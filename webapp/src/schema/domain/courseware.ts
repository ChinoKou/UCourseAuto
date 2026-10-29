import { z } from "zod";

/**
 * 课件树域模型(snake_case 字段名与 cli 域模型同名)。
 * 章 → 节 → 页 三层容器一律用数组, 课件树的遍历顺序即刷课顺序。
 * 元素按 kind 判别, 文档与纯文本只保存类型标记, 正文不进入域模型与本地存储。
 * 字段名写入 localStorage, 改动会要求配置版本升级与数据迁移。
 */

/** 视频元素: video_id 即章内容接口的 resourceid, video_length 即 videoLength(秒)。 */
export const elementVideoSchema = z.strictObject({
  kind: z.literal("video"),
  video_id: z.number().int(),
  video_length: z.number().int(),
});
export type ElementVideo = z.infer<typeof elementVideoSchema>;

/** 课件题目: 答案列表由题目答案接口的 correctAnswerList 补全。 */
export const coursewareQuestionSchema = z.object({
  question_id: z.number().int(),
  question_score: z.number().int(),
  question_content: z.string(),
  question_answer_list: z.array(z.string()).default([]),
});
export type CoursewareQuestion = z.infer<typeof coursewareQuestionSchema>;

/** 题目元素。 */
export const elementQuestionSchema = z.strictObject({
  kind: z.literal("question"),
  questions: z.array(coursewareQuestionSchema).default([]),
});
export type ElementQuestion = z.infer<typeof elementQuestionSchema>;

/** 文档元素。 */
export const elementDocumentSchema = z.strictObject({
  kind: z.literal("document"),
});
export type ElementDocument = z.infer<typeof elementDocumentSchema>;

/** 纯文本元素。 */
export const elementContentSchema = z.strictObject({
  kind: z.literal("content"),
});
export type ElementContent = z.infer<typeof elementContentSchema>;

/** 课件元素联合: 视频 / 题目 / 文档 / 纯文本。 */
export const coursewareElementSchema = z.discriminatedUnion("kind", [
  elementVideoSchema,
  elementQuestionSchema,
  elementDocumentSchema,
  elementContentSchema,
]);
export type CoursewareElement = z.infer<typeof coursewareElementSchema>;

/** 课件页: page_content_type 5 文档或文本 / 6 视频 / 7 题目。 */
export const coursewarePageSchema = z.object({
  page_id: z.number().int(),
  page_relation_id: z.number().int(),
  page_name: z.string(),
  page_content_type: z.number().int(),
  is_complete: z.boolean().default(false),
  elements: z.array(coursewareElementSchema).default([]),
});
export type CoursewarePage = z.infer<typeof coursewarePageSchema>;

/** 课件节。 */
export const coursewareSectionSchema = z.object({
  section_id: z.number().int(),
  section_name: z.string(),
  pages: z.array(coursewarePageSchema).default([]),
});
export type CoursewareSection = z.infer<typeof coursewareSectionSchema>;

/** 课件章。 */
export const coursewareChapterSchema = z.object({
  chapter_id: z.number().int(),
  chapter_name: z.string(),
  sections: z.array(coursewareSectionSchema).default([]),
});
export type CoursewareChapter = z.infer<typeof coursewareChapterSchema>;
