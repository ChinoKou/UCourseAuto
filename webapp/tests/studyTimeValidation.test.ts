import { describe, expect, it } from "vitest";

import type { ModelCourse } from "@/schema/domain/course";
import type { CoursewarePage } from "@/schema/domain/courseware";
import { createDefaultConfig } from "@/storage/configStorage";
import {
  countSelectedPagesInCourses,
  resolveActiveCourseId,
  type CoursewareTarget,
} from "@/logic/courseware/tree";
import { countPagesForTarget, pageIdsForTarget } from "@/logic/courseware/target";
import { resolveRunStatus } from "@/ui/run/runStatus";
import { isRangeValid, isSleepValid } from "@/ui/run/studyTimeValidation";

const page = (pageId: number): CoursewarePage => ({
  page_id: pageId,
  page_relation_id: pageId + 1000,
  page_name: `页面-${pageId}`,
  page_content_type: 5,
  is_complete: false,
  elements: [{ kind: "content" }],
});

/** 一门课程一本教材一章两节三页 */
const courses: ModelCourse[] = [
  {
    course_id: 301,
    course_name: "课程",
    class_id: 30,
    class_user_id: 3001,
    textbooks: [
      {
        textbook_id: 50101,
        textbook_name: "教材",
        status: 1,
        limit: 2,
        chapters: [
          {
            chapter_id: 101,
            chapter_name: "章",
            sections: [
              { section_id: 1011, section_name: "节一", pages: [page(1), page(2)] },
              { section_id: 1012, section_name: "节二", pages: [page(3)] },
            ],
          },
        ],
      },
    ],
  },
];

describe("删除目标的页面计数", () => {
  it("页面目标返回 1, 节目标返回节内页面数", () => {
    expect(countPagesForTarget(courses, { kind: "page", pageId: 1 })).toBe(1);
    expect(
      countPagesForTarget(courses, {
        kind: "section",
        courseId: 301,
        textbookId: 50101,
        chapterId: 101,
        sectionId: 1011,
      }),
    ).toBe(2);
  });

  it("章、教材与课程目标按原始课件树统计全部页面", () => {
    expect(
      countPagesForTarget(courses, {
        kind: "chapter",
        courseId: 301,
        textbookId: 50101,
        chapterId: 101,
      }),
    ).toBe(3);
    expect(
      countPagesForTarget(courses, {
        kind: "textbook",
        courseId: 301,
        textbookId: 50101,
      }),
    ).toBe(3);
    expect(countPagesForTarget(courses, { kind: "course", courseId: 301 })).toBe(3);
  });

  it("筛选后只剩一页时, 删除父节点的确认数量仍是原始课件树的 3 页", () => {
    const visibleOnly = [
      {
        ...courses[0],
        textbooks: [
          {
            ...courses[0].textbooks[0],
            chapters: [
              {
                ...courses[0].textbooks[0].chapters[0],
                sections: [
                  {
                    ...courses[0].textbooks[0].chapters[0].sections[0],
                    pages: [courses[0].textbooks[0].chapters[0].sections[0].pages[0]],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
    const target: CoursewareTarget = {
      kind: "chapter",
      courseId: 301,
      textbookId: 50101,
      chapterId: 101,
    };

    expect(countPagesForTarget(visibleOnly, target)).toBe(1);
    expect(countPagesForTarget(courses, target)).toBe(3);
  });

  it("同一目标的页面 ID 列表与计数一致", () => {
    const target: CoursewareTarget = {
      kind: "chapter",
      courseId: 301,
      textbookId: 50101,
      chapterId: 101,
    };
    expect(pageIdsForTarget(courses, target)).toEqual([1, 2, 3]);
  });

  it("目标不存在时抛出", () => {
    expect(() => countPagesForTarget(courses, { kind: "course", courseId: 999 })).toThrow(
      "课程不存在: 999",
    );
  });
});

describe("勾选范围校验", () => {
  it("统计勾选页面中属于当前课件树的数量", () => {
    expect(countSelectedPagesInCourses(courses, new Set([1, 2]))).toBe(2);
    expect(countSelectedPagesInCourses(courses, new Set([1, 999]))).toBe(1);
    expect(countSelectedPagesInCourses(courses, new Set([999]))).toBe(0);
  });

  it("当前课程被删除后回到全部课件", () => {
    expect(resolveActiveCourseId(courses, 301)).toBe(301);
    expect(resolveActiveCourseId(courses, 999)).toBeNull();
    expect(resolveActiveCourseId(courses, null)).toBeNull();
  });
});

describe("运行状态标签", () => {
  it("运行中与停止中按真实阶段显示", () => {
    expect(
      resolveRunStatus({
        phase: "running",
        preparing: true,
        stopRequested: false,
        isPartial: false,
      }),
    ).toEqual({ label: "运行中", tone: "live" });
    expect(
      resolveRunStatus({
        phase: "stopping",
        preparing: true,
        stopRequested: true,
        isPartial: true,
      }),
    ).toEqual({ label: "正在停止", tone: "warning" });
  });

  it("准备中只在空闲阶段出现", () => {
    expect(
      resolveRunStatus({
        phase: "idle",
        preparing: true,
        stopRequested: false,
        isPartial: false,
      }),
    ).toEqual({ label: "准备中", tone: "default" });
    expect(
      resolveRunStatus({
        phase: "idle",
        preparing: false,
        stopRequested: false,
        isPartial: false,
      }),
    ).toEqual({ label: "随时就绪", tone: "default" });
  });

  it("结束阶段按停止标志与剩余内容区分三种结果", () => {
    expect(
      resolveRunStatus({
        phase: "finished",
        preparing: false,
        stopRequested: true,
        isPartial: true,
      }),
    ).toEqual({ label: "已安全停止", tone: "default" });
    expect(
      resolveRunStatus({
        phase: "finished",
        preparing: false,
        stopRequested: false,
        isPartial: true,
      }),
    ).toEqual({ label: "部分完成", tone: "warning" });
    expect(
      resolveRunStatus({
        phase: "finished",
        preparing: false,
        stopRequested: false,
        isPartial: false,
      }),
    ).toEqual({ label: "已全部完成", tone: "live" });
  });

  it("失败阶段显示运行中断", () => {
    expect(
      resolveRunStatus({
        phase: "error",
        preparing: false,
        stopRequested: false,
        isPartial: true,
      }),
    ).toEqual({ label: "运行中断", tone: "danger" });
  });
});

describe("学习时长参数校验", () => {  it("空值、非整数、最小值大于最大值与超过 3600 都不可用", () => {
    expect(isRangeValid({ min: "", max: "10" })).toBe(false);
    expect(isRangeValid({ min: "1.5", max: "10" })).toBe(false);
    expect(isRangeValid({ min: "20", max: "10" })).toBe(false);
    expect(isRangeValid({ min: "0", max: "3601" })).toBe(false);
  });

  it("合法区间可用, 含边界值 0 与 3600", () => {
    expect(isRangeValid({ min: "0", max: "0" })).toBe(true);
    expect(isRangeValid({ min: "180", max: "360" })).toBe(true);
    expect(isRangeValid({ min: "3600", max: "3600" })).toBe(true);
  });

  it("冷却时长在 0 到 10 秒之间可用", () => {
    expect(isSleepValid(0)).toBe(true);
    expect(isSleepValid(10)).toBe(true);
    expect(isSleepValid(-0.1)).toBe(false);
    expect(isSleepValid(10.1)).toBe(false);
    expect(isSleepValid(Number.NaN)).toBe(false);
  });

  it("默认配置的三组区间与冷却值都通过校验", () => {
    const config = createDefaultConfig();
    const drafts = {
      question: {
        min: String(config.study_time.question.min),
        max: String(config.study_time.question.max),
      },
      document: {
        min: String(config.study_time.document.min),
        max: String(config.study_time.document.max),
      },
      content: {
        min: String(config.study_time.content.min),
        max: String(config.study_time.content.max),
      },
    };
    expect(
      Object.values(drafts).every(isRangeValid) && isSleepValid(config.sleep_time),
    ).toBe(true);
  });
});
