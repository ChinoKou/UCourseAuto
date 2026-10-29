import { describe, expect, it } from "vitest";

import { loginResponseSchema } from "@/schema/protocol/auth";
import {
  chapterContentResponseSchema,
} from "@/schema/protocol/chapterContent";
import { studentCoursesResponseSchema } from "@/schema/protocol/courseList";
import { currentUserResponseSchema } from "@/schema/protocol/currentUser";
import { questionAnswerResponseSchema } from "@/schema/protocol/questionAnswer";
import { studyRecordResponseSchema } from "@/schema/protocol/studyRecord";
import { syncStudyRecordRequestSchema } from "@/schema/protocol/syncStudyRecord";
import { courseTextbooksResponseSchema } from "@/schema/protocol/textbookList";
import { textbookDirectoryResponseSchema } from "@/schema/protocol/textbookDirectory";

describe("协议模型的字段集合", () => {
  it("登录响应含头像与机构字段, 缺少 authorization 时校验失败", () => {
    const parsed = loginResponseSchema.parse({
      authorization: "token",
      name: "张三",
      roleId: 9,
      userId: 1,
      orgId: 1,
      loginName: "202501001",
      headimage: "https://example.com/avatar.png",
      institutionId: "inst",
    });
    expect(parsed.headimage).toBe("https://example.com/avatar.png");
    expect(parsed.institutionId).toBe("inst");
    expect(parsed.orgName).toBeUndefined();

    expect(() => loginResponseSchema.parse({ name: "张三" })).toThrow();
  });

  it("当前用户响应声明平台返回的全部字段", () => {
    const parsed = currentUserResponseSchema.parse({
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
    });
    expect(parsed.headimage).toBeNull();
    expect(parsed.enableSubtitle).toBe(1);
    expect(() => currentUserResponseSchema.parse({ userid: 1 })).toThrow();
  });

  it("课程列表响应按分页字段与课程数组声明", () => {
    const parsed = studentCoursesResponseSchema.parse({
      pn: 1,
      ps: 999,
      total: 1,
      courseList: [
        {
          id: 1,
          name: "课程",
          classId: 2,
          classUserId: 3,
          cover: "",
          courseCode: "MATH101",
          type: 1,
          className: "一班",
          status: 1,
          teacherName: "老师",
          learnProgress: 10,
          totalDuration: 100,
          publishStatus: 1,
          creatorOrgId: 4,
          creatorOrgName: "学院",
        },
      ],
    });
    expect(parsed.courseList[0].className).toBe("一班");
    expect(() => studentCoursesResponseSchema.parse({ pn: 1 })).toThrow();
  });

  it("教材列表把响应数组包装为 textbooks, 可空字段取 null", () => {
    const parsed = courseTextbooksResponseSchema.parse({
      textbooks: [
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
      ],
    });
    expect(parsed.textbooks[0].author).toBeNull();
    expect(parsed.textbooks[0].cover).toBeNull();
  });

  it("教材目录区分章、节、页三层, 隐藏标记带默认值", () => {
    const parsed = textbookDirectoryResponseSchema.parse({
      courseid: 1,
      coursename: "教材",
      chapters: [
        {
          nodeid: 2,
          nodetitle: "章",
          orderindex: 1,
          items: [
            {
              itemid: 3,
              title: "节",
              orderindex: 1,
              coursepages: [
                { id: 4, relationid: 5, title: "页", orderindex: 1, contentType: 5 },
              ],
            },
          ],
        },
      ],
    });
    expect(parsed.chapters[0].hide).toBe(0);
    expect(parsed.chapters[0].items[0].hide).toBe(0);
    expect(parsed.chapters[0].items[0].coursepages[0].relationid).toBe(5);
  });

  it("章内容的元素判别联合拒收未登记的元素类型", () => {
    const response = {
      chapterid: 1,
      wholepageItemDTOList: [
        {
          itemid: 2,
          wholepageDTOList: [
            {
              id: 3,
              relationid: 4,
              content: "页",
              contentType: 5,
              contentnodeid: 2,
              type: 5,
              coursepageDTOList: [
                { coursepageDTOid: 5, parentid: 3, resourceid: 0, type: 99, content: "x" },
              ],
            },
          ],
        },
      ],
    };
    expect(() => chapterContentResponseSchema.parse(response)).toThrow();
  });

  it("学习记录响应声明完成状态与页面记录, 视频与题目可空", () => {
    const parsed = studyRecordResponseSchema.parse({
      completion_status: 1,
      learner_id: 1,
      learner_name: "张三",
      relationid: 1,
      customized: 0,
      activity_title: "节",
      item_id: 2,
      node_id: 3,
      score: 100,
      studyTime: 0,
      pageStudyRecordDTOList: [
        {
          pageid: 4,
          complete: 1,
          submitTimes: 0,
          studyTime: 0,
          answerTime: 0,
        },
      ],
    });
    expect(parsed.pageStudyRecordDTOList[0].videos).toBeNull();
    expect(parsed.pageStudyRecordDTOList[0].questions).toBeNull();
  });

  it("题目答案响应要求 correctAnswerList", () => {
    expect(
      questionAnswerResponseSchema.parse({ questionid: 1, correctAnswerList: ["A"] }),
    ).toEqual({ questionid: 1, correctAnswerList: ["A"] });
    expect(() => questionAnswerResponseSchema.parse({ questionid: 1 })).toThrow();
  });

  it("上报体缺 pageStudyRecordDTOList 时校验失败, 默认值补齐开关字段", () => {
    expect(() => syncStudyRecordRequestSchema.parse({ itemid: 1 })).toThrow();
    const parsed = syncStudyRecordRequestSchema.parse({
      itemid: 1,
      studyStartTime: 2,
      userName: "张三",
      pageStudyRecordDTOList: [],
    });
    expect(parsed.autoSave).toBe(1);
    expect(parsed.withoutOld).toBeNull();
    expect(parsed.score).toBe(100);
  });
});
