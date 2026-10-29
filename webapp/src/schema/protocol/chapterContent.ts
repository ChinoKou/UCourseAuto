import { z } from "zod";

/**
 * 章内容: GET {ua_api}/wholepage/chapter/stu/{chapterId}。
 * 返回章内每个节的页面与页面元素, 元素按 type 判别: 4 视频、6 题目、10 文档、12 文本。
 * 出现未登记的 type 时整个响应校验失败, 由调用方按接口失败处理。
 */
const pageElementBaseSchema = z.object({
  coursepageDTOid: z.number().int(),
  parentid: z.number().int(),
  resourceid: z.number().int(),
});

/** 视频元素: resourceid 为视频 ID, videoLength 为秒数。 */
export const videoPageElementSchema = pageElementBaseSchema.extend({
  type: z.literal(4),
  videoLength: z.number().int(),
});
export type VideoPageElement = z.infer<typeof videoPageElementSchema>;

/** 题目元素内的题目: type 1 单选题、2 多选题、4 判断题。 */
export const pageQuestionSchema = z.object({
  questionid: z.number().int(),
  score: z.number(),
  title: z.string(),
  type: z.number().int(),
});
export type PageQuestion = z.infer<typeof pageQuestionSchema>;

/** 题目元素: questionDTOList 为页面内的全部题目。 */
export const questionPageElementSchema = pageElementBaseSchema.extend({
  type: z.literal(6),
  content: z.string(),
  answertime: z.number().int().nullable().default(null),
  questionDTOList: z.array(pageQuestionSchema),
});
export type QuestionPageElement = z.infer<typeof questionPageElementSchema>;

/** 文档元素: content 为文档正文。 */
export const documentPageElementSchema = pageElementBaseSchema.extend({
  type: z.literal(10),
  content: z.string(),
});
export type DocumentPageElement = z.infer<typeof documentPageElementSchema>;

/** 文本元素: content 为文本正文。 */
export const textPageElementSchema = pageElementBaseSchema.extend({
  type: z.literal(12),
  content: z.string(),
});
export type TextPageElement = z.infer<typeof textPageElementSchema>;

/** 页面元素判别联合。 */
export const pageElementSchema = z.discriminatedUnion("type", [
  videoPageElementSchema,
  questionPageElementSchema,
  documentPageElementSchema,
  textPageElementSchema,
]);
export type PageElement = z.infer<typeof pageElementSchema>;

/** 章内容页面: contentnodeid 为节 ID, contentType 决定页面类型。 */
export const chapterContentPageSchema = z.object({
  id: z.number().int(),
  relationid: z.number().int(),
  content: z.string(),
  contentType: z.number().int(),
  contentnodeid: z.number().int(),
  type: z.number().int(),
  coursepageDTOList: z.array(pageElementSchema),
});
export type ChapterContentPage = z.infer<typeof chapterContentPageSchema>;

/** 章内容节: itemid 为节 ID。 */
export const chapterContentSectionSchema = z.object({
  itemid: z.number().int(),
  wholepageDTOList: z.array(chapterContentPageSchema),
});
export type ChapterContentSection = z.infer<typeof chapterContentSectionSchema>;

/** 章内容响应。 */
export const chapterContentResponseSchema = z.object({
  chapterid: z.number().int(),
  wholepageItemDTOList: z.array(chapterContentSectionSchema),
});
export type ChapterContentResponse = z.infer<typeof chapterContentResponseSchema>;
