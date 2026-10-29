import {
  findChapter,
  findPage,
  findSection,
  findTextbook,
} from "@/logic/courseware/tree";
import type { ModelCourse } from "@/schema/domain/course";
import type {
  CoursewareChapter,
  CoursewarePage,
  CoursewareSection,
} from "@/schema/domain/courseware";
import type { ChapterContentResponse } from "@/schema/protocol/chapterContent";
import type { TextbookDirectoryResponse } from "@/schema/protocol/textbookDirectory";

/**
 * 把平台响应组装为课件树: 目录给出章、节、页三层骨架, 章内容补全页面元素,
 * 题目答案另行补全。树中缺失对应节点时就地抛出, 不跳过。
 */

/** 取教材, 缺失时抛出。 */
const requireTextbook = (course: ModelCourse, textbookId: number) => {
  const textbook = findTextbook(course, textbookId);
  if (textbook === null) {
    throw new Error(`课件树中不存在教材 ${textbookId}`);
  }
  return textbook;
};

/** 取章, 缺失时抛出。 */
const requireChapter = (textbook: ReturnType<typeof requireTextbook>, chapterId: number) => {
  const chapter = findChapter(textbook, chapterId);
  if (chapter === null) {
    throw new Error(`课件树中不存在章 ${chapterId}`);
  }
  return chapter;
};

/** 取页面, 缺失时抛出。 */
const requirePage = (section: CoursewareSection, pageId: number) => {
  const page = findPage(section, pageId);
  if (page === null) {
    throw new Error(`课件树中不存在页面 ${pageId}`);
  }
  return page;
};

/**
 * 目录组装: hide 为 1 的章与节剔除, 其余按目录顺序写入章、节、页三层。
 * 页面的元素容器初始为空, 由章内容组装补全。
 */
export const assembleTextbookDirectory = (
  course: ModelCourse,
  textbookId: number,
  directory: TextbookDirectoryResponse,
): void => {
  const textbook = requireTextbook(course, textbookId);

  for (const chapterItem of directory.chapters) {
    if (chapterItem.hide === 1) {
      continue;
    }
    const chapter: CoursewareChapter = {
      chapter_id: chapterItem.nodeid,
      chapter_name: chapterItem.nodetitle,
      sections: [],
    };
    textbook.chapters.push(chapter);

    for (const sectionItem of chapterItem.items) {
      if (sectionItem.hide === 1) {
        continue;
      }
      chapter.sections.push({
        section_id: sectionItem.itemid,
        section_name: sectionItem.title,
        pages: sectionItem.coursepages.map((pageItem) => ({
          page_id: pageItem.id,
          page_relation_id: pageItem.relationid,
          page_name: pageItem.title,
          page_content_type: pageItem.contentType,
          is_complete: false,
          elements: [],
        })),
      });
    }
  }
};

/**
 * 章内容组装: 按页面类型分派元素, 视频只收 type 4, 题目只收 type 6 并展开题目列表,
 * 文档与文本页收 type 10 与 type 12。目录中不存在的节整节跳过。
 */
export const assembleChapterContent = (
  course: ModelCourse,
  textbookId: number,
  content: ChapterContentResponse,
): void => {
  const chapter = requireChapter(requireTextbook(course, textbookId), content.chapterid);

  for (const sectionItem of content.wholepageItemDTOList) {
    const section = findSection(chapter, sectionItem.itemid);
    if (section === null) {
      continue;
    }

    for (const pageItem of sectionItem.wholepageDTOList) {
      const page = requirePage(section, pageItem.id);

      for (const element of pageItem.coursepageDTOList) {
        if (pageItem.contentType === 5) {
          if (element.type === 10) {
            page.elements.push({ kind: "document" });
          } else if (element.type === 12) {
            page.elements.push({ kind: "content" });
          }
          continue;
        }
        if (pageItem.contentType === 6) {
          if (element.type !== 4) {
            continue;
          }
          page.elements.push({
            kind: "video",
            video_id: element.resourceid,
            video_length: element.videoLength,
          });
          continue;
        }
        if (pageItem.contentType === 7) {
          if (element.type !== 6) {
            continue;
          }
          page.elements.push({
            kind: "question",
            questions: element.questionDTOList.map((question) => ({
              question_id: question.questionid,
              question_score: Math.trunc(question.score),
              question_content: question.title,
              question_answer_list: [],
            })),
          });
        }
      }
    }
  }
};

/**
 * 答案补全: 把题目 id 对应的答案写入页面内全部题目。
 * 答案缺失时就地抛出, 与配置流程的中止语义一致。
 */
export const fillQuestionAnswers = (
  page: CoursewarePage,
  answers: ReadonlyMap<number, string[]>,
): void => {
  for (const element of page.elements) {
    if (element.kind !== "question") {
      continue;
    }
    for (const question of element.questions) {
      const answerList = answers.get(question.question_id);
      if (answerList === undefined) {
        throw new Error(`题目 ${question.question_id} 的答案缺失`);
      }
      question.question_answer_list = answerList;
    }
  }
};
