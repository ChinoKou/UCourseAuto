import type { ZodType } from "zod";

/**
 * 响应校验入口: 校验成功返回解析值(未知字段丢弃), 失败返回 null。
 * 失败原因由调用方按接口语义转换为统一失败结果。
 */
export function parseResponse<T>(schema: ZodType<T>, data: unknown): T | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}
