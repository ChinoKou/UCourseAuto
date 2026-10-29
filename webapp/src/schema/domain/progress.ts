/**
 * 进度与检测阶段的纯数据形状: 规则层、业务动作层与状态层共用,
 * 字段沿用界面既有 camelCase 命名, 序号从 1 起, 0 表示尚未进入。
 */

/** 课件配置进度: 当前课程、教材、章、节与各层计数，以及当前节点标识。 */
export interface ConfigProgress {
  courseName: string;
  textbookName: string;
  chapterName: string;
  sectionName?: string;
  courseIndex: number;
  courseTotal: number;
  textbookIndex: number;
  textbookTotal: number;
  chapterIndex: number;
  chapterTotal: number;
  sectionIndex?: number;
  sectionTotal?: number;
  courseId?: number;
  textbookId?: number;
  chapterId?: number;
  sectionId?: number;
  phase?: "directory" | "content" | "record" | "answers";
}

/** 刷课进度: 五层名称、各层计数与已完成节数。 */
export interface RunProgress {
  courseName: string;
  textbookName: string;
  chapterName: string;
  sectionName: string;
  pageName: string;
  courseIndex: number;
  courseTotal: number;
  textbookIndex: number;
  textbookTotal: number;
  chapterIndex: number;
  chapterTotal: number;
  sectionIndex: number;
  sectionTotal: number;
  pageIndex: number;
  pageTotal: number;
  /** 本次运行已完成节数 */
  completedSections: number;
}

/** 反刷课检测分段: 零时长段 → 检测触发 → 真实时长段。 */
export type AntiDetectionStage = "zeroDuration" | "trigger" | "realDuration";

/** 刷课进度的初始值: 课程总数由调用方给出, 其余计数从 0 开始。 */
export const createRunProgress = (courseTotal: number): RunProgress => ({
  courseName: "",
  textbookName: "",
  chapterName: "",
  sectionName: "",
  pageName: "",
  courseIndex: 0,
  courseTotal,
  textbookIndex: 0,
  textbookTotal: 0,
  chapterIndex: 0,
  chapterTotal: 0,
  sectionIndex: 0,
  sectionTotal: 0,
  pageIndex: 0,
  pageTotal: 0,
  completedSections: 0,
});
