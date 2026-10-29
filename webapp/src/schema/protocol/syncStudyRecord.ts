import { z } from "zod";

/**
 * 学习记录上报体: POST {ua_api}/yws/api/personal/sync。
 * 请求体序列化后经 DES 加密为 Base64 文本, 字段与 cli 的上报模型一致。
 * 数值字段在平台上按浮点数接收, 整数值不需要写成小数。
 */
export const syncStartEndTimeSchema = z.object({
  startTime: z.number().int(),
  endTime: z.number().int(),
});
export type SyncStartEndTime = z.infer<typeof syncStartEndTimeSchema>;

/** 上报视频记录: current 与 recordTime 为观看时长, time 为视频总长。 */
export const syncVideoDTOSchema = z.object({
  videoid: z.number().int(),
  current: z.number(),
  status: z.number().int().default(1),
  recordTime: z.number(),
  time: z.number(),
  startEndTimeList: z.array(syncStartEndTimeSchema),
});
export type SyncVideoDTO = z.infer<typeof syncVideoDTOSchema>;

/** 上报题目作答: answerList 来自题目答案接口。 */
export const syncQuestionDTOSchema = z.object({
  questionid: z.number().int(),
  answerList: z.array(z.string()),
  score: z.number().int(),
});
export type SyncQuestionDTO = z.infer<typeof syncQuestionDTOSchema>;

/** 上报页面记录: coursepageId 仅题目页填页面 ID, 其余为 null。 */
export const syncPageStudyRecordDTOSchema = z.object({
  pageid: z.number().int(),
  complete: z.number().int().default(1),
  studyTime: z.number().int(),
  score: z.number().int(),
  answerTime: z.number().int().default(1),
  submitTimes: z.number().int().default(0),
  coursepageId: z.number().int().nullable(),
  questions: z.array(syncQuestionDTOSchema).default([]),
  videos: z.array(syncVideoDTOSchema).default([]),
  // cli 中 speaks 为未标注元素类型的列表, 上报体恒为空数组
  speaks: z.array(z.unknown()).default([]),
});
export type SyncPageStudyRecordDTO = z.infer<typeof syncPageStudyRecordDTOSchema>;

/** 上报体: itemid 为节 ID, studyStartTime 为初始化接口返回的时间戳。 */
export const syncStudyRecordRequestSchema = z.object({
  itemid: z.number().int(),
  autoSave: z.number().int().default(1),
  withoutOld: z.null().default(null),
  complete: z.number().int().default(1),
  studyStartTime: z.number().int(),
  userName: z.string(),
  score: z.number().int().default(100),
  pageStudyRecordDTOList: z.array(syncPageStudyRecordDTOSchema),
});
export type SyncStudyRecordRequest = z.infer<typeof syncStudyRecordRequestSchema>;
