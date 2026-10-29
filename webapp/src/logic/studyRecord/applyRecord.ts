import { findChapter, findSection, findTextbook } from "@/logic/courseware/tree";
import type { ModelCourse } from "@/schema/domain/course";
import type { StudyRecordResponse } from "@/schema/protocol/studyRecord";

/**
 * 把节学习记录写回课件树: 以响应的 node_id 与 item_id 定位章与节,
 * 按 pageid 匹配页面 relationid, complete 非零即视为完成。
 */
export const applySectionStudyRecord = (
  course: ModelCourse,
  textbookId: number,
  record: StudyRecordResponse,
): void => {
  const textbook = findTextbook(course, textbookId);
  if (textbook === null) {
    throw new Error(`课件树中不存在教材 ${textbookId}`);
  }
  const chapter = findChapter(textbook, record.node_id);
  if (chapter === null) {
    throw new Error(`课件树中不存在章 ${record.node_id}`);
  }
  const section = findSection(chapter, record.item_id);
  if (section === null) {
    throw new Error(`课件树中不存在节 ${record.item_id}`);
  }

  for (const pageRecord of record.pageStudyRecordDTOList) {
    for (const page of section.pages) {
      if (page.page_relation_id === pageRecord.pageid) {
        page.is_complete = pageRecord.complete !== 0;
      }
    }
  }
};
