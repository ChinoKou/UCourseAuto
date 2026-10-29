import { describe, expect, it } from "vitest";

import {
  createConfigurePorts,
  prunePorts,
  runPorts,
  signInPorts,
} from "@/composition/browser";
import type { ModelCourse } from "@/schema/domain/course";
import { useConfigStore } from "@/state/configStore";
import { useRunStore } from "@/state/runStore";

/** 内存版 Storage, 供 store 初始化与写回使用 */
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

Object.defineProperty(globalThis, "localStorage", {
  value: new MemoryStorage(),
  configurable: true,
});

describe("装配根", () => {
  it("登录端口绑定真实接口函数", () => {
    expect(signInPorts.login.name).toBe("loginWithCredential");
    expect(signInPorts.validateToken.name).toBe("validateAccessToken");
    expect(signInPorts.fetchCurrentUser.name).toBe("fetchCurrentUser");
  });

  it("清理端口绑定学习记录接口", () => {
    expect(prunePorts.fetchSectionStudyRecord.name).toBe("fetchSectionStudyRecord");
  });

  it("刷课端口的观察者写入运行状态, 持久化写入配置", () => {
    useRunStore.getState().resetRun();
    useRunStore.getState().startRun();

    runPorts.observer.onAntiDetectionStage("zeroDuration");
    expect(useRunStore.getState().antiDetectionStage).toBe("zeroDuration");

    runPorts.observer.onRunProgress({
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
    expect(useRunStore.getState().progress.sectionName).toBe("节");

    useRunStore.getState().requestStop();
    expect(runPorts.stop.requested()).toBe(true);
    useRunStore.getState().resetRun();

    const courses: ModelCourse[] = [
      { course_id: 1, course_name: "课程", class_id: 2, class_user_id: 3, textbooks: [] },
    ];
    useConfigStore.getState().addAccount({
      siteRef: "ulearning",
      username: "a",
      password: "pw",
      token: "tok",
      activate: true,
    });
    runPorts.persist(courses);
    expect(useConfigStore.getState().config.users[0].courses).toEqual(courses);
  });

  it("配置端口把观察者原样传入", () => {
    const progresses: number[] = [];
    const ports = createConfigurePorts({
      onConfigProgress: (progress) => {
        progresses.push(progress.courseIndex);
      },
    });
    expect(ports.fetchStudentCourses.name).toBe("fetchStudentCourses");
    ports.observer.onConfigProgress({
      courseName: "",
      textbookName: "",
      chapterName: "",
      courseIndex: 2,
      courseTotal: 2,
      textbookIndex: 0,
      textbookTotal: 0,
      chapterIndex: 0,
      chapterTotal: 0,
    });
    expect(progresses).toEqual([2]);
  });
});
