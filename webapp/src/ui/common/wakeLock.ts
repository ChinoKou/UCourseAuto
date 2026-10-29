import { useEffect } from "react";

import { reportWarning } from "@/error/report";

let sentinel: WakeLockSentinel | null = null;
const reasons = new Set<string>();
let visibilityBound = false;

const requestLock = async (): Promise<void> => {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
    return;
  }
  if (reasons.size === 0) {
    return;
  }
  try {
    const lock = await navigator.wakeLock.request("screen");
    if (reasons.size === 0) {
      void lock.release();
      sentinel = null;
      return;
    }
    sentinel = lock;
    sentinel.addEventListener("release", () => {
      sentinel = null;
    });
  } catch {
    reportWarning("屏幕常亮没有开启", "浏览器拒绝了屏幕常亮请求。");
  }
};

const handleVisibilityChange = (): void => {
  if (
    document.visibilityState === "visible" &&
    reasons.size > 0 &&
    sentinel === null
  ) {
    void requestLock();
  }
};

/**
 * 手势触发阶段申请屏幕常亮锁定
 */
export const acquireWakeLock = (reason: string): void => {
  reasons.add(reason);
  if (!visibilityBound && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    visibilityBound = true;
  }
  if (sentinel === null) {
    void requestLock();
  }
};

/**
 * 释放指定来源的屏幕常亮锁定
 */
export const releaseWakeLock = (reason: string): void => {
  reasons.delete(reason);
  if (reasons.size === 0 && sentinel !== null) {
    void sentinel.release();
    sentinel = null;
  }
};

/**
 * 组件生命周期内的常亮状态同步
 */
export const useWakeLock = (active: boolean, reason = "default"): void => {
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    acquireWakeLock(reason);
    return () => {
      releaseWakeLock(reason);
    };
  }, [active, reason]);
};
