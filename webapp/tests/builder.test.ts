import { describe, expect, it } from "vitest";
import { buildSyncStudyRecordRequest, type BuilderDeps } from "@/logic/studyRecord/buildRequest";
import type { StudyTime } from "@/schema/domain/config";
import type {
  CoursewareElement,
  CoursewarePage,
  CoursewareQuestion,
  CoursewareSection,
} from "@/schema/domain/courseware";

/** 从预设队列依次取值, 队列耗尽即抛错(确定性依赖) */
const queue = (values: number[]): (() => number) => {
  let index = 0;
  return () => {
    if (index >= values.length) {
      throw new Error("预设随机数队列已耗尽");
    }
    const value = values[index];
    index += 1;
    return value;
  };
};

/** 脚本化依赖: randint/uniform 依次返回预设值, 时间恒定 */
const scriptedDeps = (
  integers: number[],
  floats: number[],
  nowValue: number,
): BuilderDeps => ({
  randint: queue(integers),
  uniform: queue(floats),
  now: () => nowValue,
});

/** 默认时长配置 */
const studyTime: StudyTime = {
  question: { min: 180, max: 360 },
  document: { min: 180, max: 360 },
  content: { min: 60, max: 120 },
};

const makePage = (
  pageId: number,
  contentType: number,
  elements: CoursewareElement[],
): CoursewarePage => ({
  page_id: pageId,
  page_relation_id: pageId + 1000,
  page_name: `页面-${pageId}`,
  page_content_type: contentType,
  is_complete: false,
  elements,
});

const makeSection = (
  sectionId: number,
  pages: CoursewarePage[],
): CoursewareSection => ({
  section_id: sectionId,
  section_name: `节-${sectionId}`,
  pages,
});

const makeQuestion = (
  questionId: number,
  score: number,
  answers: string[],
): CoursewareQuestion => ({
  question_id: questionId,
  question_score: score,
  question_content: `题目-${questionId}`,
  question_answer_list: answers,
});

/** 恒定时间(可验证取整行为): floor 后为 1800000000 */
const FIXED_NOW = 1800000000.9;

describe("零时长段", () => {
  it("全部页 studyTime=0/score=0/空 videos 与 questions/coursepageId=null, 未知类型页不进入上报体", () => {
    const section = makeSection(1011, [
      makePage(501, 5, [{ kind: "document" }]),
      makePage(502, 6, [{ kind: "video", video_id: 8002, video_length: 300 }]),
      makePage(506, 7, [{ kind: "question", questions: [makeQuestion(9001, 2, ["A"])] }]),
      makePage(599, 99, []),
    ]);

    const request = buildSyncStudyRecordRequest(
      section,
      1730000000,
      "张三",
      studyTime,
      "zeroDuration",
      scriptedDeps([], [], 0),
    );

    expect(request).toEqual({
      itemid: 1011,
      autoSave: 1,
      withoutOld: null,
      complete: 1,
      studyStartTime: 1730000000,
      userName: "张三",
      score: 100,
      pageStudyRecordDTOList: [
        {
          pageid: 1501,
          complete: 1,
          studyTime: 0,
          score: 0,
          answerTime: 1,
          submitTimes: 0,
          coursepageId: null,
          questions: [],
          videos: [],
          speaks: [],
        },
        {
          pageid: 1502,
          complete: 1,
          studyTime: 0,
          score: 0,
          answerTime: 1,
          submitTimes: 0,
          coursepageId: null,
          questions: [],
          videos: [],
          speaks: [],
        },
        {
          pageid: 1506,
          complete: 1,
          studyTime: 0,
          score: 0,
          answerTime: 1,
          submitTimes: 0,
          coursepageId: null,
          questions: [],
          videos: [],
          speaks: [],
        },
      ],
    });
  });
});

describe("contentType 5(文档/文本)", () => {
  it("存在文档元素即按文档计: studyTime = randint × 元素数", () => {
    const section = makeSection(1011, [
      makePage(501, 5, [
        { kind: "document" },
        { kind: "content" },
        { kind: "document" },
      ]),
    ]);

    const request = buildSyncStudyRecordRequest(
      section,
      1730000000,
      "张三",
      studyTime,
      "realDuration",
      scriptedDeps([200], [], FIXED_NOW),
    );

    const page = request.pageStudyRecordDTOList[0];
    expect(page.studyTime).toBe(600); // 200 × 3
    expect(page.score).toBe(100);
    expect(page.coursepageId).toBeNull();
    expect(page.videos).toEqual([]);
    expect(page.questions).toEqual([]);
  });

  it("文档时长 3600 封顶", () => {
    const section = makeSection(1011, [
      makePage(501, 5, [
        { kind: "document" },
        { kind: "document" },
      ]),
    ]);

    const request = buildSyncStudyRecordRequest(
      section,
      1730000000,
      "张三",
      { ...studyTime, document: { min: 2000, max: 2000 } },
      "realDuration",
      scriptedDeps([2000], [], FIXED_NOW),
    );

    expect(request.pageStudyRecordDTOList[0].studyTime).toBe(3600);
  });

  it("无文档元素按纯文本计: studyTime = randint × 元素数, 同样 3600 封顶", () => {
    const section = makeSection(1011, [
      makePage(501, 5, [
        { kind: "content" },
        { kind: "content" },
        { kind: "content" },
      ]),
    ]);

    const normalRequest = buildSyncStudyRecordRequest(
      section,
      1730000000,
      "张三",
      studyTime,
      "realDuration",
      scriptedDeps([90], [], FIXED_NOW),
    );
    expect(normalRequest.pageStudyRecordDTOList[0].studyTime).toBe(270); // 90 × 3

    const cappedRequest = buildSyncStudyRecordRequest(
      section,
      1730000000,
      "张三",
      { ...studyTime, content: { min: 2000, max: 2000 } },
      "realDuration",
      scriptedDeps([2000], [], FIXED_NOW),
    );
    expect(cappedRequest.pageStudyRecordDTOList[0].studyTime).toBe(3600);
  });
});

describe("contentType 6(视频)", () => {
  it("studyTime 为 video_length 之和, 观看时长与起止时间精确构造", () => {
    const section = makeSection(1011, [
      makePage(502, 6, [
        { kind: "video", video_id: 8002, video_length: 300 },
        { kind: "video", video_id: 8003, video_length: 450 },
        { kind: "content" },
      ]),
    ]);

    const request = buildSyncStudyRecordRequest(
      section,
      1730000000,
      "张三",
      studyTime,
      "realDuration",
      scriptedDeps([], [3.5, 7.25], FIXED_NOW),
    );

    const page = request.pageStudyRecordDTOList[0];
    expect(page.studyTime).toBe(750);
    expect(page.score).toBe(100);
    expect(page.coursepageId).toBeNull();
    expect(page.questions).toEqual([]);

    expect(page.videos).toEqual([
      {
        videoid: 8002,
        current: 296.5,
        status: 1,
        recordTime: 296.5,
        time: 300,
        startEndTimeList: [{ startTime: 1800000000, endTime: 1800000297 }],
      },
      {
        videoid: 8003,
        current: 442.75,
        status: 1,
        recordTime: 442.75,
        time: 450,
        startEndTimeList: [{ startTime: 1800000000, endTime: 1800000443 }],
      },
    ]);
  });
});

describe("contentType 7(题目)", () => {
  it("studyTime 取 randint(3600 封顶), score 为题目分数之和, 每题一项", () => {
    const section = makeSection(1011, [
      makePage(506, 7, [
        {
          kind: "question",
          questions: [
            makeQuestion(9001, 2, ["B"]),
            makeQuestion(9002, 3, ["A", "C"]),
          ],
        },
        { kind: "content" },
      ]),
    ]);

    const request = buildSyncStudyRecordRequest(
      section,
      1730000000,
      "张三",
      studyTime,
      "realDuration",
      scriptedDeps([240], [], FIXED_NOW),
    );

    const page = request.pageStudyRecordDTOList[0];
    expect(page.studyTime).toBe(240);
    expect(page.score).toBe(5);
    expect(page.questions).toEqual([
      { questionid: 9001, answerList: ["B"], score: 2 },
      { questionid: 9002, answerList: ["A", "C"], score: 3 },
    ]);
    expect(page.coursepageId).toBe(506);
    expect(page.videos).toEqual([]);
  });

  it("题目时长 3600 封顶", () => {
    const section = makeSection(1011, [
      makePage(506, 7, [{ kind: "question", questions: [makeQuestion(9001, 2, ["B"])] }]),
    ]);

    const request = buildSyncStudyRecordRequest(
      section,
      1730000000,
      "张三",
      { ...studyTime, question: { min: 4000, max: 4000 } },
      "realDuration",
      scriptedDeps([4000], [], FIXED_NOW),
    );

    expect(request.pageStudyRecordDTOList[0].studyTime).toBe(3600);
  });

  it("questions 为空时 coursepageId 为 null, 分数为 0", () => {
    const section = makeSection(1011, [makePage(506, 7, [{ kind: "question", questions: [] }])]);

    const request = buildSyncStudyRecordRequest(
      section,
      1730000000,
      "张三",
      studyTime,
      "realDuration",
      scriptedDeps([240], [], FIXED_NOW),
    );

    const page = request.pageStudyRecordDTOList[0];
    expect(page.studyTime).toBe(240);
    expect(page.score).toBe(0);
    expect(page.questions).toEqual([]);
    expect(page.coursepageId).toBeNull();
  });
});

describe("未知 contentType", () => {
  it("该页不进入上报体", () => {
    const section = makeSection(1011, [
      makePage(501, 5, [{ kind: "content" }]),
      makePage(599, 99, []),
    ]);

    const request = buildSyncStudyRecordRequest(
      section,
      1730000000,
      "张三",
      studyTime,
      "realDuration",
      scriptedDeps([90], [], FIXED_NOW),
    );

    expect(request.pageStudyRecordDTOList.map((page) => page.pageid)).toEqual([1501]);
  });
});

describe("上报体序列化", () => {
  it("JSON.stringify 输出紧凑文本, 字段序与 cli 模型声明序一致", () => {
    const section = makeSection(4001, [
      makePage(4501, 5, [{ kind: "document" }]),
    ]);

    const request = buildSyncStudyRecordRequest(
      section,
      1730000000,
      "张三",
      { ...studyTime, document: { min: 200, max: 200 } },
      "realDuration",
      scriptedDeps([200], [], FIXED_NOW),
    );

    expect(JSON.stringify(request)).toBe(
      '{"itemid":4001,"autoSave":1,"withoutOld":null,"complete":1,"studyStartTime":1730000000,"userName":"张三","score":100,"pageStudyRecordDTOList":[{"pageid":5501,"complete":1,"studyTime":200,"score":100,"answerTime":1,"submitTimes":0,"coursepageId":null,"questions":[],"videos":[],"speaks":[]}]}',
    );
  });
});
