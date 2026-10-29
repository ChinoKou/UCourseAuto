/// <reference types="node" />
import { describe, expect, it } from "vitest";

import { accountKeyOf } from "@/schema/domain/config";
import { createErrorDetail } from "@/error/report";
import type { ConfigModel, UserConfig } from "@/schema/domain/config";
import { selectActiveUser, useConfigStore } from "@/state/configStore";
import { BUILTIN_SITES } from "@/schema/domain/site";
import type { PlatformResult } from "@/apis/result";
import type { SignInPorts } from "@/usecases/ports";
import { addAccountWithLogin } from "@/usecases/signIn";

/** 登录响应样本: 平台多返回一个图片字段, 账号展示字段应在选择器中可读 */
const loginResponse = {
  authorization: "tok-1",
  name: "张三",
  roleId: 9,
  userId: 1,
  orgId: 1,
  loginName: "202501001",
  headimage: "https://example.com/avatar.png",
};

const ports: SignInPorts = {
  login: async (): Promise<ReturnType<SignInPorts["login"]> extends Promise<infer T> ? T : never> => ({
    status: "success",
    response: loginResponse,
  }),
  validateToken: async (): Promise<PlatformResult<boolean>> => ({ ok: true, data: true }),
  fetchCurrentUser: async () => ({
    ok: true,
    data: {
      userid: 1,
      name: "张三",
      headimage: "https://example.com/avatar.png",
      orgid: 1,
      logo: null,
      roleid: 9,
      antiCheat: 0,
      antiDrag: 0,
      openCourseResource: 0,
      enableSubtitle: 0,
      enableSkipVideoTitle: 0,
    },
  }),
};

/** 内存版 Storage, 供 store 写回使用 */
class MemoryStorage implements Storage {
  private readonly entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }
}

const emptyConfig: ConfigModel = {
  config_version: 1,
  active_user: "",
  users: [],
  custom_sites: [],
  study_time: {
    question: { min: 180, max: 360 },
    document: { min: 180, max: 360 },
    content: { min: 180, max: 360 },
  },
  sleep_time: 1,
  anti_detection: false,
};

describe("账号展示字段", () => {
  it("登录响应中的头像经 signIn 映射后能在选择器中读到", async () => {
    Object.defineProperty(globalThis, "localStorage", {
      value: new MemoryStorage(),
      configurable: true,
    });
    useConfigStore.setState({ config: structuredClone(emptyConfig) });

    const result = await addAccountWithLogin(ports, BUILTIN_SITES[0], "202501001", "pw");
    if (result.status !== "success") {
      throw new Error("预期成功");
    }

    const { addAccount, saveIdentity } = useConfigStore.getState();
    addAccount({
      siteRef: result.data.siteRef,
      username: result.data.username,
      password: result.data.password,
      token: result.data.token,
      activate: true,
    });
    saveIdentity(
      accountKeyOf(result.data.siteRef, result.data.username),
      result.data.identity,
    );

    const active: UserConfig | null = selectActiveUser(useConfigStore.getState());
    expect(active?.name).toBe("张三");
    expect(active?.headimage).toBe("https://example.com/avatar.png");
  });

  it("错误详情可重复构造且编号连续", () => {
    const first = createErrorDetail({ title: "失败", message: "说明" });
    const second = createErrorDetail({ title: "失败", message: "说明" });
    expect(second.id).toBe(first.id + 1);
  });
});
