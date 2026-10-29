import {
  httpFailure,
  parseJsonText,
  parseJsonResult,
  type LoginOutcome,
  type PlatformResult,
} from "@/apis/result";
import { createHttpClient } from "@/net/http";
import { loginResponseSchema } from "@/schema/protocol/auth";
import type { Site } from "@/schema/domain/site";

/**
 * 登录与令牌校验: POST {course_api}/users/login 与
 * GET {course_api}/users/isValidToken/{token}。
 * 网页版使用返回 200 的 JSON 登录入口, 浏览器无法读取跨站 Cookie。
 */

/** 登录失败时平台返回的错误信息, 如 code 1201 用户不存在 */
interface PlatformRejection {
  code: number;
  message: string;
}

/** 判读登录失败响应体的 code 与 message 字段, 形状不符返回 null */
const parsePlatformRejection = (data: unknown): PlatformRejection | null => {
  if (
    typeof data === "object" &&
    data !== null &&
    "code" in data &&
    "message" in data &&
    typeof data.code === "number" &&
    typeof data.message === "string"
  ) {
    return { code: data.code, message: data.message };
  }
  return null;
};

/**
 * 凭据登录: 成功时响应含 authorization 即鉴权令牌;
 * HTTP 400 且响应体含 code 与 message 时为平台拒绝, 其余按传输失败返回。
 */
export async function loginWithCredential(
  site: Site,
  username: string,
  password: string,
): Promise<LoginOutcome> {
  const endpoint = `${site.course_api}/users/login`;
  const client = createHttpClient({ token: "abc" });
  const result = await client.post(endpoint, {
    json: { loginName: username, password },
  });

  if (!result.ok) {
    if (result.status === 400) {
      const rejection = parsePlatformRejection(parseJsonText(result.text));
      if (rejection !== null) {
        return { status: "rejected", code: rejection.code, message: rejection.message };
      }
    }
    return { status: "failed", failure: httpFailure(endpoint, result) };
  }

  const parsed = parseJsonResult(endpoint, result, loginResponseSchema);
  if (!parsed.ok) {
    return { status: "failed", failure: parsed.failure };
  }
  return { status: "success", response: parsed.data };
}

/**
 * 校验令牌是否有效: 响应纯文本 true 或 false。
 * 传输失败返回失败结果, 调用方按令牌无效处理。
 */
export async function validateAccessToken(
  site: Site,
  token: string,
): Promise<PlatformResult<boolean>> {
  const endpoint = `${site.course_api}/users/isValidToken/${token}`;
  const client = createHttpClient({ token });
  const result = await client.get(endpoint);

  if (!result.ok) {
    return { ok: false, failure: httpFailure(endpoint, result) };
  }
  return { ok: true, data: result.text.trim().toLowerCase() === "true" };
}
