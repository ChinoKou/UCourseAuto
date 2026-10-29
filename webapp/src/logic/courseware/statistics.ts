import type { ModelCourse } from "@/schema/domain/course";

/** 单门课程的统计。 */
export interface CourseSummary {
  course_id: number;
  course_name: string;
  textbookCount: number;
  sectionCount: number;
  pageCount: number;
  completedPages: number;
  /** 0 到 100 */
  percent: number;
}

/** 整棵课件树的统计。 */
export interface CoursewareSummary {
  courseCount: number;
  textbookCount: number;
  chapterCount: number;
  sectionCount: number;
  pageCount: number;
  completedPages: number;
  remainingPages: number;
  /** 0 到 100 */
  percent: number;
  courses: CourseSummary[];
}

/** 计算百分比, 总数为 0 时返回 0 */
const percentOf = (completed: number, total: number): number =>
  total === 0 ? 0 : Math.round((completed / total) * 100);

/**
 * 汇总课件树各层数量与完成情况:
 * 若传入 selectedPageIds, 仅将命中的页面计入总量与完成量, 各级容器按是否包含勾选页面统计。
 */
export const summarizeCourseware = (
  courses: ReadonlyArray<ModelCourse>,
  selectedPageIds?: ReadonlySet<number>,
): CoursewareSummary => {
  let textbookCount = 0;
  let chapterCount = 0;
  let sectionCount = 0;
  let pageCount = 0;
  let completedPages = 0;
  let effectiveCourseCount = 0;
  const courseSummaries: CourseSummary[] = [];

  for (const course of courses) {
    let courseTextbooks = 0;
    let courseSections = 0;
    let coursePages = 0;
    let courseCompleted = 0;

    for (const textbook of course.textbooks) {
      let textbookChapters = 0;
      for (const chapter of textbook.chapters) {
        let chapterSections = 0;
        for (const section of chapter.sections) {
          const matchedPages = selectedPageIds !== undefined
            ? section.pages.filter((p) => selectedPageIds.has(p.page_id))
            : section.pages;

          if (matchedPages.length === 0) {
            continue;
          }
          chapterSections += 1;
          sectionCount += 1;
          courseSections += 1;

          for (const page of matchedPages) {
            pageCount += 1;
            coursePages += 1;
            if (page.is_complete) {
              completedPages += 1;
              courseCompleted += 1;
            }
          }
        }
        if (chapterSections > 0) {
          chapterCount += 1;
          textbookChapters += 1;
        }
      }
      if (textbookChapters > 0) {
        textbookCount += 1;
        courseTextbooks += 1;
      }
    }

    if (coursePages > 0 || (selectedPageIds === undefined && course.textbooks.length > 0)) {
      effectiveCourseCount += 1;
    }

    courseSummaries.push({
      course_id: course.course_id,
      course_name: course.course_name,
      textbookCount: courseTextbooks,
      sectionCount: courseSections,
      pageCount: coursePages,
      completedPages: courseCompleted,
      percent: percentOf(courseCompleted, coursePages),
    });
  }

  const remainingPages = Math.max(0, pageCount - completedPages);

  return {
    courseCount: selectedPageIds !== undefined ? effectiveCourseCount : courses.length,
    textbookCount,
    chapterCount,
    sectionCount,
    pageCount,
    completedPages,
    remainingPages,
    percent: percentOf(completedPages, pageCount),
    courses: courseSummaries,
  };
};
