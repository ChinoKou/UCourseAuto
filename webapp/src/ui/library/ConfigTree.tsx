import {
  IconAlertTriangle,
  IconCheck,
  IconLoader2,
  IconSparkles,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { VList } from "virtua";

import type { AppErrorDetail } from "@/error/report";
import type { ModelCourse } from "@/schema/domain/course";
import type { ConfigProgress } from "@/schema/domain/progress";
import type { CourseTextbookGroup } from "@/usecases/configureCourseware";
import { Button } from "@/ui/common/Button";
import { TreeRow, type TreeState } from "@/ui/common/Tree";

export interface ConfigTreeProps {
  groups: ReadonlyArray<CourseTextbookGroup>;
  progress: ConfigProgress | null;
  coursesSnapshot: ReadonlyArray<ModelCourse> | null;
  result: ReadonlyArray<ModelCourse> | null;
  error: AppErrorDetail | null;
  skippedChapterIds?: ReadonlySet<number>;
  skippedTextbookIds?: ReadonlySet<number>;
  onViewErrorDetail?: (error: AppErrorDetail) => void;
}

/** 组装用于展示的树节点结构 */
interface DisplayTreeItem {
  id: string;
  depth: number;
  tone: "course" | "textbook" | "chapter" | "section";
  title: string;
  meta?: string;
  state: TreeState;
  errorHint?: string;
  targetKind?: "chapter" | "textbook";
  targetId?: number;
  parentId?: string;
  hasChildren: boolean;
}

/**
 * 课件配置向导的核心树结构展示与同步监控器:
 * - 同步期间与出错期间始终完整展示树结构
 * - 配置到哪一个地方，哪一个地方自动展开；结束了就折叠；其余默认折叠
 * - 出错节点红色高亮并支持直接跳过与排查
 */
export function ConfigTree({
  groups,
  progress,
  coursesSnapshot,
  result,
  error,
  skippedChapterIds = new Set<number>(),
  skippedTextbookIds = new Set<number>(),
  onViewErrorDetail,
}: ConfigTreeProps) {
  // 记录用户手动干预的展开节点，未干预时为 null，走自动展开联动
  const [userExpandedNodes, setUserExpandedNodes] = useState<Set<string> | null>(null);

  // 优先级: 最终成功结果 > 过程快照 > 初始分组骨架
  const currentCourses = useMemo((): ModelCourse[] => {
    if (result !== null) {
      return [...result];
    }
    if (coursesSnapshot !== null && coursesSnapshot.length > 0) {
      return [...coursesSnapshot];
    }
    return groups.map(({ course, textbooks }) => ({
      course_id: course.id,
      course_name: course.name,
      class_id: course.classId,
      class_user_id: course.classUserId,
      teacher_name: course.teacherName,
      class_name: course.className,
      textbooks: textbooks.map((tb) => ({
        textbook_id: tb.courseId,
        textbook_name: tb.name,
        status: tb.status,
        limit: tb.limit,
        chapters: [],
      })),
    }));
  }, [result, coursesSnapshot, groups]);

  // 根据当前执行进度与错误状态，自动派生展开与折叠节点
  // 规则: 配置到哪一个地方，哪一个地方就展开；结束了就折叠；其他地方默认折叠；出错项强制展开
  const autoExpandedNodes = useMemo((): Set<string> => {
    if (error !== null) {
      const nextExpanded = new Set<string>();
      if (error.targetKey !== undefined) {
        nextExpanded.add(error.targetKey);
      }
      if (progress?.courseId !== undefined) {
        nextExpanded.add(`c-${progress.courseId}`);
      }
      if (progress?.courseId !== undefined && progress?.textbookId !== undefined) {
        nextExpanded.add(`t-${progress.courseId}-${progress.textbookId}`);
      }
      return nextExpanded;
    }

    if (result !== null) {
      const allCourseIds = new Set<string>();
      for (const course of result) {
        allCourseIds.add(`c-${course.course_id}`);
      }
      return allCourseIds;
    }

    if (progress !== null) {
      const nextExpanded = new Set<string>();
      if (progress.courseId !== undefined) {
        nextExpanded.add(`c-${progress.courseId}`);
      }
      if (progress.courseId !== undefined && progress.textbookId !== undefined) {
        nextExpanded.add(`t-${progress.courseId}-${progress.textbookId}`);
      }
      if (progress.chapterId !== undefined) {
        nextExpanded.add(`ch-${progress.chapterId}`);
      }
      return nextExpanded;
    }

    return new Set<string>();
  }, [error, result, progress]);

  const expandedNodes = useMemo((): Set<string> => {
    if (userExpandedNodes !== null) {
      if (
        result === null &&
        error === null &&
        progress !== null &&
        progress.chapterId !== undefined
      ) {
        const next = new Set(userExpandedNodes);
        for (const id of next) {
          if (id.startsWith("ch-") && id !== `ch-${progress.chapterId}`) {
            next.delete(id);
          }
        }
        next.add(`ch-${progress.chapterId}`);
        if (progress.courseId !== undefined) {
          next.add(`c-${progress.courseId}`);
        }
        if (progress.textbookId !== undefined) {
          next.add(`t-${progress.courseId}-${progress.textbookId}`);
        }
        return next;
      }
      return userExpandedNodes;
    }
    return autoExpandedNodes;
  }, [userExpandedNodes, autoExpandedNodes, result, error, progress]);

  const toggleExpand = (nodeId: string): void => {
    const next = new Set(expandedNodes);
    if (next.has(nodeId)) {
      next.delete(nodeId);
    } else {
      next.add(nodeId);
    }
    setUserExpandedNodes(next);
  };

  const expandAll = (): void => {
    const allIds = new Set<string>();
    for (const course of currentCourses) {
      allIds.add(`c-${course.course_id}`);
      for (const textbook of course.textbooks) {
        allIds.add(`t-${course.course_id}-${textbook.textbook_id}`);
        for (const chapter of textbook.chapters) {
          allIds.add(`ch-${chapter.chapter_id}`);
        }
      }
    }
    setUserExpandedNodes(allIds);
  };

  const collapseAll = (): void => {
    setUserExpandedNodes(new Set());
  };

  // 展平当前可见树节点
  const visibleItems = useMemo((): DisplayTreeItem[] => {
    const items: DisplayTreeItem[] = [];

    for (const [courseIdx, course] of currentCourses.entries()) {
      const courseKey = `c-${course.course_id}`;
      const isCourseExpanded = expandedNodes.has(courseKey);

      let courseState: TreeState = "pending";
      let courseErrorHint: string | undefined;

      if (error !== null && (error.targetKey === courseKey || (progress?.courseId === course.course_id && error.targetKind === undefined))) {
        courseState = "error";
        courseErrorHint = error.message;
      } else if (result !== null) {
        courseState = "done";
      } else if (progress !== null) {
        if (progress.courseIndex > courseIdx + 1) {
          courseState = "done";
        } else if (progress.courseIndex === courseIdx + 1) {
          courseState = "active";
        }
      }

      items.push({
        id: courseKey,
        depth: 0,
        tone: "course",
        title: course.course_name,
        meta: `${course.textbooks.length} 本教材${course.teacher_name ? ` · 教师: ${course.teacher_name}` : ""}`,
        state: courseState,
        errorHint: courseErrorHint,
        hasChildren: course.textbooks.length > 0,
      });

      if (!isCourseExpanded) {
        continue;
      }

      for (const [tbIdx, textbook] of course.textbooks.entries()) {
        const textbookKey = `t-${course.course_id}-${textbook.textbook_id}`;
        const isTextbookExpanded = expandedNodes.has(textbookKey);
        const isSkipped = skippedTextbookIds.has(textbook.textbook_id);

        let textbookState: TreeState = "pending";
        let textbookErrorHint: string | undefined;

        if (isSkipped) {
          textbookState = "skipped";
        } else if (error !== null && error.targetKey === textbookKey) {
          textbookState = "error";
          textbookErrorHint = error.message;
        } else if (result !== null) {
          textbookState = "done";
        } else if (progress !== null && progress.courseIndex === courseIdx + 1) {
          if (progress.textbookIndex > tbIdx + 1) {
            textbookState = "done";
          } else if (progress.textbookIndex === tbIdx + 1) {
            textbookState = "active";
          }
        } else if (progress !== null && progress.courseIndex > courseIdx + 1) {
          textbookState = "done";
        }

        items.push({
          id: textbookKey,
          depth: 1,
          tone: "textbook",
          title: textbook.textbook_name,
          meta: isSkipped
            ? "已跳过该教材"
            : textbook.chapters.length > 0
              ? `共 ${textbook.chapters.length} 章`
              : textbookState === "active"
                ? "正在读取目录…"
                : "待同步",
          state: textbookState,
          errorHint: textbookErrorHint,
          targetKind: "textbook",
          targetId: textbook.textbook_id,
          parentId: courseKey,
          hasChildren: textbook.chapters.length > 0,
        });

        if (!isTextbookExpanded) {
          continue;
        }

        for (const [chIdx, chapter] of textbook.chapters.entries()) {
          const chapterKey = `ch-${chapter.chapter_id}`;
          const isChapterSkipped = skippedChapterIds.has(chapter.chapter_id);

          let chapterState: TreeState = "pending";
          let chapterErrorHint: string | undefined;

          if (isChapterSkipped) {
            chapterState = "skipped";
          } else if (error !== null && (error.targetKey === chapterKey || error.targetId === chapter.chapter_id)) {
            chapterState = "error";
            chapterErrorHint = error.message;
          } else if (result !== null) {
            chapterState = "done";
          } else if (
            progress !== null &&
            progress.courseIndex === courseIdx + 1 &&
            progress.textbookIndex === tbIdx + 1
          ) {
            if (progress.chapterIndex > chIdx + 1) {
              chapterState = "done";
            } else if (progress.chapterIndex === chIdx + 1) {
              chapterState = "active";
            }
          } else if (
            progress !== null &&
            (progress.courseIndex > courseIdx + 1 ||
              (progress.courseIndex === courseIdx + 1 && progress.textbookIndex > tbIdx + 1))
          ) {
            chapterState = "done";
          }

          const pageCount = chapter.sections.reduce(
            (sum, s) => sum + s.pages.length,
            0,
          );

          const isChapterExpanded = expandedNodes.has(chapterKey);
          const hasSections = chapter.sections.length > 0;

          items.push({
            id: chapterKey,
            depth: 2,
            tone: "chapter",
            title: chapter.chapter_name,
            meta: isChapterSkipped
              ? "已跳过该章"
              : pageCount > 0
                ? `${chapter.sections.length} 节 · ${pageCount} 页`
                : chapterState === "active"
                  ? "正在解析内容与记录…"
                  : "待同步",
            state: chapterState,
            errorHint: chapterErrorHint,
            targetKind: "chapter",
            targetId: chapter.chapter_id,
            parentId: textbookKey,
            hasChildren: hasSections,
          });

          if (isChapterExpanded && hasSections) {
            for (const [sectionIdx, section] of chapter.sections.entries()) {
              const sectionKey = `s-${section.section_id}`;
              let sectionState: TreeState = "pending";

              if (chapterState === "done") {
                sectionState = "done";
              } else if (chapterState === "skipped") {
                sectionState = "skipped";
              } else if (progress !== null && progress.chapterId === chapter.chapter_id) {
                if (progress.sectionId === section.section_id) {
                  sectionState = "active";
                } else if (
                  progress.sectionIndex !== undefined &&
                  sectionIdx + 1 < progress.sectionIndex
                ) {
                  sectionState = "done";
                }
              }

              items.push({
                id: sectionKey,
                depth: 3,
                tone: "section",
                title: section.section_name,
                meta: `${section.pages.length} 个页面`,
                state: sectionState,
                parentId: chapterKey,
                hasChildren: false,
              });
            }
          }
        }
      }
    }

    return items;
  }, [
    currentCourses,
    expandedNodes,
    error,
    result,
    progress,
    skippedChapterIds,
    skippedTextbookIds,
  ]);

  // 统计数值
  const totalCourses = currentCourses.length;
  const totalTextbooks = currentCourses.reduce(
    (sum, c) => sum + c.textbooks.filter((tb) => !skippedTextbookIds.has(tb.textbook_id)).length,
    0,
  );
  const totalPages = currentCourses.reduce(
    (sum, c) =>
      sum +
      c.textbooks.reduce(
        (tSum, tb) =>
          tSum +
          tb.chapters.reduce(
            (chSum, ch) =>
              chSum + ch.sections.reduce((sSum, s) => sSum + s.pages.length, 0),
            0,
          ),
        0,
      ),
    0,
  );

  return (
    <div className="uc-config-tree-view">
      {/* 顶部状态提示横幅 */}
      {error !== null ? (
        /* 发生异常时的精巧通知横幅: 绝不遮挡或破坏树结构 */
        <div className="uc-tree-error-banner" role="alert">
          <div className="uc-tree-error-banner__left">
            <span className="uc-tree-error-banner__icon">
              <IconAlertTriangle size={18} stroke={2.2} />
            </span>
            <div className="uc-tree-error-banner__content">
              <strong className="uc-tree-error-banner__title">
                {error.targetName !== undefined
                  ? `${error.targetKind === "chapter" ? "章节" : "教材"}「${error.targetName}」同步受阻`
                  : error.title}
              </strong>
              <span className="uc-tree-error-banner__desc">
                {error.message}
              </span>
            </div>
          </div>

          {onViewErrorDetail && (
            <div className="uc-tree-error-banner__actions">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onViewErrorDetail(error);
                }}
              >
                查看完整日志
              </Button>
            </div>
          )}
        </div>
      ) : result !== null ? (
        /* 同步完成成果卡 */
        <div className="uc-tree-status-banner uc-tree-status-banner--done">
          <div className="uc-tree-status-banner__info">
            <span className="uc-tree-status-banner__icon is-done">
              <IconSparkles size={16} />
            </span>
            <div>
              <strong>课件结构已成功解析完成</strong>
              <span className="uc-tree-status-banner__meta">
                已验证真实完成状态并补全题目答案，共 {totalCourses} 门课程 · {totalTextbooks} 本教材 · {totalPages} 个学习页
              </span>
            </div>
          </div>
          <span className="uc-badge uc-badge--success">可写入工作台</span>
        </div>
      ) : (
        /* 正在同步监控条 */
        <div className="uc-tree-status-banner uc-tree-status-banner--running">
          <div className="uc-tree-status-banner__info">
            <span className="uc-tree-status-banner__icon is-running">
              <IconLoader2 size={16} className="uc-spin" />
            </span>
            <div>
              <strong>
                正在同步: {progress?.courseName || "正在准备课程…"}
                {progress?.textbookName ? ` › ${progress.textbookName}` : ""}
              </strong>
              <span className="uc-tree-status-banner__meta">
                {progress?.chapterName ? (
                  progress.sectionName ? (
                    <>
                      <span>{progress.chapterName} › 当前小节: {progress.sectionName}</span>
                      {progress.sectionIndex !== undefined && progress.sectionTotal !== undefined ? (
                        <span className="uc-mono"> ({progress.sectionIndex}/{progress.sectionTotal})</span>
                      ) : null}
                    </>
                  ) : (
                    `当前章节: ${progress.chapterName}`
                  )
                ) : (
                  "正在拉取结构与学习记录…"
                )}
              </span>
            </div>
          </div>
          <span className="uc-tree-status-banner__counter uc-mono">
            课程 {progress?.courseIndex ?? 0}/{progress?.courseTotal ?? totalCourses}
          </span>
        </div>
      )}

      {/* 树顶部控制条 */}
      <header className="uc-config-tree-head">
        <div className="uc-config-tree-head__label">
          <span>课件结构解析树</span>
          <span className="uc-badge">
            {result !== null ? "解析完成" : error !== null ? "遇到异常" : "同步中"}
          </span>
        </div>
        <div className="uc-config-tree-head__tools">
          <button
            type="button"
            className="uc-text-link"
            onClick={expandAll}
          >
            全部展开
          </button>
          <span className="uc-config-tree-head__sep">·</span>
          <button
            type="button"
            className="uc-text-link"
            onClick={collapseAll}
          >
            全部收起
          </button>
        </div>
      </header>

      {/* 课件树列表: 统一复用 TreeRow 组件, 长列表经 virtua 虚拟化 */}
      <div className="uc-config-tree-list uc-tree" role="tree">
        <VList data={visibleItems} className="uc-config-tree-list__vlist">
          {(item) => {
            const isExpanded = expandedNodes.has(item.id);

            // 行尾附加动作或状态
            let trailingContent = null;
            if (item.state === "error") {
              trailingContent = <span className="uc-badge uc-badge--danger">同步受阻</span>;
            } else if (item.state === "skipped") {
              trailingContent = <span className="uc-badge uc-badge--muted">已跳过</span>;
            } else if (item.state === "active") {
              trailingContent = (
                <span className="uc-tree-row-active-tag">
                  <IconLoader2 size={12} className="uc-spin" />
                  <span>同步中</span>
                </span>
              );
            } else if (item.state === "done") {
              trailingContent = (
                <span className="uc-tree-row-done-tag">
                  <IconCheck size={13} stroke={2.5} />
                </span>
              );
            }

            return (
              <TreeRow
                key={item.id}
                depth={item.depth}
                tone={item.tone}
                title={item.title}
                meta={item.meta}
                state={item.state}
                errorHint={item.errorHint}
                expanded={isExpanded}
                onToggle={
                  item.hasChildren
                    ? () => {
                        toggleExpand(item.id);
                      }
                    : undefined
                }
                trailing={trailingContent}
              />
            );
          }}
        </VList>
      </div>
    </div>
  );
}
