import { cloneCourse, cloneCourses, cloneTextbook } from "@/logic/courseware/clone";
import type { ModelCourse, ModelTextbook } from "@/schema/domain/course";

export { cloneCourse, cloneCourses, cloneTextbook };
import type {
  CoursewareChapter,
  CoursewarePage,
  CoursewareSection,
} from "@/schema/domain/courseware";

/**
 * 课件树的查找、删除与清理: 五层容器一律用数组, 按 id 线性查找。
 * 删除函数在目标缺失时就地抛出, 清理函数自内向外剔除空容器。
 */

/** 可以整块删除的课件节点 */
export type CoursewareTarget =
  | { kind: "course"; courseId: number }
  | { kind: "textbook"; courseId: number; textbookId: number }
  | {
      kind: "chapter";
      courseId: number;
      textbookId: number;
      chapterId: number;
    }
  | {
      kind: "section";
      courseId: number;
      textbookId: number;
      chapterId: number;
      sectionId: number;
    }
  | { kind: "page"; pageId: number };

/** 按 id 查找课程, 未命中返回 null。 */
export const findCourse = (
  courses: ReadonlyArray<ModelCourse>,
  courseId: number,
): ModelCourse | null => courses.find((course) => course.course_id === courseId) ?? null;

/** 按 id 查找教材, 未命中返回 null。 */
export const findTextbook = (
  course: ModelCourse,
  textbookId: number,
): ModelTextbook | null =>
  course.textbooks.find((textbook) => textbook.textbook_id === textbookId) ?? null;

/** 按 id 查找章, 未命中返回 null。 */
export const findChapter = (
  textbook: ModelTextbook,
  chapterId: number,
): CoursewareChapter | null =>
  textbook.chapters.find((chapter) => chapter.chapter_id === chapterId) ?? null;

/** 按 id 查找节, 未命中返回 null。 */
export const findSection = (
  chapter: CoursewareChapter,
  sectionId: number,
): CoursewareSection | null =>
  chapter.sections.find((section) => section.section_id === sectionId) ?? null;

/** 按 id 查找页面, 未命中返回 null。 */
export const findPage = (
  section: CoursewareSection,
  pageId: number,
): CoursewarePage | null => section.pages.find((page) => page.page_id === pageId) ?? null;

/** 剔除节内已完成页。 */
export const pruneSection = (section: CoursewareSection): void => {
  section.pages = section.pages.filter((page) => !page.is_complete);
};

/** 剔除空节; removeComplete 为 true 时先剔除节内已完成页。 */
export const pruneChapter = (
  chapter: CoursewareChapter,
  removeComplete = false,
): void => {
  chapter.sections = chapter.sections.filter((section) => {
    if (removeComplete) {
      pruneSection(section);
    }
    return section.pages.length > 0;
  });
};

/** 剔除空章。 */
export const pruneTextbook = (
  textbook: ModelTextbook,
  removeComplete = false,
): void => {
  textbook.chapters = textbook.chapters.filter((chapter) => {
    pruneChapter(chapter, removeComplete);
    return chapter.sections.length > 0;
  });
};

/** 剔除空教材。 */
export const pruneCourse = (
  course: ModelCourse,
  removeComplete = false,
): void => {
  course.textbooks = course.textbooks.filter((textbook) => {
    pruneTextbook(textbook, removeComplete);
    return textbook.chapters.length > 0;
  });
};

/** 逐课程剔除空容器, 就地移除不含教材的课程 */
export const pruneCourses = (
  courses: ModelCourse[],
  removeComplete = false,
): ModelCourse[] => {
  for (const course of courses) {
    pruneCourse(course, removeComplete);
  }
  const removed = courses.filter((course) => course.textbooks.length === 0);
  for (const course of removed) {
    courses.splice(courses.indexOf(course), 1);
  }
  return courses;
};

/** 按页面 id 集合删除页面, 并逐层剔除空容器。 */
export const removePageIds = (
  courses: ModelCourse[],
  pageIds: ReadonlySet<number>,
): void => {
  for (const course of courses) {
    for (const textbook of course.textbooks) {
      for (const chapter of textbook.chapters) {
        for (const section of chapter.sections) {
          section.pages = section.pages.filter((page) => !pageIds.has(page.page_id));
        }
      }
    }
  }
  pruneCourses(courses);
};

/** 收集课件树中指定目标子树内的页面 ID, 与筛选后的显示范围无关。 */
export { countPagesForTarget, pageIdsForTarget } from "@/logic/courseware/target";

/** 删除课程、教材、章、节或页面, 目标缺失时就地抛出。 */
export const removeCourseware = (
  courses: ModelCourse[],
  target: CoursewareTarget,
): void => {
  if (target.kind === "course") {
    const course = findCourse(courses, target.courseId);
    if (course === null) {
      throw new Error(`课程不存在: ${target.courseId}`);
    }
    courses.splice(courses.indexOf(course), 1);
    pruneCourses(courses);
    return;
  }

  if (target.kind === "page") {
    let found = false;
    for (const course of courses) {
      for (const textbook of course.textbooks) {
        for (const chapter of textbook.chapters) {
          for (const section of chapter.sections) {
            const before = section.pages.length;
            section.pages = section.pages.filter((page) => page.page_id !== target.pageId);
            found = found || section.pages.length !== before;
          }
        }
      }
    }
    if (!found) {
      throw new Error(`页面不存在: ${target.pageId}`);
    }
    pruneCourses(courses);
    return;
  }

  const course = findCourse(courses, target.courseId);
  if (course === null) {
    throw new Error(`课程不存在: ${target.courseId}`);
  }

  if (target.kind === "textbook") {
    const textbook = findTextbook(course, target.textbookId);
    if (textbook === null) {
      throw new Error(`教材不存在: ${target.textbookId}`);
    }
    course.textbooks = course.textbooks.filter(
      (item) => item.textbook_id !== target.textbookId,
    );
    pruneCourses(courses);
    return;
  }

  const textbook = findTextbook(course, target.textbookId);
  if (textbook === null) {
    throw new Error(`教材不存在: ${target.textbookId}`);
  }

  if (target.kind === "chapter") {
    const chapter = findChapter(textbook, target.chapterId);
    if (chapter === null) {
      throw new Error(`章不存在: ${target.chapterId}`);
    }
    textbook.chapters = textbook.chapters.filter(
      (item) => item.chapter_id !== target.chapterId,
    );
    pruneCourses(courses);
    return;
  }

  const chapter = findChapter(textbook, target.chapterId);
  if (chapter === null) {
    throw new Error(`章不存在: ${target.chapterId}`);
  }
  const section = findSection(chapter, target.sectionId);
  if (section === null) {
    throw new Error(`节不存在: ${target.sectionId}`);
  }
  chapter.sections = chapter.sections.filter(
    (item) => item.section_id !== target.sectionId,
  );
  pruneCourses(courses);
};

/**
 * 合并新增课程到现有课程列表中:
 * - 若现有列表中不存在该课程, 直接追加;
 * - 若已存在同 course_id 课程, 合并教材列表(同教材更新覆盖章节, 其余教材保留)。
 */
export const mergeCourses = (
  existing: ReadonlyArray<ModelCourse>,
  incoming: ReadonlyArray<ModelCourse>,
): ModelCourse[] => {
  const result: ModelCourse[] = cloneCourses(existing);

  for (const newCourse of incoming) {
    const foundCourse = result.find((c) => c.course_id === newCourse.course_id);
    if (foundCourse === undefined) {
      result.push(cloneCourse(newCourse));
      continue;
    }

    foundCourse.course_name = newCourse.course_name;
    foundCourse.teacher_name = newCourse.teacher_name;
    foundCourse.class_name = newCourse.class_name;
    foundCourse.class_id = newCourse.class_id;
    foundCourse.class_user_id = newCourse.class_user_id;

    for (const newTb of newCourse.textbooks) {
      const foundTbIndex = foundCourse.textbooks.findIndex(
        (tb) => tb.textbook_id === newTb.textbook_id,
      );
      if (foundTbIndex === -1) {
        foundCourse.textbooks.push(cloneTextbook(newTb));
      } else {
        foundCourse.textbooks[foundTbIndex] = cloneTextbook(newTb);
      }
    }
  }

  return result;
};

export {
  collectPageIds,
  countSelectedPagesInCourses,
  resolveActiveCourseId,
} from "@/logic/courseware/selection";
