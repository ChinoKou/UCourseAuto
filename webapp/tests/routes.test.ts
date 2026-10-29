import { beforeEach, describe, expect, it } from "vitest";

import { useConfigStore } from "@/state/configStore";
import { parseRoute } from "@/ui/app/routes";

describe("应用路由状态解析", () => {
  beforeEach(() => {
    useConfigStore.setState((state) => ({
      ...state,
      config: {
        ...state.config,
        active_user: "",
      },
    }));
  });

  it("未登录且未指定 hash 时默认停留在首页", () => {
    const result = parseRoute("");
    expect(result.route).toBe("home");
    expect(result.configure).toBe(false);
  });

  it("已登录用户且未指定 hash 时默认进入工作台", () => {
    useConfigStore.setState((state) => ({
      ...state,
      config: {
        ...state.config,
        active_user: "ulearning:user_123",
      },
    }));
    const result = parseRoute("");
    expect(result.route).toBe("dashboard");
  });

  it("地址栏指定具体路由时正常解析", () => {
    expect(parseRoute("#/home").route).toBe("home");
    expect(parseRoute("#/dashboard").route).toBe("dashboard");
    expect(parseRoute("#/library").route).toBe("library");
  });

  it("课件库路由携带 configure 查询参数时正确解析", () => {
    const result = parseRoute("#/library?configure=1");
    expect(result.route).toBe("library");
    expect(result.configure).toBe(true);
  });
});
