import { create } from "zustand";

import type { AppErrorDetail } from "@/error/report";
import type {
  AntiDetectionStage,
  RunProgress,
} from "@/schema/domain/progress";

/**
 * 刷课运行状态机与实时进度: 阶段流转由业务动作驱动,
 * 界面只订阅展示; 停止标志由 requestStop 触发, 检查点在业务动作内。
 */

/** 运行阶段 */
export type RunPhase = "idle" | "running" | "stopping" | "finished" | "error";

/** 本轮运行结果摘要 */
export interface RunResultSummary {
  skippedSections: number;
  failedUploads: number;
}

/** 进度初始值 */
const INITIAL_PROGRESS: RunProgress = {
  courseName: "",
  textbookName: "",
  chapterName: "",
  sectionName: "",
  pageName: "",
  courseIndex: 0,
  courseTotal: 0,
  textbookIndex: 0,
  textbookTotal: 0,
  chapterIndex: 0,
  chapterTotal: 0,
  sectionIndex: 0,
  sectionTotal: 0,
  pageIndex: 0,
  pageTotal: 0,
  completedSections: 0,
};

/** 运行 store 状态 */
export interface RunStoreState {
  /** 运行阶段 */
  phase: RunPhase;
  /** 当前进度 */
  progress: RunProgress;
  /** 停止标志, 触发后在最近的检查点退出循环 */
  stopRequested: boolean;
  /** 反刷课检测分段进度, 未启用时为 null */
  antiDetectionStage: AntiDetectionStage | null;
  /** 本次运行期间页面是否进入过后台 */
  backgrounded: boolean;
  /** error 阶段的错误说明 */
  errorMessage: string | null;
  /** error 阶段的错误详情, 供错误面板展示 */
  errorDetail: AppErrorDetail | null;
  /** 本轮完成后的结果摘要(跳过项与失败上报数) */
  runSummary: RunResultSummary | null;
  /** 当前勾选的待刷页面 ID 集合 */
  selectedPageIds: ReadonlySet<number>;
  /** 本轮刷课锁定的目标页面 ID 集合 */
  targetPageIds: ReadonlySet<number>;
  /** 开始运行并清空进度, 可记录本轮目标集合 */
  startRun: (targetIds?: ReadonlySet<number>) => void;
  /** 请求停止: 仅在 running 与 stopping 阶段生效 */
  requestStop: () => void;
  /** 运行结束(全部完成或停止后完成) */
  finishRun: (summary?: RunResultSummary) => void;
  /** 运行失败, 携带错误详情 */
  failRun: (error: AppErrorDetail) => void;
  /** 回到空闲并清空进度、停止标志与错误信息 */
  resetRun: () => void;
  /** 账号切换: 清空运行状态、摘要与全部页面选择 */
  resetForAccountChange: () => void;
  /** 更新进度 */
  updateProgress: (progress: RunProgress) => void;
  /** 设置反刷课检测分段 */
  setAntiDetectionStage: (stage: AntiDetectionStage | null) => void;
  /** 记录页面进入后台 */
  setBackgrounded: (backgrounded: boolean) => void;
  /** 设置勾选的页面 ID 集合 */
  setSelectedPageIds: (ids: ReadonlySet<number>) => void;
  /** 批量切换页面勾选状态 */
  togglePageIds: (ids: ReadonlyArray<number>, checked: boolean) => void;
  /** 全选指定的所有页面 */
  selectAllPages: (allIds: ReadonlyArray<number>) => void;
  /** 清空勾选 */
  clearSelectedPages: () => void;
  /** 课件被删除后从勾选与本轮目标中移除这些页面 */
  forgetPageIds: (pageIds: ReadonlyArray<number>) => void;
}

export const useRunStore = create<RunStoreState>()((set) => ({
  phase: "idle",
  progress: INITIAL_PROGRESS,
  stopRequested: false,
  antiDetectionStage: null,
  backgrounded: false,
  errorMessage: null,
  errorDetail: null,
  runSummary: null,
  selectedPageIds: new Set<number>(),
  targetPageIds: new Set<number>(),
  startRun: (targetIds) => {
    set((state) => ({
      phase: "running",
      progress: INITIAL_PROGRESS,
      stopRequested: false,
      antiDetectionStage: null,
      backgrounded: false,
      errorMessage: null,
      errorDetail: null,
      runSummary: null,
      targetPageIds: new Set(targetIds ?? state.selectedPageIds),
    }));
  },
  requestStop: () => {
    set((state) => {
      if (state.phase === "running") {
        return { stopRequested: true, phase: "stopping" };
      }
      if (state.phase === "stopping") {
        return { stopRequested: true };
      }
      return {};
    });
  },
  finishRun: (summary) => {
    set({ phase: "finished", runSummary: summary ?? null });
  },
  failRun: (error) => {
    set({ phase: "error", errorMessage: error.message, errorDetail: error });
  },
  resetRun: () => {
    set({
      phase: "idle",
      progress: INITIAL_PROGRESS,
      stopRequested: false,
      antiDetectionStage: null,
      backgrounded: false,
      errorMessage: null,
      errorDetail: null,
      runSummary: null,
      targetPageIds: new Set(),
    });
  },
  resetForAccountChange: () => {
    set({
      phase: "idle",
      progress: INITIAL_PROGRESS,
      stopRequested: false,
      antiDetectionStage: null,
      backgrounded: false,
      errorMessage: null,
      errorDetail: null,
      runSummary: null,
      selectedPageIds: new Set<number>(),
      targetPageIds: new Set<number>(),
    });
  },
  updateProgress: (progress) => {
    set({ progress });
  },
  setAntiDetectionStage: (stage) => {
    set({ antiDetectionStage: stage });
  },
  setBackgrounded: (backgrounded) => {
    set({ backgrounded });
  },
  setSelectedPageIds: (ids) => {
    set({ selectedPageIds: new Set(ids) });
  },
  togglePageIds: (ids, checked) => {
    set((state) => {
      const next = new Set(state.selectedPageIds);
      for (const id of ids) {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return { selectedPageIds: next };
    });
  },
  selectAllPages: (allIds) => {
    set({ selectedPageIds: new Set(allIds) });
  },
  clearSelectedPages: () => {
    set({ selectedPageIds: new Set() });
  },
  forgetPageIds: (pageIds) => {
    const removed = new Set(pageIds);
    set((state) => ({
      selectedPageIds: new Set(
        [...state.selectedPageIds].filter((id) => !removed.has(id)),
      ),
      targetPageIds: new Set([...state.targetPageIds].filter((id) => !removed.has(id))),
    }));
  },
}));
