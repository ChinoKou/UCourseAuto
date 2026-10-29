import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ConfigModel } from "@/schema/domain/config";
import { accountKeyOf } from "@/schema/domain/config";
import { useConfigStore } from "@/state/configStore";
import { CONFIG_KEY, loadConfig } from "@/storage/configStorage";
import { Avatar } from "@/ui/common/Avatar";

/** 内存版 Storage 实现, 供配置写回与读取使用 */
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

describe("Avatar 组件", () => {
  it("传入有效 url 时立即渲染图片", () => {
    const html = renderToStaticMarkup(
      React.createElement(Avatar, {
        name: "张三",
        url: "https://example.com/avatar.png",
        size: 36,
      }),
    );
    expect(html).toContain("<img");
    expect(html).toContain('src="https://example.com/avatar.png"');
    expect(html).toContain('alt="张三"');
    expect(html).toContain("uc-avatar--image");
  });

  it("url 为空或 null 时回退到姓名首字与稳定色调", () => {
    const htmlNull = renderToStaticMarkup(
      React.createElement(Avatar, { name: "李四", url: null, size: 36 }),
    );
    expect(htmlNull).not.toContain("<img");
    expect(htmlNull).toContain("李");

    const htmlEmpty = renderToStaticMarkup(
      React.createElement(Avatar, { name: "王五", url: "  ", size: 36 }),
    );
    expect(htmlEmpty).not.toContain("<img");
    expect(htmlEmpty).toContain("王");
  });
});

describe("头像与姓名刷新", () => {
  it("登录资料写入存储后, 经 loadConfig 读取仍能取到姓名与头像", () => {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, "localStorage", {
      value: storage,
      configurable: true,
    });

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
    useConfigStore.setState({ config: emptyConfig });

    useConfigStore.getState().addAccount({
      siteRef: "ulearning",
      username: "user_avatar_test",
      password: "password123",
      token: "tok_test_123",
      activate: true,
    });
    useConfigStore.getState().saveIdentity(accountKeyOf("ulearning", "user_avatar_test"), {
      name: "张三",
      headimage: "https://example.com/avatar_zhang.png",
    });

    expect(storage.getItem(CONFIG_KEY)).not.toBeNull();
    const restored = loadConfig(storage);
    const user = restored.users.find((item) => item.username === "user_avatar_test");
    expect(user?.name).toBe("张三");
    expect(user?.headimage).toBe("https://example.com/avatar_zhang.png");
    expect(restored.active_user).toBe(accountKeyOf("ulearning", "user_avatar_test"));
  });
});
