import type { ModelCourse } from "@/schema/domain/course";
import type { CoursewarePage } from "@/schema/domain/courseware";
import type { RunProgress } from "@/schema/domain/progress";

/** 首页课件库树的节点类型 */
export type LibraryTreeKind = "course" | "textbook" | "chapter" | "section" | "page";

/** 节点状态: 已完成、当前路径、当前节点、尚未开始 */
export type LibraryTreeState = "done" | "path" | "current" | "pending";

export interface LibraryTreeRow {
  id: string;
  kind: LibraryTreeKind;
  depth: 0 | 1 | 2 | 3 | 4;
  title: string;
  meta: string;
  /** 后代页面完成度, 0 到 100 */
  percent: number;
  state: LibraryTreeState;
  complete: boolean;
  expandable: boolean;
  expanded: boolean;
  /** 该节点下属的所有页面 ID */
  pageIds: number[];
  /** 下属页面中已被选中的数量 */
  selectedCount: number;
  /** 下属页面总数 */
  totalPages: number;
}

export interface LibraryTree {
  rows: LibraryTreeRow[];
  /** 当前节点在 rows 中的下标, 没有匹配时为 -1 */
  currentRowIndex: number;
}

interface Count {
  total: number;
  done: number;
}

const statsOfPages = (pages: ReadonlyArray<CoursewarePage>): Count => ({
  total: pages.length,
  done: pages.filter((page) => page.is_complete).length,
});

const addCounts = (left: Count, right: Count): Count => ({
  total: left.total + right.total,
  done: left.done + right.done,
});

const percentOf = (done: number, total: number): number =>
  total === 0 ? 0 : Math.round((done / total) * 100);

const isComplete = (count: Count): boolean =>
  count.total > 0 && count.done === count.total;

/**
 * 首页课件库树的展开规则:
 * 当前刷课进行到的路径节点自动展开, 离开该路径后自动折叠;
 * 用户手动点击展开的节点保留展开状态。
 */
export const buildLibraryTree = (
  courses: ReadonlyArray<ModelCourse>,
  progress: RunProgress,
  expandedNodes: ReadonlySet<string>,
  selectedPageIds: ReadonlySet<number> = new Set<number>(),
): LibraryTree => {
  const rows: LibraryTreeRow[] = [];
  let currentRowIndex = -1;

  const push = (
    row: Omit<LibraryTreeRow, "state">,
    onPath: boolean,
    isCurrent: boolean,
  ): void => {
    if (isCurrent) {
      currentRowIndex = rows.length;
    }
    rows.push({
      ...row,
      state: isCurrent
        ? "current"
        : row.complete
          ? "done"
          : onPath
            ? "path"
            : "pending",
    });
  };

  for (const [courseIndex, course] of courses.entries()) {
    const coursePageIds = course.textbooks.flatMap((textbook) =>
      textbook.chapters.flatMap((chapter) =>
        chapter.sections.flatMap((section) =>
          section.pages.map((page) => page.page_id),
        ),
      ),
    );
    const courseSelectedCount = coursePageIds.filter((id) =>
      selectedPageIds.has(id),
    ).length;
    const courseCount = course.textbooks.reduce<Count>(
      (sum, textbook) =>
        addCounts(
          sum,
          textbook.chapters.reduce<Count>(
            (chapterSum, chapter) =>
              addCounts(
                chapterSum,
                chapter.sections.reduce<Count>(
                  (sectionSum, section) => addCounts(sectionSum, statsOfPages(section.pages)),
                  { total: 0, done: 0 },
                ),
              ),
            { total: 0, done: 0 },
          ),
        ),
      { total: 0, done: 0 },
    );
    const courseId = `c${course.course_id}`;
    const onCoursePath = progress.courseIndex === courseIndex + 1;
    const courseComplete = isComplete(courseCount);
    const courseExpanded = expandedNodes.has(courseId) || onCoursePath;
    push(
      {
        id: courseId,
        kind: "course",
        depth: 0,
        title: course.course_name,
        meta: `${course.textbooks.length} 个教材 · ${courseCount.done}/${courseCount.total} 页`,
        percent: percentOf(courseCount.done, courseCount.total),
        complete: courseComplete,
        expandable: course.textbooks.length > 0,
        expanded: courseExpanded,
        pageIds: coursePageIds,
        selectedCount: courseSelectedCount,
        totalPages: coursePageIds.length,
      },
      onCoursePath,
      false,
    );
    if (!courseExpanded) {
      continue;
    }

    for (const [textbookIndex, textbook] of course.textbooks.entries()) {
      const textbookPageIds = textbook.chapters.flatMap((chapter) =>
        chapter.sections.flatMap((section) =>
          section.pages.map((page) => page.page_id),
        ),
      );
      const textbookSelectedCount = textbookPageIds.filter((id) =>
        selectedPageIds.has(id),
      ).length;
      const textbookCount = textbook.chapters.reduce<Count>(
        (sum, chapter) =>
          addCounts(
            sum,
            chapter.sections.reduce<Count>(
              (sectionSum, section) => addCounts(sectionSum, statsOfPages(section.pages)),
              { total: 0, done: 0 },
            ),
          ),
        { total: 0, done: 0 },
      );
      const textbookId = `${courseId}-t${textbook.textbook_id}`;
      const onTextbookPath =
        onCoursePath && progress.textbookIndex === textbookIndex + 1;
      const textbookComplete = isComplete(textbookCount);
      const textbookExpanded = expandedNodes.has(textbookId) || onTextbookPath;
      push(
        {
          id: textbookId,
          kind: "textbook",
          depth: 1,
          title: textbook.textbook_name,
          meta: `${textbook.chapters.length} 章 · ${textbookCount.done}/${textbookCount.total} 页`,
          percent: percentOf(textbookCount.done, textbookCount.total),
          complete: textbookComplete,
          expandable: textbook.chapters.length > 0,
          expanded: textbookExpanded,
          pageIds: textbookPageIds,
          selectedCount: textbookSelectedCount,
          totalPages: textbookPageIds.length,
        },
        onTextbookPath,
        false,
      );
      if (!textbookExpanded) {
        continue;
      }

      for (const [chapterIndex, chapter] of textbook.chapters.entries()) {
        const chapterPageIds = chapter.sections.flatMap((section) =>
          section.pages.map((page) => page.page_id),
        );
        const chapterSelectedCount = chapterPageIds.filter((id) =>
          selectedPageIds.has(id),
        ).length;
        const chapterCount = chapter.sections.reduce<Count>(
          (sum, section) => addCounts(sum, statsOfPages(section.pages)),
          { total: 0, done: 0 },
        );
        const chapterId = `${textbookId}-h${chapter.chapter_id}`;
        const onChapterPath =
          onTextbookPath && progress.chapterIndex === chapterIndex + 1;
        const chapterComplete = isComplete(chapterCount);
        const chapterExpanded = expandedNodes.has(chapterId) || onChapterPath;
        push(
          {
            id: chapterId,
            kind: "chapter",
            depth: 2,
            title: chapter.chapter_name,
            meta: `${chapter.sections.length} 节 · ${chapterCount.done}/${chapterCount.total} 页`,
            percent: percentOf(chapterCount.done, chapterCount.total),
            complete: chapterComplete,
            expandable: chapter.sections.length > 0,
            expanded: chapterExpanded,
            pageIds: chapterPageIds,
            selectedCount: chapterSelectedCount,
            totalPages: chapterPageIds.length,
          },
          onChapterPath,
          false,
        );
        if (!chapterExpanded) {
          continue;
        }

        for (const [sectionIndex, section] of chapter.sections.entries()) {
          const sectionPageIds = section.pages.map((page) => page.page_id);
          const sectionSelectedCount = sectionPageIds.filter((id) =>
            selectedPageIds.has(id),
          ).length;
          const sectionCount = statsOfPages(section.pages);
          const sectionId = `${chapterId}-s${section.section_id}`;
          const onSectionPath =
            onChapterPath && progress.sectionIndex === sectionIndex + 1;
          const sectionComplete = isComplete(sectionCount);
          const sectionExpanded = expandedNodes.has(sectionId) || onSectionPath;
          push(
            {
              id: sectionId,
              kind: "section",
              depth: 3,
              title: section.section_name,
              meta: `${sectionCount.total} 个页面`,
              percent: percentOf(sectionCount.done, sectionCount.total),
              complete: sectionComplete,
              expandable: section.pages.length > 0,
              expanded: sectionExpanded,
              pageIds: sectionPageIds,
              selectedCount: sectionSelectedCount,
              totalPages: sectionPageIds.length,
            },
            onSectionPath,
            onSectionPath && progress.pageIndex === 0,
          );
          if (!sectionExpanded) {
            continue;
          }

          for (const [pageIndex, page] of section.pages.entries()) {
            const onPagePath =
              onSectionPath && progress.pageIndex === pageIndex + 1;
            push(
              {
                id: `${sectionId}-p${page.page_id}`,
                kind: "page",
                depth: 4,
                title: page.page_name,
                meta: `${page.elements.length} 个元素 · ${page.is_complete ? "已完成" : "待完成"}`,
                percent: page.is_complete ? 100 : 0,
                complete: page.is_complete,
                expandable: false,
                expanded: false,
                pageIds: [page.page_id],
                selectedCount: selectedPageIds.has(page.page_id) ? 1 : 0,
                totalPages: 1,
              },
              onPagePath,
              onPagePath,
            );
          }
        }
      }
    }
  }

  return { rows, currentRowIndex };
};
