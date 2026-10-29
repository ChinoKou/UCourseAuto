/// <reference types="node" />
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * 层次约束: 扫描 src/ 的 import, 校验模块之间的依赖方向。
 * 依赖方向自上而下, 装配根是唯一可以同时引用全部层的模块。
 */

const SRC = fileURLToPath(new URL("../src", import.meta.url));

/** 允许的依赖边: 来源目录 → 允许引用的目录 */
const ALLOWED: Record<string, ReadonlyArray<string>> = {
  ui: ["usecases", "state", "logic", "schema", "error", "ui"],
  usecases: ["apis", "logic", "schema", "error", "usecases"],
  composition: ["ui", "usecases", "state", "logic", "schema", "error", "storage", "apis", "net", "crypto", "composition"],
  state: ["logic", "storage", "schema", "error", "state"],
  apis: ["net", "crypto", "schema", "apis"],
  logic: ["schema", "logic"],
  storage: ["schema", "error", "storage"],
  net: [],
  crypto: [],
  error: [],
  schema: ["schema"],
};

/** 列出 src 下的全部源码文件 */
const listSources = (directory: string): string[] => {
  const entries = readdirSync(directory);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listSources(full));
    } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
};

/** 文件在 src 内的相对路径, 使用正斜杠分隔 */
const relativeToSrc = (file: string): string =>
  relative(SRC, file).split(sep).join("/");

/** 文件所属的顶层目录, src 根下的装配入口记为根 */
const layerOf = (file: string): string => {
  const parts = relativeToSrc(file).split("/");
  return parts.length === 1 ? "root" : parts[0];
};

/** 提取 import 语句的来源路径 */
const importSpecifiers = (source: string): string[] => {
  const pattern = /(?:from|import)\s+"([^"]+)"/g;
  const specifiers: string[] = [];
  for (const match of source.matchAll(pattern)) {
    specifiers.push(match[1]);
  }
  return specifiers;
};

/** `@/xxx/yyy` 形式的内部引用转顶层目录名 */
const targetLayerOf = (specifier: string): string | null => {
  if (!specifier.startsWith("@/")) {
    return null;
  }
  const rest = specifier.slice(2);
  const parts = rest.split("/");
  return parts.length === 1 ? "root" : parts[0];
};

describe("层次约束", () => {
  const violations: string[] = [];
  const files = listSources(SRC);

  for (const file of files) {
    const layer = layerOf(file);
    if (layer === "root") {
      continue;
    }
    const allowed = ALLOWED[layer];
    if (allowed === undefined) {
      violations.push(`${relativeToSrc(file)}: 未登记的层 ${layer}`);
      continue;
    }
    const source = readFileSync(file, "utf-8");
    for (const specifier of importSpecifiers(source)) {
      const target = targetLayerOf(specifier);
      if (target === null || target === "root") {
        continue;
      }
      if (!allowed.includes(target)) {
        violations.push(`${relativeToSrc(file)}: ${layer}/ 不允许引用 ${target}/ (${specifier})`);
      }
    }
  }

  it("所有模块只引用允许的层, 违反时给出行号", () => {
    const withLines: string[] = [];
    for (const file of files) {
      const layer = layerOf(file);
      if (layer === "root") {
        continue;
      }
      const allowed = ALLOWED[layer];
      if (allowed === undefined) {
        continue;
      }
      const lines = readFileSync(file, "utf-8").split("\n");
      for (const [index, line] of lines.entries()) {
        const specifier = /(?:from|import)\s+"([^"]+)"/.exec(line)?.[1];
        if (specifier === undefined) {
          continue;
        }
        const target = targetLayerOf(specifier);
        if (target === null || target === "root") {
          continue;
        }
        if (!allowed.includes(target)) {
          withLines.push(
            `${relativeToSrc(file)}:${index + 1} ${layer}/ 不允许引用 ${target}/ (${specifier})`,
          );
        }
      }
    }
    expect(withLines).toEqual([]);
    expect(violations).toEqual([]);
  });

  it("界面层不直接引用访问层、传输层与加密模块", () => {
    const forbidden: string[] = [];
    for (const file of files) {
      if (layerOf(file) !== "ui") {
        continue;
      }
      const source = readFileSync(file, "utf-8");
      for (const specifier of importSpecifiers(source)) {
        const target = targetLayerOf(specifier);
        if (target === "apis" || target === "net" || target === "crypto" || target === "composition") {
          forbidden.push(`${relativeToSrc(file)}: ${specifier}`);
        }
      }
    }
    expect(forbidden).toEqual([]);
  });

  it("规则层不引用访问层、状态层与界面层", () => {
    const forbidden: string[] = [];
    for (const file of files) {
      if (layerOf(file) !== "logic") {
        continue;
      }
      const source = readFileSync(file, "utf-8");
      for (const specifier of importSpecifiers(source)) {
        const target = targetLayerOf(specifier);
        if (target === "apis" || target === "state" || target === "ui" || target === "net") {
          forbidden.push(`${relativeToSrc(file)}: ${specifier}`);
        }
      }
    }
    expect(forbidden).toEqual([]);
  });

  it("业务动作层不引用状态层, 只有装配根同时引用状态层与访问层", () => {
    const forbidden: string[] = [];
    for (const file of files) {
      if (layerOf(file) !== "usecases") {
        continue;
      }
      const source = readFileSync(file, "utf-8");
      for (const specifier of importSpecifiers(source)) {
        if (targetLayerOf(specifier) === "state") {
          forbidden.push(`${relativeToSrc(file)}: ${specifier}`);
        }
      }
    }
    expect(forbidden).toEqual([]);
  });

  it("源码与测试中不存在接口编号与施工计划条目号", () => {
    const pattern = /\b(?:[CTUSL][1-4]|P[0-6])\b/;
    const offenders: string[] = [];
    const testsDirectory = fileURLToPath(new URL("../tests", import.meta.url));
    const targets = [...files, ...listSources(testsDirectory)];
    for (const file of targets) {
      const lines = readFileSync(file, "utf-8").split("\n");
      for (const [index, line] of lines.entries()) {
        if (pattern.test(line)) {
          offenders.push(`${relativeToSrc(file)}:${index + 1} ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("源码中不存在被删除的旧模块与转发模块", () => {
    const legacy = [
      "src/logic/runner.ts",
      "src/logic/parser.ts",
      "src/logic/prune.ts",
      "src/logic/builder.ts",
      "src/logic/stats.ts",
      "src/schema/apiResponse.ts",
      "src/schema/apiRequest.ts",
      "src/schema/common.ts",
      "src/schema/config.ts",
      "src/schema/course.ts",
      "src/schema/courseware.ts",
      "src/apis/login.ts",
      "src/crypto/crypto.ts",
    ];
    const present = legacy.filter((file) => existsSync(join(SRC, file.slice("src/".length))));
    expect(present).toEqual([]);

    // logic/ 根目录只保留子目录, 不再存放转发模块
    const logicRoot = readdirSync(join(SRC, "logic"));
    expect(logicRoot.filter((entry) => entry.endsWith(".ts"))).toEqual([]);
  });

  it("业务层单个文件不超过 300 行", () => {
    const tooLong: string[] = [];
    for (const file of files) {
      const layer = layerOf(file);
      if (layer !== "usecases" && layer !== "logic") {
        continue;
      }
      const lines = readFileSync(file, "utf-8").split("\n").length;
      if (lines > 300) {
        tooLong.push(`${relativeToSrc(file)}: ${lines}`);
      }
    }
    expect(tooLong).toEqual([]);
  });
});
