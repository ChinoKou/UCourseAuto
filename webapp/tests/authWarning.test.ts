import { describe, expect, it } from "vitest";

import type { Site } from "@/schema/domain/site";
import { isDgutSite, resolveUsernameValidation } from "@/ui/auth/authValidation";

describe("东莞理工学院站点判断与用户名警示", () => {
  const dgutBuiltinSite: Site = {
    ref: "dgut",
    name: "东莞理工学院",
    course_api: "https://lms.dgut.edu.cn/courseapi",
    ua_api: "https://ua.dgut.edu.cn/uaapi",
    builtin: true,
  };

  const ulearningSite: Site = {
    ref: "ulearning",
    name: "优学院 主站",
    course_api: "https://courseapi.ulearning.cn",
    ua_api: "https://api.ulearning.cn",
    builtin: true,
  };

  const customDgutSite: Site = {
    ref: "custom:123",
    name: "莞工镜像",
    course_api: "https://course.dgut.edu.cn/courseapi",
    ua_api: "https://ua.dgut.edu.cn/uaapi",
    builtin: false,
  };

  const customOtherSite: Site = {
    ref: "custom:456",
    name: "其他高校",
    course_api: "https://course.other.edu.cn/courseapi",
    ua_api: "https://ua.other.edu.cn/uaapi",
    builtin: false,
  };

  it("准确判定东莞理工学院内置与自定义站点", () => {
    expect(isDgutSite(dgutBuiltinSite)).toBe(true);
    expect(isDgutSite(customDgutSite)).toBe(true);
    expect(isDgutSite(ulearningSite)).toBe(false);
    expect(isDgutSite(customOtherSite)).toBe(false);
    expect(isDgutSite(undefined)).toBe(false);
  });

  it("未失焦或碰触时不展示任何错误或警告", () => {
    expect(resolveUsernameValidation("", false, true)).toEqual({
      error: null,
      warning: null,
    });
    expect(resolveUsernameValidation("2099001", false, true)).toEqual({
      error: null,
      warning: null,
    });
  });

  it("已触碰且为空时优先报告红色错误，不提示黄色警告", () => {
    expect(resolveUsernameValidation("", true, true)).toEqual({
      error: "请输入用户名",
      warning: null,
    });
    expect(resolveUsernameValidation("   ", true, true)).toEqual({
      error: "请输入用户名",
      warning: null,
    });
  });

  it("东莞理工学院站点且用户名未以 dgut 开头时给出黄色警示", () => {
    const result = resolveUsernameValidation("2099001", true, true);
    expect(result.error).toBeNull();
    expect(result.warning).toBe(
      "东莞理工学院用户名以 dgut 开头（示例 dgut2099xxxxx）",
    );
  });

  it("东莞理工学院站点且用户名以 dgut 开头（忽略大小写）时不产生警告", () => {
    expect(resolveUsernameValidation("dgut2099001", true, true)).toEqual({
      error: null,
      warning: null,
    });
    expect(resolveUsernameValidation("DGUT2099001", true, true)).toEqual({
      error: null,
      warning: null,
    });
  });

  it("非东莞理工学院站点时不产生 dgut 前缀黄色警告", () => {
    expect(resolveUsernameValidation("2099001", true, false)).toEqual({
      error: null,
      warning: null,
    });
  });
});
