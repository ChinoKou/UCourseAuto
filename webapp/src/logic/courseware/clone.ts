import type { ModelCourse, ModelTextbook } from "@/schema/domain/course";
import type {
  CoursewareElement,
  CoursewarePage,
} from "@/schema/domain/courseware";

/**
 * 课件树纯数据深度复制:
 * 递归解构构建全新对象, 避免跨模块共享引用,
 * 规避浏览器 structuredClone 在 Proxy 与复杂上下文下的异常中断。
 */

/** 单个元素按 kind 复制, 文档与纯文本只复制类型标记 */
const cloneElement = (element: CoursewareElement): CoursewareElement => {
  switch (element.kind) {
    case "video":
      return {
        kind: "video",
        video_id: element.video_id,
        video_length: element.video_length,
      };
    case "question":
      return {
        kind: "question",
        questions: element.questions.map((question) => ({
          question_id: question.question_id,
          question_score: question.question_score,
          question_content: question.question_content,
          question_answer_list: [...question.question_answer_list],
        })),
      };
    case "document":
      return { kind: "document" };
    case "content":
      return { kind: "content" };
  }
};

const clonePage = (page: CoursewarePage): CoursewarePage => ({
  page_id: page.page_id,
  page_relation_id: page.page_relation_id,
  page_name: page.page_name,
  page_content_type: page.page_content_type,
  is_complete: page.is_complete,
  elements: page.elements.map(cloneElement),
});

export const cloneCourses = (courses: ReadonlyArray<ModelCourse>): ModelCourse[] =>
  courses.map((course) => ({
    course_id: course.course_id,
    course_name: course.course_name,
    class_id: course.class_id,
    class_user_id: course.class_user_id,
    teacher_name: course.teacher_name,
    class_name: course.class_name,
    textbooks: course.textbooks.map((textbook) => ({
      textbook_id: textbook.textbook_id,
      textbook_name: textbook.textbook_name,
      status: textbook.status,
      limit: textbook.limit,
      chapters: textbook.chapters.map((chapter) => ({
        chapter_id: chapter.chapter_id,
        chapter_name: chapter.chapter_name,
        sections: chapter.sections.map((section) => ({
          section_id: section.section_id,
          section_name: section.section_name,
          pages: section.pages.map(clonePage),
        })),
      })),
    })),
  }));

export const cloneCourse = (course: ModelCourse): ModelCourse =>
  cloneCourses([course])[0];

export const cloneTextbook = (textbook: ModelTextbook): ModelTextbook => ({
  textbook_id: textbook.textbook_id,
  textbook_name: textbook.textbook_name,
  status: textbook.status,
  limit: textbook.limit,
  chapters: textbook.chapters.map((chapter) => ({
    chapter_id: chapter.chapter_id,
    chapter_name: chapter.chapter_name,
    sections: chapter.sections.map((section) => ({
      section_id: section.section_id,
      section_name: section.section_name,
      pages: section.pages.map(clonePage),
    })),
  })),
});
