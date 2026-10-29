import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowRight,
  IconCircleCheck,
  IconClock,
  IconPlayerPlay,
  IconRefresh,
  IconRotateClockwise,
  IconSparkles,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";

import { createErrorDetail, type AppErrorDetail } from "@/error/report";
import { summarizeCourseware } from "@/logic/courseware/statistics";
import { selectActiveUser, useConfigStore } from "@/state/configStore";
import { useRunStore } from "@/state/runStore";
import { AnimatedNumber } from "@/ui/common/AnimatedNumber";
import { Button } from "@/ui/common/Button";
import { ConfirmDialog } from "@/ui/common/Dialog";
import { ErrorOverlay } from "@/ui/common/ErrorOverlay";
import { RunLive } from "@/ui/run/RunLive";
import { resolveRunStatus } from "@/ui/run/runStatus";
import { RunSettings } from "@/ui/run/RunSettings";
import { useRunControl } from "@/ui/run/useRunControl";

export interface RunConsoleProps {
  onConfigure: () => void;
  onRequireSelection?: () => void;
}

/** 首页刷课卡: 直接启动、卡内运行动画、参数配置与停止控制 */
export function RunConsole({ onConfigure, onRequireSelection }: RunConsoleProps) {
  const activeUser = useConfigStore(selectActiveUser);
  const phase = useRunStore((state) => state.phase);
  const progress = useRunStore((state) => state.progress);
  const antiStage = useRunStore((state) => state.antiDetectionStage);
  const stopRequested = useRunStore((state) => state.stopRequested);
  const errorMessage = useRunStore((state) => state.errorMessage);
  const errorDetail = useRunStore((state) => state.errorDetail);
  const runSummary = useRunStore((state) => state.runSummary);
  const selectedPageIds = useRunStore((state) => state.selectedPageIds);
  const targetPageIds = useRunStore((state) => state.targetPageIds);
  const { preparing, startError, start } = useRunControl();

  const [stopOpen, setStopOpen] = useState(false);
  const [settingsValid, setSettingsValid] = useState(true);
  const [errorReport, setErrorReport] = useState<AppErrorDetail | null>(null);
  const runBusy = phase === "running" || phase === "stopping";
  const selectedCount = selectedPageIds.size;
  const canLaunch = !preparing && settingsValid;

  if (activeUser === null) {
    throw new Error("刷课控制台需要活跃账号");
  }

  // 本轮勾选或锁定的执行目标范围
  const currentScopeIds = targetPageIds.size > 0 ? targetPageIds : selectedPageIds;
  const scopeSummary = useMemo(
    () => summarizeCourseware(activeUser.courses, currentScopeIds),
    [activeUser.courses, currentScopeIds],
  );
  // 全局概览统计(用于待命看板与就绪度显示)
  const globalSummary = useMemo(
    () => summarizeCourseware(activeUser.courses),
    [activeUser.courses],
  );

  const hasUnfinishedTargets = scopeSummary.remainingPages > 0;
  const hasSkippedSections =
    runSummary !== null && (runSummary.skippedSections > 0 || runSummary.failedUploads > 0);
  const isPartial = !stopRequested && (hasUnfinishedTargets || hasSkippedSections);

  const startRun = (): void => {
    if (!settingsValid) {
      return;
    }
    if (selectedCount === 0) {
      onRequireSelection?.();
      return;
    }
    void start();
  };

  const resetRun = (): void => {
    useRunStore.getState().resetRun();
  };

  const openRunError = (): void => {
    setErrorReport(
      errorDetail ??
        createErrorDetail({
          title: "刷课中断",
          message: errorMessage ?? "运行过程中遇到异常情况，请查看具体信息。",
        }),
    );
  };

  const status = resolveRunStatus({
    phase,
    preparing,
    stopRequested,
    isPartial,
  });

  const hasCourses = globalSummary.pageCount > 0;

  return (
    <section
      className="uc-run-console"
      id="run-console"
      aria-labelledby="uc-run-title"
    >
      <div className="uc-run-console__aurora" aria-hidden="true" />

      {/* 刷课卡顶部标题与全局状态药丸 */}
      <header className="uc-run-console__head">
        <div className="uc-card__label">
          <span className="uc-card__icon">
            <IconClock size={16} stroke={1.8} />
          </span>
          <span id="uc-run-title">自动刷课</span>
        </div>
        <div className="uc-run-console__head-meta">
          <span
            className={`uc-status-pill ${
              status.tone === "live"
                ? "is-live"
                : status.tone === "warning"
                  ? "is-warning"
                  : ""
            }`}
          >
            <span className="uc-status-pill__dot" />
            {status.label}
          </span>
        </div>
      </header>

      <div className="uc-run-console__body">
        {/* 运行完成状态卡片 */}
        {phase === "finished" && !runBusy && (
          <div
            className={`uc-console-finish ${
              isPartial ? "uc-console-finish--warning" : ""
            }`}
          >
            <div className="uc-console-finish__icon-wrap">
              <span className="uc-console-finish__icon" aria-hidden="true">
                {isPartial ? (
                  <IconAlertCircle size={40} stroke={1.5} />
                ) : (
                  <IconCircleCheck size={40} stroke={1.5} />
                )}
              </span>
              <span className="uc-console-finish__ring" aria-hidden="true" />
            </div>

            <span className="uc-console-finish__kicker">
              {stopRequested
                ? "手动中止"
                : isPartial
                  ? "部分内容未能完成"
                  : "全部处理完毕"}
            </span>
            <h2>
              {stopRequested
                ? progress.completedSections > 0
                  ? `已完成 ${progress.completedSections} 个小节，在此平稳停止`
                  : "刷课已停止，未完成任何小节"
                : isPartial
                  ? progress.completedSections === 0
                    ? "本轮未能成功完成任何小节"
                    : `已完成 ${progress.completedSections} 个小节，部分小节未能成功`
                  : "本轮设定的全部课件已顺利完成"}
            </h2>
            <p>
              {stopRequested
                ? hasUnfinishedTargets
                  ? `本轮勾选的内容中还有 ${scopeSummary.remainingPages} 个页面未完成，随时可继续处理。`
                  : "本轮勾选的内容已全部处理完毕。"
                : isPartial
                  ? hasSkippedSections
                    ? `${runSummary?.skippedSections ?? 0} 个小节初始化受阻，${runSummary?.failedUploads ?? 0} 个小节上报受阻已跳过。本轮剩余 ${scopeSummary.remainingPages} 个页面仍未完成。`
                    : `本轮勾选的内容中还有 ${scopeSummary.remainingPages} 个页面未完成，随时可继续处理。`
                  : `本轮勾选的 ${scopeSummary.pageCount} 个页面已全部处理完毕。`}
            </p>

            <div className="uc-console-finish__stats">
              <div className="uc-console-finish__stat-item">
                <strong className="uc-mono">{progress.completedSections}</strong>
                <span>本轮完成小节</span>
              </div>
              <div className="uc-console-finish__stat-item">
                <strong className="uc-mono">{scopeSummary.completedPages}</strong>
                <span>本轮完成页面</span>
              </div>
              <div className="uc-console-finish__stat-item">
                <strong className="uc-mono">{scopeSummary.pageCount}</strong>
                <span>本轮勾选总量</span>
              </div>
            </div>

            <div className="uc-console-finish__actions">
              <Button
                variant="primary"
                size="md"
                icon={<IconRotateClockwise size={16} />}
                onClick={resetRun}
              >
                完成并返回就绪
              </Button>
            </div>
          </div>
        )}

        {/* 异常中断状态卡片 */}
        {phase === "error" && !runBusy && (
          <div className="uc-console-finish uc-console-finish--error">
            <div className="uc-console-finish__icon-wrap">
              <span className="uc-console-finish__icon" aria-hidden="true">
                <IconAlertTriangle size={38} stroke={1.5} />
              </span>
              <span className="uc-console-finish__ring" aria-hidden="true" />
            </div>

            <span className="uc-console-finish__kicker">执行出现异常</span>
            <h2>本轮刷课未能继续</h2>
            <p>{errorMessage ?? "请求过程中遇到了异常响应，可查看错误日志详情。"}</p>

            <div className="uc-console-finish__actions">
              <Button
                variant="primary"
                size="md"
                icon={<IconRefresh size={16} />}
                onClick={startRun}
              >
                重新尝试启动
              </Button>
              <Button variant="ghost" size="md" onClick={openRunError}>
                查看错误详情
              </Button>
              <Button variant="secondary" size="md" onClick={resetRun}>
                复位控制台
              </Button>
            </div>
          </div>
        )}

        {/* 课件为空的引导视图 */}
        {phase === "idle" && !hasCourses && (
          <div className="uc-console-empty">
            <div className="uc-console-empty__card">
              <div className="uc-console-empty__art" aria-hidden="true">
                <span className="uc-console-empty__halo" />
                <span className="uc-console-empty__core">
                  <IconSparkles size={32} />
                </span>
              </div>

              <h3>课件库尚未选择课程</h3>
              <p>
                在启动自动刷课之前，请先从右侧或下方配置向导中选择要学习的课程与对应教材。
              </p>

              <div className="uc-console-empty__actions">
                <Button
                  variant="primary"
                  size="md"
                  icon={<IconArrowRight size={16} />}
                  onClick={onConfigure}
                >
                  新增课件
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 待命与准备启动状态 */}
        {phase === "idle" && hasCourses && (
          <div className="uc-run-console__idle">
            {/* 核心启动区与就绪看板 */}
            <div className="uc-console-hub">
              {/* 启动枢纽 */}
              <div className="uc-console-launch">
                <span className="uc-console-launch__ring" aria-hidden="true" />
                <span
                  className="uc-console-launch__ring uc-console-launch__ring--inner"
                  aria-hidden="true"
                />
                <button
                  type="button"
                  className={`uc-console-launch__button ${selectedCount === 0 ? "is-selection-needed" : ""}`}
                  aria-label={
                    preparing
                      ? "正在准备刷课任务"
                      : selectedCount === 0
                        ? "未勾选课件，点击前往课件库勾选"
                        : "开始执行刷课"
                  }
                  disabled={!canLaunch}
                  onClick={startRun}
                >
                  {preparing ? (
                    <span className="uc-spinner uc-spinner--lg" />
                  ) : (
                    <IconPlayerPlay size={36} fill="currentColor" stroke={0} />
                  )}
                </button>
                <strong className="uc-console-launch__title">
                  {preparing
                    ? "正在准备中…"
                    : selectedCount === 0
                      ? "请勾选课件"
                      : "开始刷课"}
                </strong>
              </div>

              {/* 课件就绪看板 */}
              <div className="uc-console-readiness">
                <div className="uc-console-readiness__head">
                  <div className="uc-console-readiness__title-wrap">
                    <span className="uc-eyebrow">课件就绪度</span>
                    <strong className="uc-console-readiness__title">
                      {globalSummary.courseCount} 门课程 · {globalSummary.textbookCount} 本教材
                    </strong>
                  </div>
                  <div className="uc-console-readiness__percent-wrap">
                    <span className="uc-console-readiness__percent uc-mono">
                      <AnimatedNumber value={globalSummary.percent} />
                      <small>%</small>
                    </span>
                  </div>
                </div>

                <div className="uc-console-readiness__bar">
                  <span style={{ width: `${globalSummary.percent}%` }} />
                </div>

                <div className="uc-console-readiness__metrics">
                  <div className="uc-console-readiness__metric">
                    <strong className="uc-mono">
                      <AnimatedNumber value={globalSummary.completedPages} />
                    </strong>
                    <span>已完成页面</span>
                  </div>
                  <div className="uc-console-readiness__metric is-highlight">
                    <strong className="uc-mono">
                      <AnimatedNumber value={globalSummary.remainingPages} />
                    </strong>
                    <span>待完成页面</span>
                  </div>
                  <div className="uc-console-readiness__metric">
                    <strong className="uc-mono">
                      <AnimatedNumber value={globalSummary.sectionCount} />
                    </strong>
                    <span>覆盖小节数</span>
                  </div>
                </div>

                <div className="uc-console-readiness__selection-hint">
                  {selectedCount > 0 ? (
                    <span>
                      已勾选 <b>{selectedCount}</b> 个待刷页面
                    </span>
                  ) : (
                    <span className="is-warning">
                      请在右侧课件库中勾选要学习的内容
                    </span>
                  )}
                </div>

                {startError !== null && (
                  <div
                    className="uc-alert uc-alert--danger uc-console-readiness__error"
                    role="alert"
                  >
                    <IconAlertTriangle size={16} />
                    <span>{startError}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 运行中实时状态视图 */}
        {runBusy && (
          <RunLive
            progress={progress}
            summary={scopeSummary}
            antiStage={antiStage}
            stopRequested={stopRequested}
            onRequestStop={() => {
              setStopOpen(true);
            }}
          />
        )}

        {/* 参数调节面板: 待命状态可调, 运行状态锁定展示当前生效参数 */}
        {hasCourses && phase !== "finished" && phase !== "error" && (
          <RunSettings
            disabled={runBusy || preparing}
            onValidityChange={setSettingsValid}
          />
        )}
      </div>

      {/* 安全停止确认对话框: 运行结束后自动关闭 */}
      <ConfirmDialog
        open={stopOpen && runBusy}
        onClose={() => {
          setStopOpen(false);
        }}
        onConfirm={() => {
          useRunStore.getState().requestStop();
          setStopOpen(false);
        }}
        title="确认停止刷课？"
        danger
        confirmText="确认停止"
      >
        系统将在当前小节上报并完成检查点后安全退出。所有已成功上报的节与时长记录均会完整保存，后续可继续处理剩余内容。
      </ConfirmDialog>

      {/* 结构化错误详情抽屉 */}
      <ErrorOverlay
        report={errorReport}
        headline="刷课遇到异常中断"
        onClose={() => {
          setErrorReport(null);
        }}
      />
    </section>
  );
}
