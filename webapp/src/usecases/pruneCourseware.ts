import type { AppErrorDetail } from "@/error/report";
import { pruneCourses } from "@/logic/courseware/tree";
import { applySectionStudyRecord } from "@/logic/studyRecord/applyRecord";
import type { ModelCourse } from "@/schema/domain/course";
import type { Site } from "@/schema/domain/site";
import { errorFromFailure, type PrunePorts } from "@/usecases/ports";

/**
 * 同步课件完成状态: 逐教材逐章刷新节学习记录, 单节失败时继续处理其余节,
 * 完成状态同步写回页面对象, 不自动删除已完成课件。
 * 就地改写传入的课件树, 调用方持有自己的工作副本; 写回由 replaceCourseware 复制。
 */

/** 同步结果: 课件树与失败统计 */
export interface PruneOutcome {
  courses: ModelCourse[];
  /** 本次请求的节总数 */
  totalSections: number;
  /** 请求失败的节数 */
  failedSections: number;
  /** 首个失败详情, 全部成功时为 null */
  firstFailure: AppErrorDetail | null;
}

export async function pruneCourseware(
  ports: PrunePorts,
  site: Site,
  token: string,
  courses: ModelCourse[],
): Promise<PruneOutcome> {
  if (courses.length === 0) {
    return { courses, totalSections: 0, failedSections: 0, firstFailure: null };
  }

  let totalSections = 0;
  let failedSections = 0;
  let firstFailure: AppErrorDetail | null = null;

  for (const course of courses) {
    for (const textbook of course.textbooks) {
      for (const chapter of textbook.chapters) {
        const records = await Promise.all(
          chapter.sections.map((section) =>
            ports.fetchSectionStudyRecord(site, token, section.section_id),
          ),
        );
        totalSections += chapter.sections.length;
        for (const result of records) {
          if (!result.ok) {
            failedSections += 1;
            if (firstFailure === null) {
              firstFailure = errorFromFailure(
                "学习记录获取失败",
                result.failure,
                `章节「${chapter.chapter_name}」的学习记录没有取到。`,
              );
            }
            continue;
          }
          if (!result.data.studied) {
            continue;
          }
          applySectionStudyRecord(course, textbook.textbook_id, result.data.record);
        }
      }
    }
  }

  return {
    courses: pruneCourses(courses, false),
    totalSections,
    failedSections,
    firstFailure,
  };
}
