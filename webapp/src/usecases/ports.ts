import type { AppErrorDetail } from "@/error/report";
import type {
  LoginOutcome,
  PlatformFailure,
  PlatformFailureReason,
  PlatformResult,
  SectionStudyRecord,
} from "@/apis/result";
import { createErrorDetail } from "@/error/report";
import type { StudyTime } from "@/schema/domain/config";
import type { ModelCourse } from "@/schema/domain/course";
import type { Site } from "@/schema/domain/site";
import type {
  AntiDetectionStage,
  ConfigProgress,
  RunProgress,
} from "@/schema/domain/progress";
import type { ChapterContentResponse } from "@/schema/protocol/chapterContent";
import type { CurrentUserResponse } from "@/schema/protocol/currentUser";
import type { StudentCoursesResponse } from "@/schema/protocol/courseList";
import type { QuestionAnswerResponse } from "@/schema/protocol/questionAnswer";
import type { SyncStudyRecordRequest } from "@/schema/protocol/syncStudyRecord";
import type { CourseTextbooksResponse } from "@/schema/protocol/textbookList";
import type { TextbookDirectoryResponse } from "@/schema/protocol/textbookDirectory";

/**
 * 业务动作的端口与观察者类型: 平台调用、等待、随机数、停止信号、进度上报与写入
 * 全部由装配根注入, 业务动作不引用状态层。
 */

export type OperationResult<T> =
  | { status: "success"; data: T }
  | { status: "failed"; error: AppErrorDetail };

export interface ConfigObserver {
  onConfigProgress(
    progress: ConfigProgress,
    coursesSnapshot?: ReadonlyArray<ModelCourse>,
  ): void;
}

export interface RunObserver {
  onRunProgress(progress: RunProgress): void;
  onAntiDetectionStage(stage: AntiDetectionStage): void;
}

export interface StopSignal {
  requested(): boolean;
}

/** 登录、恢复会话与修改凭据所需的平台调用 */
export interface SignInPorts {
  login(site: Site, username: string, password: string): Promise<LoginOutcome>;
  validateToken(site: Site, token: string): Promise<PlatformResult<boolean>>;
  fetchCurrentUser(site: Site, token: string): Promise<PlatformResult<CurrentUserResponse>>;
}

/** 课件配置向导所需的平台调用与进度观察者 */
export interface ConfigurePorts {
  fetchStudentCourses(site: Site, token: string): Promise<PlatformResult<StudentCoursesResponse>>;
  fetchCourseTextbooks(
    site: Site,
    token: string,
    courseId: number,
  ): Promise<PlatformResult<CourseTextbooksResponse>>;
  fetchTextbookDirectory(
    site: Site,
    token: string,
    textbookId: number,
    classId: number,
  ): Promise<PlatformResult<TextbookDirectoryResponse>>;
  fetchChapterContent(
    site: Site,
    token: string,
    chapterId: number,
  ): Promise<PlatformResult<ChapterContentResponse>>;
  fetchSectionStudyRecord(
    site: Site,
    token: string,
    sectionId: number,
  ): Promise<PlatformResult<SectionStudyRecord>>;
  fetchQuestionAnswers(
    site: Site,
    token: string,
    questionId: number,
    pageId: number,
  ): Promise<PlatformResult<QuestionAnswerResponse>>;
  observer: ConfigObserver;
}

/** 已完成内容清理所需的平台调用 */
export interface PrunePorts {
  fetchSectionStudyRecord(
    site: Site,
    token: string,
    sectionId: number,
  ): Promise<PlatformResult<SectionStudyRecord>>;
}

/** 刷课输入: 一次运行所需的账号、课件与设置 */
export interface RunCoursewareInput {
  site: Site;
  token: string;
  courses: ModelCourse[];
  studyTime: StudyTime;
  /** 节间冷却(秒), 仅真实时长段 */
  sectionCooldown: number;
  antiDetection: boolean;
  /** 可选勾选的页面 ID 集合; 未指定时默认全选 */
  selectedPageIds?: ReadonlySet<number>;
}

/** 刷课执行所需的平台调用、等待、随机数与写入 */
export interface RunPorts {
  fetchCurrentUser(site: Site, token: string): Promise<PlatformResult<CurrentUserResponse>>;
  initializeSectionRecord(
    site: Site,
    token: string,
    sectionId: number,
  ): Promise<PlatformResult<number>>;
  reportVideoBehavior(
    site: Site,
    token: string,
    classId: number,
    textbookId: number,
    chapterId: number,
    videoId: number,
  ): Promise<PlatformResult<void>>;
  syncStudyRecord(
    site: Site,
    token: string,
    request: SyncStudyRecordRequest,
  ): Promise<PlatformResult<boolean>>;
  triggerTextbookDetection(
    site: Site,
    token: string,
    courseId: number,
    textbookId: number,
  ): Promise<PlatformResult<boolean>>;
  fetchSectionStudyRecord(
    site: Site,
    token: string,
    sectionId: number,
  ): Promise<PlatformResult<SectionStudyRecord>>;
  sleep(seconds: number): Promise<void>;
  now(): number;
  randint(min: number, max: number): number;
  uniform(min: number, max: number): number;
  stop: StopSignal;
  observer: RunObserver;
  persist(courses: ModelCourse[]): void;
}

const FAILURE_MESSAGES: Record<Exclude<PlatformFailureReason, "httpStatus">, string> = {
  network: "网络错误或请求超时，请检查网络后重试。",
  invalidJson: "平台返回了无法解析的响应。",
  schemaMismatch: "响应的字段结构与预期不一致。",
  unexpectedBody: "响应内容与预期不一致。",
};

/** 平台失败的可见说明: 状态码与原因各写一句, 便于判断是网络问题还是结构问题 */
export const describeFailure = (failure: PlatformFailure): string =>
  failure.reason === "httpStatus"
    ? `接口返回 HTTP ${failure.status}。`
    : FAILURE_MESSAGES[failure.reason];

/** 出错所属的目标节点信息 */
export interface ErrorTargetInfo {
  targetKey?: string;
  targetName?: string;
  targetKind?: "course" | "textbook" | "chapter";
  targetId?: number;
}

/** 由平台失败构造错误详情, 标题与补充说明由业务动作给出 */
export const errorFromFailure = (
  title: string,
  failure: PlatformFailure,
  context?: string,
  target?: ErrorTargetInfo,
): AppErrorDetail =>
  createErrorDetail({
    title,
    message:
      context === undefined
        ? describeFailure(failure)
        : `${context}${describeFailure(failure)}`,
    endpoint: failure.endpoint,
    status: failure.status,
    raw: failure.raw,
    cause: failure.reason,
    targetKey: target?.targetKey,
    targetName: target?.targetName,
    targetKind: target?.targetKind,
    targetId: target?.targetId,
  });

/** 由本地校验失败构造错误详情 */
export const errorFromMessage = (
  title: string,
  message: string,
  target?: ErrorTargetInfo,
): AppErrorDetail =>
  createErrorDetail({
    title,
    message,
    targetKey: target?.targetKey,
    targetName: target?.targetName,
    targetKind: target?.targetKind,
    targetId: target?.targetId,
  });

/** 失败结果构造 */
export const failed = <T>(error: AppErrorDetail): OperationResult<T> => ({
  status: "failed",
  error,
});
