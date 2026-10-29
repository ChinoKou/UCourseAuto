import { describe, expect, it } from "vitest";

import type { SectionStudyRecord } from "@/apis/result";
import { pruneCourseware } from "@/usecases/pruneCourseware";
import type { PrunePorts } from "@/usecases/ports";
import { BUILTIN_SITES } from "@/schema/domain/site";
import type { StudyRecordResponse } from "@/schema/protocol/studyRecord";
import type { ModelCourse } from "@/schema/domain/course";

const SITE = BUILTIN_SITES[0];

const makeRecord = (
  chapterId: number,
  sectionId: number,
  pages: ReadonlyArray<{ pageid: number; complete: number }>,
): StudyRecordResponse => ({
  completion_status: 1,
  learner_id: 1,
  learner_name: "张三",
  relationid: sectionId,
  customized: 0,
  activity_title: "",
  item_id: sectionId,
  node_id: chapterId,
  score: 100,
  studyTime: 0,
  pageStudyRecordDTOList: pages.map(({ pageid, complete }) => ({
    pageid,
    complete,
    submitTimes: 0,
    studyTime: 0,
    answerTime: 0,
    videos: null,
    questions: null,
    coursepageId: null,
  })),
});

const page = (pageId: number, relationId: number) => ({
  page_id: pageId,
  page_relation_id: relationId,
  page_name: `页-${pageId}`,
  page_content_type: 5,
  is_complete: false,
  elements: [],
});

const buildCourses = (): ModelCourse[] => [
  {
    course_id: 301,
    course_name: "课程",
    class_id: 30,
    class_user_id: 3001,
    textbooks: [
      {
        textbook_id: 50101,
        textbook_name: "教材一",
        status: 1,
        limit: 2,
        chapters: [
          {
            chapter_id: 101,
            chapter_name: "章一",
            sections: [
              { section_id: 1011, section_name: "节一", pages: [page(1, 1001)] },
              { section_id: 1012, section_name: "节二", pages: [page(2, 1002)] },
              { section_id: 1013, section_name: "节三", pages: [page(3, 1003)] },
            ],
          },
          {
            chapter_id: 102,
            chapter_name: "章二",
            sections: [{ section_id: 1021, section_name: "节四", pages: [page(4, 1004)] }],
          },
        ],
      },
      {
        textbook_id: 50202,
        textbook_name: "教材二",
        status: 1,
        limit: 2,
        chapters: [
          {
            chapter_id: 103,
            chapter_name: "章三",
            sections: [{ section_id: 1031, section_name: "节五", pages: [page(5, 1005)] }],
          },
        ],
      },
    ],
  },
  {
    course_id: 302,
    course_name: "课程二",
    class_id: 31,
    class_user_id: 3002,
    textbooks: [
      {
        textbook_id: 50303,
        textbook_name: "教材三",
        status: 1,
        limit: 2,
        chapters: [
          {
            chapter_id: 104,
            chapter_name: "章四",
            sections: [{ section_id: 1041, section_name: "节六", pages: [page(6, 1006)] }],
          },
        ],
      },
    ],
  },
];

const recordMap = new Map<number, SectionStudyRecord>([
  // 已完成 → 剔除后节为空
  [1011, { studied: true, record: makeRecord(101, 1011, [{ pageid: 1001, complete: 1 }]) }],
  // 未学习 → 保留
  [1012, { studied: false }],
  [1013, { studied: true, record: makeRecord(101, 1013, [{ pageid: 1003, complete: 0 }]) }],
  [1021, { studied: true, record: makeRecord(102, 1021, [{ pageid: 1004, complete: 1 }]) }],
  [1031, { studied: true, record: makeRecord(103, 1031, [{ pageid: 1005, complete: 1 }]) }],
  [1041, { studied: true, record: makeRecord(104, 1041, [{ pageid: 1006, complete: 1 }]) }],
]);

const makePorts = (calls: number[]): PrunePorts => ({
  fetchSectionStudyRecord: async (_site, _token, sectionId) => {
    calls.push(sectionId);
    const entry = recordMap.get(sectionId);
    if (entry === undefined) {
      throw new Error(`缺少节 ${sectionId} 的学习记录`);
    }
    return { ok: true, data: entry };
  },
});

describe("pruneCourseware", () => {
  it("全部节成功: 更新完成状态并完整保留全部课件", async () => {
    const calls: number[] = [];
    const courses = buildCourses();

    const outcome = await pruneCourseware(makePorts(calls), SITE, "tok", courses);

    expect(calls).toEqual([1011, 1012, 1013, 1021, 1031, 1041]);
    expect(outcome.totalSections).toBe(6);
    expect(outcome.failedSections).toBe(0);
    expect(outcome.firstFailure).toBeNull();
    // 所有课程全部保留，不因完成而自动剔除
    expect(outcome.courses.map((course) => course.course_id)).toEqual([301, 302]);
    const chapter1 = outcome.courses[0].textbooks[0].chapters[0];
    expect(chapter1.sections.map((section) => section.section_id)).toEqual([
      1011, 1012, 1013,
    ]);
    // 节一学习记录为已完成
    expect(chapter1.sections[0].pages[0].is_complete).toBe(true);
    // 节二未学习
    expect(chapter1.sections[1].pages[0].is_complete).toBe(false);
    // 节三已学习但未完成
    expect(chapter1.sections[2].pages[0].is_complete).toBe(false);
  });

  it("部分节失败: 继续同步其余节并保留首个失败", async () => {
    const courses = buildCourses();
    const ports: PrunePorts = {
      fetchSectionStudyRecord: async (_site, _token, sectionId) => {
        if (sectionId === 1011) {
          return {
            ok: false,
            failure: { endpoint: "e", status: 500, raw: "x", reason: "httpStatus" },
          };
        }
        return { ok: true, data: { studied: false } };
      },
    };

    const outcome = await pruneCourseware(ports, SITE, "tok", courses);
    expect(outcome.totalSections).toBe(6);
    expect(outcome.failedSections).toBe(1);
    expect(outcome.firstFailure?.status).toBe(500);
    expect(outcome.courses[0].textbooks[0].chapters[0].sections).toHaveLength(3);
  });

  it("全部节失败: 失败数量等于节总数", async () => {
    const courses = buildCourses();
    const ports: PrunePorts = {
      fetchSectionStudyRecord: async () => ({
        ok: false,
        failure: { endpoint: "e", status: 503, raw: "", reason: "httpStatus" },
      }),
    };

    const outcome = await pruneCourseware(ports, SITE, "tok", courses);
    expect(outcome.totalSections).toBe(6);
    expect(outcome.failedSections).toBe(6);
    expect(outcome.firstFailure?.status).toBe(503);
  });

  it("空课件树直接返回零计数的结果", async () => {
    const outcome = await pruneCourseware(makePorts([]), SITE, "tok", []);
    expect(outcome).toEqual({
      courses: [],
      totalSections: 0,
      failedSections: 0,
      firstFailure: null,
    });
  });
});
