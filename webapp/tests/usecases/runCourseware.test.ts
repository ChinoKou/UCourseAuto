import { describe, expect, it } from "vitest";

import type { StudyTime } from "@/schema/domain/config";
import type { ModelCourse, ModelTextbook } from "@/schema/domain/course";
import type {
  CoursewareChapter,
  CoursewareElement,
  CoursewarePage,
  CoursewareSection,
} from "@/schema/domain/courseware";
import { BUILTIN_SITES } from "@/schema/domain/site";
import type { SyncStudyRecordRequest } from "@/schema/protocol/syncStudyRecord";
import type { BuilderDeps } from "@/logic/studyRecord/buildRequest";
import { subscribeNotices } from "@/error/report";
import type { SectionStudyRecord } from "@/apis/result";
import type { PlatformResult } from "@/apis/result";
import { runCourseware } from "@/usecases/runCourseware";
import type { RunPorts } from "@/usecases/ports";

/** 测试用站点: 内置主站 */
const TEST_SITE = BUILTIN_SITES[0];

/** 域模型构造辅助 */
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

const makeTextbook = (textbookId: number, chapters: CoursewareChapter[]): ModelTextbook => ({
  textbook_id: textbookId,
  textbook_name: `教材-${textbookId}`,
  status: 1,
  limit: 2,
  chapters,
});

const makeCourse = (courseId: number, textbooks: ModelTextbook[]): ModelCourse => ({
  course_id: courseId,
  course_name: `课程-${courseId}`,
  class_id: courseId * 10,
  class_user_id: courseId * 100,
  textbooks,
});

/** 纯文本页(contentType 5, 单个文本元素) */
const contentPage = (pageId: number): CoursewarePage =>
  makePage(pageId, 5, [{ kind: "content" }]);

/** 时长配置: content 区间取恒定值, 便于推断上报体 */
const studyTime: StudyTime = {
  question: { min: 180, max: 360 },
  document: { min: 180, max: 360 },
  content: { min: 100, max: 100 },
};

/** 脚本化运行端口的输入 */
interface ScriptInput {
  /** 平台调用事件序列 */
  events: string[];
  /** sleep 秒数记录 */
  sleepLog: number[];
  /** persist 写回记录 */
  persistCalls: ModelCourse[][];
  /** 初始化应答(缺省 1730000000), 返回失败结果表示初始化失败 */
  initialize?: (sectionId: number) => PlatformResult<number>;
  /** 上报应答(缺省成功) */
  sync?: (request: SyncStudyRecordRequest) => PlatformResult<boolean>;
  /** 学习记录应答(缺省未学习) */
  studyRecord?: (sectionId: number) => PlatformResult<SectionStudyRecord>;
  /** 构造依赖 */
  builder?: BuilderDeps;
  /** 停止检查(缺省恒 false) */
  shouldStop?: () => boolean;
}

const makeScript = (): ScriptInput => ({ events: [], sleepLog: [], persistCalls: [] });

/** 组装脚本化运行端口: 平台响应按脚本给出, sleep 与写回记录调用 */
const makeRunPorts = (script: ScriptInput): RunPorts => ({
  fetchCurrentUser: async () => ({
    ok: true,
    data: {
      userid: 1,
      name: "张三",
      headimage: "https://example.com/avatar.png",
      orgid: 100,
      logo: null,
      roleid: 9,
      antiCheat: 0,
      antiDrag: 0,
      openCourseResource: 0,
      enableSubtitle: 0,
      enableSkipVideoTitle: 0,
    },
  }),
  initializeSectionRecord: async (_site, _token, sectionId) => {
    script.events.push(`initialize:${sectionId}`);
    return script.initialize?.(sectionId) ?? { ok: true, data: 1730000000 };
  },
  syncStudyRecord: async (_site, _token, request) => {
    const isZeroSegment = request.pageStudyRecordDTOList.every(
      (page) => page.studyTime === 0 && page.score === 0,
    );
    script.events.push(`sync:${isZeroSegment ? "zero" : "real"}:${request.itemid}`);
    return script.sync?.(request) ?? { ok: true, data: true };
  },
  reportVideoBehavior: async (_site, _token, _classId, _textbookId, _chapterId, videoId) => {
    script.events.push(`video:${videoId}`);
    return { ok: true, data: undefined };
  },
  triggerTextbookDetection: async (_site, _token, courseId, textbookId) => {
    script.events.push(`detection:${courseId}/${textbookId}`);
    return { ok: true, data: true };
  },
  fetchSectionStudyRecord: async (_site, _token, sectionId) => {
    script.events.push(`record:${sectionId}`);
    return script.studyRecord?.(sectionId) ?? { ok: true, data: { studied: false } };
  },
  sleep: async (seconds) => {
    script.sleepLog.push(seconds);
  },
  now: () => (script.builder === undefined ? 1800000000 : script.builder.now()),
  randint: (min, max) =>
    script.builder === undefined ? max : script.builder.randint(min, max),
  uniform: (min, max) =>
    script.builder === undefined ? (min + max) / 2 : script.builder.uniform(min, max),
  stop: { requested: script.shouldStop ?? (() => false) },
  observer: {
    onRunProgress: () => {},
    onAntiDetectionStage: (stage) => {
      script.events.push(`stage:${stage}`);
    },
  },
  persist: (courses) => {
    script.persistCalls.push(courses);
  },
});

/** 三个节的遍历样本: 章 101 含节 1011/1012, 章 102 含节 2011 */
const buildTraversalFixture = () => {
  const section1011 = makeSection(1011, [contentPage(1)]);
  const section1012 = makeSection(1012, [contentPage(2)]);
  const section2011 = makeSection(2011, [contentPage(3)]);
  const course = makeCourse(301, [
    makeTextbook(50101, [
      makeChapter(101, [section1011, section1012]),
      makeChapter(102, [section2011]),
    ]),
  ]);
  return { course, section1011, section1012, section2011 };
};

const runInput = (course: ModelCourse, antiDetection = false) => ({
  site: TEST_SITE,
  token: "tok",
  courses: [course],
  studyTime,
  sectionCooldown: 2,
  antiDetection,
});

describe("runCourseware 遍历与重试", () => {
  it("遍历顺序与数组顺序一致, 每节一次节间冷却", async () => {
    const { course } = buildTraversalFixture();
    const script = makeScript();

    const outcome = await runCourseware(makeRunPorts(script), runInput(course));

    expect(script.events).toEqual([
      "initialize:1011",
      "sync:real:1011",
      "initialize:1012",
      "sync:real:1012",
      "initialize:2011",
      "sync:real:2011",
    ]);
    expect(script.sleepLog).toEqual([2, 2, 2]);
    expect(script.persistCalls).toHaveLength(4);
    expect(outcome).toMatchObject({ status: "completed", skippedSections: 0, failedUploads: 0 });
  });

  it("初始化失败与返回 0 都跳过该节并继续", async () => {
    const { course, section1011, section1012, section2011 } = buildTraversalFixture();
    const script = makeScript();
    script.initialize = (sectionId) => {
      if (sectionId === 1012) {
        return { ok: false, failure: { endpoint: "x", status: 500, raw: "", reason: "httpStatus" } };
      }
      if (sectionId === 2011) {
        return { ok: true, data: 0 };
      }
      return { ok: true, data: 1730000000 };
    };

    const outcome = await runCourseware(makeRunPorts(script), runInput(course));

    expect(script.events).toEqual([
      "initialize:1011",
      "sync:real:1011",
      "initialize:1012",
      "initialize:2011",
    ]);
    expect(section1011.pages.every((page) => page.is_complete)).toBe(true);
    expect(section1012.pages.every((page) => page.is_complete)).toBe(false);
    expect(section2011.pages.every((page) => page.is_complete)).toBe(false);
    expect(script.persistCalls).toHaveLength(2);
    expect(script.sleepLog).toEqual([2]);
    expect(outcome).toMatchObject({ status: "completed", skippedSections: 2 });
  });

  it("上报失败共 4 次尝试、3 次 1 秒重试等待后跳过该节, 每次重新构造上报体", async () => {
    const section1011 = makeSection(1011, [contentPage(1)]);
    const course = makeCourse(301, [makeTextbook(50101, [makeChapter(101, [section1011])])]);
    const script = makeScript();
    const randintCalls: number[] = [];
    script.sync = () => {
      return { ok: false, failure: { endpoint: "x", status: 500, raw: "", reason: "httpStatus" } };
    };
    script.builder = {
      randint: (min) => {
        randintCalls.push(min);
        return 100;
      },
      uniform: (min, max) => (min + max) / 2,
      now: () => 1800000000,
    };

    const outcome = await runCourseware(makeRunPorts(script), runInput(course));

    expect(script.events.filter((event) => event.startsWith("sync:"))).toHaveLength(4);
    expect(script.sleepLog).toEqual([1, 1, 1, 2]);
    expect(randintCalls).toHaveLength(4);
    expect(section1011.pages.every((page) => page.is_complete)).toBe(false);
    expect(script.persistCalls).toHaveLength(1);
    expect(outcome).toMatchObject({ status: "completed", failedUploads: 1 });
  });
});

describe("runCourseware 反刷课检测", () => {
  it("每教材先零时长段, 再触发检测, 最后真实时长段", async () => {
    const section1011 = makeSection(1011, [contentPage(1)]);
    const section1012 = makeSection(1012, [contentPage(2)]);
    const course = makeCourse(301, [
      makeTextbook(50101, [makeChapter(101, [section1011, section1012])]),
    ]);
    const script = makeScript();

    const outcome = await runCourseware(makeRunPorts(script), runInput(course, true));

    expect(script.events).toEqual([
      "stage:zeroDuration",
      "initialize:1011",
      "sync:zero:1011",
      "initialize:1012",
      "sync:zero:1012",
      "stage:trigger",
      "detection:301/50101",
      "stage:realDuration",
      "initialize:1011",
      "sync:real:1011",
      "initialize:1012",
      "sync:real:1012",
    ]);
    expect(script.sleepLog).toEqual([2, 2]);
    expect(outcome.status).toBe("completed");
  });
});

describe("runCourseware 停止与视频行为", () => {
  it("停止请求在最近检查点退出, 已上报节保持完成", async () => {
    const section1011 = makeSection(1011, [contentPage(1)]);
    const section1012 = makeSection(1012, [contentPage(2)]);
    const section1013 = makeSection(1013, [contentPage(3)]);
    const course = makeCourse(301, [
      makeTextbook(50101, [makeChapter(101, [section1011, section1012, section1013])]),
    ]);
    const script = makeScript();
    let stopped = false;
    script.sync = (request) => {
      if (request.itemid === 1012) {
        stopped = true;
      }
      return { ok: true, data: true };
    };
    script.shouldStop = () => stopped;

    const outcome = await runCourseware(makeRunPorts(script), runInput(course));

    expect(outcome).toEqual({ status: "stopped" });
    expect(script.events).toEqual([
      "initialize:1011",
      "sync:real:1011",
      "initialize:1012",
      "sync:real:1012",
    ]);
    expect(section1011.pages.every((page) => page.is_complete)).toBe(true);
    expect(section1012.pages.every((page) => page.is_complete)).toBe(true);
    expect(section1013.pages.every((page) => page.is_complete)).toBe(false);
    expect(script.persistCalls).toHaveLength(2);
  });

  it("视频页并发上报观看行为, 每个视频等待 0.3 秒", async () => {
    const videoPage = makePage(1, 6, [
      { kind: "video", video_id: 8002, video_length: 300 },
      { kind: "video", video_id: 8003, video_length: 450 },
    ]);
    const section = makeSection(1011, [videoPage]);
    const course = makeCourse(301, [makeTextbook(50101, [makeChapter(101, [section])])]);
    const script = makeScript();

    await runCourseware(makeRunPorts(script), runInput(course));

    expect(script.events.filter((event) => event.startsWith("video:"))).toEqual([
      "video:8002",
      "video:8003",
    ]);
    expect(script.sleepLog).toEqual([0.3, 0.3, 2]);
  });
});

describe("runCourseware 课件树持久化与勾选执行", () => {
  it("完成后保留课件树并标记页面已完成, 不物理删除课件", async () => {
    const section1011 = makeSection(1011, [makePage(1, 5, [{ kind: "content" }])]);
    const course = makeCourse(301, [makeTextbook(50101, [makeChapter(101, [section1011])])]);
    const script = makeScript();

    const outcome = await runCourseware(makeRunPorts(script), runInput(course));

    if (outcome.status !== "completed") {
      throw new Error(`预期完成: ${outcome.status}`);
    }
    expect(outcome.courses).toHaveLength(1);
    expect(outcome.courses[0].textbooks[0].chapters[0].sections[0].pages[0].is_complete).toBe(true);
    expect(script.persistCalls).toHaveLength(2);
  });

  it("传入 selectedPageIds 时仅执行被勾选的节与页面", async () => {
    const page1 = contentPage(1);
    const page2 = contentPage(2);
    const section1011 = makeSection(1011, [page1]);
    const section1012 = makeSection(1012, [page2]);
    const course = makeCourse(301, [
      makeTextbook(50101, [makeChapter(101, [section1011, section1012])]),
    ]);
    const script = makeScript();

    const input = {
      ...runInput(course),
      selectedPageIds: new Set([1]), // 仅勾选 page 1 (节 1011)
    };

    const outcome = await runCourseware(makeRunPorts(script), input);

    expect(outcome.status).toBe("completed");
    expect(script.events).toEqual(["initialize:1011", "sync:real:1011"]);
    expect(page1.is_complete).toBe(true);
    expect(page2.is_complete).toBe(false);
  });
});

describe("runCourseware 上报范围", () => {
  /** 一节两页, 仅勾选第一页 */
  const buildTwoPageSection = () => {
    const selectedPage = contentPage(1);
    const unselectedPage = contentPage(2);
    const section = makeSection(1011, [selectedPage, unselectedPage]);
    const course = makeCourse(301, [
      makeTextbook(50101, [makeChapter(101, [section])]),
    ]);
    return { course, selectedPage, unselectedPage };
  };

  it("一节两页只勾选一页时, 真实时长段请求只包含勾选页面", async () => {
    const { course, selectedPage, unselectedPage } = buildTwoPageSection();
    const script = makeScript();
    const requests: SyncStudyRecordRequest[] = [];
    script.sync = (request) => {
      requests.push(request);
      return { ok: true, data: true };
    };

    const outcome = await runCourseware(makeRunPorts(script), {
      ...runInput(course),
      selectedPageIds: new Set([1]),
    });

    expect(outcome.status).toBe("completed");
    expect(requests).toHaveLength(1);
    expect(requests[0].pageStudyRecordDTOList.map((page) => page.pageid)).toEqual([1001]);
    expect(selectedPage.is_complete).toBe(true);
    expect(unselectedPage.is_complete).toBe(false);
  });

  it("反刷课开启时零时长段与真实时长段都只包含勾选页面", async () => {
    const { course } = buildTwoPageSection();
    const script = makeScript();
    const requests: SyncStudyRecordRequest[] = [];
    script.sync = (request) => {
      requests.push(request);
      return { ok: true, data: true };
    };

    await runCourseware(makeRunPorts(script), {
      ...runInput(course, true),
      selectedPageIds: new Set([1]),
    });

    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request.pageStudyRecordDTOList.map((page) => page.pageid)).toEqual([1001]);
    }
  });

  it("未知页面类型不进入请求, 也不标记完成", async () => {
    const knownPage = contentPage(1);
    const unknownPage = makePage(2, 99, []);
    const section = makeSection(1011, [knownPage, unknownPage]);
    const course = makeCourse(301, [
      makeTextbook(50101, [makeChapter(101, [section])]),
    ]);
    const script = makeScript();
    const requests: SyncStudyRecordRequest[] = [];
    script.sync = (request) => {
      requests.push(request);
      return { ok: true, data: true };
    };

    const outcome = await runCourseware(makeRunPorts(script), runInput(course));

    expect(outcome.status).toBe("completed");
    expect(requests[0].pageStudyRecordDTOList.map((page) => page.pageid)).toEqual([1001]);
    expect(knownPage.is_complete).toBe(true);
    expect(unknownPage.is_complete).toBe(false);
  });

  it("整节只有未知页面时跳过该节, 不发起初始化与上报", async () => {
    const unknownPage = makePage(2, 99, []);
    const section = makeSection(1011, [unknownPage]);
    const course = makeCourse(301, [
      makeTextbook(50101, [makeChapter(101, [section])]),
    ]);
    const script = makeScript();

    const outcome = await runCourseware(makeRunPorts(script), runInput(course));

    expect(script.events).toEqual([]);
    expect(unknownPage.is_complete).toBe(false);
    expect(outcome).toMatchObject({ status: "completed", skippedSections: 0 });
  });
});

describe("runCourseware 重试顺序", () => {
  it("前三次失败、第四次成功时该节完成且不计失败", async () => {
    const page = contentPage(1);
    const section = makeSection(1011, [page]);
    const course = makeCourse(301, [
      makeTextbook(50101, [makeChapter(101, [section])]),
    ]);
    const script = makeScript();
    let attempts = 0;
    script.sync = () => {
      attempts += 1;
      return attempts < 4
        ? { ok: false, failure: { endpoint: "x", status: 500, raw: "", reason: "httpStatus" } }
        : { ok: true, data: true };
    };

    const outcome = await runCourseware(makeRunPorts(script), runInput(course));

    expect(attempts).toBe(4);
    expect(page.is_complete).toBe(true);
    expect(outcome).toMatchObject({
      status: "completed",
      skippedSections: 0,
      failedUploads: 0,
    });
  });
});

describe("runCourseware 视频行为", () => {
  it("视频行为失败时学习记录仍上报, 警告通道收到提示", async () => {
    const videoPage = makePage(1, 6, [
      { kind: "video", video_id: 8002, video_length: 300 },
    ]);
    const section = makeSection(1011, [videoPage]);
    const course = makeCourse(301, [
      makeTextbook(50101, [makeChapter(101, [section])]),
    ]);
    const script = makeScript();
    const ports = makeRunPorts(script);
    ports.reportVideoBehavior = async () => ({
      ok: false,
      failure: { endpoint: "x", status: 500, raw: "", reason: "httpStatus" },
    });

    const notices: string[] = [];
    const unsubscribe = subscribeNotices((notice) => {
      notices.push(notice.title);
    });
    try {
      const outcome = await runCourseware(ports, runInput(course));

      expect(outcome.status).toBe("completed");
      expect(script.events.filter((event) => event.startsWith("sync:real"))).toEqual([
        "sync:real:1011",
      ]);
      expect(notices).toContain("视频观看行为没有记录");
    } finally {
      unsubscribe();
    }
  });
});

describe("runCourseware 反刷课计数", () => {
  const buildSingleSection = () => {
    const page = contentPage(1);
    const section = makeSection(1011, [page]);
    const course = makeCourse(301, [
      makeTextbook(50101, [makeChapter(101, [section])]),
    ]);
    return { course, page };
  };

  const counts = async (
    script: ScriptInput,
    course: ModelCourse,
  ): Promise<{ skippedSections: number; failedUploads: number }> => {
    const outcome = await runCourseware(makeRunPorts(script), runInput(course, true));
    if (outcome.status !== "completed") {
      throw new Error(`预期完成: ${outcome.status}`);
    }
    return {
      skippedSections: outcome.skippedSections,
      failedUploads: outcome.failedUploads,
    };
  };

  it("零时长段失败、真实时长段成功时不计失败", async () => {
    const { course } = buildSingleSection();
    const script = makeScript();
    let initializeCalls = 0;
    script.initialize = () => {
      initializeCalls += 1;
      return initializeCalls === 1
        ? { ok: false, failure: { endpoint: "x", status: 500, raw: "", reason: "httpStatus" } }
        : { ok: true, data: 1730000000 };
    };

    expect(await counts(script, course)).toEqual({
      skippedSections: 0,
      failedUploads: 0,
    });
  });

  it("两段都初始化失败时只计一次初始化失败", async () => {
    const { course } = buildSingleSection();
    const script = makeScript();
    script.initialize = () => ({
      ok: false,
      failure: { endpoint: "x", status: 500, raw: "", reason: "httpStatus" },
    });

    expect(await counts(script, course)).toEqual({
      skippedSections: 1,
      failedUploads: 0,
    });
  });

  it("两段都上报失败时只计一次上报失败", async () => {
    const { course } = buildSingleSection();
    const script = makeScript();
    script.sync = () => ({
      ok: false,
      failure: { endpoint: "x", status: 500, raw: "", reason: "httpStatus" },
    });

    expect(await counts(script, course)).toEqual({
      skippedSections: 0,
      failedUploads: 1,
    });
  });

  it("零时长段初始化失败、真实时长段上报失败时只计上报失败", async () => {
    const { course } = buildSingleSection();
    const script = makeScript();
    let initializeCalls = 0;
    script.initialize = () => {
      initializeCalls += 1;
      return initializeCalls === 1
        ? { ok: false, failure: { endpoint: "x", status: 500, raw: "", reason: "httpStatus" } }
        : { ok: true, data: 1730000000 };
    };
    script.sync = () => ({
      ok: false,
      failure: { endpoint: "x", status: 500, raw: "", reason: "httpStatus" },
    });

    expect(await counts(script, course)).toEqual({
      skippedSections: 0,
      failedUploads: 1,
    });
  });

  it("真实时长段四次尝试全部失败时只计一次上报失败", async () => {
    const { course } = buildSingleSection();
    const script = makeScript();
    let attempts = 0;
    script.sync = (request) => {
      // 零时长段成功, 真实时长段连续四次失败
      if (request.pageStudyRecordDTOList.every((page) => page.studyTime === 0)) {
        return { ok: true, data: true };
      }
      attempts += 1;
      return {
        ok: false,
        failure: { endpoint: "x", status: 500, raw: "", reason: "httpStatus" },
      };
    };

    expect(await counts(script, course)).toEqual({
      skippedSections: 0,
      failedUploads: 1,
    });
    expect(attempts).toBe(4);
  });
});
