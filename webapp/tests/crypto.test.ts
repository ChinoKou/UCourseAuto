/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { syncTextDecrypt, syncTextEncrypt } from "@/crypto/des";

/** 固定向量文件的条目形状 */
interface CryptoVector {
  plain: string;
  cipher: string;
}

// 固定向量由 cli 的 Python 实现生成, 路径相对本测试文件定位
const vectors: CryptoVector[] = JSON.parse(
  readFileSync(new URL("./fixtures/crypto_vectors.json", import.meta.url), "utf-8"),
);

describe("加解密往返", () => {
  const samples: string[] = [
    "", // 空串
    "{\"itemid\":9527}", // 纯 ASCII 的 JSON 片段
    "中文文本: 优学院 平台", // 中文
    "{\"userName\":\"张三\",\"note\":\"优学院 平台\"}", // 中英混合 JSON
    "控制与转义字符: \t\n\"引号\" 反斜\\\\ 与 😀", // 特殊字符
    "x".repeat(100_000), // 长文本
  ];

  it("构造文本加密后解密还原为原文本", () => {
    for (const text of samples) {
      expect(syncTextDecrypt(syncTextEncrypt(text))).toBe(text);
    }
  });
});

describe("固定向量交叉验证(密文由 cli 的 Python 实现生成)", () => {
  for (const [index, { plain, cipher }] of vectors.entries()) {
    it(`向量 ${index}: syncTextEncrypt 输出与密文逐字符一致`, () => {
      expect(syncTextEncrypt(plain)).toBe(cipher);
    });

    it(`向量 ${index}: syncTextDecrypt 将密文还原为明文`, () => {
      expect(syncTextDecrypt(cipher)).toBe(plain);
    });
  }
});
