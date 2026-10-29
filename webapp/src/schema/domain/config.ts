import { z } from "zod";

import { modelCourseSchema } from "@/schema/domain/course";
import { customSiteSchema } from "@/schema/domain/site";

/**
 * localStorage 存储配置模型(键名 ucourse_config), 字段与 cli 的 ConfigModel 对应;
 * 网页版没有 cookie 概念, 不存在 cookies 字段。
 * 密码与 token 以明文保存, 界面向用户明示。
 */

/** 上报时长范围(秒)。 */
export const minMaxTimeSchema = z.object({
  min: z.number().int().default(180),
  max: z.number().int().default(360),
});
export type MinMaxTime = z.infer<typeof minMaxTimeSchema>;

/** 三类页面(题目 / 文档 / 文本)的上报时长配置。 */
export const studyTimeSchema = z.object({
  question: minMaxTimeSchema.prefault({}),
  document: minMaxTimeSchema.prefault({}),
  content: minMaxTimeSchema.prefault({}),
});
export type StudyTime = z.infer<typeof studyTimeSchema>;

/** 账号展示资料: 登录响应与当前用户接口都能提供, 写入配置的 name 与 headimage */
export interface UserIdentity {
  name: string;
  headimage: string | null;
}

/** 用户配置: token 占位值 "abc" 表示未登录; site 为站点引用值。 */
export const userConfigSchema = z.object({
  site: z.string(),
  username: z.string(),
  password: z.string(),
  token: z.string().default("abc"),
  courses: z.array(modelCourseSchema).default([]),
  name: z.string().default(""),
  headimage: z.string().nullable().default(null),
});
export type UserConfig = z.infer<typeof userConfigSchema>;

/**
 * 账号键: 由站点引用值与用户名共同确定, active_user 保存该键。
 * 两个不同站点的同名账号因此可以同时保存, 查找也不会相互覆盖。
 */
export const accountKeyOf = (siteRef: string, username: string): string =>
  `${encodeURIComponent(siteRef)}::${encodeURIComponent(username)}`;

/** 存储配置: users 为数组, 每项自带 site 与 username, active_user 保存账号键。 */
export const configSchema = z.object({
  config_version: z.number().int().default(1),
  active_user: z.string().default(""),
  users: z.array(userConfigSchema).default([]),
  custom_sites: z.array(customSiteSchema).default([]),
  study_time: studyTimeSchema.prefault({}),
  sleep_time: z.number().default(1),
  anti_detection: z.boolean().default(false),
});
export type ConfigModel = z.infer<typeof configSchema>;
