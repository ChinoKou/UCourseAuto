import type { ZodType } from "zod";

import type { HttpResult } from "@/net/http";
import type { LoginResponse } from "@/schema/protocol/auth";
import type { StudyRecordResponse } from "@/schema/protocol/studyRecord";
import { parseResponse } from "@/schema/parse";

/**
 * 平台访问的统一结果类型: 失败携带定位问题所需的地址、状态码与原始响应,
 * 提示文案与界面动作由业务动作层决定。
 */

export type PlatformFailureReason =
  | "network"
  | "httpStatus"
  | "invalidJson"
  | "schemaMismatch"
  | "unexpectedBody";

export interface PlatformFailure {
  /** 出错的接口地址, 查询参数包含在内 */
  endpoint: string;
  /** HTTP 状态码, 网络失败或超时时为 0 */
  status: number;
  /** 原始响应文本 */
  raw: string;
  reason: PlatformFailureReason;
}

export type PlatformResult<T> =
  | { ok: true; data: T }
  | { ok: false; failure: PlatformFailure };

/** 登录的平台拒绝与传输失败分开表达 */
export type LoginOutcome =
  | { status: "success"; response: LoginResponse }
  | { status: "rejected"; code: number; message: string }
  | { status: "failed"; failure: PlatformFailure };

/** 学习记录接口的空响应体表达"该节未学习" */
export type SectionStudyRecord =
  | { studied: false }
  | { studied: true; record: StudyRecordResponse };

/** 解析 JSON 响应文本, 语法错误返回 null */
export const parseJsonText = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/** 由 HTTP 请求结果构造失败信息: 状态码 0 表示传输层重试耗尽 */
export const httpFailure = (
  endpoint: string,
  result: HttpResult,
): PlatformFailure => ({
  endpoint,
  status: result.status,
  raw: result.text,
  reason: result.status === 0 ? "network" : "httpStatus",
});

/** 把 200 响应文本经 JSON 解析与 zod 校验转为结果 */
export const parseJsonResult = <T>(
  endpoint: string,
  result: HttpResult,
  schema: ZodType<T>,
): PlatformResult<T> => {
  const data = parseJsonText(result.text);
  if (data === null) {
    return {
      ok: false,
      failure: { endpoint, status: result.status, raw: result.text, reason: "invalidJson" },
    };
  }
  const model = parseResponse(schema, data);
  if (model === null) {
    return {
      ok: false,
      failure: { endpoint, status: result.status, raw: result.text, reason: "schemaMismatch" },
    };
  }
  return { ok: true, data: model };
};
