import { beforeEach, describe, expect, it } from "vitest";

import { runPorts } from "@/composition/browser";
import type { ModelCourse } from "@/schema/domain/course";
import { createDefaultConfig, CONFIG_KEY, loadConfig } from "@/storage/configStorage";
import { syncFromStorageEvent, useConfigStore } from "@/state/configStore";
import { useRunStore } from "@/state/runStore";

/** 内存版 Storage 实现 */
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

const installStorage = (storage: Storage): void => {
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
};

const course: ModelCourse = {
  course_id: 1,
  course_name: "课程",
  class_id: 2,
  class_user_id: 3,
  textbooks: [
    {
      textbook_id: 4,
      textbook_name: "教材",
      status: 1,
      limit: 2,
      chapters: [],
    },
  ],
};

/** 由其他标签页写入的配置: 与当前 store 不同的冷却时长 */
const externalConfigJson = (): string =>
  JSON.stringify({ ...createDefaultConfig(), sleep_time: 9 });

describe("多标签页配置校验", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    installStorage(storage);
    syncFromStorageEvent(null);
    useConfigStore.setState({ config: createDefaultConfig(), configStale: false });
    useConfigStore.getState().addAccount({
      siteRef: "ulearning",
      username: "a",
      password: "pw",
      token: "tok",
      activate: true,
    });
  });

  it("外部写入后旧 store 的变更返回 false 且 store 与存储都不变", () => {
    const external = externalConfigJson();
    storage.setItem(CONFIG_KEY, external);

    const written = useConfigStore.getState().updateSettings({ sleep_time: 5 });

    expect(written).toBe(false);
    expect(useConfigStore.getState().config.sleep_time).toBe(1);
    expect(storage.getItem(CONFIG_KEY)).toBe(external);
  });

  it("外部写入后新增课件同样被拒绝", () => {
    const external = externalConfigJson();
    storage.setItem(CONFIG_KEY, external);

    expect(useConfigStore.getState().appendCourseware([course])).toBe(false);
    expect(storage.getItem(CONFIG_KEY)).toBe(external);
  });

  it("空闲时 syncFromStorageEvent 载入新配置并清空页面选择", () => {
    useRunStore.getState().setSelectedPageIds(new Set([1, 2]));

    syncFromStorageEvent(externalConfigJson());

    expect(useConfigStore.getState().config.sleep_time).toBe(9);
    expect(useRunStore.getState().selectedPageIds.size).toBe(0);
    expect(useConfigStore.getState().configStale).toBe(false);
  });

  it("运行中同步只标记过期, 持久化跳过写回", () => {
    useConfigStore.getState().replaceCourseware([course]);
    useRunStore.getState().startRun();

    syncFromStorageEvent(externalConfigJson());

    expect(useConfigStore.getState().configStale).toBe(true);
    expect(useConfigStore.getState().config.sleep_time).toBe(1);

    runPorts.persist([
      { ...course, course_name: "另一门课程" },
    ]);
    const active = useConfigStore.getState().config.users[0];
    expect(active.courses[0].course_name).toBe("课程");
  });

  it("resetConfig 清除过期标记并同步存储原文", () => {
    useRunStore.getState().startRun();
    syncFromStorageEvent(externalConfigJson());
    expect(useConfigStore.getState().configStale).toBe(true);

    useConfigStore.getState().resetConfig();

    expect(useConfigStore.getState().configStale).toBe(false);
    expect(storage.getItem(CONFIG_KEY)).toBe(JSON.stringify(loadConfig(storage)));

    useConfigStore.getState().addAccount({
      siteRef: "ulearning",
      username: "b",
      password: "pw",
      token: "tok",
      activate: true,
    });
    expect(useConfigStore.getState().config.users).toHaveLength(1);
    useRunStore.getState().resetRun();
  });
});

describe("运行状态机的停止请求", () => {
  beforeEach(() => {
    useRunStore.getState().resetRun();
  });

  it("running 阶段请求停止后进入 stopping", () => {
    useRunStore.getState().startRun();
    useRunStore.getState().requestStop();

    expect(useRunStore.getState().phase).toBe("stopping");
    expect(useRunStore.getState().stopRequested).toBe(true);
  });

  it("stopping 阶段再次请求保持 stopping", () => {
    useRunStore.getState().startRun();
    useRunStore.getState().requestStop();
    useRunStore.getState().requestStop();

    expect(useRunStore.getState().phase).toBe("stopping");
    expect(useRunStore.getState().stopRequested).toBe(true);
  });

  it("finished 阶段请求停止不改变任何字段", () => {
    useRunStore.getState().startRun();
    useRunStore.getState().finishRun({ skippedSections: 0, failedUploads: 0 });

    useRunStore.getState().requestStop();

    expect(useRunStore.getState().phase).toBe("finished");
    expect(useRunStore.getState().stopRequested).toBe(false);
  });

  it("idle 与 error 阶段请求停止不改变阶段", () => {
    useRunStore.getState().requestStop();
    expect(useRunStore.getState().phase).toBe("idle");
    expect(useRunStore.getState().stopRequested).toBe(false);
  });
});

describe("账号切换后的运行状态", () => {
  beforeEach(() => {
    installStorage(new MemoryStorage());
    syncFromStorageEvent(null);
    useConfigStore.setState({ config: createDefaultConfig(), configStale: false });
    useRunStore.getState().resetRun();
  });

  it("resetForAccountChange 清空运行状态、摘要与页面选择", () => {
    useRunStore.getState().setSelectedPageIds(new Set([1, 2]));
    useRunStore.getState().startRun();
    useRunStore.getState().updateProgress({
      courseName: "课程",
      textbookName: "教材",
      chapterName: "章",
      sectionName: "节",
      pageName: "页",
      courseIndex: 1,
      courseTotal: 1,
      textbookIndex: 1,
      textbookTotal: 1,
      chapterIndex: 1,
      chapterTotal: 1,
      sectionIndex: 1,
      sectionTotal: 1,
      pageIndex: 1,
      pageTotal: 1,
      completedSections: 1,
    });
    useRunStore.getState().finishRun({ skippedSections: 1, failedUploads: 1 });
    useRunStore.getState().setBackgrounded(true);

    useRunStore.getState().resetForAccountChange();

    const state = useRunStore.getState();
    expect(state.phase).toBe("idle");
    expect(state.progress.completedSections).toBe(0);
    expect(state.stopRequested).toBe(false);
    expect(state.antiDetectionStage).toBeNull();
    expect(state.backgrounded).toBe(false);
    expect(state.errorMessage).toBeNull();
    expect(state.errorDetail).toBeNull();
    expect(state.runSummary).toBeNull();
    expect(state.selectedPageIds.size).toBe(0);
    expect(state.targetPageIds.size).toBe(0);
  });

  it("切换账号时清空上一账号的勾选页面", () => {
    useConfigStore.getState().addAccount({
      siteRef: "ulearning",
      username: "a",
      password: "pw",
      token: "tok-a",
      activate: true,
    });
    useConfigStore.getState().addAccount({
      siteRef: "ulearning",
      username: "b",
      password: "pw",
      token: "tok-b",
      activate: false,
    });
    useRunStore.getState().setSelectedPageIds(new Set([1, 2]));

    useConfigStore.getState().switchUser(
      `${encodeURIComponent("ulearning")}::${encodeURIComponent("b")}`,
    );

    expect(useRunStore.getState().selectedPageIds.size).toBe(0);
  });

  it("删除活跃账号时清空运行状态与勾选", () => {
    useConfigStore.getState().addAccount({
      siteRef: "ulearning",
      username: "a",
      password: "pw",
      token: "tok-a",
      activate: true,
    });
    useRunStore.getState().setSelectedPageIds(new Set([3]));
    useRunStore.getState().startRun();

    useConfigStore.getState().removeAccount(
      `${encodeURIComponent("ulearning")}::${encodeURIComponent("a")}`,
    );

    expect(useRunStore.getState().phase).toBe("idle");
    expect(useRunStore.getState().selectedPageIds.size).toBe(0);
  });
});
