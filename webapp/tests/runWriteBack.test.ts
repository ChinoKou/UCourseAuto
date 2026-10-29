import { beforeEach, describe, expect, it } from "vitest";

import { runPorts } from "@/composition/browser";
import type { PlatformResult, SectionStudyRecord } from "@/apis/result";
import type { ModelCourse } from "@/schema/domain/course";
import type { CoursewarePage } from "@/schema/domain/courseware";
import { BUILTIN_SITES } from "@/schema/domain/site";
import { selectActiveUser, syncFromStorageEvent, useConfigStore } from "@/state/configStore";
import { useRunStore } from "@/state/runStore";
import type { RunPorts } from "@/usecases/ports";
import { runCourseware } from "@/usecases/runCourseware";

/**
 * 写回与工作树的关系: persist 绑定真实 replaceCourseware, 工作树经
 * structuredClone(store.courses) 得到, 与真实界面流程一致。
 * 状态层用 immer 冻结写入对象, 写回方必须复制后接管,
 * 否则第二次标记完成与收尾清理都会向只读对象赋值。
 */

class MemoryStorage implements Storage {
  private readonly entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }
}

const SITE = BUILTIN_SITES[0];

const page = (pageId: number): CoursewarePage => ({
  page_id: pageId,
  page_relation_id: pageId + 1000,
  page_name: `页-${pageId}`,
  page_content_type: 5,
  is_complete: false,
  elements: [{ kind: "content" }],
});

/** 两节课件: 每节一页, 写回后第二节仍要标记完成 */
const twoSectionCourse = (): ModelCourse => ({
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
            { section_id: 1011, section_name: "节一", pages: [page(1)] },
            { section_id: 1012, section_name: "节二", pages: [page(2)] },
          ],
        },
      ],
    },
  ],
});

/** 平台调用全部固定成功, persist 保持绑定真实 store */
const makePorts = (written: ModelCourse[][]): RunPorts => ({
  ...runPorts,
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
  initializeSectionRecord: async (): Promise<PlatformResult<number>> => ({
    ok: true,
    data: 1730000000,
  }),
  syncStudyRecord: async (): Promise<PlatformResult<boolean>> => ({ ok: true, data: true }),
  fetchSectionStudyRecord: async (): Promise<PlatformResult<SectionStudyRecord>> => ({
    ok: true,
    data: { studied: false },
  }),
  reportVideoBehavior: async (): Promise<PlatformResult<void>> => ({ ok: true, data: undefined }),
  triggerTextbookDetection: async (): Promise<PlatformResult<boolean>> => ({
    ok: true,
    data: true,
  }),
  sleep: async () => {},
  persist: (courses) => {
    // 记录写回时的状态, 再交给真实写回
    written.push(structuredClone(courses));
    runPorts.persist(courses);
  },
});

const input = (courses: ModelCourse[]) => ({
  site: SITE,
  token: "tok",
  courses,
  studyTime: {
    question: { min: 1, max: 1 },
    document: { min: 1, max: 1 },
    content: { min: 1, max: 1 },
  },
  sectionCooldown: 0,
  antiDetection: false,
});

/** 写入课件并把工作树取出来, 与 useRunControl 的做法一致 */
const seedAndClone = (course: ModelCourse): ModelCourse[] => {
  useConfigStore.getState().replaceCourseware([course]);
  const active = selectActiveUser(useConfigStore.getState());
  if (active === null) {
    throw new Error("预期存在活跃账号");
  }
  return structuredClone(active.courses);
};

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
  });
  // 换用新的存储后同步一次基线, 避免把上一个用例写入的原文当作其他标签页的变更
  syncFromStorageEvent(null);
  useConfigStore.setState({
    config: {
      config_version: 1,
      active_user: "",
      users: [],
      custom_sites: [],
      study_time: {
        question: { min: 180, max: 360 },
        document: { min: 180, max: 360 },
        content: { min: 180, max: 360 },
      },
      sleep_time: 1,
      anti_detection: false,
    },
  });
  useRunStore.getState().resetRun();
  useConfigStore.getState().addAccount({
    siteRef: "ulearning",
    username: "a",
    password: "pw",
    token: "tok",
    activate: true,
  });
});

describe("写回后工作树仍可写", () => {
  it("两节课件: 第一次写回后第二节继续标记完成", async () => {
    const written: ModelCourse[][] = [];
    const courses = seedAndClone(twoSectionCourse());

    const outcome = await runCourseware(makePorts(written), input(courses));

    expect(outcome.status).toBe("completed");
    // 首两次写回分别对应两节上报成功, 每节都标记了完成
    expect(written).toHaveLength(3);
    const firstWrite = written[0][0].textbooks[0].chapters[0].sections;
    expect(firstWrite.map((section) => section.section_id)).toEqual([1011, 1012]);
    expect(firstWrite[0].pages.every((item) => item.is_complete)).toBe(true);
    expect(firstWrite[1].pages.every((item) => item.is_complete)).toBe(false);

    const secondWrite = written[1][0].textbooks[0].chapters[0].sections;
    expect(secondWrite[0].pages.every((item) => item.is_complete)).toBe(true);
    expect(secondWrite[1].pages.every((item) => item.is_complete)).toBe(true);
  });

  it("单节课件: 运行完成后保留课件树并标记页面已完成", async () => {
    const written: ModelCourse[][] = [];
    const courses = seedAndClone(twoSectionCourse());
    courses[0].textbooks[0].chapters[0].sections = [
      courses[0].textbooks[0].chapters[0].sections[0],
    ];

    const outcome = await runCourseware(makePorts(written), input(courses));

    if (outcome.status !== "completed") {
      throw new Error(`预期完成: ${outcome.status}`);
    }
    expect(
      outcome.courses[0].textbooks[0].chapters[0].sections[0].pages[0].is_complete,
    ).toBe(true);
    // 运行完成后的写回是独立副本, 工作树本身未被冻结
    expect(Object.isFrozen(courses)).toBe(false);
  });

  it("写回后状态层的课件树与工作树是两个对象", async () => {
    const written: ModelCourse[][] = [];
    const courses = seedAndClone(twoSectionCourse());
    await runCourseware(makePorts(written), input(courses));

    const active = selectActiveUser(useConfigStore.getState());
    expect(active?.courses).not.toBe(courses);
    // 全部页面完成后状态层完整保留完成状态
    expect(
      active?.courses[0].textbooks[0].chapters[0].sections[0].pages[0].is_complete,
    ).toBe(true);
  });
});
