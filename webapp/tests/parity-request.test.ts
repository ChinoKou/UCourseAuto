/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { syncTextDecrypt, syncTextEncrypt } from "@/crypto/des";
import { buildSyncStudyRecordRequest } from "@/logic/studyRecord/buildRequest";
import type { StudyTime } from "@/schema/domain/config";
import type { CoursewarePage, CoursewareSection } from "@/schema/domain/courseware";

/**
 * 上报体等价: cli 侧用同一份明文加密, 再解密并按上报模型解析, 结果写入固定样本。
 * cli 的 pydantic 模型把 current、recordTime、time 声明为浮点数, 整数值输出 65.0;
 * 网页版按整数输出 65, 两份明文不按字符逐一相同。
 * 等价判据是结构比较: 网页版构造的上报体与 cli 解析结果逐字段相等。
 */

interface ParitySample {
  cipher: string;
  plain: string;
  parsed: unknown;
}

const sample: ParitySample = JSON.parse(
  readFileSync(new URL("./fixtures/parity_study_record.json", import.meta.url), "utf-8"),
);

const studyTime: StudyTime = {
  question: { min: 273, max: 273 },
  document: { min: 273, max: 273 },
  content: { min: 100, max: 100 },
};

const makePage = (
  pageId: number,
  relationId: number,
  contentType: number,
  elements: CoursewarePage["elements"],
): CoursewarePage => ({
  page_id: pageId,
  page_relation_id: relationId,
  page_name: `页-${pageId}`,
  page_content_type: contentType,
  is_complete: false,
  elements,
});

/** 与样本相同的节内容: 文档页、视频页与题目页 */
const section: CoursewareSection = {
  section_id: 3001,
  section_name: "第一节",
  pages: [
    makePage(90001, 90011, 5, [{ kind: "document" }]),
    makePage(90002, 90012, 6, [{ kind: "video", video_id: 70001, video_length: 65 }]),
    makePage(90003, 90013, 7, [
      {
        kind: "question",
        questions: [
          {
            question_id: 50001,
            question_score: 5,
            question_content: "题目一",
            question_answer_list: ["A"],
          },
          {
            question_id: 50002,
            question_score: 10,
            question_content: "题目二",
            question_answer_list: ["B", "C"],
          },
        ],
      },
    ]),
  ],
};

const builder = {
  randint: (min: number) => min,
  uniform: () => 3.5,
  now: () => 1748000100,
};

const buildRequest = () =>
  buildSyncStudyRecordRequest(
    section,
    1748000000,
    "测试用户",
    studyTime,
    "realDuration",
    builder,
  );

describe("上报体等价", () => {
  it("网页版构造的上报体与 cli 解析结果逐字段相等", () => {
    expect(JSON.parse(JSON.stringify(buildRequest()))).toEqual(sample.parsed);
  });

  it("样本密文可由网页版解密还原为同一份明文", () => {
    expect(syncTextDecrypt(sample.cipher)).toBe(sample.plain);
  });

  it("网页版明文与样本明文结构一致", () => {
    expect(JSON.parse(JSON.stringify(buildRequest()))).toEqual(JSON.parse(sample.plain));
    expect(syncTextEncrypt(JSON.stringify(buildRequest()))).toBe(
      syncTextEncrypt(sample.plain),
    );
  });

  it("整数字段按整数书写, 与 cli 的浮点声明只在书写形式上不同", () => {
    const plain = JSON.stringify(buildRequest());
    expect(plain).toContain('"studyTime":273');
    expect(plain).toContain('"time":65');
    expect(sample.plain).toContain('"studyTime":273');
  });
});
