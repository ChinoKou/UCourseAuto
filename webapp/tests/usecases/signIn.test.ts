import { describe, expect, it } from "vitest";

import type { LoginOutcome, PlatformResult } from "@/apis/result";
import type { Site } from "@/schema/domain/site";
import { BUILTIN_SITES } from "@/schema/domain/site";
import type { UserConfig } from "@/schema/domain/config";
import type { SignInPorts } from "@/usecases/ports";
import {
  addAccountWithLogin,
  restoreSession,
  updateCredential,
} from "@/usecases/signIn";

const SITE: Site = BUILTIN_SITES[0];

/** 登录成功响应: 平台返回的用户资料 */
const loginResponse = (token: string) => ({
  authorization: token,
  name: "张三",
  roleId: 3,
  userId: 1,
  orgId: 1,
  loginName: "202501001",
  headimage: "https://example.com/avatar.png",
});

/** 存储中的账号样本 */
const storedUser: UserConfig = {
  site: "ulearning",
  username: "202501001",
  password: "pw",
  token: "tok-old",
  courses: [],
  name: "旧姓名",
  headimage: null,
};

interface PortLog {
  calls: string[];
}

const makePorts = (overrides: Partial<SignInPorts>, log: PortLog = { calls: [] }): SignInPorts => ({
  login: async (_site: Site, username: string) => {
    log.calls.push(`login:${username}`);
    return {
      status: "failed",
      failure: { endpoint: "e", status: 500, raw: "", reason: "httpStatus" },
    };
  },
  validateToken: async (_site: Site, token: string): Promise<PlatformResult<boolean>> => {
    log.calls.push(`validate:${token}`);
    return { ok: true, data: false };
  },
  fetchCurrentUser: async () => {
    log.calls.push("currentUser");
    return {
      ok: true,
      data: {
        userid: 1,
        name: "张三",
        headimage: null,
        orgid: 1,
        logo: null,
        roleid: 1,
        antiCheat: 0,
        antiDrag: 0,
        openCourseResource: 0,
        enableSubtitle: 0,
        enableSkipVideoTitle: 0,
      },
    };
  },
  ...overrides,
});

describe("addAccountWithLogin", () => {
  it("凭据登录成功返回站点引用、凭据、令牌与账号资料", async () => {
    const ports = makePorts({
      login: async (): Promise<LoginOutcome> => ({
        status: "success",
        response: loginResponse("tok-1"),
      }),
    });

    const result = await addAccountWithLogin(ports, SITE, "202501001", "pw");
    expect(result).toEqual({
      status: "success",
      data: {
        siteRef: "ulearning",
        username: "202501001",
        password: "pw",
        token: "tok-1",
        identity: { name: "张三", headimage: "https://example.com/avatar.png" },
      },
    });
  });

  it("平台拒绝时返回错误码与文案", async () => {
    const ports = makePorts({
      login: async () => ({ status: "rejected", code: 1201, message: "用户不存在" }),
    });
    const result = await addAccountWithLogin(ports, SITE, "a", "b");
    if (result.status !== "failed") {
      throw new Error("预期失败");
    }
    expect(result.error.message).toBe("1201 用户不存在");
  });

  it("传输失败时错误详情携带接口与状态", async () => {
    const ports = makePorts({
      login: async () => ({
        status: "failed",
        failure: {
          endpoint: `${SITE.course_api}/users/login`,
          status: 502,
          raw: "x",
          reason: "httpStatus",
        },
      }),
    });
    const result = await addAccountWithLogin(ports, SITE, "a", "b");
    if (result.status !== "failed") {
      throw new Error("预期失败");
    }
    expect(result.error.endpoint).toBe(`${SITE.course_api}/users/login`);
    expect(result.error.status).toBe(502);
  });
});

describe("restoreSession", () => {
  it("存量令牌有效时直接复用, 并补拉账号资料", async () => {
    const log: PortLog = { calls: [] };
    const ports = makePorts(
      {
        validateToken: async (_site: Site, token: string) => {
          log.calls.push(`validate:${token}`);
          return { ok: true, data: true };
        },
        fetchCurrentUser: async () => {
          log.calls.push("currentUser");
          return {
            ok: true,
            data: {
              userid: 1,
              name: "张三",
              headimage: "https://example.com/a.png",
              orgid: 1,
              logo: null,
              roleid: 1,
              antiCheat: 0,
              antiDrag: 0,
              openCourseResource: 0,
              enableSubtitle: 0,
              enableSkipVideoTitle: 0,
            },
          };
        },
      },
      log,
    );

    const result = await restoreSession(ports, storedUser, SITE);
    expect(log.calls).toEqual(["validate:tok-old", "currentUser"]);
    if (result.status !== "success") {
      throw new Error("预期成功");
    }
    expect(result.data.token).toBe("tok-old");
    expect(result.data.identity.name).toBe("张三");
  });

  it("复用令牌但资料接口失败时保留存储资料", async () => {
    const ports = makePorts({
      validateToken: async () => ({ ok: true, data: true }),
      fetchCurrentUser: async () => ({
        ok: false,
        failure: { endpoint: "e", status: 500, raw: "", reason: "httpStatus" },
      }),
    });
    const result = await restoreSession(ports, storedUser, SITE);
    if (result.status !== "success") {
      throw new Error("预期成功");
    }
    expect(result.data.identity).toEqual({ name: "旧姓名", headimage: null });
  });

  it("令牌失效时以凭据登录并复验一次", async () => {
    const log: PortLog = { calls: [] };
    const ports = makePorts(
      {
        validateToken: async (_site: Site, token: string) => {
          log.calls.push(`validate:${token}`);
          return { ok: true, data: token === "tok-new" };
        },
        login: async () => {
          log.calls.push("login");
          return { status: "success", response: loginResponse("tok-new") };
        },
      },
      log,
    );

    const result = await restoreSession(ports, storedUser, SITE);
    expect(log.calls).toEqual(["validate:tok-old", "login", "validate:tok-new"]);
    if (result.status !== "success") {
      throw new Error("预期成功");
    }
    expect(result.data.token).toBe("tok-new");
  });

  it("令牌失效且凭据登录失败时返回说明, 不产生账号数据", async () => {
    const ports = makePorts({
      validateToken: async () => ({ ok: true, data: false }),
      login: async () => ({ status: "rejected", code: 1201, message: "用户不存在" }),
    });
    const result = await restoreSession(ports, storedUser, SITE);
    expect(result.status).toBe("failed");
  });

  it("登录成功但令牌复验失败时返回说明", async () => {
    const ports = makePorts({
      validateToken: async () => ({ ok: true, data: false }),
      login: async () => ({ status: "success", response: loginResponse("tok-new") }),
    });
    const result = await restoreSession(ports, storedUser, SITE);
    if (result.status !== "failed") {
      throw new Error("预期失败");
    }
    expect(result.error.message).toContain("令牌复验失败");
  });
});

describe("updateCredential", () => {
  it("新凭据校验成功后返回新令牌与资料", async () => {
    const ports = makePorts({
      login: async () => ({ status: "success", response: loginResponse("tok-9") }),
      validateToken: async () => ({ ok: true, data: true }),
    });
    const result = await updateCredential(ports, {
      username: "202501001",
      nextSite: SITE,
      nextPassword: "新密码",
    });
    if (result.status !== "success") {
      throw new Error("预期成功");
    }
    expect(result.data).toMatchObject({
      siteRef: "ulearning",
      password: "新密码",
      token: "tok-9",
    });
  });

  it("校验失败时返回错误, 调用方无需回滚", async () => {
    const ports = makePorts({
      login: async () => ({ status: "rejected", code: 1201, message: "用户不存在" }),
    });
    const result = await updateCredential(ports, {
      username: "202501001",
      nextSite: SITE,
      nextPassword: "错误",
    });
    if (result.status !== "failed") {
      throw new Error("预期失败");
    }
    expect(result.error.message).toBe("1201 用户不存在");
  });
});
