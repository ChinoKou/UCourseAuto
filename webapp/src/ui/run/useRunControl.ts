import { useCallback, useState } from "react";

import { reportWarning } from "@/error/report";
import { cloneCourses, collectPageIds, countSelectedPagesInCourses } from "@/logic/courseware/tree";
import { findSite } from "@/schema/domain/site";
import { selectActiveUser, useConfigStore } from "@/state/configStore";
import { useRunStore } from "@/state/runStore";
import { withRunLock } from "@/usecases/runLock";
import { runCourseware } from "@/usecases/runCourseware";
import { usePorts } from "@/ui/app/ports";
import { useToast } from "@/ui/common/toast";

/** 首页刷课控制: 开始与准备状态 */
export interface RunControl {
  /** 只在启动前为真, 进入运行后立即复位 */
  preparing: boolean;
  startError: string | null;
  start: () => Promise<void>;
}

/** 首页直接启动刷课, 运行与写回由业务动作完成 */
export const useRunControl = (): RunControl => {
  const ports = usePorts();
  const toast = useToast();
  const [preparing, setPreparing] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const notifyStaleConfig = (): void => {
    if (useConfigStore.getState().configStale) {
      reportWarning(
        "学习记录已上报",
        "本地课件状态未写回，请刷新页面后查看。",
      );
    }
  };

  const start = useCallback(async (): Promise<void> => {
    const state = useConfigStore.getState();
    const user = selectActiveUser(state);
    if (user === null) {
      throw new Error("当前没有活跃账号");
    }
    const site = findSite(user.site, state.config.custom_sites);
    if (site === null) {
      setStartError("这个账号的站点已被移除，请重新登录。");
      return;
    }
    const runStore = useRunStore.getState();
    const phase = runStore.phase;
    if (preparing || phase === "running" || phase === "stopping") {
      return;
    }
    const selectedPageIds = runStore.selectedPageIds;
    if (selectedPageIds.size === 0) {
      setStartError("请先在右侧课件库勾选要学习的内容。");
      return;
    }
    if (countSelectedPagesInCourses(user.courses, selectedPageIds) === 0) {
      setStartError("当前账号的课件库里没有已勾选的页面，请重新选择。");
      return;
    }

    setPreparing(true);
    setStartError(null);
    try {
      const lockError = await withRunLock(async () => {
        const ready = useConfigStore.getState();
        const readyUser = selectActiveUser(ready);
        if (readyUser === null) {
          throw new Error("当前没有活跃账号");
        }

        useRunStore.getState().startRun(selectedPageIds);
        setPreparing(false);
        const outcome = await runCourseware(ports.run, {
          site,
          token: readyUser.token,
          courses: cloneCourses(readyUser.courses),
          studyTime: ready.config.study_time,
          sectionCooldown: ready.config.sleep_time,
          antiDetection: ready.config.anti_detection,
          selectedPageIds,
        });

        const syncRemainingSelection = (): void => {
          const updatedUser = selectActiveUser(useConfigStore.getState());
          if (updatedUser !== null) {
            const incompleteIds = new Set(collectPageIds(updatedUser.courses, true));
            const nextSelected = new Set(
              Array.from(selectedPageIds).filter((id) => incompleteIds.has(id)),
            );
            useRunStore.getState().setSelectedPageIds(nextSelected);
          }
        };

        if (outcome.status === "completed") {
          useRunStore.getState().finishRun({
            skippedSections: outcome.skippedSections,
            failedUploads: outcome.failedUploads,
          });
          useRunStore.getState().setAntiDetectionStage(null);
          syncRemainingSelection();
          notifyStaleConfig();
          if (outcome.skippedSections > 0 || outcome.failedUploads > 0) {
            reportWarning(
              "部分节没有完成",
              `${outcome.skippedSections} 个节初始化失败，${outcome.failedUploads} 个节上报失败，已跳过。`,
            );
          }
          return;
        }
        if (outcome.status === "stopped") {
          useRunStore.getState().finishRun();
          useRunStore.getState().setAntiDetectionStage(null);
          syncRemainingSelection();
          notifyStaleConfig();
          return;
        }
        useRunStore.getState().failRun(outcome.error);
        notifyStaleConfig();
      });

      if (lockError !== null) {
        setStartError(lockError);
        useRunStore.getState().resetRun();
        toast.push({ title: lockError, tone: "warning" });
      }
    } finally {
      setPreparing(false);
    }
  }, [ports, preparing, toast]);

  return { preparing, startError, start };
};
