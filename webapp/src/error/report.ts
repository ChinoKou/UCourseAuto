/**
 * 面向界面的错误与警告通道: 业务动作构造结构化详情作为返回值,
 * 右上角提示由界面决定是否触发; 提示装饰与 Issue 文本集中在这里。
 */

/** 一条可复制的错误详情 */
export interface AppErrorDetail {
  id: number;
  time: Date;
  title: string;
  message: string;
  /** 出错的接口地址 */
  endpoint?: string;
  /** HTTP 状态码 */
  status?: number;
  /** 原始响应文本 */
  raw?: string;
  /** 额外的技术信息 */
  cause?: string;
  /** 出错所属的目标标识, 用于在树中准确定位 */
  targetKey?: string;
  targetName?: string;
  targetKind?: "course" | "textbook" | "chapter";
  targetId?: number;
}

/** 右上角提示的内容 */
export interface AppNotice {
  level: "error" | "warning";
  title: string;
  message?: string;
}

/** 构造错误详情的输入 */
export interface ErrorDetailInput {
  title: string;
  message: string;
  endpoint?: string;
  status?: number;
  raw?: string;
  cause?: string;
  targetKey?: string;
  targetName?: string;
  targetKind?: "course" | "textbook" | "chapter";
  targetId?: number;
}

export type NoticeListener = (notice: AppNotice) => void;

const noticeListeners = new Set<NoticeListener>();
const pendingNotices: AppNotice[] = [];
let nextId = 0;

const emitNotice = (notice: AppNotice): void => {
  if (noticeListeners.size === 0) {
    pendingNotices.push(notice);
    if (pendingNotices.length > 20) {
      pendingNotices.shift();
    }
    return;
  }
  for (const listener of noticeListeners) {
    listener(notice);
  }
};

/** 构造结构化错误详情, 供界面展示、复制或创建 Issue */
export const createErrorDetail = (input: ErrorDetailInput): AppErrorDetail => {
  nextId += 1;
  return {
    id: nextId,
    time: new Date(),
    title: input.title,
    message: input.message,
    endpoint: input.endpoint,
    status: input.status,
    raw: input.raw,
    cause: input.cause,
    targetKey: input.targetKey,
    targetName: input.targetName,
    targetKind: input.targetKind,
    targetId: input.targetId,
  };
};

/** 上报一条错误: 触发右上角提示并返回结构化详情 */
export const reportError = (input: ErrorDetailInput): AppErrorDetail => {
  const detail = createErrorDetail(input);
  emitNotice({ level: "error", title: detail.title, message: detail.message });
  return detail;
};

/** 上报一条警告, 只触发右上角提示 */
export const reportWarning = (title: string, message?: string): void => {
  emitNotice({ level: "warning", title, message });
};

/** 订阅右上角提示, 返回取消订阅函数; 订阅时先补发挂起的提示 */
export const subscribeNotices = (listener: NoticeListener): (() => void) => {
  noticeListeners.add(listener);
  while (pendingNotices.length > 0) {
    const notice = pendingNotices.shift();
    if (notice !== undefined) {
      listener(notice);
    }
  }
  return () => {
    noticeListeners.delete(listener);
  };
};

/** 尝试把 JSON 原始响应格式化为缩进文本 */
export const formatRawResponse = (raw: string): string => {
  try {
    const parsed: unknown = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
};

const pad = (value: number): string => String(value).padStart(2, "0");

const formatTime = (time: Date): string =>
  `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())} ${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;

/** 生成可复制的错误文本 */
export const formatErrorDetail = (detail: AppErrorDetail): string => {
  const lines: string[] = [
    "### UCourseAuto 网页版错误",
    "",
    `**${detail.title}**`,
    "",
    detail.message,
    "",
    `- 时间: ${formatTime(detail.time)}`,
  ];
  if (detail.endpoint !== undefined) {
    lines.push(`- 接口: ${detail.endpoint}`);
  }
  if (detail.status !== undefined) {
    lines.push(`- HTTP 状态: ${detail.status}`);
  }
  if (detail.cause !== undefined) {
    lines.push(`- 技术信息: ${detail.cause}`);
  }
  if (typeof navigator !== "undefined") {
    lines.push(`- 浏览器: ${navigator.userAgent}`);
  }
  lines.push("");
  if (detail.raw !== undefined && detail.raw !== "") {
    lines.push("#### 原始响应", "", "```json", formatRawResponse(detail.raw), "```");
  } else {
    lines.push("#### 原始响应", "", "没有可用的原始响应。");
  }
  lines.push("", "#### 补充说明", "", "请在这里描述出现问题时正在进行的操作。");
  return lines.join("\n");
};

const truncate = (text: string, maxLength: number): string =>
  text.length > maxLength ? `${text.slice(0, maxLength)}\n\n…内容过长，完整内容请使用复制按钮。` : text;

/** 生成 GitHub 新建 Issue 的地址 */
export const buildIssueUrl = (detail: AppErrorDetail): string => {
  const url = new URL("https://github.com/ChinoKou/UCourseAuto/issues/new");
  url.searchParams.set("title", `[网页版] ${detail.title}`);
  url.searchParams.set("body", truncate(formatErrorDetail(detail), 6000));
  return url.toString();
};
