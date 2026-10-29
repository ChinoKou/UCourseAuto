import type { MinMaxTime, StudyTime } from "@/schema/domain/config";

/** 单类页面的时长区间草稿(输入框文本) */
export interface RangeDraft {
  min: string;
  max: string;
}

/** 时长上限(秒) */
export const MAX_SECONDS = 3600;

const DIGITS = /^\d+$/;

/** 由已校验的配置构造草稿 */
export const draftFrom = (range: MinMaxTime): RangeDraft => ({
  min: String(range.min),
  max: String(range.max),
});

/** 草稿转时长区间, 无效时返回 null */
export const parseRange = (draft: RangeDraft): MinMaxTime | null => {
  if (!DIGITS.test(draft.min) || !DIGITS.test(draft.max)) {
    return null;
  }
  const min = Number(draft.min);
  const max = Number(draft.max);
  if (min < 0 || max > MAX_SECONDS || min > max) {
    return null;
  }
  return { min, max };
};

/** 区间草稿是否可用 */
export const isRangeValid = (draft: RangeDraft): boolean => parseRange(draft) !== null;

/** 三组区间草稿是否全部可用 */
export const isStudyTimeValid = (drafts: Record<keyof StudyTime, RangeDraft>): boolean =>
  Object.values(drafts).every(isRangeValid);

/** 区间草稿的字段级错误提示 */
export const rangeErrors = (draft: RangeDraft): { min: string | null; max: string | null } => {
  if (!DIGITS.test(draft.min)) {
    return { min: "请输入整数秒数", max: null };
  }
  const min = Number(draft.min);
  if (min < 0 || min > MAX_SECONDS) {
    return { min: "范围需在 0 到 3600 秒之间", max: null };
  }
  if (!DIGITS.test(draft.max)) {
    return { min: null, max: "请输入整数秒数" };
  }
  const max = Number(draft.max);
  if (max > MAX_SECONDS) {
    return { min: null, max: "最大上限 3600 秒" };
  }
  if (max < min) {
    return { min: null, max: "最大值不能低于最小值" };
  }
  return { min: null, max: null };
};

/** 冷却时长取整到 0.1 秒并限制在 0 到 10 秒 */
export const clampSleep = (value: number): number =>
  Math.round(Math.min(10, Math.max(0, value)) * 10) / 10;

/** 冷却时长是否可用 */
export const isSleepValid = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= 10;

/**
 * 写入结果决定输入框显示的草稿:
 * 写入成功时采用新草稿, 被拒绝时回到已保存的值, 不保留没有生效的改动。
 */
export const draftAfterWrite = (
  next: RangeDraft,
  saved: MinMaxTime,
  written: boolean,
): RangeDraft => (written ? next : draftFrom(saved));

/** 冷却值的显示值同样按写入结果决定 */
export const sleepAfterWrite = (next: number, saved: number, written: boolean): number =>
  written ? next : saved;
