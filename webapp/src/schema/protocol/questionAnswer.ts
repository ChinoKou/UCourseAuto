import { z } from "zod";

/**
 * 题目答案: GET {ua_api}/questionAnswer/{questionId}。
 * correctAnswerList 直接写入课件树的题目答案列表, 配置课件时逐题拉取。
 */
export const questionAnswerResponseSchema = z.object({
  questionid: z.number().int(),
  correctAnswerList: z.array(z.string()),
});
export type QuestionAnswerResponse = z.infer<typeof questionAnswerResponseSchema>;
