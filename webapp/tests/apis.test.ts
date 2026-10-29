import { afterEach, describe, expect, it, vi } from "vitest";

import { loginWithCredential, validateAccessToken } from "@/apis/auth";
import {
  fetchChapterContent,
  fetchCourseTextbooks,
  fetchCurrentUser,
  fetchQuestionAnswers,
  fetchSectionStudyRecord,
  fetchStudentCourses,
  fetchTextbookDirectory,
  initializeSectionRecord,
  reportVideoBehavior,
  syncStudyRecord,
  triggerTextbookDetection,
} from "@/apis/course";
import { syncTextDecrypt } from "@/crypto/des";
import { BUILTIN_SITES } from "@/schema/domain/site";

/** 测试用站点: 内置主站 */
const SITE = BUILTIN_SITES[0];

/** 一次被拦截的请求 */
interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

/** 安装 fetch 桩: 记录请求并返回固定响应 */
const installFetch = (
  responder: (request: CapturedRequest) => Response,
): CapturedRequest[] => {
  const captured: CapturedRequest[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(init?.headers ?? {})) {
      headers[key] = String(value);
    }
    const request: CapturedRequest = {
      url,
      method: init?.method ?? "GET",
      headers,
      body: typeof init?.body === "string" ? init.body : null,
    };
    captured.push(request);
    return responder(request);
  });
  return captured;
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const textResponse = (body: string, status = 200): Response =>
  new Response(body, { status, headers: { "Content-Type": "text/plain" } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("登录接口", () => {
  it("登录: POST {course_api}/users/login, JSON 请求体, 成功返回 authorization", async () => {
    const captured = installFetch(() =>
      jsonResponse({ authorization: "tok-1", name: "张三", roleId: 1, userId: 2, orgId: 3, loginName: "a" }),
    );

    const outcome = await loginWithCredential(SITE, "202501001", "pw");
    expect(outcome.status).toBe("success");
    expect(captured[0].url).toBe(`${SITE.course_api}/users/login`);
    expect(captured[0].method).toBe("POST");
    expect(captured[0].headers["Content-Type"]).toBe("application/json");
    expect(captured[0].headers.Authorization).toBeUndefined();
    expect(JSON.parse(captured[0].body ?? "{}")).toEqual({
      loginName: "202501001",
      password: "pw",
    });
  });

  it("登录: HTTP 400 且响应体含 code 与 message 时为平台拒绝", async () => {
    installFetch(() => jsonResponse({ code: 1201, message: "用户不存在" }, 400));
    const outcome = await loginWithCredential(SITE, "a", "b");
    expect(outcome).toEqual({ status: "rejected", code: 1201, message: "用户不存在" });
  });

  it("登录: 其余状态按传输失败返回, 携带接口、状态与原始响应", async () => {
    installFetch(() => textResponse("bad", 502));
    const outcome = await loginWithCredential(SITE, "a", "b");
    if (outcome.status !== "failed") {
      throw new Error(`预期失败: ${outcome.status}`);
    }
    expect(outcome.failure).toEqual({
      endpoint: `${SITE.course_api}/users/login`,
      status: 502,
      raw: "bad",
      reason: "httpStatus",
    });
  });

  it("登录: 响应字段结构不符时按 schemaMismatch 返回", async () => {
    installFetch(() => jsonResponse({ name: "张三" }));
    const outcome = await loginWithCredential(SITE, "a", "b");
    if (outcome.status !== "failed") {
      throw new Error(`预期失败: ${outcome.status}`);
    }
    expect(outcome.failure.reason).toBe("schemaMismatch");
  });

  it("令牌校验: GET {course_api}/users/isValidToken/{token}, 文本 true 为有效", async () => {
    const captured = installFetch(() => textResponse("true"));
    const result = await validateAccessToken(SITE, "tok-9");
    expect(captured[0].url).toBe(`${SITE.course_api}/users/isValidToken/tok-9`);
    expect(captured[0].headers.Authorization).toBe("tok-9");
    expect(result).toEqual({ ok: true, data: true });
  });

  it("令牌校验: 传输失败按令牌无效返回失败结果", async () => {
    installFetch(() => textResponse("", 500));
    const result = await validateAccessToken(SITE, "tok-9");
    expect(result.ok).toBe(false);
  });
});

describe("课程与教材接口", () => {
  it("课程列表: GET {course_api}/courses/students, 六个查询参数按顺序附加", async () => {
    const captured = installFetch(() =>
      jsonResponse({ pn: 1, ps: 999, total: 0, courseList: [] }),
    );
    const result = await fetchStudentCourses(SITE, "tok");
    expect(captured[0].url).toBe(
      `${SITE.course_api}/courses/students?keyword=&publishStatus=1&type=1&pn=1&ps=999&lang=zh`,
    );
    expect(result).toEqual({ ok: true, data: { pn: 1, ps: 999, total: 0, courseList: [] } });
  });

  it("课程列表: 非 200 时不重试, 直接按失败返回", async () => {
    const captured = installFetch(() => textResponse("server error", 500));
    const result = await fetchStudentCourses(SITE, "tok");
    expect(captured).toHaveLength(1);
    expect(result.ok).toBe(false);
  });

  it("教材列表: GET {course_api}/textbook/student/{courseId}/list, 数组包装为 textbooks", async () => {
    const captured = installFetch(() =>
      jsonResponse([
        {
          courseId: 1,
          name: "教材",
          type: 1,
          status: 1,
          limit: 2,
          needapprove: "0",
          lastModifyDate: 1,
          openCourse: 1,
          md5: "x",
        },
      ]),
    );
    const result = await fetchCourseTextbooks(SITE, "tok", 301);
    expect(captured[0].url).toBe(`${SITE.course_api}/textbook/student/301/list?lang=zh`);
    if (!result.ok) {
      throw new Error("预期成功");
    }
    expect(result.data.textbooks).toHaveLength(1);
  });

  it("检测接口: GET {course_api}/textbook/student/information, textbook 与 list 为真值才成功", async () => {
    const captured = installFetch(() => jsonResponse({ textbook: { id: 1 }, list: [1] }));
    const result = await triggerTextbookDetection(SITE, "tok", 301, 50101);
    expect(captured[0].url).toBe(
      `${SITE.course_api}/textbook/student/information?currentPlatformType=1&ocId=301&textbookId=50101&lang=zh`,
    );
    expect(result).toEqual({ ok: true, data: true });
  });

  it("检测接口: 空数组与空对象视为假值, 按 unexpectedBody 返回", async () => {
    installFetch(() => jsonResponse({ textbook: {}, list: [] }));
    const result = await triggerTextbookDetection(SITE, "tok", 301, 50101);
    if (result.ok) {
      throw new Error("预期失败");
    }
    expect(result.failure.reason).toBe("unexpectedBody");
  });

  it("教材目录: GET {ua_api}/course/stu/{textbookId}/directory, classId 作为查询参数", async () => {
    const captured = installFetch(() =>
      jsonResponse({ courseid: 1, coursename: "教材", chapters: [] }),
    );
    const result = await fetchTextbookDirectory(SITE, "tok", 50101, 30);
    expect(captured[0].url).toBe(`${SITE.ua_api}/course/stu/50101/directory?classId=30`);
    expect(result.ok).toBe(true);
  });

  it("章内容: GET {ua_api}/wholepage/chapter/stu/{chapterId}, 无查询参数", async () => {
    const captured = installFetch(() =>
      jsonResponse({ chapterid: 1, wholepageItemDTOList: [] }),
    );
    const result = await fetchChapterContent(SITE, "tok", 101);
    expect(captured[0].url).toBe(`${SITE.ua_api}/wholepage/chapter/stu/101`);
    expect(result.ok).toBe(true);
  });

  it("学习记录: GET {ua_api}/studyrecord/item/{sectionId}, 空响应体表达未学习", async () => {
    const captured = installFetch(() => textResponse(""));
    const result = await fetchSectionStudyRecord(SITE, "tok", 1011);
    expect(captured[0].url).toBe(`${SITE.ua_api}/studyrecord/item/1011?courseType=4`);
    expect(result).toEqual({ ok: true, data: { studied: false } });
  });

  it("学习记录: 非空响应体按学习记录模型解析", async () => {
    installFetch(() =>
      jsonResponse({
        completion_status: 1,
        learner_id: 1,
        learner_name: "张三",
        relationid: 1,
        customized: 0,
        activity_title: "节",
        item_id: 1011,
        node_id: 101,
        score: 100,
        studyTime: 0,
        pageStudyRecordDTOList: [],
      }),
    );
    const result = await fetchSectionStudyRecord(SITE, "tok", 1011);
    if (!result.ok || !result.data.studied) {
      throw new Error("预期已学习");
    }
    expect(result.data.record.item_id).toBe(1011);
  });

  it("题目答案: GET {ua_api}/questionAnswer/{questionId}, parentId 为页面 ID", async () => {
    const captured = installFetch(() =>
      jsonResponse({ questionid: 9001, correctAnswerList: ["A"] }),
    );
    const result = await fetchQuestionAnswers(SITE, "tok", 9001, 506);
    expect(captured[0].url).toBe(`${SITE.ua_api}/questionAnswer/9001?parentId=506`);
    expect(result.ok).toBe(true);
  });

  it("当前用户: GET {ua_api}/user", async () => {
    const captured = installFetch(() =>
      jsonResponse({
        userid: 1,
        name: "张三",
        headimage: null,
        orgid: 2,
        logo: null,
        roleid: 3,
        antiCheat: 0,
        antiDrag: 0,
        openCourseResource: 0,
        enableSubtitle: 1,
        enableSkipVideoTitle: 0,
      }),
    );
    const result = await fetchCurrentUser(SITE, "tok");
    expect(captured[0].url).toBe(`${SITE.ua_api}/user`);
    expect(result.ok).toBe(true);
  });

  it("初始化节: GET {ua_api}/studyrecord/initialize/{sectionId}, 只接受十进制整数文本", async () => {
    const captured = installFetch(() => textResponse(" 1730000000 "));
    const ok = await initializeSectionRecord(SITE, "tok", 1011);
    expect(captured[0].url).toBe(`${SITE.ua_api}/studyrecord/initialize/1011`);
    expect(ok).toEqual({ ok: true, data: 1730000000 });

    installFetch(() => textResponse("5.0"));
    const decimal = await initializeSectionRecord(SITE, "tok", 1011);
    expect(decimal.ok).toBe(false);

    installFetch(() => textResponse("1e3"));
    const exponent = await initializeSectionRecord(SITE, "tok", 1011);
    expect(exponent.ok).toBe(false);
  });

  it("视频行为: POST {course_api}/behavior/watchVideo, courseId 为教材 ID", async () => {
    const captured = installFetch(() => textResponse(""));
    const result = await reportVideoBehavior(SITE, "tok", 30, 50101, 101, 8002);
    expect(captured[0].url).toBe(`${SITE.course_api}/behavior/watchVideo`);
    expect(JSON.parse(captured[0].body ?? "{}")).toEqual({
      classId: 30,
      courseId: 50101,
      chapterId: 101,
      videoId: 8002,
    });
    expect(result.ok).toBe(true);
  });

  it("上报学习记录: POST {ua_api}/yws/api/personal/sync, 请求体为 DES 密文, 文本 1 为成功", async () => {
    const captured = installFetch(() => textResponse("1"));
    const request = {
      itemid: 1011,
      autoSave: 1 as const,
      withoutOld: null,
      complete: 1 as const,
      studyStartTime: 1730000000,
      userName: "张三",
      score: 100,
      pageStudyRecordDTOList: [],
    };
    const result = await syncStudyRecord(SITE, "tok", request);
    expect(captured[0].url).toBe(
      `${SITE.ua_api}/yws/api/personal/sync?courseType=4&platform=PC`,
    );
    expect(captured[0].headers["Content-Type"]).toBeUndefined();
    expect(JSON.parse(syncTextDecrypt(captured[0].body ?? ""))).toEqual(request);
    expect(result).toEqual({ ok: true, data: true });
  });

  it("上报学习记录: 响应文本不是 1 时按 unexpectedBody 返回", async () => {
    installFetch(() => textResponse("0"));
    const result = await syncStudyRecord(SITE, "tok", {
      itemid: 1,
      autoSave: 1,
      withoutOld: null,
      complete: 1,
      studyStartTime: 1,
      userName: "张三",
      score: 100,
      pageStudyRecordDTOList: [],
    });
    if (result.ok) {
      throw new Error("预期失败");
    }
    expect(result.failure.reason).toBe("unexpectedBody");
  });
});
