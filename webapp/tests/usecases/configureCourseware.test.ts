import { describe, expect, it } from "vitest";

import type { PlatformResult, SectionStudyRecord } from "@/apis/result";
import type { ModelCourse } from "@/schema/domain/course";
import type { Site } from "@/schema/domain/site";
import { BUILTIN_SITES } from "@/schema/domain/site";
import type { ChapterContentResponse } from "@/schema/protocol/chapterContent";
import type { StudentCoursesResponse } from "@/schema/protocol/courseList";
import type { QuestionAnswerResponse } from "@/schema/protocol/questionAnswer";
import type { CourseTextbooksResponse } from "@/schema/protocol/textbookList";
import type { TextbookDirectoryResponse } from "@/schema/protocol/textbookDirectory";
import type { ConfigProgress } from "@/schema/domain/progress";
import type { ConfigurePorts } from "@/usecases/ports";
import {
  configureCourseware,
  listAvailableCourses,
  listCourseTextbooks,
} from "@/usecases/configureCourseware";

const SITE: Site = BUILTIN_SITES[0];

const courseResponse: StudentCoursesResponse = {
  pn: 1,
  ps: 999,
  total: 1,
  courseList: [
    {
      id: 301,
      name: "高等数学",
      classId: 30,
      classUserId: 3001,
      cover: "",
      courseCode: "MATH101",
      type: 1,
      className: "一班",
      status: 1,
      teacherName: "李老师",
      learnProgress: 0,
      totalDuration: 0,
      publishStatus: 1,
      creatorOrgId: 1,
      creatorOrgName: "学院",
    },
  ],
};

const textbooksResponse: CourseTextbooksResponse = {
  textbooks: [
    {
      courseId: 50101,
      name: "高等数学(上)",
      type: 1,
      status: 1,
      limit: 2,
      author: null,
      copyright: null,
      description: null,
      cover: null,
      needapprove: "0",
      lastModifyDate: 1,
      openCourse: 1,
      md5: "x",
    },
  ],
};

const directoryResponse: TextbookDirectoryResponse = {
  courseid: 50101,
  coursename: "高等数学(上)",
  chapters: [
    {
      nodeid: 101,
      nodetitle: "第一章",
      orderindex: 1,
      hide: 0,
      preview: 0,
      id: 0,
      items: [
        {
          itemid: 1011,
          title: "第一节",
          orderindex: 1,
          hide: 0,
          ishidepreview: "2",
          id: 0,
          coursepages: [
            { id: 501, relationid: 601, title: "页面", orderindex: 1, contentType: 7 },
          ],
        },
      ],
    },
    {
      nodeid: 102,
      nodetitle: "隐藏章",
      orderindex: 2,
      hide: 1,
      preview: 0,
      id: 0,
      items: [],
    },
  ],
};

const chapterResponse: ChapterContentResponse = {
  chapterid: 101,
  wholepageItemDTOList: [
    {
      itemid: 1011,
      wholepageDTOList: [
        {
          id: 501,
          relationid: 601,
          content: "页面",
          contentType: 7,
          contentnodeid: 1011,
          type: 7,
          coursepageDTOList: [
            {
              coursepageDTOid: 1,
              parentid: 501,
              resourceid: 0,
              type: 6,
              content: "题目",
              answertime: null,
              questionDTOList: [
                { questionid: 9001, score: 2, title: "题目一", type: 1 },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const answerResponse: QuestionAnswerResponse = { questionid: 9001, correctAnswerList: ["A"] };

const studiedRecord: SectionStudyRecord = {
  studied: true,
  record: {
    completion_status: 1,
    learner_id: 1,
    learner_name: "张三",
    relationid: 1011,
    customized: 0,
    activity_title: "第一节",
    item_id: 1011,
    node_id: 101,
    score: 0,
    studyTime: 0,
    pageStudyRecordDTOList: [
      {
        pageid: 601,
        complete: 1,
        submitTimes: 0,
        studyTime: 0,
        answerTime: 0,
        videos: null,
        questions: null,
        coursepageId: null,
      },
    ],
  },
};

interface Script {
  calls: string[];
  progress: ConfigProgress[];
  directory?: PlatformResult<TextbookDirectoryResponse>;
  chapter?: PlatformResult<ChapterContentResponse>;
  textbooks?: PlatformResult<CourseTextbooksResponse>;
}

const makePorts = (script: Script): ConfigurePorts => ({
  fetchStudentCourses: async () => {
    script.calls.push("courses");
    return { ok: true, data: courseResponse };
  },
  fetchCourseTextbooks: async () => {
    script.calls.push("textbooks");
    return script.textbooks ?? { ok: true, data: textbooksResponse };
  },
  fetchTextbookDirectory: async () => {
    script.calls.push("directory");
    return script.directory ?? { ok: true, data: directoryResponse };
  },
  fetchChapterContent: async () => {
    script.calls.push("chapter");
    return script.chapter ?? { ok: true, data: chapterResponse };
  },
  fetchSectionStudyRecord: async () => {
    script.calls.push("record");
    return { ok: true, data: studiedRecord };
  },
  fetchQuestionAnswers: async () => {
    script.calls.push("answer");
    return { ok: true, data: answerResponse };
  },
  observer: {
    onConfigProgress: (progress) => {
      script.progress.push(progress);
    },
  },
});

const makeScript = (): Script => ({ calls: [], progress: [] });

const selection = [{ course: courseResponse.courseList[0], textbooks: textbooksResponse.textbooks }];

describe("listAvailableCourses", () => {
  it("返回课程数组, 失败时给出错误详情", async () => {
    const script = makeScript();
    const result = await listAvailableCourses(makePorts(script), SITE, "tok");
    expect(result).toEqual({ status: "success", data: courseResponse.courseList });

    const failing = makePorts(script);
    failing.fetchStudentCourses = async () => ({
      ok: false,
      failure: { endpoint: "e", status: 500, raw: "x", reason: "httpStatus" },
    });
    const failedResult = await listAvailableCourses(failing, SITE, "tok");
    if (failedResult.status !== "failed") {
      throw new Error("预期失败");
    }
    expect(failedResult.error.title).toBe("课程列表获取失败");
  });
});

describe("listCourseTextbooks", () => {
  it("按课程返回同序分组", async () => {
    const script = makeScript();
    const result = await listCourseTextbooks(
      makePorts(script),
      SITE,
      "tok",
      courseResponse.courseList,
    );
    if (result.status !== "success") {
      throw new Error("预期成功");
    }
    expect(result.data).toHaveLength(1);
    expect(result.data[0].textbooks[0].courseId).toBe(50101);
  });

  it("全部课程都没有教材时返回可展示的说明", async () => {
    const script = makeScript();
    script.textbooks = { ok: true, data: { textbooks: [] } };
    const result = await listCourseTextbooks(
      makePorts(script),
      SITE,
      "tok",
      courseResponse.courseList,
    );
    if (result.status !== "failed") {
      throw new Error("预期失败");
    }
    expect(result.error.message).toBe("这些课程暂时没有可配置的教材。");
  });

  it("单门课程教材失败时跳过该课程并继续", async () => {
    const secondCourse = { ...courseResponse.courseList[0], id: 302, name: "大学英语" };
    const script = makeScript();
    const ports = makePorts(script);
    ports.fetchCourseTextbooks = async (_site, _token, courseId) => {
      script.calls.push(`textbooks:${courseId}`);
      if (courseId === 301) {
        return {
          ok: false,
          failure: { endpoint: "e", status: 500, raw: "x", reason: "httpStatus" },
        };
      }
      return { ok: true, data: textbooksResponse };
    };

    const result = await listCourseTextbooks(ports, SITE, "tok", [
      courseResponse.courseList[0],
      secondCourse,
    ]);
    if (result.status !== "success") {
      throw new Error("预期成功");
    }
    expect(script.calls).toEqual(["textbooks:301", "textbooks:302"]);
    expect(result.data.map((group) => group.course.id)).toEqual([302]);
  });
});

describe("configureCourseware", () => {
  it("组装目录、章内容、学习记录与答案, 剔除隐藏章", async () => {
    const script = makeScript();
    const result = await configureCourseware(makePorts(script), SITE, "tok", selection);

    expect(script.calls).toEqual(["courses", "directory", "chapter", "record", "answer"].slice(1));
    if (result.status !== "success") {
      throw new Error("预期成功");
    }
    const course: ModelCourse = result.data[0];
    expect(course.teacher_name).toBe("李老师");
    expect(course.class_name).toBe("一班");
    expect(course.textbooks[0].chapters.map((chapter) => chapter.chapter_id)).toEqual([101]);
    const page = course.textbooks[0].chapters[0].sections[0].pages[0];
    expect(page.is_complete).toBe(true);
    expect(page.elements).toEqual([
      {
        kind: "question",
        questions: [
          {
            question_id: 9001,
            question_score: 2,
            question_content: "题目一",
            question_answer_list: ["A"],
          },
        ],
      },
    ]);
    expect(script.progress.at(-1)?.chapterIndex).toBe(1);
  });

  it("目录失败时中止并保留错误详情, 不产生课件数据", async () => {
    const script = makeScript();
    script.directory = {
      ok: false,
      failure: { endpoint: "e", status: 500, raw: "x", reason: "httpStatus" },
    };
    const result = await configureCourseware(makePorts(script), SITE, "tok", selection);
    if (result.status !== "failed") {
      throw new Error("预期失败");
    }
    expect(result.error.title).toBe("教材目录获取失败");
    expect(result.error.message).toContain("高等数学(上)");
  });

  it("答案失败时中止整次配置并记录出错章节标识", async () => {
    const script = makeScript();
    const ports = makePorts(script);
    ports.fetchQuestionAnswers = async () => ({
      ok: false,
      failure: { endpoint: "e", status: 500, raw: "x", reason: "httpStatus" },
    });
    const result = await configureCourseware(ports, SITE, "tok", selection);
    if (result.status !== "failed") {
      throw new Error("预期失败");
    }
    expect(result.error.title).toBe("题目答案获取失败");
    expect(result.error.targetKind).toBe("chapter");
    expect(result.error.targetId).toBe(101);
  });

  it("支持跳过指定章节, 跳过章节不发起内容与答案请求", async () => {
    const script = makeScript();
    const result = await configureCourseware(makePorts(script), SITE, "tok", selection, {
      skippedChapterIds: new Set([101]),
    });
    if (result.status !== "success") {
      throw new Error("预期成功");
    }
    // 章节 101 被跳过，因此未发起 chapter, record, answer 请求
    expect(script.calls).toEqual(["directory"]);
    // 过滤空容器后结果为空数组
    expect(result.data).toHaveLength(0);
  });

  it("支持跳过指定教材, 跳过的教材不拉取目录", async () => {
    const script = makeScript();
    const result = await configureCourseware(makePorts(script), SITE, "tok", selection, {
      skippedTextbookIds: new Set([50101]),
    });
    if (result.status !== "success") {
      throw new Error("预期成功");
    }
    expect(script.calls).toHaveLength(0);
    expect(result.data).toHaveLength(0);
  });
});
