import type { RunPhase } from "@/state/runStore";

/** 状态标签的语气 */
export type RunStatusTone = "default" | "live" | "warning" | "danger";

export interface RunStatusInput {
  phase: RunPhase;
  /** 只在启动前为真 */
  preparing: boolean;
  stopRequested: boolean;
  /** 本轮还有未完成的页面或未完成的节 */
  isPartial: boolean;
}

export interface RunStatus {
  label: string;
  tone: RunStatusTone;
}

/** 状态标签: 运行阶段优先, 只有空闲时才显示准备中 */
export const resolveRunStatus = (input: RunStatusInput): RunStatus => {
  if (input.phase === "running") {
    return { label: "运行中", tone: "live" };
  }
  if (input.phase === "stopping") {
    return { label: "正在停止", tone: "warning" };
  }
  if (input.phase === "finished") {
    if (input.stopRequested) {
      return { label: "已安全停止", tone: "default" };
    }
    if (input.isPartial) {
      return { label: "部分完成", tone: "warning" };
    }
    return { label: "已全部完成", tone: "live" };
  }
  if (input.phase === "error") {
    return { label: "运行中断", tone: "danger" };
  }
  if (input.preparing) {
    return { label: "准备中", tone: "default" };
  }
  return { label: "随时就绪", tone: "default" };
};
