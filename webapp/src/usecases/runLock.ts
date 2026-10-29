/** 刷课运行独占锁名称 */
const RUN_LOCK_NAME = "ucourse-run";

/**
 * 刷课启动入口封装: 经 Web Locks 请求 "ucourse-run" 独占锁,
 * 拿不到锁时返回提示文案; 拿到后执行 action, 锁在 action 完成前保持持有。
 * 环境没有 Web Locks 时直接执行。
 */
export const withRunLock = async (action: () => Promise<void>): Promise<string | null> => {
  if (typeof navigator === "undefined" || navigator.locks === undefined) {
    await action();
    return null;
  }

  let acquired = false;
  await navigator.locks.request(RUN_LOCK_NAME, { ifAvailable: true }, async (lock) => {
    if (lock === null) {
      return;
    }
    acquired = true;
    await action();
  });

  return acquired ? null : "另一个标签页正在刷课";
};
