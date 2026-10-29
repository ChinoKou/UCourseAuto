import { IconBooks, IconRefresh, IconTrash } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { VList, type VListHandle } from "virtua";

import { summarizeCourseware } from "@/logic/courseware/statistics";
import { cloneCourses, collectPageIds } from "@/logic/courseware/tree";
import type { AppErrorDetail } from "@/error/report";
import type { UserConfig } from "@/schema/domain/config";
import { findSite } from "@/schema/domain/site";
import { selectActiveUser, useConfigStore } from "@/state/configStore";
import { useRunStore } from "@/state/runStore";
import { pruneCourseware } from "@/usecases/pruneCourseware";
import { usePorts } from "@/ui/app/ports";
import { navigate } from "@/ui/app/routes";
import { AnimatedNumber } from "@/ui/common/AnimatedNumber";
import { Button } from "@/ui/common/Button";
import { ConfirmDialog } from "@/ui/common/Dialog";
import { ErrorOverlay } from "@/ui/common/ErrorOverlay";
import { useToast } from "@/ui/common/toast";
import { TreeRow } from "@/ui/common/Tree";
import { TriStateCheck } from "@/ui/common/TriStateCheck";
import { buildLibraryTree } from "@/ui/dashboard/libraryTree";

export interface LibraryCardProps {
  onConfigure: () => void;
  highlighted?: boolean;
  previewUser?: UserConfig;
  ref?: React.Ref<HTMLElement>;
}

/** 首页课件库卡: 五层课件树随刷课进度展开与收起 */
export function LibraryCard({
  onConfigure,
  highlighted = false,
  previewUser,
  ref,
}: LibraryCardProps) {
  const storeUser = useConfigStore(selectActiveUser);
  const activeUser = storeUser ?? previewUser ?? null;
  const customSites = useConfigStore((state) => state.config.custom_sites);
  const replaceCourseware = useConfigStore((state) => state.replaceCourseware);
  const phase = useRunStore((state) => state.phase);
  const progress = useRunStore((state) => state.progress);
  const selectedPageIds = useRunStore((state) => state.selectedPageIds);
  const togglePageIds = useRunStore((state) => state.togglePageIds);
  const selectAllPages = useRunStore((state) => state.selectAllPages);
  const clearSelectedPages = useRunStore((state) => state.clearSelectedPages);
  const ports = usePorts();
  const toast = useToast();
  const courses = activeUser?.courses;
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (courses && courses.length > 0) {
      for (const course of courses) {
        for (const tb of course.textbooks) {
          initial.add(`t${course.course_id}-${tb.textbook_id}`);
          for (const ch of tb.chapters) {
            initial.add(`h${ch.chapter_id}`);
          }
        }
      }
    }
    return initial;
  });
  const [pruneOpen, setPruneOpen] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [pruneError, setPruneError] = useState<AppErrorDetail | null>(null);
  const listRef = useRef<VListHandle>(null);

  const tree = useMemo(
    () => buildLibraryTree(courses ?? [], progress, expandedNodes, selectedPageIds),
    [courses, expandedNodes, progress, selectedPageIds],
  );

  useEffect(() => {
    if (tree.currentRowIndex >= 0) {
      listRef.current?.scrollToIndex(tree.currentRowIndex, {
        align: "center",
        smooth: true,
      });
    }
  }, [tree.currentRowIndex]);

  if (activeUser === null) {
    throw new Error("课件库卡片需要活跃账号");
  }

  const site = findSite(activeUser.site, customSites);
  const summary = summarizeCourseware(activeUser.courses);
  const runBusy = phase === "running" || phase === "stopping";

  const toggleNode = (id: string): void => {
    setExpandedNodes((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handlePrune = async (): Promise<void> => {
    if (storeUser === null) {
      return;
    }
    if (site === null) {
      toast.push({ title: "站点配置缺失", tone: "error" });
      return;
    }
    setPruning(true);
    try {
      const outcome = await pruneCourseware(
        ports.prune,
        site,
        activeUser.token,
        cloneCourses(activeUser.courses),
      );
      if (outcome.failedSections === 0) {
        const written = replaceCourseware(outcome.courses);
        setPruneOpen(false);
        if (!written) {
          toast.push({ title: "同步结果没有写入，请刷新页面后重试", tone: "error" });
          return;
        }
        toast.push({ title: "已同步最新学习状态", tone: "success" });
        return;
      }
      if (outcome.failedSections < outcome.totalSections) {
        const written = replaceCourseware(outcome.courses);
        setPruneOpen(false);
        if (!written) {
          toast.push({ title: "同步结果没有写入，请刷新页面后重试", tone: "error" });
          return;
        }
        toast.push({
          title: `已同步 ${outcome.totalSections - outcome.failedSections} 个节，${outcome.failedSections} 个节失败`,
          tone: "warning",
        });
        return;
      }
      if (outcome.firstFailure !== null) {
        setPruneError(outcome.firstFailure);
      }
      setPruneOpen(false);
      toast.push({ title: "同步没有完成，全部节都失败了", tone: "error" });
    } finally {
      setPruning(false);
    }
  };

  return (
    <section
      ref={ref}
      tabIndex={-1}
      className={`uc-card uc-library-card ${highlighted ? "is-highlighted" : ""}`}
      aria-labelledby="uc-library-card-title"
    >
      <header className="uc-card__top uc-library-card__head">
        <div className="uc-card__label">
          <span className="uc-card__icon">
            <IconBooks size={16} />
          </span>
          <span id="uc-library-card-title">课件库</span>
        </div>
        <div className="uc-library-card__head-right">
          <button
            type="button"
            className="uc-library-card__del-link"
            disabled={runBusy}
            title="前往课件库管理或删除课件"
            onClick={() => {
              navigate("library");
            }}
          >
            <IconTrash size={13} />
            <span>前往课件库删除</span>
          </button>
          <span className={`uc-library-card__live ${runBusy ? "is-live" : ""}`}>
            <span className="uc-library-card__live-dot" />
            {runBusy ? "跟随进度" : "课件树"}
          </span>
        </div>
      </header>

      {summary.pageCount === 0 ? (
        <div className="uc-library-card__empty">
          <div className="uc-library-card__empty-art" aria-hidden="true">
            <span />
            <span />
            <IconBooks size={30} stroke={1.4} />
          </div>
          <strong>课件库还是空的</strong>
          <p>选择课程与教材后，课程、教材、章、节与页面的完整树会出现在这里。</p>
        </div>
      ) : (
        <>
          <div className="uc-library-card__board">
            <div className="uc-library-card__board-top">
              <div className="uc-library-card__progress-lead">
                <span className="uc-library-card__percent-num">
                  <AnimatedNumber value={summary.percent} />
                  <small>%</small>
                </span>
                <span className="uc-library-card__percent-label">总体进度</span>
              </div>

              <div className="uc-library-card__badges">
                <div className="uc-library-card__badge-item">
                  <span className="uc-library-card__badge-val">{summary.courseCount}</span>
                  <span className="uc-library-card__badge-name">课程</span>
                </div>
                <div className="uc-library-card__badge-item">
                  <span className="uc-library-card__badge-val">{summary.textbookCount}</span>
                  <span className="uc-library-card__badge-name">教材</span>
                </div>
                <div className="uc-library-card__badge-item">
                  <span className="uc-library-card__badge-val">{summary.pageCount}</span>
                  <span className="uc-library-card__badge-name">页面</span>
                </div>
                <div
                  className={`uc-library-card__badge-item ${
                    summary.remainingPages > 0 ? "is-pending" : "is-complete"
                  }`}
                >
                  <span className="uc-library-card__badge-val">
                    {summary.remainingPages}
                  </span>
                  <span className="uc-library-card__badge-name">待完成</span>
                </div>
              </div>
            </div>

            <div className="uc-library-card__track" aria-hidden="true">
              <span style={{ transform: `scaleX(${summary.percent / 100})` }} />
            </div>
          </div>

          <div className="uc-library-card__selection">
            <div className="uc-library-card__selection-info">
              <span
                className={`uc-library-card__selection-dot ${
                  selectedPageIds.size > 0 ? "is-active" : ""
                }`}
              />
              <span className="uc-library-card__selection-text">
                已选 <b>{selectedPageIds.size}</b> / {summary.pageCount} 页面
              </span>
            </div>

            <div className="uc-library-card__selection-btns">
              <button
                type="button"
                className="uc-library-card__quick-btn uc-library-card__quick-btn--accent"
                disabled={runBusy || summary.remainingPages === 0}
                onClick={() => {
                  if (courses) {
                    selectAllPages(collectPageIds(courses, true));
                  }
                }}
              >
                选待刷
              </button>
              <button
                type="button"
                className="uc-library-card__quick-btn"
                disabled={runBusy}
                onClick={() => {
                  if (courses) {
                    selectAllPages(collectPageIds(courses, false));
                  }
                }}
              >
                全选
              </button>
              <button
                type="button"
                className="uc-library-card__quick-btn"
                disabled={runBusy || selectedPageIds.size === 0}
                onClick={clearSelectedPages}
              >
                清空选择
              </button>
            </div>
          </div>

          <div
            className="uc-library-card__tree"
            style={
              {
                "--tree-content-height": `${tree.rows.length === 0 ? 80 : tree.rows.length * 46}px`,
              } as React.CSSProperties
            }
          >
            {tree.rows.length === 0 ? (
              <p className="uc-library-card__tree-empty">课件树还在等待课程数据</p>
            ) : (
              <VList
                ref={listRef}
                className="uc-library-card__list"
                data={tree.rows}
              >
                {(row) => {
                  const isChecked =
                    row.totalPages > 0 && row.selectedCount === row.totalPages;
                  const isIndeterminate =
                    row.selectedCount > 0 && row.selectedCount < row.totalPages;
                  return (
                    <TreeRow
                      key={row.id}
                      depth={row.depth}
                      tone={row.kind}
                      title={row.title}
                      meta={row.meta}
                      state={row.state}
                      percent={row.kind === "page" ? undefined : row.percent}
                      expanded={row.expanded}
                      leading={
                        <TriStateCheck
                          checked={isChecked}
                          indeterminate={isIndeterminate}
                          disabled={runBusy}
                          label={`勾选 ${row.title}`}
                          onToggle={(next) => {
                            togglePageIds(row.pageIds, next);
                          }}
                        />
                      }
                      onToggle={
                        row.expandable
                          ? () => {
                              toggleNode(row.id);
                            }
                          : undefined
                      }
                      trailing={
                        row.expandable ? (
                          <span className="uc-tree__count">{row.percent}%</span>
                        ) : undefined
                      }
                    />
                  );
                }}
              </VList>
            )}
          </div>

          <div className="uc-library-card__actions">
            <Button
              variant="primary"
              size="sm"
              disabled={runBusy}
              onClick={onConfigure}
            >
              新增课件
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<IconRefresh size={15} />}
              loading={pruning}
              disabled={runBusy}
              onClick={() => {
                setPruneOpen(true);
              }}
            >
              同步状态
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={pruneOpen}
        onClose={() => {
          setPruneOpen(false);
        }}
        onConfirm={() => {
          void handlePrune();
        }}
        title="同步学习状态"
        busy={pruning}
        confirmText="开始同步"
      >
        重新向平台获取全部小节的学习记录，更新课件的完成状态与进度。
      </ConfirmDialog>

      <ErrorOverlay
        report={pruneError}
        headline="同步学习状态失败"
        onClose={() => {
          setPruneError(null);
        }}
      />
    </section>
  );
}
