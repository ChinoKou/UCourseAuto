import {
  httpFailure,
  parseJsonResult,
  parseJsonText,
  type PlatformResult,
  type SectionStudyRecord,
} from "@/apis/result";
import { syncTextEncrypt } from "@/crypto/des";
import { createHttpClient } from "@/net/http";
import type { Site } from "@/schema/domain/site";
import { parseResponse } from "@/schema/parse";
import {
  chapterContentResponseSchema,
  type ChapterContentResponse,
} from "@/schema/protocol/chapterContent";
import {
  currentUserResponseSchema,
  type CurrentUserResponse,
} from "@/schema/protocol/currentUser";
import {
  questionAnswerResponseSchema,
  type QuestionAnswerResponse,
} from "@/schema/protocol/questionAnswer";
import {
  studyRecordResponseSchema,
} from "@/schema/protocol/studyRecord";
import type { SyncStudyRecordRequest } from "@/schema/protocol/syncStudyRecord";
import {
  courseTextbooksResponseSchema,
  type CourseTextbooksResponse,
} from "@/schema/protocol/textbookList";
import {
  studentCoursesResponseSchema,
  type StudentCoursesResponse,
} from "@/schema/protocol/courseList";
import {
  textbookDirectoryResponseSchema,
  type TextbookDirectoryResponse,
} from "@/schema/protocol/textbookDirectory";

/**
 * 课程域接口: 课程、教材、目录、章内容、学习记录、题目答案、用户资料与上报。
 * 只做请求发送与响应解析, 失败以 PlatformResult 返回, 提示由业务动作决定。
 */

/** 与 Python 真值语义一致的判读: 空数组与空对象视为假值 */
const isTruthyValue = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object" && value !== null) {
    return Object.keys(value).length > 0;
  }
  return Boolean(value);
};

/** 课程列表: GET {course_api}/courses/students, 一次取回全部课程 */
export async function fetchStudentCourses(
  site: Site,
  token: string,
): Promise<PlatformResult<StudentCoursesResponse>> {
  const endpoint = `${site.course_api}/courses/students`;
  const client = createHttpClient({ token });
  const result = await client.get(endpoint, {
    params: { keyword: "", publishStatus: 1, type: 1, pn: 1, ps: 999, lang: "zh" },
  });
  if (!result.ok) {
    return { ok: false, failure: httpFailure(endpoint, result) };
  }
  return parseJsonResult(endpoint, result, studentCoursesResponseSchema);
}

/** 课程教材列表: GET {course_api}/textbook/student/{courseId}/list, 响应体是教材数组 */
export async function fetchCourseTextbooks(
  site: Site,
  token: string,
  courseId: number,
): Promise<PlatformResult<CourseTextbooksResponse>> {
  const endpoint = `${site.course_api}/textbook/student/${courseId}/list`;
  const client = createHttpClient({ token });
  const result = await client.get(endpoint, { params: { lang: "zh" } });
  if (!result.ok) {
    return { ok: false, failure: httpFailure(endpoint, result) };
  }
  const data = parseJsonText(result.text);
  if (data === null) {
    return {
      ok: false,
      failure: { endpoint, status: result.status, raw: result.text, reason: "invalidJson" },
    };
  }
  const model = parseResponse(courseTextbooksResponseSchema, { textbooks: data });
  if (model === null) {
    return {
      ok: false,
      failure: { endpoint, status: result.status, raw: result.text, reason: "schemaMismatch" },
    };
  }
  return { ok: true, data: model };
}

/**
 * 触发平台的课件检测: 响应含 textbook 与 list 字段且均为真值视为成功, 超时 120 秒。
 * 该接口在零时长段结束后调用, 失败只影响提示, 不中断真实时长段。
 */
export async function triggerTextbookDetection(
  site: Site,
  token: string,
  courseId: number,
  textbookId: number,
): Promise<PlatformResult<boolean>> {
  const endpoint = `${site.course_api}/textbook/student/information`;
  const client = createHttpClient({ token });
  const result = await client.get(endpoint, {
    params: { currentPlatformType: 1, ocId: courseId, textbookId, lang: "zh" },
    timeout: 120_000,
  });
  if (!result.ok) {
    return { ok: false, failure: httpFailure(endpoint, result) };
  }
  const data = parseJsonText(result.text);
  if (
    typeof data !== "object" ||
    data === null ||
    !("textbook" in data) ||
    !("list" in data) ||
    !isTruthyValue(data.textbook) ||
    !isTruthyValue(data.list)
  ) {
    return {
      ok: false,
      failure: { endpoint, status: result.status, raw: result.text, reason: "unexpectedBody" },
    };
  }
  return { ok: true, data: true };
}

/** 教材章节目录: GET {ua_api}/course/stu/{textbookId}/directory */
export async function fetchTextbookDirectory(
  site: Site,
  token: string,
  textbookId: number,
  classId: number,
): Promise<PlatformResult<TextbookDirectoryResponse>> {
  const endpoint = `${site.ua_api}/course/stu/${textbookId}/directory`;
  const client = createHttpClient({ token });
  const result = await client.get(endpoint, { params: { classId } });
  if (!result.ok) {
    return { ok: false, failure: httpFailure(endpoint, result) };
  }
  return parseJsonResult(endpoint, result, textbookDirectoryResponseSchema);
}

/** 章内容: GET {ua_api}/wholepage/chapter/stu/{chapterId} */
export async function fetchChapterContent(
  site: Site,
  token: string,
  chapterId: number,
): Promise<PlatformResult<ChapterContentResponse>> {
  const endpoint = `${site.ua_api}/wholepage/chapter/stu/${chapterId}`;
  const client = createHttpClient({ token });
  const result = await client.get(endpoint);
  if (!result.ok) {
    return { ok: false, failure: httpFailure(endpoint, result) };
  }
  return parseJsonResult(endpoint, result, chapterContentResponseSchema);
}

/**
 * 节学习记录: GET {ua_api}/studyrecord/item/{sectionId}。
 * 空响应体表示该节未学习, 以 studied 为 false 表达。
 */
export async function fetchSectionStudyRecord(
  site: Site,
  token: string,
  sectionId: number,
): Promise<PlatformResult<SectionStudyRecord>> {
  const endpoint = `${site.ua_api}/studyrecord/item/${sectionId}`;
  const client = createHttpClient({ token });
  const result = await client.get(endpoint, { params: { courseType: 4 } });
  if (!result.ok) {
    return { ok: false, failure: httpFailure(endpoint, result) };
  }
  if (result.text === "") {
    return { ok: true, data: { studied: false } };
  }
  const parsed = parseJsonResult(endpoint, result, studyRecordResponseSchema);
  if (!parsed.ok) {
    return { ok: false, failure: parsed.failure };
  }
  return { ok: true, data: { studied: true, record: parsed.data } };
}

/** 题目答案: GET {ua_api}/questionAnswer/{questionId}, parentId 为页面 ID */
export async function fetchQuestionAnswers(
  site: Site,
  token: string,
  questionId: number,
  pageId: number,
): Promise<PlatformResult<QuestionAnswerResponse>> {
  const endpoint = `${site.ua_api}/questionAnswer/${questionId}`;
  const client = createHttpClient({ token });
  const result = await client.get(endpoint, { params: { parentId: pageId } });
  if (!result.ok) {
    return { ok: false, failure: httpFailure(endpoint, result) };
  }
  return parseJsonResult(endpoint, result, questionAnswerResponseSchema);
}

/** 当前用户信息: GET {ua_api}/user */
export async function fetchCurrentUser(
  site: Site,
  token: string,
): Promise<PlatformResult<CurrentUserResponse>> {
  const endpoint = `${site.ua_api}/user`;
  const client = createHttpClient({ token });
  const result = await client.get(endpoint);
  if (!result.ok) {
    return { ok: false, failure: httpFailure(endpoint, result) };
  }
  return parseJsonResult(endpoint, result, currentUserResponseSchema);
}

/**
 * 初始化节: GET {ua_api}/studyrecord/initialize/{sectionId}。
 * 响应为纯文本学习开始时间戳, 只接受十进制整数文本。
 */
export async function initializeSectionRecord(
  site: Site,
  token: string,
  sectionId: number,
): Promise<PlatformResult<number>> {
  const endpoint = `${site.ua_api}/studyrecord/initialize/${sectionId}`;
  const client = createHttpClient({ token });
  const result = await client.get(endpoint);
  if (!result.ok) {
    return { ok: false, failure: httpFailure(endpoint, result) };
  }
  const text = result.text.trim();
  if (!/^-?\d+$/.test(text)) {
    return {
      ok: false,
      failure: { endpoint, status: result.status, raw: result.text, reason: "unexpectedBody" },
    };
  }
  return { ok: true, data: Number(text) };
}

/** 上报视频观看行为: POST {course_api}/behavior/watchVideo */
export async function reportVideoBehavior(
  site: Site,
  token: string,
  classId: number,
  textbookId: number,
  chapterId: number,
  videoId: number,
): Promise<PlatformResult<void>> {
  const endpoint = `${site.course_api}/behavior/watchVideo`;
  const client = createHttpClient({ token });
  const result = await client.post(endpoint, {
    json: { classId, courseId: textbookId, chapterId, videoId },
  });
  if (!result.ok) {
    return { ok: false, failure: httpFailure(endpoint, result) };
  }
  return { ok: true, data: undefined };
}

/**
 * 上报学习记录: POST {ua_api}/yws/api/personal/sync。
 * 请求体为 JSON 文本经 DES 加密后的 Base64, 响应文本 1 为成功。
 */
export async function syncStudyRecord(
  site: Site,
  token: string,
  request: SyncStudyRecordRequest,
): Promise<PlatformResult<boolean>> {
  const endpoint = `${site.ua_api}/yws/api/personal/sync`;
  const client = createHttpClient({ token });
  const encryptedText = syncTextEncrypt(JSON.stringify(request));
  const result = await client.post(endpoint, {
    params: { courseType: 4, platform: "PC" },
    body: encryptedText,
  });
  if (!result.ok) {
    return { ok: false, failure: httpFailure(endpoint, result) };
  }
  if (result.text !== "1") {
    return {
      ok: false,
      failure: { endpoint, status: result.status, raw: result.text, reason: "unexpectedBody" },
    };
  }
  return { ok: true, data: true };
}
