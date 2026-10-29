import { z } from "zod";

/**
 * 站点模型: 内置站点与用户自定义站点共用同一份地址结构。
 * 账号配置中的 site 字段保存站点引用值, 内置站点为固定标识,
 * 自定义站点为 `custom:${id}`。
 */

/** 只接受 HTTP(S) 的绝对地址。 */
const httpUrlSchema = z
  .url()
  .refine((value) => /^https?:\/\//.test(value), "地址需要以 http:// 或 https:// 开头");

/** 自定义站点: 名称与两个 API 地址, id 由界面生成。 */
export const customSiteSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(40),
  course_api: httpUrlSchema,
  ua_api: httpUrlSchema,
});
export type CustomSite = z.infer<typeof customSiteSchema>;

/** 可直接用于接口调用的站点。 */
export interface Site {
  /** 配置中的站点引用值 */
  readonly ref: string;
  /** 界面名称 */
  readonly name: string;
  /** 课程域地址 */
  readonly course_api: string;
  /** 用户行为域地址 */
  readonly ua_api: string;
  /** 是否为内置站点 */
  readonly builtin: boolean;
}

/** 内置站点: 主站与东莞理工学院。 */
export const BUILTIN_SITES: ReadonlyArray<Site> = [
  {
    ref: "ulearning",
    name: "优学院 主站",
    course_api: "https://courseapi.ulearning.cn",
    ua_api: "https://api.ulearning.cn",
    builtin: true,
  },
  {
    ref: "dgut",
    name: "东莞理工学院",
    course_api: "https://lms.dgut.edu.cn/courseapi",
    ua_api: "https://ua.dgut.edu.cn/uaapi",
    builtin: true,
  },
];

/** 默认登录站点引用值: 东莞理工学院 */
export const DEFAULT_SITE_REF = "dgut";

/** 自定义站点的引用值。 */
export const customSiteRef = (id: string): string => `custom:${id}`;

/** 自定义站点转站点。 */
export const customSiteToSite = (site: CustomSite): Site => ({
  ref: customSiteRef(site.id),
  name: site.name,
  course_api: site.course_api,
  ua_api: site.ua_api,
  builtin: false,
});

/** 全部可用站点: 内置在前, 自定义按保存顺序在后。 */
export const allSites = (customSites: ReadonlyArray<CustomSite>): Site[] => [
  ...BUILTIN_SITES,
  ...customSites.map(customSiteToSite),
];

/** 按引用值查找站点, 未命中返回 null。 */
export const findSite = (
  ref: string,
  customSites: ReadonlyArray<CustomSite>,
): Site | null => allSites(customSites).find((site) => site.ref === ref) ?? null;

/** 按引用值查找站点, 未命中就地抛出。 */
export const resolveSite = (
  ref: string,
  customSites: ReadonlyArray<CustomSite>,
): Site => {
  const site = findSite(ref, customSites);
  if (site === null) {
    throw new Error(`未知的站点引用值: ${ref}`);
  }
  return site;
};

/** 站点地址的主机名(含端口), 用于界面展示。 */
export const siteHost = (site: Site): string => new URL(site.course_api).host;

/** 地址是否为可用的 HTTP(S) 绝对地址。 */
export const isValidHttpUrl = (value: string): boolean => {
  const parsed = z.url().safeParse(value);
  if (!parsed.success) {
    return false;
  }
  return /^https?:\/\//.test(parsed.data);
};
