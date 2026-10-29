import { produce } from "immer";
import { describe, expect, it } from "vitest";

import { cloneCourse, cloneCourses, cloneTextbook } from "@/logic/courseware/clone";
import { mergeCourses } from "@/logic/courseware/tree";
import type { ModelCourse, ModelTextbook } from "@/schema/domain/course";

const sampleCourse: ModelCourse = {
  course_id: 101,
  course_name: "测试课程",
  class_id: 201,
  class_user_id: 301,
  teacher_name: "张老师",
  class_name: "一班",
  textbooks: [
    {
      textbook_id: 401,
      textbook_name: "测试教材",
      status: 1,
      limit: 0,
      chapters: [
        {
          chapter_id: 501,
          chapter_name: "第一章",
          sections: [
            {
              section_id: 601,
              section_name: "第一节",
              pages: [
                {
                  page_id: 701,
                  page_relation_id: 801,
                  page_name: "文档页",
                  page_content_type: 5,
                  is_complete: false,
                  elements: [{ kind: "document" }],
                },
                {
                  page_id: 702,
                  page_relation_id: 802,
                  page_name: "视频页",
                  page_content_type: 6,
                  is_complete: true,
                  elements: [{ kind: "video", video_id: 123, video_length: 120 }],
                },
                {
                  page_id: 703,
                  page_relation_id: 803,
                  page_name: "题目页",
                  page_content_type: 7,
                  is_complete: false,
                  elements: [
                    {
                      kind: "question",
                      questions: [
                        {
                          question_id: 901,
                          question_score: 5,
                          question_content: "测试题目？",
                          question_answer_list: ["选项A", "选项B"],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("cloneCourses 深度复制功能", () => {
  it("创建全新的独立五层课件树对象, 修改副本不影响原对象", () => {
    const original = [sampleCourse];
    const cloned = cloneCourses(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned[0]).not.toBe(original[0]);
    expect(cloned[0].textbooks).not.toBe(original[0].textbooks);
    expect(cloned[0].textbooks[0]).not.toBe(original[0].textbooks[0]);
    expect(cloned[0].textbooks[0].chapters[0]).not.toBe(original[0].textbooks[0].chapters[0]);
    expect(cloned[0].textbooks[0].chapters[0].sections[0]).not.toBe(
      original[0].textbooks[0].chapters[0].sections[0],
    );

    // 修改克隆对象的内部属性
    cloned[0].course_name = "修改后的课程";
    cloned[0].textbooks[0].textbook_name = "修改后的教材";
    cloned[0].textbooks[0].chapters[0].sections[0].pages[0].is_complete = true;

    expect(original[0].course_name).toBe("测试课程");
    expect(original[0].textbooks[0].textbook_name).toBe("测试教材");
    expect(original[0].textbooks[0].chapters[0].sections[0].pages[0].is_complete).toBe(false);
  });

  it("支持单门课程与单本教材的独立复制", () => {
    const clonedCourse = cloneCourse(sampleCourse);
    expect(clonedCourse).toEqual(sampleCourse);
    expect(clonedCourse).not.toBe(sampleCourse);

    const textbook: ModelTextbook = sampleCourse.textbooks[0];
    const clonedTextbook = cloneTextbook(textbook);
    expect(clonedTextbook).toEqual(textbook);
    expect(clonedTextbook).not.toBe(textbook);
  });

  it("支持对 Immer Draft 代理对象的复制, 规避浏览器 structuredClone 异常", () => {
    const state = { courses: [sampleCourse] };

    const nextState = produce(state, (draft) => {
      // 在 Immer 的 produce 内部, draft.courses 是 Proxy 对象
      const copied = cloneCourses(draft.courses);
      expect(copied[0].course_name).toBe("测试课程");

      // 验证 mergeCourses 接收 Draft 代理对象时正常工作
      const merged = mergeCourses(draft.courses, [
        {
          ...sampleCourse,
          course_id: 102,
          course_name: "第二门课程",
        },
      ]);
      expect(merged).toHaveLength(2);
      expect(merged[1].course_name).toBe("第二门课程");

      draft.courses = merged;
    });

    expect(nextState.courses).toHaveLength(2);
  });
});
