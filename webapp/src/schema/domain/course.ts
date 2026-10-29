import { z } from "zod";

import { coursewareChapterSchema } from "@/schema/domain/courseware";

/**
 * 课程与教材域模型(snake_case 字段名与 cli 域模型同名)。
 * 课程 → 教材 → 章 容器一律用数组, 与课件树五层容器的形状一致。
 */

/** 教材域模型: status 与 limit 来自课程教材列表。 */
export const modelTextbookSchema = z.object({
  textbook_id: z.number().int(),
  textbook_name: z.string(),
  status: z.number().int(),
  limit: z.number().int(),
  chapters: z.array(coursewareChapterSchema).default([]),
});
export type ModelTextbook = z.infer<typeof modelTextbookSchema>;

/** 课程域模型。 */
export const modelCourseSchema = z.object({
  course_id: z.number().int(),
  course_name: z.string(),
  class_id: z.number().int(),
  class_user_id: z.number().int(),
  /** 课程列表中的老师名称, 旧配置没有该字段 */
  teacher_name: z.string().optional(),
  /** 课程列表中的班级名称, 旧配置没有该字段 */
  class_name: z.string().optional(),
  textbooks: z.array(modelTextbookSchema).default([]),
});
export type ModelCourse = z.infer<typeof modelCourseSchema>;
