import { reportError } from "@/error/report";
import { configSchema, type ConfigModel } from "@/schema/domain/config";

/**
 * 配置存储层: localStorage 的读取、版本校验与写入, 键名与序列化集中于此。
 * 网页版配置版本为 1; 缺失版本号、类型异常或大于当前版本均判定为载入失败。
 * 载入失败时不强行静默覆盖, 向上暴露异常以供界面呈现一键重置引导; 写入异常向上抛出。
 */

/** 配置存储键名 */
export const CONFIG_KEY = "ucourse_config";

/** 当前配置版本号 */
export const CONFIG_VERSION = 1;

/** 存储对象字典结构 */
export type ConfigDict = Record<string, unknown>;

/** 高版本配置不兼容异常 */
export class ConfigVersionMismatchError extends Error {
  readonly storedVersion: number;
  readonly supportedVersion: number;

  constructor(storedVersion: number, supportedVersion: number) {
    super(
      `检测到不支持的高版本配置 (v${storedVersion})，当前应用仅支持 v${supportedVersion}。配置载入失败，请点击重置。`,
    );
    this.name = "ConfigVersionMismatchError";
    this.storedVersion = storedVersion;
    this.supportedVersion = supportedVersion;
  }
}

/** 构造默认配置, 全部字段取 zod 模型默认值 */
export const createDefaultConfig = (): ConfigModel => configSchema.parse({});

/** 判定 JSON 解析结果是否为配置对象 */
const isConfigDict = (value: unknown): value is ConfigDict =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** 校验配置版本号, 缺失、类型异常或大于当前版本号时就地抛出 */
const checkConfigVersion = (configDict: ConfigDict): ConfigDict => {
  const versionValue = configDict["config_version"];

  if (typeof versionValue !== "number" || !Number.isInteger(versionValue)) {
    throw new TypeError(`配置版本号类型错误: ${typeof versionValue}`);
  }

  if (versionValue > CONFIG_VERSION) {
    throw new ConfigVersionMismatchError(versionValue, CONFIG_VERSION);
  }

  return configDict;
};

/** 配置载入结果 */
export interface LoadConfigResult {
  config: ConfigModel;
  error: Error | null;
}

/**
 * 把存储原文解析为配置: JSON 解析 → 版本校验 → zod 校验。
 * 任一环节不通过时就地抛出, 由调用方决定保留旧配置还是引导重置。
 */
export const parseConfigJson = (raw: string): ConfigModel => {
  const parsed: unknown = JSON.parse(raw);
  if (!isConfigDict(parsed)) {
    throw new TypeError("配置顶层必须是 JSON 对象");
  }
  return configSchema.parse(checkConfigVersion(parsed));
};

/**
 * 读取本地配置并返回结果状态: 读取 → JSON 解析 → 版本校验 → zod 校验。
 * 遇到异常时保留存储原状并返回默认配置与异常详情, 供界面触发重置提示。
 */
export const loadConfigWithStatus = (storage?: Storage): LoadConfigResult => {
  const store = storage ?? globalThis.localStorage;
  if (store === undefined || typeof store.getItem !== "function") {
    return { config: createDefaultConfig(), error: null };
  }
  const raw = store.getItem(CONFIG_KEY);

  if (raw === null) {
    return { config: createDefaultConfig(), error: null };
  }

  try {
    return { config: parseConfigJson(raw), error: null };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    reportError({
      title: "本地配置载入失败",
      message: err.message,
    });
    return {
      config: createDefaultConfig(),
      error: err,
    };
  }
};

/** 读取本地配置, 简化返回配置数据对象 */
export const loadConfig = (storage?: Storage): ConfigModel =>
  loadConfigWithStatus(storage).config;

/** 手动重置本地存储配置为当前默认配置 */
export const resetConfigStorage = (storage?: Storage): ConfigModel => {
  const store = storage ?? globalThis.localStorage;
  if (store !== undefined && typeof store.removeItem === "function") {
    store.removeItem(CONFIG_KEY);
  }
  const fresh = createDefaultConfig();
  saveConfig(fresh, store);
  return fresh;
};

/** 序列化配置并写入 localStorage; 写入异常向上抛出 */
export const saveConfig = (config: ConfigModel, storage?: Storage): void => {
  const store = storage ?? globalThis.localStorage;
  if (store === undefined || typeof store.setItem !== "function") {
    return;
  }
  store.setItem(CONFIG_KEY, JSON.stringify(config));
};

/** 读取存储中的配置原文, 存储不可用时返回 null */
export const readConfigJson = (storage?: Storage): string | null => {
  const store = storage ?? globalThis.localStorage;
  if (store === undefined || typeof store.getItem !== "function") {
    return null;
  }
  return store.getItem(CONFIG_KEY);
};
