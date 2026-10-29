import { beforeEach, describe, expect, it } from "vitest";

import { createErrorDetail } from "@/error/report";
import { accountKeyOf, type ConfigModel } from "@/schema/domain/config";
import { selectActiveUser, syncFromStorageEvent, useConfigStore } from "@/state/configStore";
import { CONFIG_KEY, loadConfig } from "@/storage/configStorage";

/** 内存版 Storage 实现, 供 store 写回与读取使用 */
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

const installStorage = (storage: Storage): void => {
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
};

const seedAccount = (
  siteRef: string,
  username: string,
  activate = false,
): void => {
  useConfigStore.getState().addAccount({
    siteRef,
    username,
    password: "pw",
    token: "tok",
    activate,
  });
};

beforeEach(() => {
  installStorage(new MemoryStorage());
  syncFromStorageEvent(null);
  useConfigStore.setState({ config: structuredClone(emptyConfig) });
});

describe("configStore 账号键", () => {
  it("addAccount 新增账号并保存账号键为活跃账号", () => {
    seedAccount("ulearning", "202501001", true);

    const state = useConfigStore.getState();
    expect(state.config.active_user).toBe(
      accountKeyOf("ulearning", "202501001"),
    );
    expect(state.config.users).toHaveLength(1);
    expect(state.config.users[0].token).toBe("tok");
    expect(JSON.parse(globalThis.localStorage.getItem(CONFIG_KEY) ?? "{}")).toMatchObject({
      active_user: accountKeyOf("ulearning", "202501001"),
    });
  });

  it("同一用户名在不同站点下可以并存", () => {
    seedAccount("ulearning", "a", true);
    seedAccount("dgut", "a");

    const state = useConfigStore.getState();
    expect(state.config.users).toHaveLength(2);
    expect(state.config.users.map((user) => user.site)).toEqual([
      "ulearning",
      "dgut",
    ]);
  });

  it("相同账号键未确认时拒绝新增, 确认覆盖后清空课件", () => {
    seedAccount("ulearning", "a", true);
    useConfigStore.getState().replaceCourseware([
      { course_id: 1, course_name: "课程", class_id: 2, class_user_id: 3, textbooks: [] },
    ]);

    expect(() => seedAccount("ulearning", "a")).toThrow("账号已存在");

    const written = useConfigStore.getState().addAccount({
      siteRef: "ulearning",
      username: "a",
      password: "新密码",
      token: "tok-new",
      activate: true,
      overwrite: true,
    });
    expect(written).toBe(true);
    const account = useConfigStore.getState().config.users[0];
    expect(account.token).toBe("tok-new");
    expect(account.courses).toEqual([]);
  });

  it("saveCredential 只更新已有账号, 账号不存在时不写入", () => {
    seedAccount("ulearning", "a", true);
    const updated = useConfigStore.getState().saveCredential({
      siteRef: "ulearning",
      username: "a",
      password: "新密码",
      token: "tok-new",
      activate: false,
    });
    expect(updated).toBe(true);
    expect(useConfigStore.getState().config.users[0].token).toBe("tok-new");

    const missing = useConfigStore.getState().saveCredential({
      siteRef: "ulearning",
      username: "missing",
      password: "pw",
      token: "tok",
      activate: false,
    });
    expect(missing).toBe(false);
    expect(useConfigStore.getState().config.users).toHaveLength(1);
  });

  it("saveIdentity 按账号键写入姓名与头像, 账号不存在时抛出", () => {
    seedAccount("ulearning", "a", true);
    const key = accountKeyOf("ulearning", "a");
    useConfigStore.getState().saveIdentity(key, {
      name: "张三",
      headimage: "https://example.com/a.png",
    });

    const user = useConfigStore.getState().config.users[0];
    expect(user.name).toBe("张三");
    expect(user.headimage).toBe("https://example.com/a.png");

    expect(() =>
      useConfigStore.getState().saveIdentity("missing", { name: "x", headimage: null }),
    ).toThrow("账号不存在: missing");
  });

  it("removeAccount 删除活跃账号时清空 active_user", () => {
    seedAccount("ulearning", "a", true);
    useConfigStore.getState().removeAccount(accountKeyOf("ulearning", "a"));

    expect(useConfigStore.getState().config.active_user).toBe("");
    expect(useConfigStore.getState().config.users).toEqual([]);
  });

  it("switchUser 与 logout 只切换活跃账号", () => {
    seedAccount("ulearning", "a", true);
    seedAccount("ulearning", "b");
    const keyB = accountKeyOf("ulearning", "b");
    useConfigStore.getState().switchUser(keyB);
    expect(useConfigStore.getState().config.active_user).toBe(keyB);

    useConfigStore.getState().logout();
    expect(useConfigStore.getState().config.active_user).toBe("");
    expect(useConfigStore.getState().config.users).toHaveLength(2);
  });

  it("updateAccount 站点变化时清空课件并同步活跃账号键", () => {
    seedAccount("ulearning", "a", true);
    const key = accountKeyOf("ulearning", "a");
    useConfigStore.getState().replaceCourseware([
      { course_id: 1, course_name: "课程", class_id: 2, class_user_id: 3, textbooks: [] },
    ]);

    useConfigStore.getState().updateAccount(key, {
      siteRef: "dgut",
      password: "pw",
      token: "tok-new",
    });

    const state = useConfigStore.getState();
    const account = state.config.users[0];
    expect(account.site).toBe("dgut");
    expect(account.courses).toEqual([]);
    expect(state.config.active_user).toBe(accountKeyOf("dgut", "a"));
    expect(selectActiveUser(state)?.username).toBe("a");
  });

  it("updateAccount 仅刷新令牌时保留课件", () => {
    seedAccount("ulearning", "a", true);
    const key = accountKeyOf("ulearning", "a");
    useConfigStore.getState().replaceCourseware([
      { course_id: 1, course_name: "课程", class_id: 2, class_user_id: 3, textbooks: [] },
    ]);

    useConfigStore.getState().updateAccount(key, {
      siteRef: "ulearning",
      password: "新密码",
      token: "tok-new",
    });

    expect(useConfigStore.getState().config.users[0].courses).toHaveLength(1);
    expect(useConfigStore.getState().config.active_user).toBe(key);
  });
});

describe("configStore 设置与站点", () => {
  it("updateSettings 写入三类设置并持久化", () => {
    useConfigStore.getState().updateSettings({
      sleep_time: 3.5,
      anti_detection: true,
      study_time: {
        question: { min: 10, max: 20 },
        document: { min: 30, max: 40 },
        content: { min: 50, max: 60 },
      },
    });

    const saved = loadConfig(globalThis.localStorage);
    expect(saved.sleep_time).toBe(3.5);
    expect(saved.anti_detection).toBe(true);
    expect(saved.study_time.content).toEqual({ min: 50, max: 60 });
  });

  it("addCustomSite 返回引用值, 名称重复时抛出", () => {
    const ref = useConfigStore.getState().addCustomSite({
      name: "校内站点",
      course_api: "https://a.example.com/courseapi",
      ua_api: "https://a.example.com/uaapi",
    });
    if (ref === null) {
      throw new Error("预期返回站点引用值");
    }
    expect(ref.startsWith("custom:")).toBe(true);
    expect(useConfigStore.getState().config.custom_sites).toHaveLength(1);

    expect(() =>
      useConfigStore.getState().addCustomSite({
        name: "校内站点",
        course_api: "https://b.example.com/courseapi",
        ua_api: "https://b.example.com/uaapi",
      }),
    ).toThrow("站点名称已存在");
  });

  it("removeCustomSite 在仍有账号引用时拒绝删除", () => {
    const ref = useConfigStore.getState().addCustomSite({
      name: "校内站点",
      course_api: "https://a.example.com/courseapi",
      ua_api: "https://a.example.com/uaapi",
    });
    if (ref === null) {
      throw new Error("预期返回站点引用值");
    }
    seedAccount(ref, "a", true);

    const id = useConfigStore.getState().config.custom_sites[0].id;
    expect(() => useConfigStore.getState().removeCustomSite(id)).toThrow(
      "仍有 1 个账号使用该站点",
    );
  });

  it("有账号引用时允许改名, 修改地址被拒绝", () => {
    const ref = useConfigStore.getState().addCustomSite({
      name: "校内站点",
      course_api: "https://a.example.com/courseapi",
      ua_api: "https://a.example.com/uaapi",
    });
    if (ref === null) {
      throw new Error("预期返回站点引用值");
    }
    seedAccount(ref, "a", true);
    const id = useConfigStore.getState().config.custom_sites[0].id;

    expect(
      useConfigStore.getState().updateCustomSite(id, {
        name: "校内站点（新）",
        course_api: "https://a.example.com/courseapi",
        ua_api: "https://a.example.com/uaapi",
      }),
    ).toBe(true);
    expect(useConfigStore.getState().config.custom_sites[0].name).toBe("校内站点（新）");

    expect(() =>
      useConfigStore.getState().updateCustomSite(id, {
        name: "校内站点（新）",
        course_api: "https://c.example.com/courseapi",
        ua_api: "https://a.example.com/uaapi",
      }),
    ).toThrow("地址不可修改");
  });

  it("无账号引用时可修改地址, 与其他站点重名时抛出", () => {
    useConfigStore.getState().addCustomSite({
      name: "站点一",
      course_api: "https://a.example.com/courseapi",
      ua_api: "https://a.example.com/uaapi",
    });
    useConfigStore.getState().addCustomSite({
      name: "站点二",
      course_api: "https://b.example.com/courseapi",
      ua_api: "https://b.example.com/uaapi",
    });
    const [first, second] = useConfigStore.getState().config.custom_sites;

    useConfigStore.getState().updateCustomSite(first.id, {
      name: "站点一（新）",
      course_api: "https://c.example.com/courseapi/",
      ua_api: "https://c.example.com/uaapi/",
    });
    const updated = useConfigStore.getState().config.custom_sites[0];
    expect(updated.name).toBe("站点一（新）");
    expect(updated.course_api).toBe("https://c.example.com/courseapi");

    expect(() =>
      useConfigStore.getState().updateCustomSite(first.id, {
        name: second.name,
        course_api: "https://c.example.com/courseapi",
        ua_api: "https://c.example.com/uaapi",
      }),
    ).toThrow("站点名称已存在");
  });
});

describe("configStore 课件树", () => {
  const seedUser = (): void => {
    seedAccount("ulearning", "a", true);
  };

  it("replaceCourseware 写入活跃账号的课件树", () => {
    seedUser();
    useConfigStore.getState().replaceCourseware([
      { course_id: 1, course_name: "课程", class_id: 2, class_user_id: 3, textbooks: [] },
    ]);
    expect(useConfigStore.getState().config.users[0].courses).toHaveLength(1);
  });

  it("removeCourseware 删除页面并剔除空容器", () => {
    seedUser();
    useConfigStore.getState().replaceCourseware([
      {
        course_id: 1,
        course_name: "课程",
        class_id: 2,
        class_user_id: 3,
        textbooks: [
          {
            textbook_id: 4,
            textbook_name: "教材",
            status: 1,
            limit: 2,
            chapters: [
              {
                chapter_id: 5,
                chapter_name: "章",
                sections: [
                  {
                    section_id: 6,
                    section_name: "节",
                    pages: [
                      {
                        page_id: 7,
                        page_relation_id: 8,
                        page_name: "页",
                        page_content_type: 5,
                        is_complete: false,
                        elements: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);

    useConfigStore.getState().removeCourseware({ kind: "page", pageId: 7 });
    expect(useConfigStore.getState().config.users[0].courses).toEqual([]);
  });

  it("removePages 按 id 集合删除并保留其余页面", () => {
    seedUser();
    useConfigStore.getState().replaceCourseware([
      {
        course_id: 1,
        course_name: "课程",
        class_id: 2,
        class_user_id: 3,
        textbooks: [
          {
            textbook_id: 4,
            textbook_name: "教材",
            status: 1,
            limit: 2,
            chapters: [
              {
                chapter_id: 5,
                chapter_name: "章",
                sections: [
                  {
                    section_id: 6,
                    section_name: "节",
                    pages: [
                      {
                        page_id: 7,
                        page_relation_id: 8,
                        page_name: "页一",
                        page_content_type: 5,
                        is_complete: false,
                        elements: [],
                      },
                      {
                        page_id: 9,
                        page_relation_id: 10,
                        page_name: "页二",
                        page_content_type: 5,
                        is_complete: false,
                        elements: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);

    useConfigStore.getState().removePages([7]);
    const courses = useConfigStore.getState().config.users[0].courses;
    expect(
      courses[0].textbooks[0].chapters[0].sections[0].pages.map((page) => page.page_id),
    ).toEqual([9]);
  });

  it("存储写入失败时触发错误提示, 配置仍保留在内存", () => {
    seedUser();
    const memory = new MemoryStorage();
    memory.setItem(
      CONFIG_KEY,
      JSON.stringify(useConfigStore.getState().config),
    );
    installStorage({
      length: memory.length,
      clear: () => {
        memory.clear();
      },
      getItem: (key) => memory.getItem(key),
      key: (index) => memory.key(index),
      setItem: () => {
        throw new Error("配额耗尽");
      },
      removeItem: (key) => {
        memory.removeItem(key);
      },
    });

    expect(useConfigStore.getState().updateSettings({ sleep_time: 2 })).toBe(true);
    expect(useConfigStore.getState().config.sleep_time).toBe(2);
  });
});

describe("错误详情构造", () => {
  it("createErrorDetail 递增编号并保留接口与原始响应", () => {
    const first = createErrorDetail({
      title: "失败",
      message: "说明",
      endpoint: "e",
      status: 500,
      raw: "x",
    });
    const second = createErrorDetail({ title: "失败", message: "说明" });
    expect(second.id).toBe(first.id + 1);
    expect(first.time).toBeInstanceOf(Date);
    expect(first.endpoint).toBe("e");
  });
});
