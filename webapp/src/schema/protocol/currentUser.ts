import { z } from "zod";

/**
 * 当前用户信息: GET {ua_api}/user。
 * name 用于上报体的 userName, headimage 用于账号头像。
 * 平台只在登录后返回完整资料, 复用存量令牌时需要单独请求。
 */
export const currentUserResponseSchema = z.object({
  userid: z.number().int(),
  name: z.string(),
  headimage: z.string().nullable().default(null),
  orgid: z.number().int(),
  logo: z.string().nullable().default(null),
  roleid: z.number().int(),
  antiCheat: z.number().int(),
  antiDrag: z.number().int(),
  openCourseResource: z.number().int(),
  enableSubtitle: z.number().int(),
  enableSkipVideoTitle: z.number().int(),
});
export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;
