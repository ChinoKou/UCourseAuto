import { z } from "zod";

/**
 * 学生课程列表: GET {course_api}/courses/students。
 * 每项代表一门已加入的课程, classId 与 classUserId 是后续教材目录请求的定位参数。
 * 列表按平台返回顺序排列, 配置向导与课件树沿用该顺序。
 */
export const studentCourseSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  classId: z.number().int(),
  classUserId: z.number().int(),
  cover: z.string(),
  courseCode: z.string(),
  type: z.number().int(),
  className: z.string(),
  status: z.number().int(),
  teacherName: z.string(),
  learnProgress: z.number().int(),
  totalDuration: z.number().int(),
  publishStatus: z.number().int(),
  creatorOrgId: z.number().int(),
  creatorOrgName: z.string(),
});
export type StudentCourse = z.infer<typeof studentCourseSchema>;

/** 课程列表响应: 分页字段与课程数组, 网页版一次取回全部课程。 */
export const studentCoursesResponseSchema = z.object({
  pn: z.number().int(),
  ps: z.number().int(),
  total: z.number().int(),
  courseList: z.array(studentCourseSchema),
});
export type StudentCoursesResponse = z.infer<typeof studentCoursesResponseSchema>;
