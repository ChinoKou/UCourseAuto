/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  chapterContentResponseSchema,
  type ChapterContentResponse,
} from "@/schema/protocol/chapterContent";
import {
  textbookDirectoryResponseSchema,
  type TextbookDirectoryResponse,
} from "@/schema/protocol/textbookDirectory";
import { studyRecordResponseSchema } from "@/schema/protocol/studyRecord";

/** 读取 fixtures 中的真实响应样本, 个人字段已抹除 */
const loadFixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf-8"));

describe("真实响应样本驱动解析函数", () => {
  it("教材目录样本通过校验, 章与节计数与样本一致", () => {
    const directory: TextbookDirectoryResponse = textbookDirectoryResponseSchema.parse(
      loadFixture("t1_directory.json"),
    );
    expect(directory.courseid).toBe(50101);
    expect(directory.chapters).toHaveLength(3);
    expect(directory.chapters[0].items[0].coursepages).toHaveLength(3);
    expect(directory.chapters[2].hide).toBe(1);
  });

  it("章内容样本通过校验, 元素判别联合识别四种元素", () => {
    const content: ChapterContentResponse = chapterContentResponseSchema.parse(
      loadFixture("t2_chapter.json"),
    );
    const types = content.wholepageItemDTOList[0].wholepageDTOList.flatMap((page) =>
      page.coursepageDTOList.map((element) => element.type),
    );
    expect(types).toEqual([10, 12, 4, 4, 4, 12, 6, 12]);
    const questionPage = content.wholepageItemDTOList[0].wholepageDTOList[2];
    expect(questionPage.coursepageDTOList[0].type).toBe(6);
  });

  it("学习记录样本通过校验, 视频与题目字段可读", () => {
    const record = studyRecordResponseSchema.parse(loadFixture("t3_studyrecord.json"));
    expect(record.item_id).toBe(1011);
    expect(record.node_id).toBe(101);
    expect(record.pageStudyRecordDTOList[0].complete).toBe(1);
    expect(record.pageStudyRecordDTOList[1].videos?.[0].videoid).toBe(8002);
    expect(record.pageStudyRecordDTOList[2].questions?.[0].answerList).toEqual(["A"]);
  });

  it("samples 均为 JSON 对象, 样本文件不含个人字段", () => {
    for (const name of ["t1_directory.json", "t2_chapter.json", "t3_studyrecord.json"]) {
      const sample = loadFixture(name);
      expect(typeof sample).toBe("object");
      expect(JSON.stringify(sample)).not.toContain("learner_name\":\"张三");
    }
  });
});
