import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconBook,
  IconBook2,
  IconBookmark,
  IconCheck,
  IconChevronRight,
  IconRefresh,
  IconSearch,
  IconSparkles,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";

import type { AppErrorDetail } from "@/error/report";
import { createErrorDetail } from "@/error/report";
import type { Site } from "@/schema/domain/site";
import type { ModelCourse } from "@/schema/domain/course";
import type { ConfigProgress } from "@/schema/domain/progress";
import type { StudentCourse } from "@/schema/protocol/courseList";
import { collectPageIds } from "@/logic/courseware/tree";
import { useConfigStore } from "@/state/configStore";
import { useRunStore } from "@/state/runStore";
import {
  configureCourseware,
  listAvailableCourses,
  listCourseTextbooks,
  type CourseTextbookGroup,
} from "@/usecases/configureCourseware";
import { usePorts } from "@/ui/app/ports";
import { Button } from "@/ui/common/Button";
import { Modal } from "@/ui/common/Dialog";
import { ErrorOverlay } from "@/ui/common/ErrorOverlay";
import { ConfigTree } from "@/ui/library/ConfigTree";

export interface ConfigWizardProps {
  /** 配置进行中时不允许关闭, 调用方据此保持弹窗打开 */
  onClose: () => void;
  site: Site;
  token: string;
}

const STEP_LABELS = ["选择课程", "选择教材", "同步课件"] as const;

const textbookKey = (courseId: number, textbookId: number): string =>
  `${courseId}-${textbookId}`;

/** 课件新增向导: 课程选择 → 教材选择 → 抓取章节与答案并追加课件 */
export function ConfigWizard({ onClose, site, token }: ConfigWizardProps) {
  const appendCourseware = useConfigStore((state) => state.appendCourseware);
  const ports = usePorts();

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [courses, setCourses] = useState<StudentCourse[] | null>(null);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<AppErrorDetail | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [errorReport, setErrorReport] = useState<AppErrorDetail | null>(null);
  const [errorHeadline, setErrorHeadline] = useState("配置遇到异常");
  const [courseQuery, setCourseQuery] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<number>>(new Set());
  const [textbookOptions, setTextbookOptions] = useState<CourseTextbookGroup[] | null>(null);
  const [textbookLoading, setTextbookLoading] = useState(false);
  const [textbookError, setTextbookError] = useState<AppErrorDetail | null>(null);
  const [selectedTextbooks, setSelectedTextbooks] = useState<Set<string>>(new Set());
  const [configuring, setConfiguring] = useState(false);
  const [configProgress, setConfigProgress] = useState<ConfigProgress | null>(null);
  const [coursesSnapshot, setCoursesSnapshot] = useState<ReadonlyArray<ModelCourse> | null>(null);
  const [skippedChapterIds, setSkippedChapterIds] = useState<Set<number>>(new Set());
  const [skippedTextbookIds, setSkippedTextbookIds] = useState<Set<number>>(new Set());
  const [configError, setConfigError] = useState<AppErrorDetail | null>(null);
  const [configuredCourses, setConfiguredCourses] = useState<ModelCourse[] | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<CourseTextbookGroup[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      const result = await listAvailableCourses(
        ports.configure({ onConfigProgress: () => {} }),
        site,
        token,
      );
      if (cancelled) {
        return;
      }
      setCoursesLoading(false);
      if (result.status === "failed") {
        setCoursesError(result.error);
        return;
      }
      setCourses(result.data);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, site, token, ports]);

  const reloadCourses = (): void => {
    setCoursesLoading(true);
    setCoursesError(null);
    setErrorReport(null);
    setCourses(null);
    setReloadKey((current) => current + 1);
  };

  const filteredCourses = (courses ?? []).filter((course) => {
    const query = courseQuery.trim().toLowerCase();
    if (query === "") {
      return true;
    }
    return (
      course.name.toLowerCase().includes(query) ||
      course.teacherName.toLowerCase().includes(query) ||
      course.className.toLowerCase().includes(query)
    );
  });

  const toggleCourse = (courseId: number): void => {
    setSelectedCourseIds((current) => {
      const next = new Set(current);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  };

  const selectAllCourses = (): void => {
    setSelectedCourseIds(new Set(filteredCourses.map((c) => c.id)));
  };

  const clearSelectedCourses = (): void => {
    setSelectedCourseIds(new Set());
  };

  const goToTextbooks = async (): Promise<void> => {
    const selected = (courses ?? []).filter((course) =>
      selectedCourseIds.has(course.id),
    );
    if (selected.length === 0) {
      return;
    }
    setStep(1);
    setTextbookLoading(true);
    setTextbookError(null);
    try {
      const result = await listCourseTextbooks(
        ports.configure({ onConfigProgress: () => {} }),
        site,
        token,
        selected,
      );
      if (result.status === "failed") {
        setTextbookOptions([]);
        setSelectedTextbooks(new Set());
        setTextbookError(result.error);
        return;
      }
      setTextbookOptions(result.data);
      // 默认全选获取到的全部教材
      const initialSelected = new Set<string>();
      for (const group of result.data) {
        for (const tb of group.textbooks) {
          initialSelected.add(textbookKey(group.course.id, tb.courseId));
        }
      }
      setSelectedTextbooks(initialSelected);
    } finally {
      setTextbookLoading(false);
    }
  };

  const toggleTextbook = (key: string): void => {
    setSelectedTextbooks((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleGroupTextbooks = (courseId: number, textbooks: { courseId: number }[]): void => {
    const keys = textbooks.map((tb) => textbookKey(courseId, tb.courseId));
    const allSelected = keys.every((key) => selectedTextbooks.has(key));
    setSelectedTextbooks((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (allSelected) {
          next.delete(key);
        } else {
          next.add(key);
        }
      }
      return next;
    });
  };

  const startConfigure = async (
    overrideSkippedChapters?: Set<number>,
    overrideSkippedTextbooks?: Set<number>,
  ): Promise<void> => {
    if (textbookOptions === null) {
      return;
    }
    const selected: CourseTextbookGroup[] = textbookOptions
      .map(({ course, textbooks }) => ({
        course,
        textbooks: textbooks.filter((textbook) =>
          selectedTextbooks.has(textbookKey(course.id, textbook.courseId)),
        ),
      }))
      .filter(({ textbooks }) => textbooks.length > 0);

    if (selected.length === 0) {
      return;
    }

    const currentSkippedChapters = overrideSkippedChapters ?? skippedChapterIds;
    const currentSkippedTextbooks = overrideSkippedTextbooks ?? skippedTextbookIds;

    setStep(2);
    setConfiguring(true);
    setConfigError(null);
    setConfigProgress(null);
    setErrorReport(null);
    setConfiguredCourses(null);
    setSelectedGroups(selected);

    try {
      const result = await configureCourseware(
        ports.configure({
          onConfigProgress: (value, snap) => {
            setConfigProgress(value);
            if (snap !== undefined) {
              setCoursesSnapshot(snap);
            }
          },
        }),
        site,
        token,
        selected,
        {
          skippedChapterIds: currentSkippedChapters,
          skippedTextbookIds: currentSkippedTextbooks,
        },
      );
      if (result.status === "failed") {
        setConfigError(result.error);
        setErrorHeadline("课件同步未能完成");
        return;
      }
      if (!appendCourseware(result.data)) {
        setConfigError(
          createErrorDetail({
            title: "课件没有写入",
            message: "配置已在其他标签页更新，本次同步的课件未保存，请刷新页面后重试。",
          }),
        );
        setErrorHeadline("课件同步没有写入");
        return;
      }
      setConfiguredCourses(result.data);
      const newIncompleteIds = collectPageIds(result.data, true);
      if (newIncompleteIds.length > 0) {
        useRunStore.getState().togglePageIds(newIncompleteIds, true);
      }
    } catch (err) {
      const detail = createErrorDetail({
        title: "课件同步异常中断",
        message: err instanceof Error ? err.message : "同步过程中遭遇异常中断，请重试。",
      });
      setConfigError(detail);
      setErrorHeadline("课件同步异常中断");
    } finally {
      setConfiguring(false);
    }
  };

  const handleSkipTarget = (kind: "chapter" | "textbook", id: number): void => {
    if (kind === "chapter") {
      const next = new Set(skippedChapterIds);
      next.add(id);
      setSkippedChapterIds(next);
      setConfigError(null);
      void startConfigure(next, skippedTextbookIds);
    } else {
      const next = new Set(skippedTextbookIds);
      next.add(id);
      setSkippedTextbookIds(next);
      setConfigError(null);
      void startConfigure(skippedChapterIds, next);
    }
  };

  const closeWizard = (): void => {
    if (configuring) {
      return;
    }
    onClose();
  };

  const openErrorReport = (detail: AppErrorDetail, headline: string): void => {
    setErrorHeadline(headline);
    setErrorReport(detail);
  };

  const selectedTextbookCount =
    textbookOptions?.reduce(
      (sum, group) =>
        sum +
        group.textbooks.filter((textbook) =>
          selectedTextbooks.has(textbookKey(group.course.id, textbook.courseId)),
        ).length,
      0,
    ) ?? 0;

  const courseCount = selectedCourseIds.size;

  const skipTarget =
    configError !== null &&
    configError.targetId !== undefined &&
    (configError.targetKind === "chapter" || configError.targetKind === "textbook")
      ? { kind: configError.targetKind, id: configError.targetId }
      : null;

  const stepFooter =
    step === 0 ? (
      <div className="uc-wizard__footer-actions">
        <Button variant="ghost" size="sm" onClick={closeWizard}>
          取消
        </Button>
        <Button
          variant="primary"
          size="sm"
          trailing={<IconArrowRight size={16} />}
          disabled={courseCount === 0 || coursesLoading}
          onClick={() => {
            void goToTextbooks();
          }}
        >
          <span className="uc-btn-text--full">下一步 · 已选 {courseCount} 门课程</span>
          <span className="uc-btn-text--short">下一步 ({courseCount})</span>
        </Button>
      </div>
    ) : step === 1 ? (
      <div className="uc-wizard__footer-actions">
        <Button
          variant="ghost"
          size="sm"
          icon={<IconArrowLeft size={16} />}
          onClick={() => {
            setStep(0);
          }}
          disabled={textbookLoading}
        >
          <span className="uc-btn-text--full">返回选择课程</span>
          <span className="uc-btn-text--short">返回课程</span>
        </Button>
        <Button
          variant="primary"
          size="sm"
          trailing={<IconArrowRight size={16} />}
          disabled={selectedTextbookCount === 0 || textbookLoading}
          onClick={() => {
            void startConfigure();
          }}
        >
          <span className="uc-btn-text--full">开始同步 · 已选 {selectedTextbookCount} 本教材</span>
          <span className="uc-btn-text--short">开始同步 ({selectedTextbookCount})</span>
        </Button>
      </div>
    ) : (
      <>
        {configuring ? (
          <span className="uc-wizard__running-note">
            <span className="uc-spinner" />
            正在解析课件与记录，请勿关闭页面…
          </span>
        ) : configError !== null ? (
          <div className="uc-wizard__footer-actions">
            <Button
              variant="ghost"
              icon={<IconArrowLeft size={16} />}
              onClick={() => {
                setStep(1);
              }}
            >
              修改教材选择
            </Button>
            <Button
              variant="secondary"
              icon={<IconRefresh size={16} />}
              onClick={() => {
                void startConfigure();
              }}
            >
              重新尝试
            </Button>
            {skipTarget !== null && (
              <Button
                variant="primary"
                onClick={() => {
                  handleSkipTarget(skipTarget.kind, skipTarget.id);
                }}
              >
                跳过此项继续同步
              </Button>
            )}
          </div>
        ) : configuredCourses !== null ? (
          <Button
            variant="primary"
            icon={<IconSparkles size={16} />}
            onClick={closeWizard}
          >
            完成并进入工作台
          </Button>
        ) : (
          <div className="uc-wizard__footer-actions">
            <Button variant="ghost" onClick={closeWizard}>
              取消
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void startConfigure();
              }}
            >
              重新开始同步
            </Button>
          </div>
        )}
      </>
    );

  return (
    <>
      <Modal
        open
        onClose={closeWizard}
        size="xl"
        className="uc-wizard"
        dismissible={!configuring}
        title="新增课件向导"
        description="选择需要学习的课程与教材，自动拉取章节结构并追加到课件库中，原课件保持保留。"
        footer={stepFooter}
      >
        {/* 顶部步骤导航条 */}
        <div className="uc-wizard__steps" aria-label="向导配置阶段">
          {STEP_LABELS.map((label, index) => (
            <div
              key={label}
              className={`uc-wizard__step ${index === step ? "is-current" : ""} ${index < step ? "is-done" : ""}`}
            >
              <span className="uc-wizard__step-index">
                {index < step ? <IconCheck size={13} stroke={3} /> : index + 1}
              </span>
              <span className="uc-wizard__step-title">{label}</span>
              {index < STEP_LABELS.length - 1 && (
                <span className="uc-wizard__step-line" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>

        {/* 步骤 1: 选择课程 */}
        {step === 0 && (
          <div className="uc-wizard__panel">
            <div className="uc-wizard__toolbar">
              <div className="uc-search">
                <IconSearch size={16} />
                <input
                  type="search"
                  placeholder="按课程名、教师或班级搜索…"
                  value={courseQuery}
                  onChange={(event) => {
                    setCourseQuery(event.currentTarget.value);
                  }}
                />
              </div>
              <div className="uc-wizard__toolbar-actions">
                <button
                  type="button"
                  className="uc-text-link"
                  disabled={courses === null || filteredCourses.length === 0}
                  onClick={selectAllCourses}
                >
                  全选当前搜索
                </button>
                <span className="uc-wizard__sep">·</span>
                <button
                  type="button"
                  className="uc-text-link"
                  disabled={selectedCourseIds.size === 0}
                  onClick={clearSelectedCourses}
                >
                  清空已选
                </button>
              </div>
            </div>

            {coursesLoading ? (
              <div className="uc-skeleton-list" aria-label="正在获取课程列表">
                {[0, 1, 2, 3].map((item) => (
                  <div className="uc-skeleton-row" key={item}>
                    <span className="uc-skeleton uc-skeleton--box" />
                    <span className="uc-skeleton-list__text">
                      <span className="uc-skeleton uc-skeleton--line" />
                      <span className="uc-skeleton uc-skeleton--short" />
                    </span>
                  </div>
                ))}
              </div>
            ) : coursesError !== null ? (
              /* 结构化错误诊断卡 */
              <div className="uc-wizard-error">
                <div className="uc-wizard-error__header">
                  <span className="uc-wizard-error__icon" aria-hidden="true">
                    <IconAlertTriangle size={24} />
                  </span>
                  <div>
                    <strong className="uc-wizard-error__title">课程列表获取失败</strong>
                    <span className="uc-wizard-error__sub">
                      未能从优学院平台成功拉取课程数据，请检查网络或登录状态。
                    </span>
                  </div>
                </div>
                <div className="uc-wizard-error__body">
                  <div className="uc-wizard-error__detail-item">
                    <span>错误原因</span>
                    <strong>{coursesError.message}</strong>
                  </div>
                </div>
                <div className="uc-wizard-error__actions">
                  <Button
                    variant="primary"
                    icon={<IconRefresh size={16} />}
                    onClick={reloadCourses}
                  >
                    重新获取课程
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      openErrorReport(coursesError, "课程列表获取失败");
                    }}
                  >
                    查看完整错误日志
                  </Button>
                </div>
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="uc-state-block">
                <span className="uc-state-block__icon">
                  <IconBook2 size={26} />
                </span>
                <strong>未找到匹配的课程</strong>
                <p>尝试更换关键词搜索，或确认当前账号在平台中是否已成功加入课程。</p>
              </div>
            ) : (
              /* 课程选择列表: 彻底移除未核验的 0% 进度条，聚焦真实课程元信息 */
              <div className="uc-choice-list">
                {filteredCourses.map((course) => {
                  const checked = selectedCourseIds.has(course.id);
                  return (
                    <label
                      className={`uc-choice uc-choice--course ${checked ? "is-checked" : ""}`}
                      key={course.id}
                    >
                      <input
                        type="checkbox"
                        className="uc-checkbox"
                        checked={checked}
                        onChange={() => {
                          toggleCourse(course.id);
                        }}
                      />
                      <span className="uc-choice__icon">
                        <IconBook size={18} />
                      </span>
                      <span className="uc-choice__body">
                        <span className="uc-choice__title">{course.name}</span>
                        <span className="uc-choice__meta">
                          <span>
                            教师: {course.teacherName === "" ? "未注明" : course.teacherName}
                          </span>
                          {course.className !== "" && <span>班级: {course.className}</span>}
                          <span className="uc-mono">ID: {course.id}</span>
                        </span>
                      </span>
                      {checked && (
                        <span className="uc-choice__badge">
                          <IconCheck size={14} stroke={3} />
                          <span>已选择</span>
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 步骤 2: 选择教材 */}
        {step === 1 && (
          <div className="uc-wizard__panel">
            {textbookLoading ? (
              <div className="uc-skeleton-list" aria-label="正在获取教材信息">
                {[0, 1, 2].map((item) => (
                  <div className="uc-skeleton-row" key={item}>
                    <span className="uc-skeleton uc-skeleton--box" />
                    <span className="uc-skeleton-list__text">
                      <span className="uc-skeleton uc-skeleton--line" />
                      <span className="uc-skeleton uc-skeleton--short" />
                    </span>
                  </div>
                ))}
              </div>
            ) : textbookError !== null ? (
              /* 教材获取失败诊断卡 */
              <div className="uc-wizard-error">
                <div className="uc-wizard-error__header">
                  <span className="uc-wizard-error__icon" aria-hidden="true">
                    <IconAlertTriangle size={24} />
                  </span>
                  <div>
                    <strong className="uc-wizard-error__title">没有获取到可配置的教材</strong>
                    <span className="uc-wizard-error__sub">
                      已选课程未检测到有效的教材内容，或平台接口响应异常。
                    </span>
                  </div>
                </div>
                <div className="uc-wizard-error__body">
                  <div className="uc-wizard-error__detail-item">
                    <span>错误原因</span>
                    <strong>{textbookError.message}</strong>
                  </div>
                </div>
                <div className="uc-wizard-error__actions">
                  <Button
                    variant="primary"
                    icon={<IconArrowLeft size={16} />}
                    onClick={() => {
                      setStep(0);
                    }}
                  >
                    返回修改课程选择
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      openErrorReport(textbookError, "教材列表获取失败");
                    }}
                  >
                    查看完整错误日志
                  </Button>
                </div>
              </div>
            ) : (
              <div className="uc-textbook-groups">
                {(textbookOptions ?? []).map(({ course, textbooks }) => {
                  const allGroupSelected = textbooks.every((tb) =>
                    selectedTextbooks.has(textbookKey(course.id, tb.courseId)),
                  );

                  return (
                    <section className="uc-textbook-group" key={course.id}>
                      <header className="uc-textbook-group__head">
                        <span className="uc-textbook-group__icon">
                          <IconBook size={16} />
                        </span>
                        <div className="uc-textbook-group__title-wrap">
                          <h3>{course.name}</h3>
                          <span className="uc-textbook-group__count">
                            共 {textbooks.length} 本教材
                          </span>
                        </div>
                        {textbooks.length > 0 && (
                          <button
                            type="button"
                            className="uc-text-link uc-textbook-group__toggle"
                            onClick={() => {
                              toggleGroupTextbooks(course.id, textbooks);
                            }}
                          >
                            {allGroupSelected ? "取消全选" : "全选本门"}
                          </button>
                        )}
                      </header>

                      {textbooks.length === 0 ? (
                        <p className="uc-textbook-group__empty">这门课程暂时未包含任何教材。</p>
                      ) : (
                        <div className="uc-textbook-group__list">
                          {textbooks.map((textbook) => {
                            const key = textbookKey(course.id, textbook.courseId);
                            const checked = selectedTextbooks.has(key);
                            return (
                              <label
                                className={`uc-choice uc-choice--textbook ${checked ? "is-checked" : ""}`}
                                key={key}
                              >
                                <input
                                  type="checkbox"
                                  className="uc-checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    toggleTextbook(key);
                                  }}
                                />
                                <span className="uc-choice__icon">
                                  <IconBookmark size={16} />
                                </span>
                                <span className="uc-choice__body">
                                  <span className="uc-choice__title">{textbook.name}</span>
                                  <span className="uc-choice__meta">
                                    <span className="uc-mono">教材 ID: {textbook.courseId}</span>
                                    <span>状态: {textbook.status > 0 ? "正常开放" : "未知"}</span>
                                  </span>
                                </span>
                                <IconChevronRight size={16} className="uc-choice__chevron" />
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 步骤 3: 课件同步与组装 */}
        {step === 2 && (
          <div className="uc-wizard__panel uc-wizard__panel--progress">
            <ConfigTree
              groups={selectedGroups}
              progress={configProgress}
              coursesSnapshot={coursesSnapshot}
              result={configuredCourses}
              error={configError}
              skippedChapterIds={skippedChapterIds}
              skippedTextbookIds={skippedTextbookIds}
              onViewErrorDetail={(detail) => {
                openErrorReport(detail, "课件同步失败");
              }}
            />
          </div>
        )}
      </Modal>

      {/* 结构化错误详情抽屉 */}
      <ErrorOverlay
        report={errorReport}
        headline={errorHeadline}
        onClose={() => {
          setErrorReport(null);
        }}
      />
    </>
  );
}
