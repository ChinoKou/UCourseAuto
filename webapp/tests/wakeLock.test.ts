import { describe, expect, it } from "vitest";

import { acquireWakeLock, releaseWakeLock } from "@/ui/common/wakeLock";

describe("屏幕唤醒锁调用安全", () => {
  it("在缺少原生 wakeLock 支持的环境下安全调用而不抛出异常", () => {
    expect(() => {
      acquireWakeLock("test-reason");
      releaseWakeLock("test-reason");
    }).not.toThrow();
  });

  it("多次重复申请与释放不同原因时不抛出异常", () => {
    expect(() => {
      acquireWakeLock("run");
      acquireWakeLock("wizard");
      releaseWakeLock("run");
      releaseWakeLock("wizard");
      releaseWakeLock("non-existent");
    }).not.toThrow();
  });
});
