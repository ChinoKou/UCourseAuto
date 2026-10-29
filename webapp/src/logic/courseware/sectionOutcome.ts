/**
 * 刷课节结局的汇总规则: 以节为单位记录最终结局,
 * 反刷课的零时长段不写入, 真实时长段按最终结果写入或删除。
 */

/** 节最终失败的环节 */
export type SectionFailureCause = "initialize" | "upload";

/** 节的唯一标识: 不同课程或教材中相同的节 ID 不会相互覆盖 */
export const sectionKeyOf = (
  courseId: number,
  textbookId: number,
  sectionId: number,
): string => `${courseId}:${textbookId}:${sectionId}`;

/** 由失败记录派生两个计数: 同一节最多进入一个计数 */
export const summarizeSectionFailures = (
  failedSections: ReadonlyMap<string, SectionFailureCause>,
): { skippedSections: number; failedUploads: number } => {
  let skippedSections = 0;
  let failedUploads = 0;
  for (const cause of failedSections.values()) {
    if (cause === "initialize") {
      skippedSections += 1;
    } else {
      failedUploads += 1;
    }
  }
  return { skippedSections, failedUploads };
};
