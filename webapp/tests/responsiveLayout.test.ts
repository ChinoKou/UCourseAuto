/// <reference types="node" />
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const STYLES_DIR = fileURLToPath(new URL("../src/styles", import.meta.url));

describe("响应式布局样式校验", () => {
  it("home.css 在屏幕宽度收紧至 1150px 以下时设定课件库卡片高度保障", () => {
    const homeCss = readFileSync(
      join(STYLES_DIR, "features/dashboard/home.css"),
      "utf-8",
    );
    expect(homeCss).toContain("@media (max-width: 1150px)");
    expect(homeCss).toContain(".uc-home-grid__library");
    expect(homeCss).toMatch(/\.uc-home-grid__library\s*\{[^}]*height:\s*clamp/);
  });

  it("library-card.css 为课件树滚动容器提供最小高度保护", () => {
    const libraryCardCss = readFileSync(
      join(STYLES_DIR, "features/dashboard/library-card.css"),
      "utf-8",
    );
    expect(libraryCardCss).toContain(".uc-library-card__tree");
    expect(libraryCardCss).toContain(".uc-library-card__list");
    expect(libraryCardCss).toMatch(/\.uc-library-card__tree\s*\{[^}]*min-height:\s*320px/);
    expect(libraryCardCss).toMatch(/\.uc-library-card__list\s*\{[^}]*min-height:\s*320px/);
  });

  it("library-card.css 包含 1150px 媒体查询实现树高随展开自适应伸展与上限约束", () => {
    const libraryCardCss = readFileSync(
      join(STYLES_DIR, "features/dashboard/library-card.css"),
      "utf-8",
    );
    expect(libraryCardCss).toContain("@media (max-width: 1150px)");
    expect(libraryCardCss).toContain("var(--tree-content-height");
    expect(libraryCardCss).toContain("clamp(340px");
  });

  it("run-console.css 在换行至第二行时隐藏课件就绪度卡片", () => {
    const runConsoleCss = readFileSync(
      join(STYLES_DIR, "features/dashboard/run-console.css"),
      "utf-8",
    );
    expect(runConsoleCss).toContain("@media (max-width: 1000px)");
    expect(runConsoleCss).toMatch(/\.uc-console-readiness\s*\{[^}]*display:\s*none/);
  });

  it("library-card.css 包含未勾选指引高亮动效与聚焦重置", () => {
    const libraryCardCss = readFileSync(
      join(STYLES_DIR, "features/dashboard/library-card.css"),
      "utf-8",
    );
    expect(libraryCardCss).toContain(".uc-library-card.is-highlighted");
    expect(libraryCardCss).toContain("@keyframes uc-library-glow");
  });

  it("library-card.css 包含重构后的概览看板与选择操作条样式", () => {
    const libraryCardCss = readFileSync(
      join(STYLES_DIR, "features/dashboard/library-card.css"),
      "utf-8",
    );
    expect(libraryCardCss).toContain(".uc-library-card__board");
    expect(libraryCardCss).toContain(".uc-library-card__board-top");
    expect(libraryCardCss).toContain(".uc-library-card__badges");
    expect(libraryCardCss).toContain(".uc-library-card__quick-btn--accent");
  });

  it("tokens.css 包含移动端媒体查询以减小页面左右留空", () => {
    const tokensCss = readFileSync(join(STYLES_DIR, "tokens.css"), "utf-8");
    expect(tokensCss).toContain("@media (max-width: 600px)");
    expect(tokensCss).toMatch(/--page-pad:\s*8px/);
  });

  it("card.css 与 library.css 在窄屏下紧缩卡片内边距以扩大内容区域", () => {
    const cardCss = readFileSync(join(STYLES_DIR, "shell/card.css"), "utf-8");
    expect(cardCss).toContain("@media (max-width: 500px)");
    expect(cardCss).toMatch(/padding:\s*12px 8px/);

    const libraryCss = readFileSync(
      join(STYLES_DIR, "features/library/library.css"),
      "utf-8",
    );
    expect(libraryCss).toContain("@media (max-width: 600px)");
    expect(libraryCss).toMatch(/\.uc-library-main-card\s*\{[^}]*padding:\s*12px 8px/);
  });

  it("tree.css 在窄屏下紧缩节点缩进与尾部空间以确保文字充分展示", () => {
    const treeCss = readFileSync(join(STYLES_DIR, "controls/tree.css"), "utf-8");
    expect(treeCss).toMatch(/--indent-step:\s*8px/);
    expect(treeCss).toContain("@media (max-width: 560px)");
    expect(treeCss).toMatch(/--indent-step:\s*4px/);
    expect(treeCss).toMatch(/\.uc-tree__progress-text\s*\{[^}]*min-width:\s*24px/);
  });

  it("tree.css 使用重复线性渐变渲染连续缩进导轨线", () => {
    const treeCss = readFileSync(join(STYLES_DIR, "controls/tree.css"), "utf-8");
    expect(treeCss).toContain("repeating-linear-gradient");
    expect(treeCss).toContain("background-size: calc(var(--depth) * var(--indent-step)) 100%");
    expect(treeCss).not.toContain(".uc-tree__row.is-nested::before");
    expect(treeCss).not.toContain(".uc-tree__row.is-nested::after");
    expect(treeCss).not.toContain(".uc-tree__toggle-spacer");
  });

  it("toolbar.css 包含窄屏下批量操作浮条尺寸紧凑化与文案简写机制", () => {
    const toolbarCss = readFileSync(
      join(STYLES_DIR, "features/library/toolbar.css"),
      "utf-8",
    );
    expect(toolbarCss).toContain(".uc-selection-bar__btn-short");
    expect(toolbarCss).toContain("@media (max-width: 600px)");
    expect(toolbarCss).toMatch(/\.uc-selection-bar__btn-full\s*\{[^}]*display:\s*none/);
    expect(toolbarCss).toMatch(/\.uc-selection-bar__btn-short\s*\{[^}]*display:\s*inline/);
  });

  it("library-card.css 将操作区设为不可压缩并为窄屏动态约束树高度", () => {
    const libraryCardCss = readFileSync(
      join(STYLES_DIR, "features/dashboard/library-card.css"),
      "utf-8",
    );
    expect(libraryCardCss).toMatch(/\.uc-library-card__actions\s*\{[^}]*flex:\s*none/);
    expect(libraryCardCss).toContain("@media (max-width: 700px)");
    expect(libraryCardCss).toContain("clamp(300px");
  });

  it("wizard.css 包含向导操作区分散对齐与窄屏按钮文字简写", () => {
    const wizardCss = readFileSync(
      join(STYLES_DIR, "features/library/wizard.css"),
      "utf-8",
    );
    expect(wizardCss).toContain(".uc-btn-text--short");
    expect(wizardCss).toContain("@media (max-width: 600px)");
    expect(wizardCss).toMatch(/\.uc-btn-text--full\s*\{[^}]*display:\s*none/);
    expect(wizardCss).toMatch(/\.uc-btn-text--short\s*\{[^}]*display:\s*inline/);
  });
});
