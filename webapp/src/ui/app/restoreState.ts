/** 启动恢复失败后的界面状态 */
export interface RestoreFailureState {
  /** 展示给用户的说明 */
  message: string;
  /** 启动画面上的阶段文字 */
  label: string;
  /** 为 true 时不进入工作台, 只呈现需要刷新页面的提示 */
  blocked: boolean;
}

/**
 * 清理失效的登录状态。
 * 清理被拒绝说明配置已在其他标签页更新, 此时内存中的账号仍然存在,
 * 不能再按"需要重新登录"继续, 只能提示刷新页面。
 */
export const endSessionForRestore = (
  logout: () => boolean,
  reason: string,
): RestoreFailureState => {
  if (!logout()) {
    return {
      message: `${reason}，且本地配置已在其他标签页更新，未能退出登录。请刷新页面后重试。`,
      label: "需要刷新页面",
      blocked: true,
    };
  }
  return {
    message: `${reason}，请重新登录。`,
    label: "需要重新登录",
    blocked: false,
  };
};
