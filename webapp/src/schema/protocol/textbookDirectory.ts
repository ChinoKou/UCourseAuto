import { z } from "zod";

/**
 * 教材章节目录: GET {ua_api}/course/stu/{textbookId}/directory。
 * 章、节、页三层, hide 为 1 的章与节在组装课件树时剔除。
 * 目录只提供页面标题与类型, 页面元素由章内容接口补全。
 */
export const directoryPageSchema = z.object({
  id: z.number().int(),
  relationid: z.number().int(),
  title: z.string(),
  orderindex: z.number().int(),
  contentType: z.number().int(),
});
export type DirectoryPage = z.infer<typeof directoryPageSchema>;

/** 节目录项: hide 为 1 时在课件树中剔除。 */
export const directorySectionSchema = z.object({
  itemid: z.number().int(),
  title: z.string(),
  orderindex: z.number().int(),
  hide: z.number().int().default(0),
  ishidepreview: z.string().default("2"),
  id: z.number().int().default(0),
  coursepages: z.array(directoryPageSchema),
});
export type DirectorySection = z.infer<typeof directorySectionSchema>;

/** 章目录项: hide 为 1 时整章剔除。 */
export const directoryChapterSchema = z.object({
  nodeid: z.number().int(),
  nodetitle: z.string(),
  orderindex: z.number().int(),
  hide: z.number().int().default(0),
  preview: z.number().int().default(0),
  id: z.number().int().default(0),
  items: z.array(directorySectionSchema),
});
export type DirectoryChapter = z.infer<typeof directoryChapterSchema>;

/** 目录响应: courseid 在平台上表示教材 ID。 */
export const textbookDirectoryResponseSchema = z.object({
  courseid: z.number().int(),
  coursename: z.string(),
  chapters: z.array(directoryChapterSchema),
});
export type TextbookDirectoryResponse = z.infer<typeof textbookDirectoryResponseSchema>;
