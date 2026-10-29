import type { AppErrorDetail } from "@/error/report";
import { reportWarning } from "@/error/report";
import {
  sectionKeyOf,
  summarizeSectionFailures,
  type SectionFailureCause,
} from "@/logic/courseware/sectionOutcome";
import { buildSyncStudyRecordRequest, isReportablePage, type StudyPhase } from "@/logic/studyRecord/buildRequest";
import { createRunProgress } from "@/schema/domain/progress";
import type { ModelCourse, ModelTextbook } from "@/schema/domain/course";
import type { CoursewareSection } from "@/schema/domain/courseware";
import {
  describeFailure,
  errorFromFailure,
  type RunCoursewareInput,
  type RunPorts,
} from "@/usecases/ports";

/**
 * 刷课执行: 取当前用户姓名后逐课程逐教材逐章逐节处理。
 * 反刷课检测开启时, 每个教材先以零时长段上报, 触发平台检测后再上报真实时长。
 * 停止检查点位于每节开始前、每个页面处理前与每次重试等待前。
 *
 * input.courses 是调用方提供的工作树, 执行过程中就地标记完成并剔除空容器;
 * 写回经 ports.persist 交给写回方, 写回方复制后接管, 工作树始终保持可写。
 */

/** 单个节的上报结局 */
export type RunOutcome =
  | {
      status: "completed";
      courses: ModelCourse[];
      skippedSections: number;
      failedUploads: number;
    }
  | { status: "stopped" }
  | { status: "failed"; error: AppErrorDetail };

/** 节最终失败的环节: 初始化失败或上报失败 */
export type { SectionFailureCause };

/** 单次运行内的计数器 */
interface RunCounter {
  stopped: boolean;
  failedSections: Map<string, SectionFailureCause>;
}

/** 单个节的上报结局 */
type UploadOutcome = "success" | "failed" | "stopped";

export async function runCourseware(
  ports: RunPorts,
  input: RunCoursewareInput,
): Promise<RunOutcome> {
  if (input.courses.length === 0) {
    return { status: "completed", courses: [], skippedSections: 0, failedUploads: 0 };
  }

  const userResult = await ports.fetchCurrentUser(input.site, input.token);
  if (!userResult.ok) {
    return { status: "failed", error: errorFromFailure("获取用户信息失败", userResult.failure) };
  }
  const userName = userResult.data.name;

  const progress = createRunProgress(input.courses.length);
  const report = (): void => {
    ports.observer.onRunProgress({ ...progress });
  };
  const counter: RunCounter = { stopped: false, failedSections: new Map() };
  const selectedSet = input.selectedPageIds;
  const isPageSelected = (pageId: number): boolean =>
    selectedSet === undefined || selectedSet.has(pageId);

  const checkStop = (): boolean => {
    if (!counter.stopped && ports.stop.requested()) {
      counter.stopped = true;
    }
    return counter.stopped;
  };

  const uploadSection = async (
    section: CoursewareSection,
    studyStartTime: number,
    phase: StudyPhase,
  ): Promise<UploadOutcome> => {
    for (let retry = 0; ; retry += 1) {
      // 每次尝试重新构造上报体, 随机值随之重新生成
      const request = buildSyncStudyRecordRequest(
        section,
        studyStartTime,
        userName,
        input.studyTime,
        phase,
        { randint: ports.randint, uniform: ports.uniform, now: ports.now },
      );
      const synced = await ports.syncStudyRecord(input.site, input.token, request);

      if (synced.ok) {
        return "success";
      }
      if (checkStop()) {
        return "stopped";
      }
      // 累计 3 次重试(共 4 次尝试)后跳过该节
      if (retry >= 3) {
        return "failed";
      }
      await ports.sleep(1);
    }
  };

  const runTextbook = async (
    course: ModelCourse,
    textbook: ModelTextbook,
    phase: StudyPhase,
  ): Promise<void> => {
    for (const [chapterIndex, chapter] of textbook.chapters.entries()) {
      progress.chapterName = chapter.chapter_name;
      progress.chapterIndex = chapterIndex + 1;
      progress.chapterTotal = textbook.chapters.length;
      progress.sectionIndex = 0;

      for (const [sectionIndex, section] of chapter.sections.entries()) {
        const reportablePages = section.pages
          .filter((page) => isPageSelected(page.page_id))
          .filter(isReportablePage);
        if (reportablePages.length === 0) {
          continue;
        }

        // 检查点: 每节开始前
        if (checkStop()) {
          return;
        }

        progress.sectionName = section.section_name;
        progress.sectionIndex = sectionIndex + 1;
        progress.sectionTotal = chapter.sections.length;
        progress.pageName = "";
        progress.pageIndex = 0;
        progress.pageTotal = reportablePages.length;
        report();

        const sectionKey = sectionKeyOf(
          course.course_id,
          textbook.textbook_id,
          section.section_id,
        );

        const initialized = await ports.initializeSectionRecord(
          input.site,
          input.token,
          section.section_id,
        );
        // 初始化失败或返回 0 都按该节不可上报处理
        if (!initialized.ok || initialized.data === 0) {
          if (phase === "realDuration") {
            counter.failedSections.set(sectionKey, "initialize");
          }
          continue;
        }

        if (phase === "realDuration") {
          for (const [pageIndex, page] of reportablePages.entries()) {
            // 检查点: 每页处理前
            if (checkStop()) {
              return;
            }

            progress.pageName = page.page_name;
            progress.pageIndex = pageIndex + 1;
            report();

            if (page.page_content_type !== 6) {
              continue;
            }

            const videoElements = page.elements.filter((element) => element.kind === "video");
            const videoResults = await Promise.all(
              videoElements.map(async (element) => ({
                videoId: element.video_id,
                result: await ports.reportVideoBehavior(
                  input.site,
                  input.token,
                  course.class_id,
                  textbook.textbook_id,
                  chapter.chapter_id,
                  element.video_id,
                ),
              })),
            );
            const failedVideoIds = videoResults
              .filter((item) => !item.result.ok)
              .map((item) => item.videoId);
            if (failedVideoIds.length > 0) {
              reportWarning(
                "视频观看行为没有记录",
                `${failedVideoIds.length} 个视频的观看行为上报失败: ${failedVideoIds.join("、")}。学习记录仍会照常上报。`,
              );
            }

            // 视频元素间隔 0.3 秒
            for (const element of videoElements) {
              void element;
              await ports.sleep(0.3);
            }
          }
        }

        const uploaded = await uploadSection(
          { ...section, pages: reportablePages },
          initialized.data,
          phase,
        );
        if (uploaded === "stopped") {
          return;
        }

        if (phase === "realDuration") {
          if (uploaded === "success") {
            // 真实时长段上报成功: 标记可上报页面完成并立即写回完整树
            for (const page of reportablePages) {
              page.is_complete = true;
            }
            counter.failedSections.delete(sectionKey);
            progress.completedSections += 1;
            ports.persist(input.courses);
            report();
          } else {
            counter.failedSections.set(sectionKey, "upload");
          }
        }

        // 节间冷却(仅真实时长段)
        if (phase === "realDuration") {
          await ports.sleep(input.sectionCooldown);
        }
      }
    }
  };

  for (const [courseIndex, course] of input.courses.entries()) {
    progress.courseName = course.course_name;
    progress.courseIndex = courseIndex + 1;

    for (const [textbookIndex, textbook] of course.textbooks.entries()) {
      progress.textbookName = textbook.textbook_name;
      progress.textbookIndex = textbookIndex + 1;
      progress.textbookTotal = course.textbooks.length;
      progress.chapterIndex = 0;
      report();

      if (input.antiDetection) {
        // 第一段以零时长上报, 短路平台的刷课检测
        ports.observer.onAntiDetectionStage("zeroDuration");
        await runTextbook(course, textbook, "zeroDuration");
        if (counter.stopped) {
          return { status: "stopped" };
        }

        // 调用检测接口触发平台的刷课检测
        ports.observer.onAntiDetectionStage("trigger");
        const detection = await ports.triggerTextbookDetection(
          input.site,
          input.token,
          course.course_id,
          textbook.textbook_id,
        );
        // 检测失败只提示, 真实时长段照常进行
        if (!detection.ok) {
          reportWarning("平台检测没有通过", describeFailure(detection.failure));
        }
        ports.observer.onAntiDetectionStage("realDuration");
      }

      // 上报真实学习时长
      await runTextbook(course, textbook, "realDuration");
      if (counter.stopped) {
        return { status: "stopped" };
      }
    }
  }

  // 运行结束直接写回包含最新完成状态的课件树, 不执行物理删除
  ports.persist(input.courses);

  return {
    status: "completed",
    courses: input.courses,
    ...summarizeSectionFailures(counter.failedSections),
  };
}
