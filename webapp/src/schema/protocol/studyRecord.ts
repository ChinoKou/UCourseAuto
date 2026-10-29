import { z } from "zod";

/**
 * 节学习记录: GET {ua_api}/studyrecord/item/{sectionId}。
 * 响应体为空文本表示该节尚未学习, 由访问层转换为未学习结果。
 * node_id 与 item_id 用于在课件树中定位章与节, pageid 对应页面 relationid。
 */
export const videoStartEndTimeSchema = z.object({
  startTime: z.number().int(),
  endTime: z.number().int(),
});
export type VideoStartEndTime = z.infer<typeof videoStartEndTimeSchema>;

/** 学习记录中的视频: current 与 recordTime 为观看时长, time 为视频总长。 */
export const studyRecordVideoSchema = z.object({
  videoid: z.number().int(),
  current: z.number(),
  status: z.number().int(),
  recordTime: z.number().int(),
  time: z.number(),
  startEndTimeList: z.array(videoStartEndTimeSchema.nullable()),
});
export type StudyRecordVideo = z.infer<typeof studyRecordVideoSchema>;

/** 学习记录中的题目作答。 */
export const studyRecordQuestionDTOSchema = z.object({
  questionid: z.number().int(),
  answerList: z.array(z.string()),
  score: z.number(),
});
export type StudyRecordQuestionDTO = z.infer<typeof studyRecordQuestionDTOSchema>;

/** 页面学习记录: complete 非零表示已完成, videos 与 questions 可缺省。 */
export const pageStudyRecordDTOSchema = z.object({
  pageid: z.number().int(),
  complete: z.number().int(),
  submitTimes: z.number().int(),
  studyTime: z.number().int(),
  answerTime: z.number().int(),
  videos: z.array(studyRecordVideoSchema).nullable().default(null),
  questions: z.array(studyRecordQuestionDTOSchema).nullable().default(null),
  coursepageId: z.number().int().nullable().default(null),
});
export type PageStudyRecordDTO = z.infer<typeof pageStudyRecordDTOSchema>;

/** 节学习记录响应。 */
export const studyRecordResponseSchema = z.object({
  completion_status: z.number().int(),
  learner_id: z.number().int(),
  learner_name: z.string(),
  relationid: z.number().int(),
  customized: z.number().int(),
  activity_title: z.string(),
  item_id: z.number().int(),
  node_id: z.number().int(),
  score: z.number().int(),
  studyTime: z.number().int(),
  pageStudyRecordDTOList: z.array(pageStudyRecordDTOSchema),
});
export type StudyRecordResponse = z.infer<typeof studyRecordResponseSchema>;
