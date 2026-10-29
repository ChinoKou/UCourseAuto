import { describe, expect, it } from "vitest";
import {
  collectPageIds,
  mergeCourses,
  pruneChapter,
  pruneCourse,
  pruneCourses,
  pruneSection,
  pruneTextbook,
  removeCourseware,
  removePageIds,
} from "@/logic/courseware/tree";
import type { ModelCourse } from "@/schema/domain/course";
import type {
  CoursewareChapter,
  CoursewarePage,
  CoursewareSection,
} from "@/schema/domain/courseware";

const makePage = (pageId: number, isComplete: boolean): CoursewarePage => ({
  page_id: pageId,
  page_relation_id: pageId + 1000,
  page_name: `页面-${pageId}`,
  page_content_type: 5,
  is_complete: isComplete,
  elements: [],
});

const makeSection = (sectionId: number, pages: CoursewarePage[]): CoursewareSection => ({
  section_id: sectionId,
  section_name: `节-${sectionId}`,
  pages,
});

const makeChapter = (
  chapterId: number,
  sections: CoursewareSection[],
): CoursewareChapter => ({
  chapter_id: chapterId,
  chapter_name: `章-${chapterId}`,
  sections,
});

const makeCourse = (
  chaptersByTextbook: Map<number, CoursewareChapter[]>,
): ModelCourse => ({
  course_id: 301,
  course_name: "高等数学",
  class_id: 30,
  class_user_id: 3001,
  textbooks: [...chaptersByTextbook].map(([textbookId, chapters]) => ({
    textbook_id: textbookId,
    textbook_name: `教材-${textbookId}`,
    status: 1,
    limit: 2,
    chapters,
  })),
});

/** 含已完成页、未完成页与各层空容器的样本课程 */
const buildSampleCourse = (): ModelCourse =>
  makeCourse(
    new Map<number, CoursewareChapter[]>([
      [
        50101,
        [
          makeChapter(101, [
            makeSection(1011, [makePage(1, true), makePage(2, false)]),
            makeSection(1012, []),
          ]),
          makeChapter(102, []),
        ],
      ],
      [50202, []],
    ]),
  );

describe("pruneCourse(removeComplete=false)", () => {
  it("仅剔除空容器, 已完成页保留", () => {
    const course = buildSampleCourse();
    pruneCourse(course, false);

    expect(course.textbooks.map((textbook) => textbook.textbook_id)).toEqual([50101]);
    const textbook = course.textbooks[0];
    expect(textbook.chapters.map((chapter) => chapter.chapter_id)).toEqual([101]);
    const chapter = textbook.chapters[0];
    expect(chapter.sections.map((section) => section.section_id)).toEqual([1011]);
    expect(chapter.sections[0].pages.map((page) => page.page_id)).toEqual([1, 2]);
  });
});

describe("pruneCourse(removeComplete=true)", () => {
  it("先逐节剔除已完成页, 再逐层剔除空节、空章与空教材", () => {
    const course = makeCourse(
      new Map<number, CoursewareChapter[]>([
        [
          50101,
          [
            makeChapter(101, [
              makeSection(1011, [makePage(1, true), makePage(2, false)]),
              makeSection(1012, []),
            ]),
            makeChapter(103, [makeSection(1031, [makePage(3, true)])]),
          ],
        ],
        [50303, []],
      ]),
    );
    pruneCourse(course, true);

    expect(course.textbooks.map((textbook) => textbook.textbook_id)).toEqual([50101]);
    const textbook = course.textbooks[0];
    expect(textbook.chapters.map((chapter) => chapter.chapter_id)).toEqual([101]);
    const chapter = textbook.chapters[0];
    expect(chapter.sections.map((section) => section.section_id)).toEqual([1011]);
    expect(chapter.sections[0].pages.map((page) => page.page_id)).toEqual([2]);
  });

  it("全部页已完成时整棵树剔空", () => {
    const course = makeCourse(
      new Map<number, CoursewareChapter[]>([
        [
          50101,
          [makeChapter(101, [makeSection(1011, [makePage(1, true), makePage(2, true)])])],
        ],
      ]),
    );
    pruneCourse(course, true);
    expect(course.textbooks).toEqual([]);
  });
});

describe("分级 prune", () => {
  it("pruneSection 剔除节内已完成页", () => {
    const section = makeSection(1011, [makePage(1, true), makePage(2, false)]);
    pruneSection(section);
    expect(section.pages.map((page) => page.page_id)).toEqual([2]);
  });

  it("pruneChapter 默认不剔除已完成页, 仅剔除空节", () => {
    const chapter = makeChapter(101, [
      makeSection(1011, [makePage(1, true)]),
      makeSection(1012, []),
    ]);
    pruneChapter(chapter);
    expect(chapter.sections.map((section) => section.section_id)).toEqual([1011]);
    expect(chapter.sections[0].pages.map((page) => page.page_id)).toEqual([1]);
  });

  it("pruneTextbook removeComplete=true 传导到节内已完成页", () => {
    const textbook = {
      textbook_id: 50101,
      textbook_name: "教材",
      status: 1,
      limit: 2,
      chapters: [makeChapter(101, [makeSection(1011, [makePage(1, true)])]), makeChapter(102, [])],
    };
    pruneTextbook(textbook, true);
    expect(textbook.chapters).toEqual([]);
  });
});

describe("removeCourseware", () => {
  it("删除整门课程时其余课程保留", () => {
    const kept = makeCourse(new Map([[50101, [makeChapter(101, [makeSection(1011, [makePage(1, false)])])]]]));
    kept.course_id = 302;
    const courses = [buildSampleCourse(), kept];

    removeCourseware(courses, { kind: "course", courseId: 301 });
    expect(courses.map((course) => course.course_id)).toEqual([302]);
  });

  it("删除教材、章、节与页面时逐层清理空容器", () => {
    const courses = [buildSampleCourse()];

    removeCourseware(courses, { kind: "page", pageId: 2 });
    const afterPage = courses[0].textbooks[0].chapters[0].sections[0];
    expect(afterPage.pages.map((page) => page.page_id)).toEqual([1]);

    removeCourseware(courses, {
      kind: "section",
      courseId: 301,
      textbookId: 50101,
      chapterId: 101,
      sectionId: 1011,
    });
    expect(courses).toEqual([]);
  });

  it("目标缺失时抛出错误", () => {
    const courses = [buildSampleCourse()];
    expect(() => removeCourseware(courses, { kind: "course", courseId: 999 })).toThrow(
      "课程不存在: 999",
    );
    expect(() => removeCourseware(courses, { kind: "page", pageId: 999 })).toThrow(
      "页面不存在: 999",
    );
  });
});

describe("removePageIds 与 pruneCourses", () => {
  it("批量删除页面时按 id 集合过滤并剔除空容器", () => {
    const courses = [buildSampleCourse()];
    removePageIds(courses, new Set([1, 2]));
    expect(courses).toEqual([]);
  });

  it("pruneCourses 返回仅含教材的课程", () => {
    const empty = makeCourse(new Map([[50999, []]]));
    empty.course_id = 303;
    const courses = [buildSampleCourse(), empty];
    const result = pruneCourses(courses);
    expect(result.map((course) => course.course_id)).toEqual([301]);
  });
});

describe("mergeCourses 与 collectPageIds", () => {
  it("合并不同课程时直接追加", () => {
    const c1 = buildSampleCourse();
    const c2 = buildSampleCourse();
    c2.course_id = 302;
    c2.course_name = "线性代数";

    const merged = mergeCourses([c1], [c2]);
    expect(merged.map((c) => c.course_id)).toEqual([301, 302]);
  });

  it("合并同课程不同教材时合并教材列表", () => {
    const c1 = buildSampleCourse();
    const c2 = makeCourse(
      new Map([
        [
          50202,
          [makeChapter(201, [makeSection(2011, [makePage(3, false)])])],
        ],
      ]),
    );
    c2.course_id = 301;

    const merged = mergeCourses([c1], [c2]);
    expect(merged).toHaveLength(1);
    expect(merged[0].textbooks.map((t) => t.textbook_id)).toEqual([50101, 50202]);
  });

  it("collectPageIds 正确收集所有页面与未完成页面", () => {
    const c = buildSampleCourse(); // page 1: false, page 2: false
    c.textbooks[0].chapters[0].sections[0].pages[0].is_complete = true; // page 1: true

    expect(collectPageIds([c])).toEqual([1, 2]);
    expect(collectPageIds([c], true)).toEqual([2]);
  });
});
