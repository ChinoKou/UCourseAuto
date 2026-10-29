import {
  findChapter,
  findCourse,
  findSection,
  findTextbook,
  type CoursewareTarget,
} from "@/logic/courseware/tree";
import type { ModelCourse } from "@/schema/domain/course";

/**
 * 课件删除目标的页面范围: 按原始课件树统计, 与搜索、完成状态与题型筛选无关。
 * 删除确认数量与实际删除范围因此始终一致。
 */

/** 收集目标子树内的页面 ID, 页面目标返回自身 */
export const pageIdsForTarget = (
  courses: ReadonlyArray<ModelCourse>,
  target: CoursewareTarget,
): number[] => {
  if (target.kind === "page") {
    return [target.pageId];
  }
  const course = findCourse(courses, target.courseId);
  if (course === null) {
    throw new Error(`课程不存在: ${target.courseId}`);
  }
  if (target.kind === "course") {
    return course.textbooks
      .flatMap((textbook) => textbook.chapters)
      .flatMap((chapter) => chapter.sections)
      .flatMap((section) => section.pages.map((page) => page.page_id));
  }
  const textbook = findTextbook(course, target.textbookId);
  if (textbook === null) {
    throw new Error(`教材不存在: ${target.textbookId}`);
  }
  if (target.kind === "textbook") {
    return textbook.chapters
      .flatMap((chapter) => chapter.sections)
      .flatMap((section) => section.pages.map((page) => page.page_id));
  }
  const chapter = findChapter(textbook, target.chapterId);
  if (chapter === null) {
    throw new Error(`章不存在: ${target.chapterId}`);
  }
  if (target.kind === "chapter") {
    return chapter.sections.flatMap((section) =>
      section.pages.map((page) => page.page_id),
    );
  }
  const section = findSection(chapter, target.sectionId);
  if (section === null) {
    throw new Error(`节不存在: ${target.sectionId}`);
  }
  return section.pages.map((page) => page.page_id);
};

/** 统计目标子树内的页面数量 */
export const countPagesForTarget = (
  courses: ReadonlyArray<ModelCourse>,
  target: CoursewareTarget,
): number => pageIdsForTarget(courses, target).length;
