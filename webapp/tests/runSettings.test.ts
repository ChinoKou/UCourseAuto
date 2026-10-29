import { describe, expect, it } from "vitest";

import { summarizeCourseware } from "@/logic/courseware/statistics";
import type { ModelCourse } from "@/schema/domain/course";

const samplePage = (pageId: number, complete: boolean) => ({
  page_id: pageId,
  page_relation_id: pageId,
  page_name: `页面 ${pageId}`,
  page_content_type: 5,
  is_complete: complete,
  elements: [],
});

const sampleCourse = (completePageIds: ReadonlyArray<number>): ModelCourse => ({
  course_id: 11,
  course_name: "测试课程",
  class_id: 22,
  class_user_id: 33,
  textbooks: [
    {
      textbook_id: 101,
      textbook_name: "测试教材",
      status: 1,
      limit: 0,
      chapters: [
        {
          chapter_id: 201,
          chapter_name: "测试章节",
          sections: [
            {
              section_id: 301,
              section_name: "测试小节",
              pages: [
                samplePage(1, completePageIds.includes(1)),
                samplePage(2, completePageIds.includes(2)),
                samplePage(3, completePageIds.includes(3)),
              ],
            },
          ],
        },
      ],
    },
  ],
});

describe("刷课卡片统计与就绪计算", () => {
  it("无课件时统计各项指标归零", () => {
    const summary = summarizeCourseware([]);
    expect(summary.pageCount).toBe(0);
    expect(summary.completedPages).toBe(0);
    expect(summary.remainingPages).toBe(0);
    expect(summary.percent).toBe(0);
    expect(summary.sectionCount).toBe(0);
  });

  it("部分完成时准确计算待刷页面与百分比", () => {
    const summary = summarizeCourseware([sampleCourse([1])]);
    expect(summary.pageCount).toBe(3);
    expect(summary.completedPages).toBe(1);
    expect(summary.remainingPages).toBe(2);
    expect(summary.percent).toBe(33);
    expect(summary.sectionCount).toBe(1);
  });

  it("全部完成时剩余待完成页面为 0 且百分比为 100", () => {
    const summary = summarizeCourseware([sampleCourse([1, 2, 3])]);
    expect(summary.pageCount).toBe(3);
    expect(summary.completedPages).toBe(3);
    expect(summary.remainingPages).toBe(0);
    expect(summary.percent).toBe(100);
  });

  it("传入勾选页面集合时, 总量与完成度严格按勾选范围计算", () => {
    // 课件库共 3 页，其中页面 1 已完成
    const courses = [sampleCourse([1])];

    // 用户只勾选了页面 1
    const selectedJustCompleted = summarizeCourseware(courses, new Set([1]));
    expect(selectedJustCompleted.pageCount).toBe(1);
    expect(selectedJustCompleted.completedPages).toBe(1);
    expect(selectedJustCompleted.remainingPages).toBe(0);
    expect(selectedJustCompleted.percent).toBe(100);

    // 用户勾选了页面 2 和 3 (均未完成)
    const selectedIncomplete = summarizeCourseware(courses, new Set([2, 3]));
    expect(selectedIncomplete.pageCount).toBe(2);
    expect(selectedIncomplete.completedPages).toBe(0);
    expect(selectedIncomplete.remainingPages).toBe(2);
    expect(selectedIncomplete.percent).toBe(0);
  });
});
