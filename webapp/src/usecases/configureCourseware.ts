import type { AppErrorDetail } from "@/error/report";
import { reportWarning } from "@/error/report";
import { assembleChapterContent, assembleTextbookDirectory, fillQuestionAnswers } from "@/logic/courseware/assemble";
import { cloneCourses, pruneCourses } from "@/logic/courseware/tree";
import { applySectionStudyRecord } from "@/logic/studyRecord/applyRecord";
import type { ModelCourse } from "@/schema/domain/course";
import type { CoursewareSection } from "@/schema/domain/courseware";
import type { ConfigProgress } from "@/schema/domain/progress";
import type { Site } from "@/schema/domain/site";
import type { StudentCourse } from "@/schema/protocol/courseList";
import type { CourseTextbook } from "@/schema/protocol/textbookList";
import {
  describeFailure,
  errorFromFailure,
  errorFromMessage,
  failed,
  type ConfigurePorts,
  type ErrorTargetInfo,
  type OperationResult,
} from "@/usecases/ports";

/**
 * 课件配置向导的三个业务动作: 列出课程、列出教材、组装课件树。
 * 目录、章内容与答案的失败都会中止本次配置; 配置失败时不写入状态, 已有课件保持原样。
 */

export type CourseTextbookGroup = {
  course: StudentCourse;
  textbooks: CourseTextbook[];
};

/** 课程列表: 失败中止配置向导的第一步 */
export async function listAvailableCourses(
  ports: ConfigurePorts,
  site: Site,
  token: string,
): Promise<OperationResult<StudentCourse[]>> {
  const result = await ports.fetchStudentCourses(site, token);
  if (!result.ok) {
    return failed(errorFromFailure("课程列表获取失败", result.failure));
  }
  return { status: "success", data: result.data.courseList };
}

/** 教材列表: 单门课程失败时提示并跳过, 其余课程继续; 全部没有教材时给出提示 */
export async function listCourseTextbooks(
  ports: ConfigurePorts,
  site: Site,
  token: string,
  courses: StudentCourse[],
): Promise<OperationResult<CourseTextbookGroup[]>> {
  const groups: CourseTextbookGroup[] = [];
  for (const course of courses) {
    const result = await ports.fetchCourseTextbooks(site, token, course.id);
    if (!result.ok) {
      reportWarning("教材列表获取失败", `${course.name}: ${describeFailure(result.failure)}`);
      continue;
    }
    groups.push({ course, textbooks: result.data.textbooks });
  }
  if (groups.every((group) => group.textbooks.length === 0)) {
    return failed(errorFromMessage("没有可配置的教材", "这些课程暂时没有可配置的教材。"));
  }
  return { status: "success", data: groups };
}

export interface ConfigureOptions {
  /** 指定跳过的教材 ID 集合 */
  skippedTextbookIds?: ReadonlySet<number>;
  /** 指定跳过的章节 ID 集合 */
  skippedChapterIds?: ReadonlySet<number>;
}

/**
 * 组装课件树: 先按选中项建骨架, 再逐课程取目录、逐教材取章内容、逐章取学习记录、
 * 逐题取答案, 最后剔除空容器。支持跳过指定教材与章节。
 */
export async function configureCourseware(
  ports: ConfigurePorts,
  site: Site,
  token: string,
  selection: CourseTextbookGroup[],
  options?: ConfigureOptions,
): Promise<OperationResult<ModelCourse[]>> {
  const skippedTextbookIds = options?.skippedTextbookIds ?? new Set<number>();
  const skippedChapterIds = options?.skippedChapterIds ?? new Set<number>();

  const courses: ModelCourse[] = selection.map(({ course, textbooks }) => ({
    course_id: course.id,
    course_name: course.name,
    class_id: course.classId,
    class_user_id: course.classUserId,
    teacher_name: course.teacherName,
    class_name: course.className,
    textbooks: textbooks
      .filter((textbook) => !skippedTextbookIds.has(textbook.courseId))
      .map((textbook) => ({
        textbook_id: textbook.courseId,
        textbook_name: textbook.name,
        status: textbook.status,
        limit: textbook.limit,
        chapters: [],
      })),
  }));

  const progress: ConfigProgress = {
    courseName: "",
    textbookName: "",
    chapterName: "",
    courseIndex: 0,
    courseTotal: courses.length,
    textbookIndex: 0,
    textbookTotal: 0,
    chapterIndex: 0,
    chapterTotal: 0,
  };
  const emitProgress = (snap = true): void => {
    ports.observer.onConfigProgress(
      { ...progress },
      snap ? cloneCourses(courses) : undefined,
    );
  };
  emitProgress();

  for (const [courseIndex, course] of courses.entries()) {
    Object.assign(progress, {
      courseName: course.course_name,
      courseIndex: courseIndex + 1,
      courseId: course.course_id,
      textbookId: undefined,
      textbookName: "",
      textbookIndex: 0,
      textbookTotal: 0,
      chapterId: undefined,
      chapterName: "",
      chapterIndex: 0,
      chapterTotal: 0,
      sectionId: undefined,
      sectionName: undefined,
      sectionIndex: undefined,
      sectionTotal: undefined,
      phase: "directory",
    });
    emitProgress();

    const directories = await Promise.all(
      course.textbooks.map((textbook) =>
        ports.fetchTextbookDirectory(site, token, textbook.textbook_id, course.class_id),
      ),
    );
    for (const [textbookIndex, result] of directories.entries()) {
      const textbook = course.textbooks[textbookIndex];
      if (!result.ok) {
        return failed(errorFromFailure(
          "教材目录获取失败", result.failure, `获取教材「${textbook.textbook_name}」的目录失败。`,
          { targetKey: `t-${course.course_id}-${textbook.textbook_id}`, targetName: textbook.textbook_name, targetKind: "textbook", targetId: textbook.textbook_id },
        ));
      }
      assembleTextbookDirectory(course, textbook.textbook_id, result.data);
    }
    // 目录解析完毕后同步快照
    emitProgress();

    for (const [textbookIndex, textbook] of course.textbooks.entries()) {
      Object.assign(progress, {
        textbookName: textbook.textbook_name,
        textbookIndex: textbookIndex + 1,
        textbookTotal: course.textbooks.length,
        textbookId: textbook.textbook_id,
        chapterId: undefined,
        chapterName: "",
        chapterIndex: 0,
        chapterTotal: textbook.chapters.length,
        sectionId: undefined,
        sectionName: undefined,
        sectionIndex: undefined,
        sectionTotal: undefined,
        phase: "content",
      });
      emitProgress();

      // 剔除用户指定跳过的章节
      const activeChapters = textbook.chapters.filter(
        (ch) => !skippedChapterIds.has(ch.chapter_id),
      );

      const contents = await Promise.all(
        activeChapters.map((chapter) =>
          ports.fetchChapterContent(site, token, chapter.chapter_id),
        ),
      );
      for (const [chapterIndex, result] of contents.entries()) {
        const chapter = activeChapters[chapterIndex];
        if (!result.ok) {
          return failed(errorFromFailure(
            "章内容获取失败", result.failure, `获取章节「${chapter.chapter_name}」的内容失败。`,
            { targetKey: `ch-${chapter.chapter_id}`, targetName: chapter.chapter_name, targetKind: "chapter", targetId: chapter.chapter_id },
          ));
        }
        assembleChapterContent(course, textbook.textbook_id, result.data);
      }
      // 章内容解析完毕后同步快照
      emitProgress();

      for (const [chapterIndex, chapter] of activeChapters.entries()) {
        progress.chapterName = chapter.chapter_name;
        progress.chapterIndex = chapterIndex + 1;
        progress.chapterId = chapter.chapter_id;
        progress.phase = "record";
        emitProgress();

        const records = await Promise.all(
          chapter.sections.map((section) =>
            ports.fetchSectionStudyRecord(site, token, section.section_id),
          ),
        );

        progress.sectionTotal = chapter.sections.length;
        for (const [sectionIndex, section] of chapter.sections.entries()) {
          progress.sectionName = section.section_name;
          progress.sectionIndex = sectionIndex + 1;
          progress.sectionId = section.section_id;
          progress.phase = "answers";
          emitProgress();

          const answerError = await fillSectionAnswers(
            ports,
            site,
            token,
            section,
            chapter,
          );
          if (answerError !== null) {
            return failed(answerError);
          }
          const recordResult = records[sectionIndex];
          if (recordResult.ok && recordResult.data.studied) {
            applySectionStudyRecord(course, textbook.textbook_id, recordResult.data.record);
          }
          emitProgress();
        }
        progress.sectionId = undefined;
        progress.sectionName = undefined;
        progress.sectionIndex = undefined;
        progress.sectionTotal = undefined;
      }
    }
  }

  // 最终组装交付前剔除被跳过的章节
  for (const course of courses) {
    for (const textbook of course.textbooks) {
      textbook.chapters = textbook.chapters.filter(
        (ch) => !skippedChapterIds.has(ch.chapter_id),
      );
    }
  }

  return { status: "success", data: pruneCourses(courses) };
}

/** 题目页逐题拉取答案并写入页面, 任一题失败返回错误详情 */
const fillSectionAnswers = async (
  ports: ConfigurePorts,
  site: Site,
  token: string,
  section: CoursewareSection,
  chapter?: { chapter_id: number; chapter_name: string },
): Promise<AppErrorDetail | null> => {
  for (const page of section.pages) {
    if (page.page_content_type !== 7) {
      continue;
    }
    const answers = new Map<number, string[]>();
    for (const element of page.elements) {
      if (element.kind !== "question") {
        continue;
      }
      for (const question of element.questions) {
        const result = await ports.fetchQuestionAnswers(site, token, question.question_id, page.page_id);
        if (!result.ok) {
          const target: ErrorTargetInfo | undefined = chapter === undefined
            ? undefined
            : {
                targetKey: `ch-${chapter.chapter_id}`,
                targetName: chapter.chapter_name,
                targetKind: "chapter",
                targetId: chapter.chapter_id,
              };
          return errorFromFailure("题目答案获取失败", result.failure, `题目 ${question.question_id} 的答案获取失败。`, target);
        }
        answers.set(question.question_id, result.data.correctAnswerList);
      }
    }
    fillQuestionAnswers(page, answers);
  }
  return null;
};
