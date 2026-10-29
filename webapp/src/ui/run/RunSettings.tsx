import {
  IconAdjustmentsHorizontal,
  IconArrowRight,
  IconBook2,
  IconChevronDown,
  IconFileText,
  IconHelpCircle,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type CSSProperties } from "react";

import type { StudyTime } from "@/schema/domain/config";
import { useConfigStore } from "@/state/configStore";
import { AntiDetectionControl } from "@/ui/run/AntiDetectionControl";
import {
  clampSleep,
  draftAfterWrite,
  draftFrom,
  isRangeValid,
  isSleepValid,
  MAX_SECONDS,
  parseRange,
  rangeErrors,
  sleepAfterWrite,
  type RangeDraft,
} from "@/ui/run/studyTimeValidation";

type StudyTimeKey = keyof StudyTime;

interface StudyTypeMeta {
  key: StudyTimeKey;
  label: string;
  icon: typeof IconHelpCircle;
}

const STUDY_TYPES: ReadonlyArray<StudyTypeMeta> = [
  {
    key: "question",
    label: "题目页面",
    icon: IconHelpCircle,
  },
  {
    key: "document",
    label: "文档页面",
    icon: IconFileText,
  },
  {
    key: "content",
    label: "纯文本页面",
    icon: IconBook2,
  },
];

type CooldownTone = "fast" | "normal" | "slow";

interface CooldownPace {
  tone: CooldownTone;
  label: string;
  hint: string;
}

const resolveCooldownPace = (seconds: number): CooldownPace => {
  if (seconds < 0.5) {
    return {
      tone: "fast",
      label: "极速",
      hint: "间隔过短",
    };
  }
  if (seconds <= 2.0) {
    return {
      tone: "normal",
      label: "均衡",
      hint: "推荐区间",
    };
  }
  return {
    tone: "slow",
    label: "从容",
    hint: "节奏较慢",
  };
};

export interface RunSettingsProps {
  disabled: boolean;
  /** 草稿的综合有效性, 在草稿变化时上报 */
  onValidityChange: (valid: boolean) => void;
}

/** 刷课卡运行参数调节板: 高级配置项折叠收纳 */
export function RunSettings({ disabled, onValidityChange }: RunSettingsProps) {
  const config = useConfigStore((state) => state.config);
  const updateSettings = useConfigStore((state) => state.updateSettings);

  const [expanded, setExpanded] = useState(false);
  const [drafts, setDrafts] = useState<Record<StudyTimeKey, RangeDraft>>(() => ({
    question: draftFrom(config.study_time.question),
    document: draftFrom(config.study_time.document),
    content: draftFrom(config.study_time.content),
  }));
  const [sleepDraft, setSleepDraft] = useState(config.sleep_time);

  const cooldownPace = resolveCooldownPace(sleepDraft);
  const cooldownRatio = Math.min(100, Math.max(0, (sleepDraft / 10) * 100));

  const settingsValid =
    isRangeValid(drafts.question) &&
    isRangeValid(drafts.document) &&
    isRangeValid(drafts.content) &&
    isSleepValid(sleepDraft);

  useEffect(() => {
    onValidityChange(settingsValid);
  }, [onValidityChange, settingsValid]);

  const updateRange = (key: StudyTimeKey, patch: Partial<RangeDraft>): void => {
    const nextDraft: RangeDraft = { ...drafts[key], ...patch };
    const parsed = parseRange(nextDraft);
    if (parsed === null) {
      setDrafts((current) => ({ ...current, [key]: nextDraft }));
      return;
    }
    const current = config.study_time[key];
    if (parsed.min === current.min && parsed.max === current.max) {
      setDrafts((next) => ({ ...next, [key]: nextDraft }));
      return;
    }
    const written = updateSettings({
      study_time: { ...config.study_time, [key]: parsed },
    });
    // 写入被拒绝时草稿回到已保存的值, 输入框不保留没有生效的改动
    setDrafts((next) => ({ ...next, [key]: draftAfterWrite(nextDraft, current, written) }));
  };

  const commitSleep = (value: number): void => {
    const clamped = clampSleep(value);
    if (clamped === config.sleep_time) {
      setSleepDraft(clamped);
      return;
    }
    const written = updateSettings({ sleep_time: clamped });
    setSleepDraft(sleepAfterWrite(clamped, config.sleep_time, written));
  };

  return (
    <section className="uc-run-params" aria-label="运行参数配置">
      {/* 配置项折叠控制栏 */}
      <div className="uc-accordion">
        <button
          type="button"
          className={`uc-accordion__trigger ${expanded ? "is-expanded" : ""}`}
          aria-expanded={expanded}
          aria-controls="uc-advanced-params-panel"
          onClick={() => {
            setExpanded((prev) => !prev);
          }}
        >
          <div className="uc-accordion__trigger-lead">
            <span className="uc-accordion__trigger-icon" aria-hidden="true">
              <IconAdjustmentsHorizontal size={16} />
            </span>
            <span className="uc-accordion__trigger-label">高级参数配置</span>
          </div>
          <span
            className={`uc-accordion__arrow ${expanded ? "is-rotated" : ""}`}
            aria-hidden="true"
          >
            <IconChevronDown size={16} stroke={2} />
          </span>
        </button>

        {/* 默认折叠内容区域 */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              id="uc-advanced-params-panel"
              className="uc-accordion__content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="uc-accordion__inner">
                {/* 节间冷却滑块 */}
                <div
                  className={`uc-param-group uc-cooldown-group tone-${cooldownPace.tone}`}
                >
                  <div className="uc-param-group__title">
                    <div className="uc-cooldown-title-row">
                      <label htmlFor="uc-cooldown-slider">节间冷却间隔</label>
                      <span
                        className={`uc-badge uc-cooldown-badge tone-${cooldownPace.tone}`}
                      >
                        {cooldownPace.label} · {cooldownPace.hint}
                      </span>
                    </div>
                    <small>每处理完一个完整小节后休眠等待的时长</small>
                  </div>
                  <div
                    className="uc-cooldown-panel"
                    style={
                      {
                        "--cooldown-ratio": `${cooldownRatio}%`,
                      } as CSSProperties
                    }
                  >
                    <div className="uc-cooldown-slider-row">
                      <div className="uc-cooldown-track-wrap">
                        <input
                          id="uc-cooldown-slider"
                          type="range"
                          className="uc-slider"
                          min={0}
                          max={10}
                          step={0.1}
                          value={sleepDraft}
                          aria-valuetext={`${sleepDraft.toFixed(1)} 秒 (${cooldownPace.label})`}
                          disabled={disabled}
                          onChange={(event) => {
                            setSleepDraft(Number(event.currentTarget.value));
                          }}
                          onPointerUp={() => {
                            commitSleep(sleepDraft);
                          }}
                          onKeyUp={() => {
                            commitSleep(sleepDraft);
                          }}
                          onBlur={() => {
                            commitSleep(sleepDraft);
                          }}
                        />
                        <div className="uc-cooldown-scale" aria-hidden="true">
                          <span
                            className="uc-cooldown-scale__item"
                            style={{ left: "0%" }}
                          >
                            0s
                          </span>
                          <span
                            className="uc-cooldown-scale__item"
                            style={{ left: "5%" }}
                          >
                            0.5s
                          </span>
                          <span
                            className="uc-cooldown-scale__item"
                            style={{ left: "20%" }}
                          >
                            2s
                          </span>
                          <span
                            className="uc-cooldown-scale__item"
                            style={{ left: "100%" }}
                          >
                            10s
                          </span>
                        </div>
                      </div>
                      <div className="uc-cooldown-display">
                        <strong>{sleepDraft.toFixed(1)}</strong>
                        <span className="uc-cooldown-unit">秒</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 逐题型学习时长 */}
                <div className="uc-param-group uc-duration-group">
                  <div className="uc-param-group__title">
                    <span>逐题型学习时长</span>
                    <small>在区间内随机生成上报时间戳，单位为秒</small>
                  </div>

                  <div className="uc-duration-cards">
                    {STUDY_TYPES.map((typeMeta) => {
                      const key = typeMeta.key;
                      const Icon = typeMeta.icon;
                      const errors = rangeErrors(drafts[key]);
                      const hasError = errors.min !== null || errors.max !== null;

                      return (
                        <div
                          className={`uc-duration-card ${hasError ? "has-error" : ""}`}
                          key={key}
                        >
                          <div className="uc-duration-card__meta">
                            <span className="uc-duration-card__icon" aria-hidden="true">
                              <Icon size={16} />
                            </span>
                            <strong className="uc-duration-card__label">
                              {typeMeta.label}
                            </strong>
                          </div>

                          <div className="uc-duration-inputs">
                            <div className="uc-duration-field">
                              <span className="uc-duration-field__label">最短</span>
                              <div className="uc-duration-field__control">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  max={MAX_SECONDS}
                                  value={drafts[key].min}
                                  aria-label={`${typeMeta.label}最短秒数`}
                                  aria-invalid={errors.min !== null}
                                  disabled={disabled}
                                  onChange={(event) => {
                                    updateRange(key, { min: event.currentTarget.value });
                                  }}
                                />
                                <span className="uc-duration-field__unit">秒</span>
                              </div>
                            </div>

                            <span className="uc-range-sep" aria-hidden="true">
                              <IconArrowRight size={13} />
                            </span>

                            <div className="uc-duration-field">
                              <span className="uc-duration-field__label">最长</span>
                              <div className="uc-duration-field__control">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  max={MAX_SECONDS}
                                  value={drafts[key].max}
                                  aria-label={`${typeMeta.label}最长秒数`}
                                  aria-invalid={errors.max !== null}
                                  disabled={disabled}
                                  onChange={(event) => {
                                    updateRange(key, { max: event.currentTarget.value });
                                  }}
                                />
                                <span className="uc-duration-field__unit">秒</span>
                              </div>
                            </div>
                          </div>

                          {hasError && (
                            <p className="uc-field__error" role="alert">
                              {errors.min ?? errors.max}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 反刷课检测安全模块 */}
                <div className="uc-param-group">
                  <AntiDetectionControl disabled={disabled} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
