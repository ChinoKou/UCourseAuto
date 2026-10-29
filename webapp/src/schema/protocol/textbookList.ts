import { z } from "zod";

/**
 * 课程教材列表: GET {course_api}/textbook/student/{courseId}/list。
 * 响应体本身是教材数组, 调用方包装为 textbooks 字段后交给本模型。
 * courseId 在平台上表示教材 ID, status 与 limit 会写入课件树。
 */
export const courseTextbookSchema = z.object({
  courseId: z.number().int(),
  name: z.string(),
  type: z.number().int(),
  status: z.number().int(),
  limit: z.number().int(),
  author: z.string().nullable().default(null),
  copyright: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  cover: z.string().nullable().default(null),
  needapprove: z.string(),
  lastModifyDate: z.number().int(),
  openCourse: z.number().int(),
  md5: z.string(),
});
export type CourseTextbook = z.infer<typeof courseTextbookSchema>;

/** 教材列表响应容器。 */
export const courseTextbooksResponseSchema = z.object({
  textbooks: z.array(courseTextbookSchema),
});
export type CourseTextbooksResponse = z.infer<typeof courseTextbooksResponseSchema>;
