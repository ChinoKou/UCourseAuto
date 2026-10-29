import { loginWithCredential, validateAccessToken } from "@/apis/auth";
import {
  fetchChapterContent,
  fetchCourseTextbooks,
  fetchCurrentUser,
  fetchQuestionAnswers,
  fetchSectionStudyRecord,
  fetchStudentCourses,
  fetchTextbookDirectory,
  initializeSectionRecord,
  reportVideoBehavior,
  syncStudyRecord,
  triggerTextbookDetection,
} from "@/apis/course";
import { useConfigStore } from "@/state/configStore";
import { useRunStore } from "@/state/runStore";
import type {
  ConfigurePorts,
  PrunePorts,
  RunPorts,
  SignInPorts,
} from "@/usecases/ports";

/**
 * 真实实现的装配: 平台接口、等待、随机数、观察者、停止信号与持久化在此绑定。
 * 装配根是唯一可以同时引用状态层与访问层的模块, 业务动作只接收这里构造的端口。
 */

/** 秒级等待 */
const sleep = (seconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });

export const signInPorts: SignInPorts = {
  login: loginWithCredential,
  validateToken: validateAccessToken,
  fetchCurrentUser,
};

/** 课件配置端口: 观察者由打开向导的界面按次注入 */
export const createConfigurePorts = (
  observer: ConfigurePorts["observer"],
): ConfigurePorts => ({
  fetchStudentCourses,
  fetchCourseTextbooks,
  fetchTextbookDirectory,
  fetchChapterContent,
  fetchSectionStudyRecord,
  fetchQuestionAnswers,
  observer,
});

export const prunePorts: PrunePorts = {
  fetchSectionStudyRecord,
};

export const runPorts: RunPorts = {
  fetchCurrentUser,
  initializeSectionRecord,
  reportVideoBehavior,
  syncStudyRecord,
  triggerTextbookDetection,
  fetchSectionStudyRecord,
  sleep,
  now: () => Date.now() / 1000,
  randint: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
  uniform: (min, max) => Math.random() * (max - min) + min,
  stop: {
    requested: () => useRunStore.getState().stopRequested,
  },
  observer: {
    onRunProgress: (progress) => {
      useRunStore.getState().updateProgress(progress);
    },
    onAntiDetectionStage: (stage) => {
      useRunStore.getState().setAntiDetectionStage(stage);
    },
  },
  persist: (courses) => {
    // 其他标签页在运行期间改过配置时跳过写回, 避免用旧快照覆盖
    if (useConfigStore.getState().configStale) {
      return;
    }
    // 写回由 replaceCourseware 复制后接管, 工作树保持可写
    useConfigStore.getState().replaceCourseware(courses);
  },
};
