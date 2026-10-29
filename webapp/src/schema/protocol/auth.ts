import { z } from "zod";

/**
 * 登录响应: POST {course_api}/users/login。
 * 代表登录成功后平台返回的账号资料, authorization 即后续请求使用的鉴权令牌。
 * 平台在部分机构下不返回展示字段, 因此姓名以外的资料均为可选。
 */
export const loginResponseSchema = z.object({
  authorization: z.string(),
  name: z.string(),
  roleId: z.number().int(),
  userId: z.number().int(),
  orgId: z.number().int(),
  loginName: z.string(),
  orgName: z.string().optional(),
  institutionId: z.string().optional(),
  sex: z.string().nullable().optional(),
  headimage: z.string().nullable().optional(),
  orgHome: z.string().optional(),
  orgLogo: z.string().optional(),
  studentId: z.string().optional(),
  uversion: z.number().int().optional(),
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;
