import { describe, expect, it } from "vitest";

import type { PlatformResult, SectionStudyRecord } from "@/apis/result";
import type { ModelCourse } from "@/schema/domain/course";
import type { CoursewarePage, CoursewareSection } from "@/schema/domain/courseware";
import type { Site } from "@/schema/domain/site";
import { BUILTIN_SITES } from "@/schema/domain/site";
import type { SyncStudyRecordRequest } from "@/schema/protocol/syncStudyRecord";
import type { RunPorts } from "@/usecases/ports";
import { runCourseware } from "@/usecases/runCourseware";

/**
 * 运行时序: 记录刷课执行的调用顺序、等待时长与三个停止检查点。
 */

const SITE: Site = BUILTIN_SITES[0];

const page = (pageId: number): CoursewarePage => ({
  page_id: pageId,
  page_relation_id: pageId + 1000,
  page_name: `页-${pageId}`,
  page_content_type: 5,
  is_complete: false,
  elements: [{ kind: "content" }],
});

const section = (sectionId: number): CoursewareSection => ({
  section_id: sectionId,
  section_name: `节-${sectionId}`,
  pages: [page(sectionId)],
});

const course: ModelCourse = {
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
          sections: [section(1011), section(1012), section(1013)],
        },
      ],
    },
  ],
};

interface Log {
  events: string[];
  sleeps: number[];
  stopChecks: number;
}

interface Scenario {
  /** 第几次停止检查返回 true, 缺省恒为 false */
  stopAfterChecks?: number;
  syncFails?: boolean;
}

const makePorts = (log: Log, scenario: Scenario): RunPorts => {
  return {
    fetchCurrentUser: async () => ({
      ok: true,
      data: {
        userid: 1,
        name: "张三",
        headimage: null,
        orgid: 1,
        logo: null,
        roleid: 1,
        antiCheat: 0,
        antiDrag: 0,
        openCourseResource: 0,
        enableSubtitle: 0,
        enableSkipVideoTitle: 0,
      },
    }),
    initializeSectionRecord: async (_site, _token, sectionId) => {
      log.events.push(`初始化:${sectionId}`);
      return { ok: true, data: 1730000000 };
    },
    reportVideoBehavior: async () => ({ ok: true, data: undefined }),
    syncStudyRecord: async (_site, _token, request: SyncStudyRecordRequest) => {
      log.events.push(`上报:${request.itemid}`);
      return scenario.syncFails === true
        ? { ok: false, failure: { endpoint: "e", status: 500, raw: "", reason: "httpStatus" } }
        : { ok: true, data: true };
    },
    triggerTextbookDetection: async () => ({ ok: true, data: true }),
    fetchSectionStudyRecord: async (_site, _token, sectionId): Promise<PlatformResult<SectionStudyRecord>> => {
      log.events.push(`学习记录:${sectionId}`);
      return { ok: true, data: { studied: false } };
    },
    sleep: async (seconds) => {
      log.sleeps.push(seconds);
    },
    now: () => 1730000000,
    randint: (min) => min,
    uniform: () => 3,
    stop: {
      requested: () => {
        log.stopChecks += 1;
        return scenario.stopAfterChecks !== undefined && log.stopChecks >= scenario.stopAfterChecks;
      },
    },
    observer: {
      onRunProgress: () => {},
      onAntiDetectionStage: () => {},
    },
    persist: () => {
      log.events.push("写回");
    },
  };
};

const input = {
  site: SITE,
  token: "tok",
  courses: [structuredClone(course)],
  studyTime: {
    question: { min: 1, max: 1 },
    document: { min: 1, max: 1 },
    content: { min: 1, max: 1 },
  },
  sectionCooldown: 1.5,
  antiDetection: false,
};

describe("运行时序", () => {
  it("每节顺序为初始化 → 上报 → 写回 → 节间冷却, 全部完成后最终写回", async () => {
    const log: Log = { events: [], sleeps: [], stopChecks: 0 };
    const outcome = await runCourseware(makePorts(log, {}), structuredClone(input));

    expect(log.events).toEqual([
      "初始化:1011",
      "上报:1011",
      "写回",
      "初始化:1012",
      "上报:1012",
      "写回",
      "初始化:1013",
      "上报:1013",
      "写回",
      "写回",
    ]);
    expect(log.sleeps).toEqual([1.5, 1.5, 1.5]);
    expect(outcome.status).toBe("completed");
  });

  it("上报失败时每次重试等待 1 秒, 共 4 次尝试", async () => {
    const log: Log = { events: [], sleeps: [], stopChecks: 0 };
    const result = await runCourseware(makePorts(log, { syncFails: true }), structuredClone(input));

    expect(log.events.filter((event) => event === "上报:1011")).toHaveLength(4);
    expect(log.sleeps.slice(0, 3)).toEqual([1, 1, 1]);
    if (result.status !== "completed") {
      throw new Error("预期完成");
    }
    expect(result.failedUploads).toBe(3);
  });

  it("每节开始前检查停止: 第二个节开始前退出", async () => {
    const log: Log = { events: [], sleeps: [], stopChecks: 0 };
    const result = await runCourseware(
      makePorts(log, { stopAfterChecks: 3 }),
      structuredClone(input),
    );

    expect(result).toEqual({ status: "stopped" });
    expect(log.events).toEqual(["初始化:1011", "上报:1011", "写回"]);
  });

  it("每页处理前检查停止", async () => {
    const log: Log = { events: [], sleeps: [], stopChecks: 0 };
    const videoCourse = structuredClone(course);
    videoCourse.textbooks[0].chapters[0].sections[0].pages = [
      {
        ...page(1),
        page_content_type: 6,
        elements: [{ kind: "video", video_id: 8002, video_length: 60 }],
      },
    ];
    const result = await runCourseware(makePorts(log, { stopAfterChecks: 2 }), {
      ...structuredClone(input),
      courses: [videoCourse],
    });

    expect(result).toEqual({ status: "stopped" });
    expect(log.events).toEqual(["初始化:1011"]);
  });

  it("每次重试等待前检查停止", async () => {
    const log: Log = { events: [], sleeps: [], stopChecks: 0 };
    const result = await runCourseware(
      makePorts(log, { stopAfterChecks: 3, syncFails: true }),
      structuredClone(input),
    );

    expect(result).toEqual({ status: "stopped" });
    expect(log.events.filter((event) => event === "上报:1011")).toHaveLength(1);
    expect(log.sleeps).toEqual([]);
  });

  it("初始化返回 0 时跳过该节, 不发起上报", async () => {
    const log: Log = { events: [], sleeps: [], stopChecks: 0 };
    const ports = makePorts(log, {});
    ports.initializeSectionRecord = async (_site, _token, sectionId) => {
      log.events.push(`初始化:${sectionId}`);
      return { ok: true, data: sectionId === 1012 ? 0 : 1730000000 };
    };

    const result = await runCourseware(ports, structuredClone(input));
    expect(log.events).not.toContain("上报:1012");
    if (result.status !== "completed") {
      throw new Error("预期完成");
    }
    expect(result.skippedSections).toBe(1);
  });
});
