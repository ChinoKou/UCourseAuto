/**
 * fetch 封装: Authorization 注入、超时与传输层重试,
 * 行为与 cli 的 http_client.py 在浏览器环境下保持一致。
 */

/** 占位 token, 为该值时不注入 Authorization 头 */
const PLACEHOLDER_TOKEN = "abc";

/** 默认超时时间(毫秒) */
const DEFAULT_TIMEOUT_MS = 8_000;

/** 重试上限(不含初始请求, 连同初始请求共 4 次尝试) */
const MAX_RETRIES = 3;

/** 重试间隔(毫秒) */
const RETRY_INTERVAL_MS = 500;

/** 请求结果 */
export interface HttpResult {
  /** HTTP 状态码是否为 200 */
  ok: boolean;
  /** HTTP 状态码, 传输层重试耗尽时为 0 */
  status: number;
  /** 响应文本 */
  text: string;
}

/** GET 请求选项 */
export interface HttpGetOptions {
  /** 查询参数 */
  params?: Record<string, string | number>;
  /** 超时时间(毫秒), 默认 8 秒; 检测接口传 120 秒 */
  timeout?: number;
}

/** POST 请求选项: json 为 JSON 请求体, body 为字符串请求体(上报接口用) */
export type HttpPostOptions = HttpGetOptions &
  ({ json: unknown; body?: undefined } | { body: string; json?: undefined });

/** 客户端创建选项 */
export interface HttpClientOptions {
  /** 鉴权令牌, 原样注入 Authorization 头, 无 Bearer 前缀 */
  token: string;
  /** 重试等待函数, 默认经 setTimeout 实现, 测试可注入确定性实现 */
  sleep?: (ms: number) => Promise<void>;
}

/** HTTP 客户端 */
export interface HttpClient {
  /** 发送 GET 请求 */
  get(url: string, options?: HttpGetOptions): Promise<HttpResult>;
  /** 发送 POST 请求 */
  post(url: string, options: HttpPostOptions): Promise<HttpResult>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** 追加查询参数 */
const appendParams = (
  url: string,
  params: Record<string, string | number> | undefined,
): string => {
  if (params === undefined) {
    return url;
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.append(key, String(value));
  }
  const query = search.toString();
  return query === "" ? url : `${url}?${query}`;
};

/** AbortSignal.timeout 到期时 fetch 以 name 为 TimeoutError 的 DOMException 拒绝 */
const isTimeoutError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "TimeoutError";

/** 创建 HTTP 客户端 */
export const createHttpClient = (options: HttpClientOptions): HttpClient => {
  const token = options.token;
  const sleep = options.sleep ?? defaultSleep;

  /** 构造请求头: 注入 Authorization 与可选 Content-Type, 不设置 User-Agent */
  const buildHeaders = (contentType?: string): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (token !== PLACEHOLDER_TOKEN) {
      headers.Authorization = token;
    }
    if (contentType !== undefined) {
      headers["Content-Type"] = contentType;
    }
    return headers;
  };

  const send = async (
    method: "GET" | "POST",
    url: string,
    requestOptions: HttpGetOptions,
    headers: Record<string, string>,
    body: string | undefined,
  ): Promise<HttpResult> => {
    const requestUrl = appendParams(url, requestOptions.params);
    const timeout = requestOptions.timeout ?? DEFAULT_TIMEOUT_MS;

    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetch(requestUrl, {
          method,
          headers,
          body,
          signal: AbortSignal.timeout(timeout),
        });
        const text = await response.text();
        return { ok: response.status === 200, status: response.status, text };
      } catch (error) {
        // 仅网络错误(TypeError)与超时(TimeoutError)重试, 其余错误就地抛出
        if (!(error instanceof TypeError) && !isTimeoutError(error)) {
          throw error;
        }
        if (attempt >= MAX_RETRIES) {
          return { ok: false, status: 0, text: "" };
        }
        await sleep(RETRY_INTERVAL_MS);
      }
    }
  };

  return {
    get: (url, requestOptions = {}) =>
      send("GET", url, requestOptions, buildHeaders(), undefined),
    post: (url, requestOptions) => {
      if (requestOptions.body === undefined) {
        // JSON 请求体显式设置 Content-Type: application/json
        return send(
          "POST",
          url,
          requestOptions,
          buildHeaders("application/json"),
          JSON.stringify(requestOptions.json),
        );
      }
      // 字符串请求体不设置 Content-Type, 由浏览器自动附带
      return send("POST", url, requestOptions, buildHeaders(), requestOptions.body);
    },
  };
};
