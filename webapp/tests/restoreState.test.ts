import { describe, expect, it } from "vitest";

import { endSessionForRestore } from "@/ui/app/restoreState";
import { draftAfterWrite, sleepAfterWrite } from "@/ui/run/studyTimeValidation";

describe("参数写入被拒绝时的显示值", () => {
  const saved = { min: 180, max: 360 };

  it("写入成功时采用输入框的新值", () => {
    expect(draftAfterWrite({ min: "200", max: "400" }, saved, true)).toEqual({
      min: "200",
      max: "400",
    });
  });

  it("写入被拒绝时回到已保存的值", () => {
    expect(draftAfterWrite({ min: "200", max: "400" }, saved, false)).toEqual({
      min: "180",
      max: "360",
    });
  });

  it("冷却值按写入结果决定显示值", () => {
    expect(sleepAfterWrite(4.5, 1, true)).toBe(4.5);
    expect(sleepAfterWrite(4.5, 1, false)).toBe(1);
  });
});

describe("启动恢复失败后的会话清理", () => {
  it("清理成功时按需要重新登录继续", () => {
    expect(endSessionForRestore(() => true, "账号使用的站点已经不存在")).toEqual({
      message: "账号使用的站点已经不存在，请重新登录。",
      label: "需要重新登录",
      blocked: false,
    });
  });

  it("清理被拒绝时停在需要刷新页面的提示", () => {
    const state = endSessionForRestore(() => false, "会话恢复失败");
    expect(state.blocked).toBe(true);
    expect(state.label).toBe("需要刷新页面");
    expect(state.message).toContain("未能退出登录");
  });
});
