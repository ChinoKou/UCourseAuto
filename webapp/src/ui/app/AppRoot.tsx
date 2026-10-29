import { IconAlertTriangle } from "@tabler/icons-react";
import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { findSite } from "@/schema/domain/site";
import { accountKeyOf } from "@/schema/domain/config";
import { selectActiveUser, useConfigStore } from "@/state/configStore";
import { restoreSession } from "@/usecases/signIn";
import { AppShell } from "@/ui/app/AppShell";
import { BootScreen } from "@/ui/app/BootScreen";
import { usePorts } from "@/ui/app/ports";
import { endSessionForRestore } from "@/ui/app/restoreState";
import { navigate } from "@/ui/app/routes";
import { AuthScreen } from "@/ui/auth/AuthScreen";
import { Button } from "@/ui/common/Button";
import { useToast } from "@/ui/common/toast";

/** 启动动画单轮完整周期(毫秒) */
const ANIMATION_CYCLE_MS = 1400;

/** 应用挂载初始时间戳 */
const APP_START_TIME = Date.now();

/** 应用根: 启动加载、登录态恢复与整屏切换 */
export function AppRoot() {
  const activeUser = useConfigStore(selectActiveUser);
  const loadError = useConfigStore((state) => state.loadError);
  const resetConfig = useConfigStore((state) => state.resetConfig);
  const toast = useToast();
  const ports = usePorts();
  const [booting, setBooting] = useState(true);
  const [progress, setProgress] = useState(15);
  const [label, setLabel] = useState("正在初始化…");
  const [fontsReady, setFontsReady] = useState(false);
  const [restoreDone, setRestoreDone] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreBlocked, setRestoreBlocked] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    void document.fonts.ready.then(() => {
      setFontsReady(true);
    });
  }, []);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    const run = async (): Promise<void> => {
      await Promise.resolve();
      setProgress(40);

      const { config } = useConfigStore.getState();
      const user = config.users.find(
        (item) => accountKeyOf(item.site, item.username) === config.active_user,
      );
      if (user === undefined) {
        if (config.active_user !== "") {
          const cleared = useConfigStore.getState().logout();
          if (!cleared) {
            setRestoreBlocked(true);
            setRestoreError(
              "本地配置已在其他标签页更新，失效的登录状态没有清理，请刷新页面后重试。",
            );
          }
        }
        setProgress(100);
        setLabel("准备就绪");
        setRestoreDone(true);
        return;
      }

      const site = findSite(user.site, config.custom_sites);
      if (site === null) {
        const failure = endSessionForRestore(
          () => useConfigStore.getState().logout(),
          "账号使用的站点已经不存在",
        );
        setRestoreBlocked(failure.blocked);
        setRestoreError(failure.message);
        setProgress(100);
        setLabel(failure.label);
        setRestoreDone(true);
        return;
      }

      setProgress(70);
      setLabel(`正在恢复 ${user.username} 的会话…`);

      const result = await restoreSession(ports.signIn, user, site);
      if (result.status === "success") {
        const accountKey = accountKeyOf(result.data.siteRef, result.data.username);
        const written = useConfigStore.getState().saveCredential({
          siteRef: result.data.siteRef,
          username: result.data.username,
          password: result.data.password,
          token: result.data.token,
          activate: false,
        });
        if (!written) {
          setRestoreBlocked(true);
          setRestoreError("会话已恢复，但凭据没有写入，请刷新页面后重试。");
          setProgress(100);
          setLabel("需要刷新页面");
          setRestoreDone(true);
          return;
        }
        useConfigStore.getState().saveIdentity(accountKey, result.data.identity);
        setProgress(100);
        setLabel("准备就绪");
      } else {
        const failure = endSessionForRestore(
          () => useConfigStore.getState().logout(),
          `会话恢复失败：${result.error.message}`,
        );
        setRestoreBlocked(failure.blocked);
        setRestoreError(failure.message);
        setProgress(100);
        setLabel(failure.label);
      }
      setRestoreDone(true);
    };

    void run();
  }, [ports.signIn]);

  const resourcesReady = fontsReady && restoreDone;

  // 动画周期循环驱动:
  // 若资源已就绪，等待当前这一轮动画完整播完后退出;
  // 若动画第一轮播完但资源未就绪，则继续循环播放，直至资源就绪后当前轮次播完退出。
  useEffect(() => {
    if (!resourcesReady || !booting) {
      return undefined;
    }

    const elapsed = Date.now() - APP_START_TIME;
    const targetEndMs = Math.max(
      ANIMATION_CYCLE_MS,
      Math.ceil(elapsed / ANIMATION_CYCLE_MS) * ANIMATION_CYCLE_MS,
    );
    const delay = Math.max(0, targetEndMs - elapsed);

    const timer = window.setTimeout(() => {
      setBooting(false);
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [resourcesReady, booting]);

  const showShell = activeUser !== null && !addingAccount && !restoreBlocked;

  return (
    <>
      <AnimatePresence>
        {booting && (
          <BootScreen
            key="boot"
            progress={resourcesReady ? 100 : progress}
            label={resourcesReady ? "准备就绪" : label}
          />
        )}
      </AnimatePresence>

      {!booting && loadError !== null && (
        <div className="uc-config-error-banner" role="alert">
          <div className="uc-config-error-banner__inner">
            <span className="uc-config-error-banner__icon" aria-hidden="true">
              <IconAlertTriangle size={18} />
            </span>
            <div className="uc-config-error-banner__text">
              <strong>{loadError.title}</strong>
              <p>{loadError.message}</p>
            </div>
            <button
              type="button"
              className="uc-btn uc-btn--sm uc-btn--primary"
              onClick={() => {
                resetConfig();
                toast.push({
                  title: "已重置本地配置为默认版本",
                  tone: "success",
                });
              }}
            >
              重置本地配置
            </button>
          </div>
        </div>
      )}

      {!booting && restoreBlocked && (
        <div className="uc-page uc-auth">
          <section className="uc-card uc-empty-state">
            <span className="uc-empty-state__icon">
              <IconAlertTriangle size={32} />
            </span>
            <span className="uc-eyebrow">登录状态</span>
            <h2>需要刷新页面</h2>
            <p>{restoreError ?? "本地登录状态已在其他标签页更新。"}</p>
            <div className="uc-empty-state__actions">
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  window.location.reload();
                }}
              >
                刷新页面
              </Button>
            </div>
          </section>
        </div>
      )}

      {!booting &&
        !restoreBlocked &&
        (showShell ? (
          <AppShell
            onAddAccount={() => {
              setAddingAccount(true);
            }}
          />
        ) : (
          <AuthScreen
            mode={addingAccount ? "add" : "login"}
            restoreError={restoreError}
            onBack={
              addingAccount
                ? () => {
                    setAddingAccount(false);
                    navigate("home");
                  }
                : undefined
            }
          />
        ))}
    </>
  );
}
