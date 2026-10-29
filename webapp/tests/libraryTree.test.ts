import { describe, expect, it } from "vitest";

import type { ModelCourse } from "@/schema/domain/course";
import { createRunProgress, type RunProgress } from "@/schema/domain/progress";
import { buildLibraryTree } from "@/ui/dashboard/libraryTree";

const page = (pageId: number, complete: boolean) => ({
  page_id: pageId,
  page_relation_id: pageId,
  page_name: `页面 ${pageId}`,
  page_content_type: 5,
  is_complete: complete,
  elements: [],
});

/** 四个页面的完成情况由入参给出: 第一节两页在前, 第二节两页在后 */
const course = (completePageIds: ReadonlyArray<number>): ModelCourse => ({
  course_id: 1,
  course_name: "课程一",
  class_id: 1,
  class_user_id: 1,
  textbooks: [
    {
      textbook_id: 10,
      textbook_name: "教材一",
      status: 1,
      limit: 0,
      chapters: [
        {
          chapter_id: 100,
          chapter_name: "第一章",
          sections: [
            {
              section_id: 1000,
              section_name: "第一节",
              pages: [
                page(1, completePageIds.includes(1)),
                page(2, completePageIds.includes(2)),
              ],
            },
            {
              section_id: 2000,
              section_name: "第二节",
              pages: [
                page(3, completePageIds.includes(3)),
                page(4, completePageIds.includes(4)),
              ],
            },
          ],
        },
      ],
    },
  ],
});

const progressAt = (sectionIndex: number, pageIndex: number): RunProgress => {
  const progress = createRunProgress(1);
  progress.courseIndex = 1;
  progress.textbookIndex = 1;
  progress.textbookTotal = 1;
  progress.chapterIndex = 1;
  progress.chapterTotal = 1;
  progress.sectionIndex = sectionIndex;
  progress.sectionTotal = 2;
  progress.pageIndex = pageIndex;
  progress.pageTotal = 2;
  return progress;
};

describe("buildLibraryTree", () => {
  it("默认收起未开始节点，只展开当前路径", () => {
    const tree = buildLibraryTree([course([])], progressAt(1, 1), new Set());

    expect(tree.rows.map((row) => row.id)).toEqual([
      "c1",
      "c1-t10",
      "c1-t10-h100",
      "c1-t10-h100-s1000",
      "c1-t10-h100-s1000-p1",
      "c1-t10-h100-s1000-p2",
      "c1-t10-h100-s2000",
    ]);
    expect(tree.currentRowIndex).toBe(4);
    expect(tree.rows[4]?.state).toBe("current");
  });

  it("已完成的节点在处于当前路径时依然自动展开以呈现当前执行位置", () => {
    const tree = buildLibraryTree([course([1, 2])], progressAt(1, 2), new Set());

    expect(tree.rows.map((row) => row.id)).toEqual([
      "c1",
      "c1-t10",
      "c1-t10-h100",
      "c1-t10-h100-s1000",
      "c1-t10-h100-s1000-p1",
      "c1-t10-h100-s1000-p2",
      "c1-t10-h100-s2000",
    ]);
    expect(tree.rows[3]?.expanded).toBe(true);
    expect(tree.rows[3]?.percent).toBe(100);
    expect(tree.currentRowIndex).toBe(5);
  });

  it("刷课推进至下一节时上一节自动折叠当前节自动展开", () => {
    const tree = buildLibraryTree([course([1, 2, 3, 4])], progressAt(2, 1), new Set());

    expect(tree.rows.map((row) => row.id)).toEqual([
      "c1",
      "c1-t10",
      "c1-t10-h100",
      "c1-t10-h100-s1000",
      "c1-t10-h100-s2000",
      "c1-t10-h100-s2000-p3",
      "c1-t10-h100-s2000-p4",
    ]);
    expect(tree.rows[3]?.expanded).toBe(false);
    expect(tree.rows[4]?.expanded).toBe(true);
    expect(tree.currentRowIndex).toBe(5);
  });

  it("已完成的节点手动点击展开时允许展开查阅", () => {
    const tree = buildLibraryTree(
      [course([1, 2, 3, 4])],
      createRunProgress(0),
      new Set(["c1"]),
    );

    expect(tree.rows.map((row) => row.id)).toEqual(["c1", "c1-t10"]);
    expect(tree.rows[0]?.expanded).toBe(true);
    expect(tree.rows[1]?.expanded).toBe(false);
  });

  it("手动展开未开始的节点时保留展开状态", () => {
    const tree = buildLibraryTree(
      [course([])],
      createRunProgress(1),
      new Set(["c1"]),
    );

    expect(tree.rows.map((row) => row.id)).toEqual(["c1", "c1-t10"]);
    expect(tree.rows[0]?.expanded).toBe(true);
    expect(tree.rows[1]?.expanded).toBe(false);
  });

  it("统计各层级的页面标识与勾选计数", () => {
    const selected = new Set([1, 4]);
    const tree = buildLibraryTree(
      [course([])],
      progressAt(1, 1),
      new Set(),
      selected,
    );

    const courseRow = tree.rows[0];
    expect(courseRow?.pageIds).toEqual([1, 2, 3, 4]);
    expect(courseRow?.totalPages).toBe(4);
    expect(courseRow?.selectedCount).toBe(2);

    const sectionRow1 = tree.rows[3];
    expect(sectionRow1?.pageIds).toEqual([1, 2]);
    expect(sectionRow1?.totalPages).toBe(2);
    expect(sectionRow1?.selectedCount).toBe(1);

    const pageRow1 = tree.rows[4];
    expect(pageRow1?.pageIds).toEqual([1]);
    expect(pageRow1?.totalPages).toBe(1);
    expect(pageRow1?.selectedCount).toBe(1);

    const pageRow2 = tree.rows[5];
    expect(pageRow2?.pageIds).toEqual([2]);
    expect(pageRow2?.totalPages).toBe(1);
    expect(pageRow2?.selectedCount).toBe(0);
  });
});
