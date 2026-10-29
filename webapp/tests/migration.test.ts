import { describe, expect, it } from "vitest";

import {
  CONFIG_KEY,
  CONFIG_VERSION,
  ConfigVersionMismatchError,
  createDefaultConfig,
  loadConfig,
  loadConfigWithStatus,
  resetConfigStorage,
} from "@/storage/configStorage";

/** 内存版 Storage 实现, 测试经依赖注入替代浏览器 localStorage */
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

describe("配置版本与校验", () => {
  it("默认配置版本号为 1", () => {
    expect(CONFIG_VERSION).toBe(1);
    expect(createDefaultConfig().config_version).toBe(1);
    expect(createDefaultConfig().custom_sites).toEqual([]);
  });

  it("正常 v1 配置完整载入并保留字段", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      CONFIG_KEY,
      JSON.stringify({
        config_version: 1,
        active_user: "2025001",
        users: [],
        custom_sites: [],
        study_time: {
          question: { min: 100, max: 200 },
          document: { min: 300, max: 400 },
          content: { min: 500, max: 600 },
        },
        sleep_time: 2,
        anti_detection: true,
      }),
    );

    const result = loadConfigWithStatus(storage);
    expect(result.error).toBeNull();
    expect(result.config.config_version).toBe(1);
    expect(result.config.active_user).toBe("2025001");
    expect(result.config.sleep_time).toBe(2);
  });

  it("检测到大于当前版本的配置时报告版本不兼容错误并不静默丢失存储", () => {
    const storage = new MemoryStorage();
    const futureJson = JSON.stringify({
      config_version: 3,
      future_field: "value",
    });
    storage.setItem(CONFIG_KEY, futureJson);

    const result = loadConfigWithStatus(storage);
    expect(result.error).toBeInstanceOf(ConfigVersionMismatchError);
    expect((result.error as ConfigVersionMismatchError).storedVersion).toBe(3);
    expect((result.error as ConfigVersionMismatchError).supportedVersion).toBe(1);
    // 遇到高版本不兼容时存储中的数据原样保留，等待用户明确确认重置
    expect(storage.getItem(CONFIG_KEY)).toBe(futureJson);
  });

  it("点击重置后清除高版本配置并重置为干净的 v1 配置", () => {
    const storage = new MemoryStorage();
    storage.setItem(CONFIG_KEY, JSON.stringify({ config_version: 2 }));

    const fresh = resetConfigStorage(storage);
    expect(fresh.config_version).toBe(1);
    expect(loadConfig(storage).config_version).toBe(1);
  });

  it("缺失版本号或损坏的配置上报错误", () => {
    const storage = new MemoryStorage();
    storage.setItem(CONFIG_KEY, "{损坏的 JSON");

    const result = loadConfigWithStatus(storage);
    expect(result.error).not.toBeNull();
    expect(result.config).toEqual(createDefaultConfig());
  });

  it("版本号类型异常时上报类型错误", () => {
    const storage = new MemoryStorage();
    storage.setItem(CONFIG_KEY, JSON.stringify({ config_version: "1" }));

    const result = loadConfigWithStatus(storage);
    expect(result.error).toBeInstanceOf(TypeError);
  });
});
