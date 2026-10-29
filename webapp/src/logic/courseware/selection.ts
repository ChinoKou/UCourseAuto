import type { ModelCourse } from "@/schema/domain/course";

/**
 * 课件树的页面选择统计: 按页面 ID 收集勾选范围,
 * 供首页卡片全选与启动前的选择范围校验使用。
 */

/** 遍历收集课件树中所有页面的 ID, incompleteOnly 为 true 时仅收集未完成页面 */
export const collectPageIds = (
  courses: ReadonlyArray<ModelCourse>,
  incompleteOnly = false,
): number[] => {
  const ids: number[] = [];
  for (const course of courses) {
    for (const textbook of course.textbooks) {
      for (const chapter of textbook.chapters) {
        for (const section of chapter.sections) {
          for (const page of section.pages) {
            if (!incompleteOnly || !page.is_complete) {
              ids.push(page.page_id);
            }
          }
        }
      }
    }
  }
  return ids;
};

/** 勾选页面中属于当前课件树的数量, 用于启动前校验选择范围 */
export const countSelectedPagesInCourses = (
  courses: ReadonlyArray<ModelCourse>,
  selectedPageIds: ReadonlySet<number>,
): number => {
  const available = new Set(collectPageIds(courses));
  let count = 0;
  for (const pageId of selectedPageIds) {
    if (available.has(pageId)) {
      count += 1;
    }
  }
  return count;
};

/** 当前课程: 请求的课程已被删除时回到全部课件 */
export const resolveActiveCourseId = (
  courses: ReadonlyArray<ModelCourse>,
  requestedId: number | null,
): number | null =>
  requestedId !== null && courses.some((course) => course.course_id === requestedId)
    ? requestedId
    : null;
