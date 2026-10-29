import type { StudyTime } from "@/schema/domain/config";
import type {
  CoursewarePage,
  CoursewareSection,
} from "@/schema/domain/courseware";
import type {
  SyncPageStudyRecordDTO,
  SyncQuestionDTO,
  SyncStudyRecordRequest,
  SyncVideoDTO,
} from "@/schema/protocol/syncStudyRecord";

/** 上报时长上限(秒) */
const MAX_STUDY_TIME = 3600;

/** 上报阶段: 零时长段只标记完成, 真实时长段带上学习时长与作答记录 */
export type StudyPhase = "zeroDuration" | "realDuration";

/** 构造依赖: 随机数与时间 */
export interface BuilderDeps {
  /** [min, max] 闭区间随机整数(含两端) */
  randint: (min: number, max: number) => number;
  /** [min, max] 区间随机浮点数 */
  uniform: (min: number, max: number) => number;
  /** 当前秒级时间戳(可含小数, 使用处取整) */
  now: () => number;
}

/** 默认依赖: 随机数基于 Math.random, 时间为秒级时间戳 */
export const defaultBuilderDeps: BuilderDeps = {
  randint: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
  uniform: (min, max) => Math.random() * (max - min) + min,
  now: () => Date.now() / 1000,
};

/** 可上报的页面类型: 5 文档或文本、6 视频、7 题目 */
const REPORTABLE_PAGE_CONTENT_TYPES: ReadonlySet<number> = new Set([5, 6, 7]);

/** 页面是否属于可上报类型, 未知类型不进入请求体 */
export const isReportablePage = (page: CoursewarePage): boolean =>
  REPORTABLE_PAGE_CONTENT_TYPES.has(page.page_content_type);

/**
 * 构造同步学习记录请求。
 * 零时长段: 全部页 studyTime 为 0、score 为 0、videos 与 questions 为空、coursepageId 为 null;
 * 真实时长段: 按页面类型计算时长与分数。未知类型的页面不进入上报体。
 */
export const buildSyncStudyRecordRequest = (
  section: CoursewareSection,
  studyStartTime: number,
  userName: string,
  studyTimeConfig: StudyTime,
  phase: StudyPhase,
  deps: BuilderDeps = defaultBuilderDeps,
): SyncStudyRecordRequest => {
  const pageStudyRecordDTOList: SyncPageStudyRecordDTO[] = [];

  for (const page of section.pages) {
    if (!isReportablePage(page)) {
      continue;
    }

    let studyTime = 0;
    let score = 0;
    const videos: SyncVideoDTO[] = [];
    const questions: SyncQuestionDTO[] = [];

    if (phase === "realDuration") {
      if (page.page_content_type === 5) {
        score = 100;
        const elementCount = page.elements.length;
        const isDocument = page.elements.some((element) => element.kind === "document");
        const range = isDocument ? studyTimeConfig.document : studyTimeConfig.content;
        studyTime += Math.min(deps.randint(range.min, range.max) * elementCount, MAX_STUDY_TIME);
      } else if (page.page_content_type === 6) {
        score = 100;
        for (const element of page.elements) {
          if (element.kind !== "video") {
            continue;
          }
          studyTime += element.video_length;
          const startTime = deps.now();
          const watchTime = element.video_length - deps.uniform(2, 8);
          videos.push({
            videoid: element.video_id,
            current: watchTime,
            status: 1,
            recordTime: watchTime,
            time: element.video_length,
            startEndTimeList: [
              {
                startTime: Math.floor(startTime),
                endTime: Math.floor(startTime + watchTime),
              },
            ],
          });
        }
      } else if (page.page_content_type === 7) {
        studyTime += Math.min(
          deps.randint(studyTimeConfig.question.min, studyTimeConfig.question.max),
          MAX_STUDY_TIME,
        );
        for (const element of page.elements) {
          if (element.kind !== "question") {
            continue;
          }
          for (const question of element.questions) {
            score += question.question_score;
            questions.push({
              questionid: question.question_id,
              answerList: question.question_answer_list,
              score: question.question_score,
            });
          }
        }
      } else {
        continue;
      }
    }

    pageStudyRecordDTOList.push({
      pageid: page.page_relation_id,
      complete: 1,
      studyTime,
      score,
      answerTime: 1,
      submitTimes: 0,
      coursepageId: questions.length > 0 ? page.page_id : null,
      questions,
      videos,
      speaks: [],
    });
  }

  return {
    itemid: section.section_id,
    autoSave: 1,
    withoutOld: null,
    complete: 1,
    studyStartTime,
    userName,
    score: 100,
    pageStudyRecordDTOList,
  };
};
