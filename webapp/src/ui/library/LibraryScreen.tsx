import {
  IconAdjustmentsHorizontal,
  IconBook2,
  IconBooks,
  IconCheck,
  IconCircleCheck,
  IconCircleDashed,
  IconFileText,
  IconFilter,
  IconFolder,
  IconHelpCircle,
  IconListDetails,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconVideo,
  IconX,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { VList } from "virtua";

import { summarizeCourseware } from "@/logic/courseware/statistics";
import type { AppErrorDetail } from "@/error/report";
import {
  cloneCourses,
  countPagesForTarget,
  pageIdsForTarget,
  resolveActiveCourseId,
  type CoursewareTarget,
} from "@/logic/courseware/tree";
import type { ModelCourse, ModelTextbook } from "@/schema/domain/course";
import type { UserConfig } from "@/schema/domain/config";
import type {
  CoursewareChapter,
  CoursewarePage,
  CoursewareSection,
} from "@/schema/domain/courseware";
import { findSite } from "@/schema/domain/site";
import { selectActiveUser, useConfigStore } from "@/state/configStore";
import { useRunStore } from "@/state/runStore";
import { pruneCourseware } from "@/usecases/pruneCourseware";
import { navigate } from "@/ui/app/routes";
import { usePorts } from "@/ui/app/ports";
import { AnimatedNumber } from "@/ui/common/AnimatedNumber";
import { Button } from "@/ui/common/Button";
import { ConfirmDialog } from "@/ui/common/Dialog";
import { ErrorOverlay } from "@/ui/common/ErrorOverlay";
import { TreeRow } from "@/ui/common/Tree";
import { TriStateCheck } from "@/ui/common/TriStateCheck";
import { useToast } from "@/ui/common/toast";
import { ConfigWizard } from "@/ui/library/ConfigWizard";

export interface LibraryScreenProps {
  initialConfigure: boolean;
  previewUser?: UserConfig;
}

const EMPTY_COURSES: ModelCourse[] = [];

interface TreeProgressIndicatorProps {
  percent: number;
}

/** 树行尾进度指示器: 左侧圆圈进度环 + 右侧百分比数字 (数字在圆圈旁) */
function TreeProgressIndicator({ percent }: TreeProgressIndicatorProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const radius = 6;
  const stroke = 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <span className="uc-tree__progress" title={`完成度 ${clamped}%`}>
      <svg
        width={16}
        height={16}
        viewBox="0 0 16 16"
        className="uc-tree__progress-ring"
        aria-hidden="true"
      >
        <circle
          cx={8}
          cy={8}
          r={radius}
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth={stroke}
          opacity={0.4}
        />
        <circle
          cx={8}
          cy={8}
          r={radius}
          fill="none"
          stroke={clamped === 100 ? "var(--success)" : "var(--accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 8 8)"
        />
      </svg>
      <span className="uc-tree__progress-text uc-mono">{clamped}%</span>
    </span>
  );
}

type ContentTypeFilter = "all" | "question" | "video" | "document";

type LibraryRow =
  | {
      kind: "course";
      key: string;
      course: ModelCourse;
      pageIds: number[];
      totalPages: number;
      completedPages: number;
      selectedCount: number;
      expanded: boolean;
    }
  | {
      kind: "textbook";
      key: string;
      course: ModelCourse;
      textbook: ModelTextbook;
      pageIds: number[];
      totalPages: number;
      completedPages: number;
      selectedCount: number;
      expanded: boolean;
    }
  | {
      kind: "chapter";
      key: string;
      course: ModelCourse;
      textbook: ModelTextbook;
      chapter: CoursewareChapter;
      pageIds: number[];
      totalPages: number;
      completedPages: number;
      selectedCount: number;
      expanded: boolean;
    }
  | {
      kind: "section";
      key: string;
      course: ModelCourse;
      textbook: ModelTextbook;
      chapter: CoursewareChapter;
      section: CoursewareSection;
      pageIds: number[];
      totalPages: number;
      completedPages: number;
      selectedCount: number;
      expanded: boolean;
    }
  | {
      kind: "page";
      key: string;
      course: ModelCourse;
      textbook: ModelTextbook;
      chapter: CoursewareChapter;
      section: CoursewareSection;
      page: CoursewarePage;
      pageIds: number[];
      totalPages: number;
      completedPages: number;
      selectedCount: number;
    };

const courseKeyOf = (courseId: number): string => `c${courseId}`;
const textbookKeyOf = (courseId: number, textbookId: number): string =>
  `t${courseId}-${textbookId}`;
const chapterKeyOf = (chapterId: number): string => `h${chapterId}`;
const sectionKeyOf = (sectionId: number): string => `s${sectionId}`;

const sectionPageIds = (section: CoursewareSection): number[] =>
  section.pages.map((page) => page.page_id);

const chapterPageIds = (chapter: CoursewareChapter): number[] =>
  chapter.sections.flatMap(sectionPageIds);

const textbookPageIds = (textbook: ModelTextbook): number[] =>
  textbook.chapters.flatMap(chapterPageIds);

const coursePageIds = (course: ModelCourse): number[] =>
  course.textbooks.flatMap(textbookPageIds);

const pageStats = (
  pages: ReadonlyArray<CoursewarePage>,
): { total: number; completed: number } => ({
  total: pages.length,
  completed: pages.filter((page) => page.is_complete).length,
});

const pageMatchesType = (contentType: number, filter: ContentTypeFilter): boolean => {
  if (filter === "all") {
    return true;
  }
  if (filter === "question") {
    return contentType === 7;
  }
  if (filter === "video") {
    return contentType === 6;
  }
  return contentType === 5 || contentType === 12;
};

const filterCoursesData = (
  courses: ReadonlyArray<ModelCourse>,
  activeCourseId: number | null,
  query: string,
  incompleteOnly: boolean,
  typeFilter: ContentTypeFilter,
): ModelCourse[] => {
  const keyword = query.trim().toLowerCase();
  const base =
    activeCourseId === null
      ? courses
      : courses.filter((c) => c.course_id === activeCourseId);

  if (keyword === "" && !incompleteOnly && typeFilter === "all") {
    return [...base];
  }

  const result: ModelCourse[] = [];
  for (const course of base) {
    const courseHit = keyword !== "" && course.course_name.toLowerCase().includes(keyword);
    const textbooks: ModelTextbook[] = [];

    for (const textbook of course.textbooks) {
      const textbookHit =
        courseHit ||
        (keyword !== "" && textbook.textbook_name.toLowerCase().includes(keyword));
      const chapters: CoursewareChapter[] = [];

      for (const chapter of textbook.chapters) {
        const chapterHit =
          textbookHit ||
          (keyword !== "" && chapter.chapter_name.toLowerCase().includes(keyword));
        const sections: CoursewareSection[] = [];

        for (const section of chapter.sections) {
          const sectionHit =
            chapterHit ||
            (keyword !== "" && section.section_name.toLowerCase().includes(keyword));

          const pages = section.pages.filter((page) => {
            if (incompleteOnly && page.is_complete) {
              return false;
            }
            if (!pageMatchesType(page.page_content_type, typeFilter)) {
              return false;
            }
            return (
              keyword === "" ||
              sectionHit ||
              page.page_name.toLowerCase().includes(keyword)
            );
          });

          if (pages.length > 0) {
            sections.push({ ...section, pages });
          }
        }

        if (sections.length > 0) {
          chapters.push({ ...chapter, sections });
        }
      }

      if (chapters.length > 0) {
        textbooks.push({ ...textbook, chapters });
      }
    }

    if (textbooks.length > 0) {
      result.push({ ...course, textbooks });
    }
  }

  return result;
};

const pageType = (
  contentType: number,
): { label: string; icon: typeof IconVideo } => {
  if (contentType === 6) {
    return { label: "视听视频", icon: IconVideo };
  }
  if (contentType === 7) {
    return { label: "测验题目", icon: IconHelpCircle };
  }
  if (contentType === 5) {
    return { label: "文档资料", icon: IconFileText };
  }
  if (contentType === 12) {
    return { label: "富文本导学", icon: IconListDetails };
  }
  return { label: "学习单元", icon: IconFileText };
};

const targetLabel = (target: CoursewareTarget): string => {
  switch (target.kind) {
    case "course":
      return "删除课程";
    case "textbook":
      return "删除教材";
    case "chapter":
      return "删除章";
    case "section":
      return "删除节";
    case "page":
      return "删除页面";
  }
};

const targetSummary = (target: CoursewareTarget, count: number): string => {
  const suffix = count > 0 ? `，连同其中 ${count} 个页面` : "";
  switch (target.kind) {
    case "course":
      return `整门课程${suffix}都会从本地课件库移除。`;
    case "textbook":
      return `整个教材${suffix}都会从本地课件库移除。`;
    case "chapter":
      return `整章${suffix}都会从本地课件库移除。`;
    case "section":
      return `整节${suffix}都会从本地课件库移除。`;
    case "page":
      return "这个页面会从本地课件库移除。";
  }
};

/** 课件库一级工作台页面: 双栏导航联动、五层深度树编辑、状态同步与批量管理 */
export function LibraryScreen({
  initialConfigure,
  previewUser,
}: LibraryScreenProps) {
  const storeUser = useConfigStore(selectActiveUser);
  const activeUser = storeUser ?? previewUser ?? null;
  const customSites = useConfigStore((state) => state.config.custom_sites);
  const replaceCourseware = useConfigStore((state) => state.replaceCourseware);
  const removePages = useConfigStore((state) => state.removePages);
  const removeCourseware = useConfigStore((state) => state.removeCourseware);
  const phase = useRunStore((state) => state.phase);
  const forgetPageIds = useRunStore((state) => state.forgetPageIds);
  const ports = usePorts();
  const toast = useToast();
  const courses = activeUser?.courses ?? EMPTY_COURSES;

  const [wizardOpen, setWizardOpen] = useState(
    initialConfigure && storeUser !== null,
  );
  const [requestedCourseId, setActiveCourseId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<ContentTypeFilter>("all");

  const [collapsedCourses, setCollapsedCourses] = useState<Set<number>>(() => new Set());
  const [userExpandedNodes, setUserExpandedNodes] = useState<Set<string> | null>(null);
  const [selectedPageState, setSelectedPages] = useState<Set<number>>(() => new Set());

  const defaultExpandedNodes = useMemo(() => {
    const initial = new Set<string>();
    for (const course of courses) {
      for (const tb of course.textbooks) {
        initial.add(textbookKeyOf(course.course_id, tb.textbook_id));
      }
    }
    return initial;
  }, [courses]);

  const expandedNodes = userExpandedNodes ?? defaultExpandedNodes;

  const [pruneOpen, setPruneOpen] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [pruneError, setPruneError] = useState<AppErrorDetail | null>(null);
  const [deletePagesOpen, setDeletePagesOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    target: CoursewareTarget;
    label: string;
    summary: string;
  } | null>(null);

  // 当前课程与勾选页面始终按当前课件树计算, 课件被删除或外部更新后直接失效
  const allPageIds = useMemo(() => new Set(courses.flatMap(coursePageIds)), [courses]);
  const activeCourseId = resolveActiveCourseId(courses, requestedCourseId);
  const selectedPages = useMemo(() => {    const result = new Set<number>();
    for (const pageId of selectedPageState) {
      if (allPageIds.has(pageId)) {
        result.add(pageId);
      }
    }
    return result;
  }, [allPageIds, selectedPageState]);

  const visibleCourses = useMemo(
    () => filterCoursesData(courses, activeCourseId, query, incompleteOnly, typeFilter),
    [courses, activeCourseId, query, incompleteOnly, typeFilter],
  );

  const filtering = query.trim() !== "" || incompleteOnly || typeFilter !== "all";

  const rows = useMemo(() => {
    const result: LibraryRow[] = [];
    for (const course of visibleCourses) {
      const courseIds = coursePageIds(course);
      const courseStats = pageStats(
        course.textbooks.flatMap((textbook) =>
          textbook.chapters.flatMap((chapter) =>
            chapter.sections.flatMap((section) => section.pages),
          ),
        ),
      );
      const courseExpanded = filtering || !collapsedCourses.has(course.course_id);
      const selectedCount = courseIds.filter((id) => selectedPages.has(id)).length;

      result.push({
        kind: "course",
        key: courseKeyOf(course.course_id),
        course,
        pageIds: courseIds,
        totalPages: courseStats.total,
        completedPages: courseStats.completed,
        selectedCount,
        expanded: courseExpanded,
      });

      if (!courseExpanded) {
        continue;
      }

      for (const textbook of course.textbooks) {
        const key = textbookKeyOf(course.course_id, textbook.textbook_id);
        const textbookIds = textbookPageIds(textbook);
        const stats = pageStats(
          textbook.chapters.flatMap((chapter) =>
            chapter.sections.flatMap((section) => section.pages),
          ),
        );
        const expanded = filtering || expandedNodes.has(key);
        const selectedCount = textbookIds.filter((id) => selectedPages.has(id)).length;

        result.push({
          kind: "textbook",
          key,
          course,
          textbook,
          pageIds: textbookIds,
          totalPages: stats.total,
          completedPages: stats.completed,
          selectedCount,
          expanded,
        });

        if (!expanded) {
          continue;
        }

        for (const chapter of textbook.chapters) {
          const chapterKey = chapterKeyOf(chapter.chapter_id);
          const chapterIds = chapterPageIds(chapter);
          const stats = pageStats(
            chapter.sections.flatMap((section) => section.pages),
          );
          const chapterExpanded = filtering || expandedNodes.has(chapterKey);
          const selectedCount = chapterIds.filter((id) => selectedPages.has(id)).length;

          result.push({
            kind: "chapter",
            key: chapterKey,
            course,
            textbook,
            chapter,
            pageIds: chapterIds,
            totalPages: stats.total,
            completedPages: stats.completed,
            selectedCount,
            expanded: chapterExpanded,
          });

          if (!chapterExpanded) {
            continue;
          }

          for (const section of chapter.sections) {
            const sectionKey = sectionKeyOf(section.section_id);
            const sectionIds = sectionPageIds(section);
            const stats = pageStats(section.pages);
            const sectionExpanded = filtering || expandedNodes.has(sectionKey);
            const selectedCount = sectionIds.filter((id) => selectedPages.has(id)).length;

            result.push({
              kind: "section",
              key: sectionKey,
              course,
              textbook,
              chapter,
              section,
              pageIds: sectionIds,
              totalPages: stats.total,
              completedPages: stats.completed,
              selectedCount,
              expanded: sectionExpanded,
            });

            if (!sectionExpanded) {
              continue;
            }

            for (const page of section.pages) {
              result.push({
                kind: "page",
                key: `p${page.page_id}`,
                course,
                textbook,
                chapter,
                section,
                page,
                pageIds: [page.page_id],
                totalPages: 1,
                completedPages: page.is_complete ? 1 : 0,
                selectedCount: selectedPages.has(page.page_id) ? 1 : 0,
              });
            }
          }
        }
      }
    }
    return result;
  }, [
    collapsedCourses,
    expandedNodes,
    filtering,
    selectedPages,
    visibleCourses,
  ]);

  if (activeUser === null) {
    throw new Error("课件库需要活跃账号");
  }

  const site = findSite(activeUser.site, customSites);
  const summary = summarizeCourseware(courses);
  const runBusy = phase === "running" || phase === "stopping";
  const selectedCount = selectedPages.size;

  const activeCourse = useMemo(
    () =>
      activeCourseId === null
        ? null
        : courses.find((c) => c.course_id === activeCourseId) ?? null,
    [courses, activeCourseId],
  );

  const activeStats = useMemo(() => {
    if (activeCourse === null) {
      return {
        courseCount: summary.courseCount,
        textbookCount: summary.textbookCount,
        sectionCount: summary.sectionCount,
        remainingPages: summary.remainingPages,
        completedPages: summary.completedPages,
        totalPages: summary.pageCount,
        percent: summary.percent,
      };
    }
    const pages = activeCourse.textbooks.flatMap((t) =>
      t.chapters.flatMap((ch) => ch.sections.flatMap((s) => s.pages)),
    );
    const sectionCount = activeCourse.textbooks.reduce(
      (acc, t) =>
        acc + t.chapters.reduce((cAcc, ch) => cAcc + ch.sections.length, 0),
      0,
    );
    const completed = pages.filter((p) => p.is_complete).length;
    const total = pages.length;
    return {
      courseCount: 1,
      textbookCount: activeCourse.textbooks.length,
      sectionCount,
      remainingPages: total - completed,
      completedPages: completed,
      totalPages: total,
      percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  }, [activeCourse, summary]);

  const togglePages = (pageIds: number[], next: boolean): void => {
    if (runBusy) {
      return;
    }
    setSelectedPages((current) => {
      const result = new Set(current);
      for (const id of pageIds) {
        if (next) {
          result.add(id);
        } else {
          result.delete(id);
        }
      }
      return result;
    });
  };

  const toggleNode = (key: string): void => {
    setUserExpandedNodes((current) => {
      const next = new Set(current ?? defaultExpandedNodes);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleCourse = (courseId: number): void => {
    setCollapsedCourses((current) => {
      const next = new Set(current);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  };

  const expandAll = (): void => {
    const nodes = new Set<string>();
    for (const course of visibleCourses) {
      for (const textbook of course.textbooks) {
        nodes.add(textbookKeyOf(course.course_id, textbook.textbook_id));
        for (const chapter of textbook.chapters) {
          nodes.add(chapterKeyOf(chapter.chapter_id));
          for (const section of chapter.sections) {
            nodes.add(sectionKeyOf(section.section_id));
          }
        }
      }
    }
    setCollapsedCourses(new Set());
    setUserExpandedNodes(nodes);
  };

  const collapseAll = (): void => {
    setCollapsedCourses(new Set(visibleCourses.map((c) => c.course_id)));
    setUserExpandedNodes(new Set());
  };

  const openWizard = (): void => {
    if (storeUser === null) {
      return;
    }
    setWizardOpen(true);
  };

  const closeWizard = (): void => {
    setWizardOpen(false);
    if (initialConfigure) {
      navigate("library");
    }
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
        setSelectedPages(new Set());
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
        setSelectedPages(new Set());
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

  const handleDeleteSelected = (): void => {
    if (runBusy || storeUser === null) {
      return;
    }
    const pageIds = [...selectedPages];
    if (!removePages(pageIds)) {
      toast.push({ title: "删除没有写入，请刷新页面后重试", tone: "error" });
      return;
    }
    forgetPageIds(pageIds);
    toast.push({ title: `已删除 ${selectedCount} 个页面`, tone: "success" });
    setSelectedPages(new Set());
    setDeletePagesOpen(false);
  };

  const handleDeleteTarget = (): void => {
    if (deleteTarget === null || runBusy || storeUser === null) {
      return;
    }
    const pageIds = pageIdsForTarget(courses, deleteTarget.target);
    if (!removeCourseware(deleteTarget.target)) {
      toast.push({ title: "删除没有写入，请刷新页面后重试", tone: "error" });
      return;
    }
    forgetPageIds(pageIds);
    if (deleteTarget.target.kind === "course" && deleteTarget.target.courseId === requestedCourseId) {
      setActiveCourseId(null);
    }
    toast.push({ title: "课件已删除", tone: "success" });
    setDeleteTarget(null);
    setSelectedPages(new Set());
  };

  const openDeleteTarget = (target: CoursewareTarget): void => {
    if (runBusy) {
      return;
    }
    setDeleteTarget({
      target,
      label: targetLabel(target),
      summary: targetSummary(target, countPagesForTarget(courses, target)),
    });
  };

  const renderRow = (row: LibraryRow) => {
    const checked = row.totalPages > 0 && row.selectedCount === row.totalPages;
    const indeterminate = row.selectedCount > 0 && row.selectedCount < row.totalPages;

    if (row.kind === "page") {
      const type = pageType(row.page.page_content_type);
      const TypeIcon = type.icon;
      return (
        <TreeRow
          key={row.key}
          depth={4}
          tone="page"
          title={row.page.page_name}
          meta={`${type.label} · ${row.page.elements.length} 个元素`}
          state={row.page.is_complete ? "done" : "pending"}
          leading={
            <TriStateCheck
              checked={checked}
              disabled={runBusy}
              onToggle={(next) => {
                togglePages([row.page.page_id], next);
              }}
              label={`选择页面 ${row.page.page_name}`}
            />
          }
          icon={<TypeIcon size={14} />}
          trailing={
            <>
              <span
                className={`uc-page-state ${row.page.is_complete ? "is-complete" : ""}`}
              >
                {row.page.is_complete ? (
                  <IconCircleCheck size={14} />
                ) : (
                  <IconCircleDashed size={14} />
                )}
                <span>{row.page.is_complete ? "已完成" : "待完成"}</span>
              </span>
              <button
                type="button"
                className="uc-icon-btn uc-icon-btn--sm uc-tree-delete"
                aria-label={`删除页面 ${row.page.page_name}`}
                title="删除此页面"
                disabled={runBusy}
                onClick={() => {
                  openDeleteTarget({ kind: "page", pageId: row.page.page_id });
                }}
              >
                <IconTrash size={14} />
              </button>
            </>
          }
        />
      );
    }

    const percent =
      row.totalPages === 0
        ? 0
        : Math.round((row.completedPages / row.totalPages) * 100);

    const target: CoursewareTarget =
      row.kind === "course"
        ? { kind: "course", courseId: row.course.course_id }
        : row.kind === "textbook"
          ? {
              kind: "textbook",
              courseId: row.course.course_id,
              textbookId: row.textbook.textbook_id,
            }
          : row.kind === "chapter"
            ? {
                kind: "chapter",
                courseId: row.course.course_id,
                textbookId: row.textbook.textbook_id,
                chapterId: row.chapter.chapter_id,
              }
            : {
                kind: "section",
                courseId: row.course.course_id,
                textbookId: row.textbook.textbook_id,
                chapterId: row.chapter.chapter_id,
                sectionId: row.section.section_id,
              };

    const title =
      row.kind === "course"
        ? row.course.course_name
        : row.kind === "textbook"
          ? row.textbook.textbook_name
          : row.kind === "chapter"
            ? row.chapter.chapter_name
            : row.section.section_name;

    const tone = row.kind;
    const meta =
      row.kind === "course"
        ? `${row.course.textbooks.length} 本教材 · ${row.totalPages} 页`
        : row.kind === "textbook"
          ? `${row.textbook.chapters.length} 章 · ${row.completedPages}/${row.totalPages} 页`
          : row.kind === "chapter"
            ? `${row.chapter.sections.length} 节 · ${row.totalPages} 页`
            : `${row.totalPages} 页 · ${row.selectedCount} 已选`;

    return (
      <TreeRow
        key={row.key}
        depth={
          row.kind === "course"
            ? 0
            : row.kind === "textbook"
              ? 1
              : row.kind === "chapter"
                ? 2
                : 3
        }
        tone={tone}
        title={title}
        meta={meta}
        expanded={row.expanded}
        onToggle={() => {
          if (row.kind === "course") {
            toggleCourse(row.course.course_id);
          } else {
            toggleNode(row.key);
          }
        }}
        leading={
          <TriStateCheck
            checked={checked}
            indeterminate={indeterminate}
            disabled={runBusy}
            onToggle={(next) => {
              togglePages(row.pageIds, next);
            }}
            label={`选择${row.kind === "course" ? "课程" : row.kind === "textbook" ? "教材" : row.kind === "chapter" ? "章" : "节"} ${title}`}
          />
        }
        trailing={
          <>
            <TreeProgressIndicator percent={percent} />
            <button
              type="button"
              className="uc-icon-btn uc-icon-btn--sm uc-tree-delete"
              aria-label={`${targetLabel(target)} ${title}`}
              title={targetLabel(target)}
              disabled={runBusy}
              onClick={() => {
                openDeleteTarget(target);
              }}
            >
              <IconTrash size={14} />
            </button>
          </>
        }
      />
    );
  };

  return (
    <div className="uc-page uc-library-page">
      {courses.length === 0 ? (
        /* 空状态大卡片 (与工作台卡片风格一致) */
        <section className="uc-card uc-empty-state">
          <div className="uc-empty-state__art" aria-hidden="true">
            <span className="uc-empty-state__ring" />
            <span className="uc-empty-state__ring uc-empty-state__ring--inner" />
            <span className="uc-empty-state__icon">
              <IconBooks size={36} stroke={1.5} />
            </span>
          </div>
          <span className="uc-eyebrow">快速开始</span>
          <h2>课件库尚未添加学习任务</h2>
          <p>
            启动配置向导选择课程与对应教材，工作台将自动解析章节目录、核验真实完成状态并补全题目答案。
          </p>
          <div className="uc-empty-state__actions">
            <Button
              variant="primary"
              size="lg"
              icon={<IconAdjustmentsHorizontal size={18} />}
              disabled={runBusy}
              onClick={openWizard}
            >
              配置第一份课件
            </Button>
          </div>
        </section>
      ) : (
        /* 双卡片自适应工作区: 顶栏以下直接占满整个视口，与工作台首页风格完全统一 */
        <div className="uc-library-grid">
          {/* 左栏卡片: 课程目录选择 */}
          <section className="uc-card uc-library-nav" aria-label="课程分类导航">
            <header className="uc-card__top uc-library-nav__head">
              <div className="uc-card__label">
                <span className="uc-card__icon">
                  <IconFolder size={16} />
                </span>
                <span>课程目录</span>
              </div>
              <span className="uc-badge">{courses.length} 门</span>
            </header>

            <div className="uc-library-nav__list">
              {/* 全部课件汇总项 (无多余箭头，排布结构与下方课程卡片完全统一) */}
              <div
                className={`uc-nav-card ${activeCourseId === null ? "is-active" : ""}`}
              >
                <button
                  type="button"
                  className="uc-nav-card__btn"
                  onClick={() => {
                    setActiveCourseId(null);
                  }}
                >
                  <div className="uc-nav-card__top">
                    <strong className="uc-nav-card__title">全部课件汇总</strong>
                    <span className="uc-nav-card__pct uc-mono">{summary.percent}%</span>
                  </div>
                  <div className="uc-nav-card__meta">
                    <span>{summary.courseCount} 门课程</span>
                    <span>{summary.textbookCount} 本教材</span>
                    <span>{summary.pageCount} 个页面</span>
                  </div>
                  <div className="uc-nav-card__bar">
                    <span style={{ width: `${summary.percent}%` }} />
                  </div>
                </button>
              </div>

              {courses.map((course) => {
                const stats = pageStats(
                  course.textbooks.flatMap((t) =>
                    t.chapters.flatMap((ch) => ch.sections.flatMap((s) => s.pages)),
                  ),
                );
                const pct =
                  stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100);
                const isSelected = activeCourseId === course.course_id;

                return (
                  <div
                    className={`uc-nav-card ${isSelected ? "is-active" : ""}`}
                    key={course.course_id}
                  >
                    <button
                      type="button"
                      className="uc-nav-card__btn"
                      onClick={() => {
                        setActiveCourseId(course.course_id);
                      }}
                    >
                      <div className="uc-nav-card__top">
                        <strong className="uc-nav-card__title">
                          {course.course_name}
                        </strong>
                        <span className="uc-nav-card__pct uc-mono">{pct}%</span>
                      </div>
                      <div className="uc-nav-card__meta">
                        {course.teacher_name && <span>{course.teacher_name}</span>}
                        {course.class_name && <span>{course.class_name}</span>}
                        <span>{course.textbooks.length} 本教材</span>
                      </div>
                      <div className="uc-nav-card__bar">
                        <span style={{ width: `${pct}%` }} />
                      </div>
                    </button>

                    <button
                      type="button"
                      className="uc-nav-card__del"
                      aria-label={`移除整门课程 ${course.course_name}`}
                      title="从课件库移除课程"
                      disabled={runBusy}
                      onClick={() => {
                        openDeleteTarget({ kind: "course", courseId: course.course_id });
                      }}
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 右栏卡片: 课件树主工作区 */}
          <main className="uc-card uc-library-main-card" aria-label="课件结构树与编辑工具">
            {/* 卡头: 整合标题、内联统计胶囊与全局动作 */}
            <header className="uc-card__top uc-library-head">
              <div className="uc-library-head__main">
                <div className="uc-card__label">
                  <span className="uc-card__icon">
                    <IconBooks size={16} />
                  </span>
                  <strong className="uc-library-head__title">
                    {activeCourse ? activeCourse.course_name : "全部课件"}
                  </strong>
                </div>

                {/* 紧凑内联指标胶囊组 (替代外侧漂浮的粗大指标方块) */}
                <div className="uc-library-capsules" aria-label="课件统计指标">
                  <span className="uc-capsule">
                    <IconBooks size={13} />
                    <span>
                      <b>
                        <AnimatedNumber value={activeStats.courseCount} />
                      </b>{" "}
                      课程
                    </span>
                  </span>
                  <span className="uc-capsule">
                    <IconBook2 size={13} />
                    <span>
                      <b>
                        <AnimatedNumber value={activeStats.textbookCount} />
                      </b>{" "}
                      教材
                    </span>
                  </span>
                  <span className="uc-capsule">
                    <IconFolder size={13} />
                    <span>
                      <b>
                        <AnimatedNumber value={activeStats.sectionCount} />
                      </b>{" "}
                      小节
                    </span>
                  </span>
                  <span className="uc-capsule uc-capsule--accent">
                    <IconFileText size={13} />
                    <span>
                      <b>
                        <AnimatedNumber value={activeStats.remainingPages} />
                      </b>{" "}
                      待完成
                    </span>
                  </span>
                  <div className="uc-capsule uc-capsule--progress">
                    <div className="uc-capsule__track">
                      <span style={{ width: `${activeStats.percent}%` }} />
                    </div>
                    <span className="uc-mono uc-capsule__pct">
                      <AnimatedNumber value={activeStats.percent} />%
                    </span>
                  </div>
                </div>
              </div>

              <div className="uc-library-head__actions">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<IconRefresh size={15} />}
                  loading={pruning}
                  disabled={runBusy || courses.length === 0}
                  onClick={() => {
                    setPruneOpen(true);
                  }}
                >
                  同步状态
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<IconAdjustmentsHorizontal size={15} />}
                  disabled={runBusy}
                  onClick={openWizard}
                >
                  新增课件
                </Button>
              </div>
            </header>

            {/* 卡内多维操作工具条 */}
            <div className="uc-library-toolbar">
              <div className="uc-library-toolbar__search">
                <div className="uc-search">
                  <IconSearch size={15} />
                  <input
                    type="search"
                    placeholder="搜索小节或页面名称…"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.currentTarget.value);
                    }}
                  />
                  {query !== "" && (
                    <button
                      type="button"
                      aria-label="清空搜索"
                      onClick={() => {
                        setQuery("");
                      }}
                    >
                      <IconX size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="uc-library-toolbar__filters">
                <button
                  type="button"
                  className={`uc-filter-pill ${incompleteOnly ? "is-active" : ""}`}
                  aria-pressed={incompleteOnly}
                  onClick={() => {
                    setIncompleteOnly((prev) => !prev);
                  }}
                >
                  <IconFilter size={13} />
                  <span>仅看未完成</span>
                </button>

                <div className="uc-type-pills" role="radiogroup" aria-label="题型筛选">
                  <button
                    type="button"
                    className={`uc-pill ${typeFilter === "all" ? "is-active" : ""}`}
                    onClick={() => {
                      setTypeFilter("all");
                    }}
                  >
                    全部
                  </button>
                  <button
                    type="button"
                    className={`uc-pill ${typeFilter === "question" ? "is-active" : ""}`}
                    onClick={() => {
                      setTypeFilter("question");
                    }}
                  >
                    题目
                  </button>
                  <button
                    type="button"
                    className={`uc-pill ${typeFilter === "video" ? "is-active" : ""}`}
                    onClick={() => {
                      setTypeFilter("video");
                    }}
                  >
                    视频
                  </button>
                  <button
                    type="button"
                    className={`uc-pill ${typeFilter === "document" ? "is-active" : ""}`}
                    onClick={() => {
                      setTypeFilter("document");
                    }}
                  >
                    文档
                  </button>
                </div>

                <div className="uc-library-toolbar__actions">
                  <button type="button" className="uc-text-link" onClick={expandAll}>
                    展开全部
                  </button>
                  <span className="uc-tool-sep">·</span>
                  <button type="button" className="uc-text-link" onClick={collapseAll}>
                    收起全部
                  </button>
                  <span className="uc-tool-sep">·</span>
                  <button
                    type="button"
                    className="uc-text-link"
                    disabled={selectedCount === 0}
                    onClick={() => {
                      setSelectedPages(new Set());
                    }}
                  >
                    清空选择
                  </button>
                </div>
              </div>
            </div>

            {/* 虚拟化五层长列表 */}
            <div className="uc-library__scroll">
              {rows.length === 0 ? (
                <div className="uc-state-block">
                  <span className="uc-state-block__icon">
                    <IconSearch size={24} />
                  </span>
                  <strong>未找到匹配的学习单元</strong>
                  <p>请尝试调整搜索关键词，或重置筛选条件。</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setQuery("");
                      setIncompleteOnly(false);
                      setTypeFilter("all");
                    }}
                  >
                    清空筛选条件
                  </Button>
                </div>
              ) : (
                <VList data={rows} className="uc-library__list">
                  {renderRow}
                </VList>
              )}
            </div>

            {/* 批量多选浮动操作胶囊 (绝对定位悬浮于底部中央，不占用文档流高度) */}
            <AnimatePresence initial={false}>
              {selectedCount > 0 && (
                <motion.div
                  className="uc-selection-bar"
                  initial={{ opacity: 0, y: 16, x: "-50%" }}
                  animate={{ opacity: 1, y: 0, x: "-50%" }}
                  exit={{ opacity: 0, y: 16, x: "-50%" }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="uc-selection-bar__lead">
                    <span className="uc-selection-bar__check">
                      <IconCheck size={14} stroke={3} />
                    </span>
                    <span>
                      <span className="uc-selection-bar__lead-label">已选中</span>{" "}
                      <strong className="uc-mono">{selectedCount}</strong>{" "}
                      <span className="uc-selection-bar__lead-unit">个页面</span>
                    </span>
                  </div>

                  <div className="uc-selection-bar__actions">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedPages(new Set());
                      }}
                    >
                      <span className="uc-selection-bar__btn-full">取消所选</span>
                      <span className="uc-selection-bar__btn-short">取消</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={<IconTrash size={15} />}
                      disabled={runBusy}
                      onClick={() => {
                        setDeletePagesOpen(true);
                      }}
                    >
                      <span className="uc-selection-bar__btn-full">批量删除所选页面</span>
                      <span className="uc-selection-bar__btn-short">删除所选</span>
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      )}

      {/* 配置向导弹窗 */}
      {site !== null && wizardOpen && (
        <ConfigWizard
          onClose={closeWizard}
          site={site}
          token={activeUser.token}
        />
      )}

      {/* 同步学习状态对话框 */}
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

      {/* 批量删除所选页面对话框 */}
      <ConfirmDialog
        open={deletePagesOpen}
        onClose={() => {
          setDeletePagesOpen(false);
        }}
        onConfirm={handleDeleteSelected}
        title="删除所选页面"
        danger
        confirmText="确认删除"
      >
        确认从课件库中移除已勾选的 {selectedCount} 个页面？若移除导致节、章或教材为空，系统将自动一并清理。此操作不可逆。
      </ConfirmDialog>

      {/* 删除单个节点对话框 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => {
          setDeleteTarget(null);
        }}
        onConfirm={handleDeleteTarget}
        title={deleteTarget?.label ?? "删除课件节点"}
        danger
        confirmText="确认删除"
      >
        {deleteTarget?.summary} 此操作不可逆。
      </ConfirmDialog>
    </div>
  );
}
