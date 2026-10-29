import {
  IconAlertCircle,
  IconCheck,
  IconFlame,
  IconPlayerStop,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";

import type { CoursewareSummary } from "@/logic/courseware/statistics";
import type { AntiDetectionStage, RunProgress } from "@/schema/domain/progress";
import { AnimatedNumber } from "@/ui/common/AnimatedNumber";
import { Button } from "@/ui/common/Button";

interface AntiStageItem {
  value: AntiDetectionStage;
  stepNumber: string;
  label: string;
  sub: string;
}

const ANTI_STAGES: ReadonlyArray<AntiStageItem> = [
  {
    value: "zeroDuration",
    stepNumber: "01",
    label: "零时长记录",
    sub: "完成状态预报",
  },
  {
    value: "trigger",
    stepNumber: "02",
    label: "触发平台检测",
    sub: "发起检测请求",
  },
  {
    value: "realDuration",
    stepNumber: "03",
    label: "写回真实时长",
    sub: "时间戳最终同步",
  },
];

const percentOf = (value: number, total: number): number =>
  total === 0 ? 0 : Math.round((value / total) * 100);

export interface RunLiveProps {
  progress: RunProgress;
  summary: CoursewareSummary;
  antiStage: AntiDetectionStage | null;
  stopRequested: boolean;
  onRequestStop: () => void;
}

/** 刷课卡实时运行控制台: 紧凑指挥台、活跃学习节点、反刷课阶段流转与安全停止 */
export function RunLive({
  progress,
  summary,
  antiStage,
  stopRequested,
  onRequestStop,
}: RunLiveProps) {
  const overallPercent = percentOf(summary.completedPages, summary.pageCount);
  const chapterPercent = percentOf(progress.chapterIndex, progress.chapterTotal);
  const pagePercent = percentOf(progress.pageIndex, progress.pageTotal);
  const stageIndex = ANTI_STAGES.findIndex((stage) => stage.value === antiStage);

  const breadcrumb = [
    progress.courseName,
    progress.textbookName,
    progress.chapterName,
  ]
    .filter((part) => part.trim() !== "")
    .join(" › ") || "正在解析课件结构…";

  return (
    <div className="uc-live">
      {/* 实时指挥台头部: 整合旋转光球、总体进度与统计指标 */}
      <div className="uc-live__head">
        <div className="uc-live__orb" aria-hidden="true">
          <span className="uc-live__ring" />
          <span className="uc-live__ring uc-live__ring--inner" />
          <span className="uc-live__core">
            <span className="uc-live__core-dot" />
          </span>
        </div>

        <div className="uc-live__summary">
          <div className="uc-live__summary-top">
            <div className="uc-live__value-group">
              <span className="uc-live__value">
                <AnimatedNumber value={overallPercent} />
                <small>%</small>
              </span>
              <span className="uc-live__caption">
                已完成 <strong>{summary.completedPages}</strong> / {summary.pageCount} 页
              </span>
            </div>

            <div className="uc-live__summary-pills">
              <span className="uc-live__status-badge">
                <span className="uc-live__status-dot" />
                <span>
                  {stopRequested
                    ? "正在安全退出…"
                    : antiStage !== null
                      ? "反刷课保护中"
                      : "上报学习中"}
                </span>
              </span>

              <span className="uc-live__metric-pill uc-mono">
                课程 {progress.courseIndex}/{progress.courseTotal || summary.courseCount}
              </span>
              <span className="uc-live__metric-pill uc-mono">
                已刷 {progress.completedSections} 节
              </span>
            </div>
          </div>

          <div className="uc-live__track">
            <span style={{ transform: `scaleX(${overallPercent / 100})` }} />
          </div>
        </div>
      </div>

      {/* 活跃学习目标卡片: 紧凑双轨进度 */}
      <div className="uc-live__now">
        <div className="uc-live__kicker">
          <span className="uc-live__kicker-tag">
            <IconFlame size={13} stroke={2.5} />
            <span>当前处理节点</span>
          </span>
          <span className="uc-live__breadcrumb" title={breadcrumb}>
            {breadcrumb}
          </span>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            className="uc-live__target"
            key={`${progress.courseName}-${progress.textbookName}-${progress.chapterName}-${progress.sectionName}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="uc-live__section-row">
              <strong className="uc-live__section-name">
                {progress.sectionName || "准备处理中…"}
              </strong>
              {progress.sectionTotal > 0 && (
                <span className="uc-live__section-badge uc-mono">
                  节 {progress.sectionIndex}/{progress.sectionTotal}
                </span>
              )}
            </div>

            <div className="uc-live__page-row">
              <span className="uc-live__page-label">学习页面</span>
              <strong className="uc-live__page-name">
                {progress.pageName.trim() === "" ? "准备页面数据…" : progress.pageName}
              </strong>
              {progress.pageTotal > 0 && (
                <span className="uc-live__page-badge uc-mono">
                  页 {progress.pageIndex}/{progress.pageTotal}
                </span>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* 双轨层级进度条 */}
        <div className="uc-live__bars">
          <div className="uc-live__bar-group">
            <div className="uc-live__bar-label">
              <span>章节进度</span>
              <span className="uc-mono">
                {progress.chapterIndex}/{progress.chapterTotal}
              </span>
            </div>
            <div className="uc-live__bar">
              <span style={{ transform: `scaleX(${chapterPercent / 100})` }} />
            </div>
          </div>

          <div className="uc-live__bar-group">
            <div className="uc-live__bar-label">
              <span>节内进度</span>
              <span className="uc-mono">
                {progress.pageIndex}/{progress.pageTotal}
              </span>
            </div>
            <div className="uc-live__bar">
              <span style={{ transform: `scaleX(${pagePercent / 100})` }} />
            </div>
          </div>
        </div>
      </div>

      {/* 反刷课分段流程指示 (开启时展示) */}
      {antiStage !== null && (
        <div className="uc-live__anti-panel" aria-label="反刷课检测阶段流水线">
          <div className="uc-live__anti-head">
            <span className="uc-eyebrow">反刷课检测时序</span>
            <span className="uc-badge uc-badge--warning">分段保护</span>
          </div>
          <div className="uc-live__stages">
            {ANTI_STAGES.map((stage, index) => {
              const isCurrent = stage.value === antiStage;
              const isDone = index < stageIndex;
              const stateClass = isCurrent
                ? "is-current"
                : isDone
                  ? "is-done"
                  : "is-pending";

              return (
                <div className={`uc-live__stage ${stateClass}`} key={stage.value}>
                  <div className="uc-live__stage-status">
                    {isDone ? (
                      <span className="uc-live__stage-icon">
                        <IconCheck size={11} stroke={3} />
                      </span>
                    ) : (
                      <span className="uc-live__stage-num uc-mono">
                        {stage.stepNumber}
                      </span>
                    )}
                    {isCurrent && <span className="uc-live__stage-pulse" />}
                  </div>
                  <div className="uc-live__stage-text">
                    <strong>{stage.label}</strong>
                    <small>{stage.sub}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 底部操作与安全停止说明 */}
      <div className="uc-live__actions">
        <Button
          variant="danger"
          size="sm"
          icon={<IconPlayerStop size={15} fill="currentColor" />}
          disabled={stopRequested}
          onClick={onRequestStop}
        >
          {stopRequested ? "正在安全退出…" : "停止刷课"}
        </Button>
        <div className="uc-live__hint">
          <IconAlertCircle size={14} />
          <span>
            {stopRequested
              ? "已发出停止信号，将在当前页面处理完成后平稳停下。"
              : "可在任意时刻点击停止，已成功上报的小节进度将永久保留。"}
          </span>
        </div>
      </div>
    </div>
  );
}
