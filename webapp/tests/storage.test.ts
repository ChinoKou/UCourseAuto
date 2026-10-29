import { describe, expect, it } from "vitest";

import type { ConfigModel } from "@/schema/domain/config";
import { buildSyncStudyRecordRequest } from "@/logic/studyRecord/buildRequest";
import {
  CONFIG_KEY,
  createDefaultConfig,
  loadConfig,
  saveConfig,
} from "@/storage/configStorage";

/** 内存版 Storage 实现, 测试经依赖注入替代浏览器 localStorage */
export class MemoryStorage implements Storage {
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

/** setItem 恒定抛出的 Storage 实现, 模拟配额耗尽 */
class QuotaExceededStorage extends MemoryStorage {
  setItem(key: string, _value: string): void {
    throw new Error(`配额耗尽: ${key}`);
  }
}

/** 覆盖全部字段的非默认配置样本 */
export const sampleConfig: ConfigModel = {
  config_version: 1,
  active_user: "202501001",
  users: [
    {
      site: "ulearning",
      username: "202501001",
      password: "明文密码",
      token: "tok-1234567890",
      name: "张三",
      headimage: "https://example.com/avatar.png",
      courses: [
        {
          course_id: 101,
          course_name: "高等数学",
          class_id: 11,
          class_user_id: 1101,
          textbooks: [
            {
              textbook_id: 201,
              textbook_name: "线性代数",
              status: 1,
              limit: 2,
              chapters: [],
            },
          ],
        },
      ],
    },
  ],
  custom_sites: [],
  study_time: {
    question: { min: 60, max: 120 },
    document: { min: 30, max: 90 },
    content: { min: 45, max: 100 },
  },
  sleep_time: 2.5,
  anti_detection: true,
};

describe("loadConfig", () => {
  it("键不存在时返回默认配置(与 cli 的 ConfigModel 默认值一致)", () => {
    const storage = new MemoryStorage();
    const config = loadConfig(storage);
    expect(config).toEqual({
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
    });
    expect(config).toEqual(createDefaultConfig());
  });

  it("写入后读回一致", () => {
    const storage = new MemoryStorage();
    saveConfig(sampleConfig, storage);

    expect(storage.length).toBe(1);
    expect(storage.getItem(CONFIG_KEY)).toBe(JSON.stringify(sampleConfig));
    expect(loadConfig(storage)).toEqual(sampleConfig);
  });

  it("JSON 损坏时保留原存储并返回默认配置", () => {
    const storage = new MemoryStorage();
    storage.setItem(CONFIG_KEY, "{损坏的 JSON");
    expect(loadConfig(storage)).toEqual(createDefaultConfig());
    expect(storage.getItem(CONFIG_KEY)).toBe("{损坏的 JSON");
  });

  it("zod 校验失败时保留原存储并返回默认配置", () => {
    const storage = new MemoryStorage();
    const badJson = JSON.stringify({ config_version: 1, sleep_time: "bad" });
    storage.setItem(CONFIG_KEY, badJson);
    expect(loadConfig(storage)).toEqual(createDefaultConfig());
    expect(storage.getItem(CONFIG_KEY)).toBe(badJson);
  });

  it("版本号类型异常时保留原存储并返回默认配置", () => {
    const storage = new MemoryStorage();
    const badVersion = JSON.stringify({ config_version: "1" });
    storage.setItem(CONFIG_KEY, badVersion);
    expect(loadConfig(storage)).toEqual(createDefaultConfig());
    expect(storage.getItem(CONFIG_KEY)).toBe(badVersion);
  });

  it("合法的配置数据正常读取并保留原有字段", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      CONFIG_KEY,
      JSON.stringify({
        config_version: 1,
        sleep_time: 5,
        active_user: "202501001",
        users: [
          {
            site: "ulearning",
            username: "202501001",
            password: "旧密码",
            token: "tok-old",
            courses: [],
            name: "张三",
            headimage: null,
          },
        ],
      }),
    );

    const config = loadConfig(storage);
    expect(config.config_version).toBe(1);
    expect(config.sleep_time).toBe(5);
    expect(config.active_user).toBe("202501001");
    expect(config.users[0].password).toBe("旧密码");
    expect(config.users[0].token).toBe("tok-old");
    expect(config.users[0].name).toBe("张三");
    expect(config.custom_sites).toEqual([]);
  });
});

describe("saveConfig", () => {
  it("写入抛出时向上抛出", () => {
    const storage = new QuotaExceededStorage();
    expect(() => saveConfig(createDefaultConfig(), storage)).toThrow("配额耗尽");
    expect(storage.getItem(CONFIG_KEY)).toBeNull();
  });
});

describe("课件元素存储往返", () => {
  it("文档与纯文本元素只保留 kind, 序列化文本不包含正文内容", () => {
    const storage = new MemoryStorage();
    const config: ConfigModel = {
      ...createDefaultConfig(),
      active_user: "ulearning::202501001",
      users: [
        {
          site: "ulearning",
          username: "202501001",
          password: "pw",
          token: "tok",
          name: "",
          headimage: null,
          courses: [
            {
              course_id: 301,
              course_name: "课程",
              class_id: 30,
              class_user_id: 3001,
              textbooks: [
                {
                  textbook_id: 50101,
                  textbook_name: "教材",
                  status: 1,
                  limit: 2,
                  chapters: [
                    {
                      chapter_id: 101,
                      chapter_name: "章",
                      sections: [
                        {
                          section_id: 1011,
                          section_name: "节",
                          pages: [
                            {
                              page_id: 1,
                              page_relation_id: 1001,
                              page_name: "文档页",
                              page_content_type: 5,
                              is_complete: false,
                              elements: [{ kind: "document" }],
                            },
                            {
                              page_id: 2,
                              page_relation_id: 1002,
                              page_name: "文本页",
                              page_content_type: 5,
                              is_complete: false,
                              elements: [{ kind: "content" }],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    saveConfig(config, storage);
    const raw = storage.getItem(CONFIG_KEY) ?? "";
    expect(raw).not.toContain("document_content");
    expect(raw).not.toContain("content_content");

    const restored = loadConfig(storage);
    const pages = restored.users[0].courses[0].textbooks[0].chapters[0].sections[0].pages;
    expect(pages[0].elements).toEqual([{ kind: "document" }]);
    expect(pages[1].elements).toEqual([{ kind: "content" }]);

    const section = restored.users[0].courses[0].textbooks[0].chapters[0].sections[0];
    const request = buildSyncStudyRecordRequest(
      section,
      1730000000,
      "张三",
      {
        question: { min: 180, max: 360 },
        document: { min: 500, max: 500 },
        content: { min: 60, max: 60 },
      },
      "realDuration",
      { randint: (min) => min, uniform: () => 3, now: () => 1730000100 },
    );
    expect(request.pageStudyRecordDTOList[0].studyTime).toBe(500);
    expect(request.pageStudyRecordDTOList[1].studyTime).toBe(60);
  });

  it("旧结构中的正文残留字段被拒绝", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      CONFIG_KEY,
      JSON.stringify({
        config_version: 1,
        users: [
          {
            site: "ulearning",
            username: "a",
            password: "pw",
            token: "tok",
            courses: [
              {
                course_id: 301,
                course_name: "课程",
                class_id: 30,
                class_user_id: 3001,
                textbooks: [
                  {
                    textbook_id: 50101,
                    textbook_name: "教材",
                    status: 1,
                    limit: 2,
                    chapters: [
                      {
                        chapter_id: 101,
                        chapter_name: "章",
                        sections: [
                          {
                            section_id: 1011,
                            section_name: "节",
                            pages: [
                              {
                                page_id: 1,
                                page_relation_id: 1001,
                                page_name: "文档页",
                                page_content_type: 5,
                                elements: [{ kind: "document", document_content: "正文" }],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    );

    expect(loadConfig(storage).users).toEqual([]);
  });
});
