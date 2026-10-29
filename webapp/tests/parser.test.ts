/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assembleChapterContent,
  assembleTextbookDirectory,
  fillQuestionAnswers,
} from "@/logic/courseware/assemble";
import { applySectionStudyRecord } from "@/logic/studyRecord/applyRecord";
import type { ModelCourse } from "@/schema/domain/course";
import type { CoursewarePage } from "@/schema/domain/courseware";
import {
  chapterContentResponseSchema,
  type ChapterContentResponse,
} from "@/schema/protocol/chapterContent";
import {
  textbookDirectoryResponseSchema,
  type TextbookDirectoryResponse,
} from "@/schema/protocol/textbookDirectory";
import { studyRecordResponseSchema } from "@/schema/protocol/studyRecord";

// fixtures 为真实响应样本, 经 zod 模型解析为响应对象
const loadFixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf-8"));

const directory: TextbookDirectoryResponse = textbookDirectoryResponseSchema.parse(
  loadFixture("t1_directory.json"),
);
const chapter: ChapterContentResponse = chapterContentResponseSchema.parse(
  loadFixture("t2_chapter.json"),
);
const record = studyRecordResponseSchema.parse(loadFixture("t3_studyrecord.json"));

/** 构建课程骨架: 含一本空章教材, 对应教材列表选中后待组装的形状 */
const buildCourse = (): ModelCourse => ({
  course_id: 301,
  course_name: "高等数学",
  class_id: 30,
  class_user_id: 3001,
  textbooks: [
    {
      textbook_id: 50101,
      textbook_name: "高等数学(上)",
      status: 1,
      limit: 2,
      chapters: [],
    },
  ],
});

/** 构建已组装目录与章内容的课件树 */
const buildAssembledCourse = (): ModelCourse => {
  const course = buildCourse();
  assembleTextbookDirectory(course, 50101, directory);
  assembleChapterContent(course, 50101, chapter);
  return course;
};

/** 按页面 ID 在课件树内查找页面 */
const getPage = (course: ModelCourse, pageId: number): CoursewarePage => {
  for (const textbook of course.textbooks) {
    for (const item of textbook.chapters) {
      for (const section of item.sections) {
        const page = section.pages.find((candidate) => candidate.page_id === pageId);
        if (page !== undefined) {
          return page;
        }
      }
    }
  }
  throw new Error(`课件树中不存在页面 ${pageId}`);
};

describe("assembleTextbookDirectory", () => {
  it("按目录的章→节→页顺序写入数组容器, 隐藏章与隐藏节剔除", () => {
    const course = buildCourse();
    assembleTextbookDirectory(course, 50101, directory);

    expect(course).toEqual({
      course_id: 301,
      course_name: "高等数学",
      class_id: 30,
      class_user_id: 3001,
      textbooks: [
        {
          textbook_id: 50101,
          textbook_name: "高等数学(上)",
          status: 1,
          limit: 2,
          chapters: [
            {
              chapter_id: 101,
              chapter_name: "第一章 函数与极限",
              sections: [
                {
                  section_id: 1011,
                  section_name: "第一节 函数",
                  pages: [
                    {
                      page_id: 501,
                      page_relation_id: 601,
                      page_name: "函数的概念",
                      page_content_type: 5,
                      is_complete: false,
                      elements: [],
                    },
                    {
                      page_id: 502,
                      page_relation_id: 602,
                      page_name: "函数的图像",
                      page_content_type: 6,
                      is_complete: false,
                      elements: [],
                    },
                    {
                      page_id: 506,
                      page_relation_id: 606,
                      page_name: "第一章测验",
                      page_content_type: 7,
                      is_complete: false,
                      elements: [],
                    },
                  ],
                },
              ],
            },
            {
              chapter_id: 102,
              chapter_name: "第二章 导数与微分",
              sections: [
                {
                  section_id: 1021,
                  section_name: "第一节 导数定义",
                  pages: [
                    {
                      page_id: 504,
                      page_relation_id: 604,
                      page_name: "极限运算",
                      page_content_type: 7,
                      is_complete: false,
                      elements: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("教材不在课件树中时抛出错误", () => {
    const course = buildCourse();
    expect(() => assembleTextbookDirectory(course, 99999, directory)).toThrow(
      "课件树中不存在教材 99999",
    );
  });
});

describe("assembleChapterContent", () => {
  it("页按 contentType 分派元素, 分数取整, 非目标类型元素跳过, 未建树 section 跳过", () => {
    const course = buildAssembledCourse();
    const textbook = course.textbooks[0];

    expect(textbook.chapters.map((item) => item.chapter_id)).toEqual([101, 102]);

    expect(getPage(course, 501).elements).toEqual([
      { kind: "document" },
      { kind: "content" },
    ]);

    expect(getPage(course, 502).elements).toEqual([
      { kind: "video", video_id: 8002, video_length: 300 },
      { kind: "video", video_id: 8003, video_length: 450 },
    ]);

    expect(getPage(course, 506).elements).toEqual([
      {
        kind: "question",
        questions: [
          {
            question_id: 9001,
            question_score: 2,
            question_content: "下列函数中为奇函数的是",
            question_answer_list: [],
          },
          {
            question_id: 9002,
            question_score: 3,
            question_content: "多选题: 以下说法正确的有",
            question_answer_list: [],
          },
          {
            question_id: 9003,
            question_score: 0,
            question_content: "判断题: 函数必有图像",
            question_answer_list: [],
          },
        ],
      },
    ]);

    const firstSection = textbook.chapters[0].sections[0];
    expect(firstSection.pages.map((page) => page.page_id)).toEqual([501, 502, 506]);
  });

  it("章不在课件树中时抛出错误", () => {
    const course = buildCourse();
    assembleTextbookDirectory(course, 50101, directory);
    expect(() => assembleChapterContent(course, 50101, { ...chapter, chapterid: 999 })).toThrow(
      "课件树中不存在章 999",
    );
  });

  it("页面不在已建树节内时抛出错误", () => {
    const course = buildCourse();
    assembleTextbookDirectory(course, 50101, directory);
    const mismatched = {
      ...chapter,
      wholepageItemDTOList: [{ ...chapter.wholepageItemDTOList[2], itemid: 1011 }],
    };
    expect(() => assembleChapterContent(course, 50101, mismatched)).toThrow(
      "课件树中不存在页面 507",
    );
  });
});

describe("applySectionStudyRecord", () => {
  it("以 node_id/item_id 定位节, 按 pageid 匹配页写入完成标记", () => {
    const course = buildAssembledCourse();
    applySectionStudyRecord(course, 50101, record);

    expect(getPage(course, 501).is_complete).toBe(true);
    expect(getPage(course, 502).is_complete).toBe(false);
    expect(getPage(course, 506).is_complete).toBe(true);
    expect(getPage(course, 504).is_complete).toBe(false);
  });

  it("节不在课件树中时抛出错误", () => {
    const course = buildAssembledCourse();
    expect(() =>
      applySectionStudyRecord(course, 50101, { ...record, item_id: 8888 }),
    ).toThrow("课件树中不存在节 8888");
  });
});

describe("fillQuestionAnswers", () => {
  it("题目页逐题写入答案列表", () => {
    const course = buildAssembledCourse();
    const page = getPage(course, 506);

    fillQuestionAnswers(
      page,
      new Map([
        [9001, ["B"]],
        [9002, ["A", "C", "D"]],
        [9003, ["正确"]],
      ]),
    );

    expect(page.elements).toEqual([
      {
        kind: "question",
        questions: [
          {
            question_id: 9001,
            question_score: 2,
            question_content: "下列函数中为奇函数的是",
            question_answer_list: ["B"],
          },
          {
            question_id: 9002,
            question_score: 3,
            question_content: "多选题: 以下说法正确的有",
            question_answer_list: ["A", "C", "D"],
          },
          {
            question_id: 9003,
            question_score: 0,
            question_content: "判断题: 函数必有图像",
            question_answer_list: ["正确"],
          },
        ],
      },
    ]);
  });

  it("某题答案缺失时抛出错误", () => {
    const course = buildAssembledCourse();
    const page = getPage(course, 506);

    expect(() =>
      fillQuestionAnswers(
        page,
        new Map([
          [9001, ["B"]],
          [9003, ["正确"]],
        ]),
      ),
    ).toThrow("题目 9002 的答案缺失");
  });
});
