import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { reportError } from "@/error/report";
import {
  cloneCourses,
  mergeCourses,
  removeCourseware as removeCoursewareTree,
  removePageIds,
} from "@/logic/courseware/tree";
import { accountKeyOf, type ConfigModel, type UserConfig, type UserIdentity } from "@/schema/domain/config";
import type { ModelCourse } from "@/schema/domain/course";
import { customSiteRef, customSiteSchema } from "@/schema/domain/site";
import { useRunStore } from "@/state/runStore";
import {
  CONFIG_KEY,
  ConfigVersionMismatchError,
  createDefaultConfig,
  loadConfigWithStatus,
  parseConfigJson,
  readConfigJson,
  resetConfigStorage,
  saveConfig,
} from "@/storage/configStorage";

/**
 * 配置、账号与课件树的唯一写入口: 全部变更动作经此 store,
 * 动作内立即写回 localStorage; 写回失败上报到右上角提示, 不静默丢弃。
 * 课件树的所有权约定: 调用方传自己的快照, 写入前由 replaceCourseware 复制,
 * 复制后的对象被 immer 冻结属于状态层, 与调用方的工作树互不影响。
 *
 * 多标签页: 每个变更动作写入前比对存储原文与上次写入的原文,
 * 不一致说明其他标签页已经改过配置, 本次动作返回 false 并提示刷新。
 */

/** 登录成功后写入的凭据与令牌 */
export interface CredentialInput {
  /** 站点引用值, 内置站点为固定标识, 自定义站点为 custom:${id} */
  siteRef: string;
  username: string;
  password: string;
  /** 登录响应的 authorization, 即鉴权令牌 */
  token: string;
  /** 新增账号与修改凭据传 true, 仅刷新令牌传 false */
  activate: boolean;
}

/** 新增账号的输入: overwrite 为 true 时替换同账号键的原有条目 */
export interface AddAccountInput extends CredentialInput {
  overwrite?: boolean;
}

/** 修改账号的输入: 站点、密码与令牌 */
export interface AccountUpdateInput {
  siteRef: string;
  password: string;
  token: string;
}

/** 自定义站点的新建或修改输入 */
export interface CustomSiteInput {
  name: string;
  course_api: string;
  ua_api: string;
}

/** 可修改的设置项(账号与课件树不经此入口) */
export type SettingsPatch = Partial<
  Pick<ConfigModel, "study_time" | "sleep_time" | "anti_detection">
>;

/** 配置 store 状态 */
export interface ConfigStoreState {
  /** 存储配置(users 内含各账号课件树) */
  config: ConfigModel;
  /** 运行期间其他标签页改过配置, 本标签页的写回与变更被暂停 */
  configStale: boolean;
  /** 新增账号, 同账号键已存在时需要 overwrite 才会替换 */
  addAccount: (input: AddAccountInput) => boolean;
  /** 修改账号的站点、密码与令牌 */
  updateAccount: (accountKey: string, input: AccountUpdateInput) => boolean;
  /** 写入账号凭据与令牌, 账号不存在时不写入 */
  saveCredential: (input: CredentialInput) => boolean;
  /** 写入账号展示资料 */
  saveIdentity: (accountKey: string, identity: UserIdentity) => boolean;
  /** 删除账号, 删除的是活跃账号时同时清空 active_user */
  removeAccount: (accountKey: string) => boolean;
  /** 切换活跃账号 */
  switchUser: (accountKey: string) => boolean;
  /** 登出: 清空 active_user, 保留账号条目与课件树 */
  logout: () => boolean;
  /** 修改设置并写回 */
  updateSettings: (patch: SettingsPatch) => boolean;
  /** 新建自定义站点, 返回站点引用值 */
  addCustomSite: (input: CustomSiteInput) => string | null;
  /** 修改自定义站点 */
  updateCustomSite: (id: string, input: CustomSiteInput) => boolean;
  /** 删除自定义站点, 被账号引用时就地抛出 */
  removeCustomSite: (id: string) => boolean;
  /** 活跃用户课件树整体替换 */
  replaceCourseware: (courses: ModelCourse[]) => boolean;
  /** 合并追加新课件树到活跃用户中, 不置换已有课程 */
  appendCourseware: (incoming: ModelCourse[]) => boolean;
  /** 删除指定课程、教材、章、节或页面 */
  removeCourseware: (target: Parameters<typeof removeCoursewareTree>[1]) => boolean;
  /** 删除指定 id 的页面并逐层剔除空容器 */
  removePages: (pageIds: number[]) => boolean;
  /** 配置载入异常详情, 用于向用户呈现重置提示横幅 */
  loadError: { title: string; message: string; versionMismatch: boolean } | null;
  /** 重置本地配置为默认版本 */
  resetConfig: () => void;
}

const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** 规范化自定义站点输入: 去空白、去末尾斜杠, 再经模型校验 */
const normalizeCustomSite = (id: string, input: CustomSiteInput) =>
  customSiteSchema.parse({
    id,
    name: input.name.trim(),
    course_api: input.course_api.trim().replace(/\/+$/, ""),
    ua_api: input.ua_api.trim().replace(/\/+$/, ""),
  });

/** 取活跃用户条目, 无活跃账号时就地抛出 */
const requireActiveUser = (state: ConfigStoreState): UserConfig => {
  const found = state.config.users.find(
    (user) => accountKeyOf(user.site, user.username) === state.config.active_user,
  );
  if (found === undefined) {
    throw new Error("当前没有活跃账号");
  }
  return found;
};

/** 上次写入存储的配置原文, 用于发现其他标签页的变更 */
let lastPersistedJson: string | null = readConfigJson();

/** 比对存储原文, 不一致时提示并返回 false */
const assertConfigFresh = (): boolean => {
  if (readConfigJson() !== lastPersistedJson) {
    reportError({
      title: "配置已在其他标签页更新",
      message: "本次修改未保存，请刷新后重试。",
    });
    return false;
  }
  return true;
};

/** 将配置写回 localStorage, 失败时上报到右上角提示 */
const writeBack = (config: ConfigModel): void => {
  try {
    saveConfig(config);
    lastPersistedJson = JSON.stringify(config);
  } catch (error) {
    reportError({
      title: "本地配置保存失败",
      message: `配置没有写入浏览器存储。${formatError(error)}`,
    });
  }
};

/** 账号切换后清空运行状态与页面选择 */
const resetForAccountChange = (): void => {
  useRunStore.getState().resetForAccountChange();
};

const initialConfigState = loadConfigWithStatus();

export const useConfigStore = create<ConfigStoreState>()(
  immer((set, get) => ({
    config: initialConfigState.config,
    configStale: false,
    loadError:
      initialConfigState.error !== null
        ? {
            title:
              initialConfigState.error instanceof ConfigVersionMismatchError
                ? "配置版本不兼容"
                : "本地配置载入失败",
            message: initialConfigState.error.message,
            versionMismatch:
              initialConfigState.error instanceof ConfigVersionMismatchError,
          }
        : null,
    resetConfig: () => {
      const fresh = resetConfigStorage();
      lastPersistedJson = readConfigJson();
      set((state) => {
        state.config = fresh;
        state.loadError = null;
        state.configStale = false;
      });
      resetForAccountChange();
    },
    addAccount: (input) => {
      if (!assertConfigFresh()) {
        return false;
      }
      const key = accountKeyOf(input.siteRef, input.username);
      const existing = get().config.users.find(
        (user) => accountKeyOf(user.site, user.username) === key,
      );
      if (existing !== undefined && input.overwrite !== true) {
        throw new Error(`账号已存在: ${input.username}`);
      }
      set((state) => {
        const index = state.config.users.findIndex(
          (user) => accountKeyOf(user.site, user.username) === key,
        );
        if (index === -1) {
          state.config.users.push({
            site: input.siteRef,
            username: input.username,
            password: input.password,
            token: input.token,
            courses: [],
            name: "",
            headimage: null,
          });
        } else {
          state.config.users[index] = {
            site: input.siteRef,
            username: input.username,
            password: input.password,
            token: input.token,
            courses: [],
            name: "",
            headimage: null,
          };
        }
        if (input.activate) {
          state.config.active_user = key;
        }
      });
      writeBack(get().config);
      if (input.activate) {
        resetForAccountChange();
      }
      return true;
    },
    updateAccount: (accountKey, input) => {
      if (!assertConfigFresh()) {
        return false;
      }
      const previous = get().config.users.find(
        (user) => accountKeyOf(user.site, user.username) === accountKey,
      );
      if (previous === undefined) {
        throw new Error(`账号不存在: ${accountKey}`);
      }
      const siteChanged = previous.site !== input.siteRef;
      const nextKey = accountKeyOf(input.siteRef, previous.username);
      const conflict = get().config.users.some(
        (user) =>
          user !== previous && accountKeyOf(user.site, user.username) === nextKey,
      );
      if (conflict) {
        throw new Error(`账号已存在: ${previous.username}`);
      }
      const wasActive = get().config.active_user === accountKey;
      set((state) => {
        const index = state.config.users.findIndex(
          (user) => accountKeyOf(user.site, user.username) === accountKey,
        );
        const target = state.config.users[index];
        target.site = input.siteRef;
        target.password = input.password;
        target.token = input.token;
        if (siteChanged) {
          target.courses = [];
          if (state.config.active_user === accountKey) {
            state.config.active_user = nextKey;
          }
        }
      });
      writeBack(get().config);
      if (siteChanged && wasActive) {
        resetForAccountChange();
      }
      return true;
    },
    saveCredential: (input) => {
      if (!assertConfigFresh()) {
        return false;
      }
      const key = accountKeyOf(input.siteRef, input.username);
      const existing = get().config.users.find(
        (user) => accountKeyOf(user.site, user.username) === key,
      );
      if (existing === undefined) {
        reportError({
          title: "账号已不存在",
          message: `找不到账号 ${input.username}，请重新登录。`,
        });
        return false;
      }
      set((state) => {
        const target = state.config.users.find(
          (user) => accountKeyOf(user.site, user.username) === key,
        );
        if (target === undefined) {
          throw new Error(`账号不存在: ${input.username}`);
        }
        target.password = input.password;
        target.token = input.token;
        if (input.activate) {
          state.config.active_user = key;
        }
      });
      writeBack(get().config);
      return true;
    },
    saveIdentity: (accountKey, identity) => {
      if (!assertConfigFresh()) {
        return false;
      }
      const existing = get().config.users.find(
        (user) => accountKeyOf(user.site, user.username) === accountKey,
      );
      if (existing === undefined) {
        throw new Error(`账号不存在: ${accountKey}`);
      }
      set((state) => {
        const found = state.config.users.find(
          (user) => accountKeyOf(user.site, user.username) === accountKey,
        );
        if (found === undefined) {
          throw new Error(`账号不存在: ${accountKey}`);
        }
        found.name = identity.name;
        found.headimage = identity.headimage;
      });
      writeBack(get().config);
      return true;
    },
    removeAccount: (accountKey) => {
      if (!assertConfigFresh()) {
        return false;
      }
      const existing = get().config.users.find(
        (user) => accountKeyOf(user.site, user.username) === accountKey,
      );
      if (existing === undefined) {
        throw new Error(`账号不存在: ${accountKey}`);
      }
      const wasActive = get().config.active_user === accountKey;
      set((state) => {
        const index = state.config.users.findIndex(
          (user) => accountKeyOf(user.site, user.username) === accountKey,
        );
        if (index === -1) {
          throw new Error(`账号不存在: ${accountKey}`);
        }
        state.config.users.splice(index, 1);
        if (state.config.active_user === accountKey) {
          state.config.active_user = "";
        }
      });
      writeBack(get().config);
      if (wasActive) {
        resetForAccountChange();
      }
      return true;
    },
    switchUser: (accountKey) => {
      if (!assertConfigFresh()) {
        return false;
      }
      const found = get().config.users.find(
        (user) => accountKeyOf(user.site, user.username) === accountKey,
      );
      if (found === undefined) {
        throw new Error(`账号不存在: ${accountKey}`);
      }
      set((state) => {
        state.config.active_user = accountKey;
      });
      writeBack(get().config);
      resetForAccountChange();
      return true;
    },
    logout: () => {
      if (!assertConfigFresh()) {
        return false;
      }
      set((state) => {
        state.config.active_user = "";
      });
      writeBack(get().config);
      resetForAccountChange();
      return true;
    },
    updateSettings: (patch) => {
      if (!assertConfigFresh()) {
        return false;
      }
      set((state) => {
        if (patch.study_time !== undefined) {
          state.config.study_time = patch.study_time;
        }
        if (patch.sleep_time !== undefined) {
          state.config.sleep_time = patch.sleep_time;
        }
        if (patch.anti_detection !== undefined) {
          state.config.anti_detection = patch.anti_detection;
        }
      });
      writeBack(get().config);
      return true;
    },
    addCustomSite: (input) => {
      if (!assertConfigFresh()) {
        return null;
      }
      const site = normalizeCustomSite(crypto.randomUUID(), input);
      set((state) => {
        if (state.config.custom_sites.some((item) => item.name === site.name)) {
          throw new Error(`站点名称已存在: ${site.name}`);
        }
        state.config.custom_sites.push(site);
      });
      writeBack(get().config);
      return customSiteRef(site.id);
    },
    updateCustomSite: (id, input) => {
      if (!assertConfigFresh()) {
        return false;
      }
      const site = normalizeCustomSite(id, input);
      const ref = customSiteRef(id);
      const original = get().config.custom_sites.find((item) => item.id === id);
      if (original === undefined) {
        throw new Error(`站点不存在: ${id}`);
      }
      const addressChanged =
        original.course_api !== site.course_api || original.ua_api !== site.ua_api;
      const used = get().config.users.filter((user) => user.site === ref).length;
      if (addressChanged && used > 0) {
        throw new Error(`有 ${used} 个账号使用该站点，地址不可修改`);
      }
      set((state) => {
        const index = state.config.custom_sites.findIndex((item) => item.id === id);
        if (index === -1) {
          throw new Error(`站点不存在: ${id}`);
        }
        if (
          state.config.custom_sites.some(
            (item) => item.id !== id && item.name === site.name,
          )
        ) {
          throw new Error(`站点名称已存在: ${site.name}`);
        }
        state.config.custom_sites[index] = site;
      });
      writeBack(get().config);
      return true;
    },
    removeCustomSite: (id) => {
      if (!assertConfigFresh()) {
        return false;
      }
      const ref = customSiteRef(id);
      set((state) => {
        const index = state.config.custom_sites.findIndex((item) => item.id === id);
        if (index === -1) {
          throw new Error(`站点不存在: ${id}`);
        }
        const used = state.config.users.filter((user) => user.site === ref).length;
        if (used > 0) {
          throw new Error(`仍有 ${used} 个账号使用该站点`);
        }
        state.config.custom_sites.splice(index, 1);
      });
      writeBack(get().config);
      return true;
    },
    replaceCourseware: (courses) => {
      if (!assertConfigFresh()) {
        return false;
      }
      set((state) => {
        // immer 会冻结写入状态的对象, 复制后接管, 调用方持有的工作树保持可写
        requireActiveUser(state).courses = cloneCourses(courses);
      });
      writeBack(get().config);
      return true;
    },
    appendCourseware: (incoming) => {
      if (!assertConfigFresh()) {
        return false;
      }
      const activeUser = selectActiveUser(get());
      if (activeUser === null) {
        throw new Error("当前没有活跃账号");
      }
      const merged = mergeCourses(activeUser.courses, incoming);
      set((state) => {
        requireActiveUser(state).courses = merged;
      });
      writeBack(get().config);
      return true;
    },
    removeCourseware: (target) => {
      if (!assertConfigFresh()) {
        return false;
      }
      set((state) => {
        removeCoursewareTree(requireActiveUser(state).courses, target);
      });
      writeBack(get().config);
      return true;
    },
    removePages: (pageIds) => {
      if (!assertConfigFresh()) {
        return false;
      }
      set((state) => {
        removePageIds(requireActiveUser(state).courses, new Set(pageIds));
      });
      writeBack(get().config);
      return true;
    },
  })),
);

/**
 * 其他标签页写入配置后的同步: 运行中只标记过期, 空闲时直接载入新配置。
 * 载入后清空页面选择与运行摘要, 避免选择集合指向已被替换的页面。
 */
export const syncFromStorageEvent = (newValue: string | null): void => {
  const phase = useRunStore.getState().phase;
  if (phase === "running" || phase === "stopping") {
    useConfigStore.setState({ configStale: true });
    return;
  }
  try {
    const config = newValue === null ? createDefaultConfig() : parseConfigJson(newValue);
    lastPersistedJson = newValue;
    useConfigStore.setState({ config, loadError: null });
    resetForAccountChange();
  } catch (error) {
    reportError({
      title: "其他标签页的配置无法载入",
      message: formatError(error),
    });
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === CONFIG_KEY) {
      syncFromStorageEvent(event.newValue);
    }
  });
}

/** 活跃用户, 无活跃账号时为 null */
export const selectActiveUser = (state: ConfigStoreState): UserConfig | null => {
  const found = state.config.users.find(
    (user) => accountKeyOf(user.site, user.username) === state.config.active_user,
  );
  return found === undefined ? null : found;
};
