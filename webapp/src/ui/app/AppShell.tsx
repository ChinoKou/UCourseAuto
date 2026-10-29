import {
  IconAlertTriangle,
  IconBooks,
  IconBrandGithub,
  IconChevronDown,
  IconHome,
  IconLayoutDashboard,
  IconLogin,
  IconPlayerPlay,
  IconX,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { reportWarning } from "@/error/report";
import { summarizeCourseware } from "@/logic/courseware/statistics";
import { accountKeyOf } from "@/schema/domain/config";
import { findSite } from "@/schema/domain/site";
import { selectActiveUser, useConfigStore } from "@/state/configStore";
import { useRunStore } from "@/state/runStore";
import { navigate, useRoute } from "@/ui/app/routes";
import { AccountDrawer } from "@/ui/account/AccountDrawer";
import { Avatar } from "@/ui/common/Avatar";
import { AuthGateOverlay } from "@/ui/common/AuthGateOverlay";
import { Button } from "@/ui/common/Button";
import { Brand } from "@/ui/common/Logo";
import { PREVIEW_USER } from "@/ui/common/previewData";
import { DashboardScreen } from "@/ui/dashboard/DashboardScreen";
import { HomeScreen } from "@/ui/home/HomeScreen";
import { LibraryScreen } from "@/ui/library/LibraryScreen";
import { pageTransition } from "@/ui/motion/presets";
import { ThemeToggle } from "@/ui/theme/ThemeToggle";

export interface AppShellProps {
  onAddAccount?: () => void;
  onLogin?: () => void;
}

const ROUTE_TITLES = {
  home: "首页",
  dashboard: "工作台",
  library: "课件库",
} as const;

const NAV_ITEMS = [
  { route: "home", label: "首页", Icon: IconHome },
  { route: "dashboard", label: "工作台", Icon: IconLayoutDashboard },
  { route: "library", label: "课件库", Icon: IconBooks },
] as const;

/** GitHub 仓库地址 */
const REPOSITORY_URL = "https://github.com/ChinoKou/UCourseAuto";

/** 刷课开始后保持屏幕常亮 */
const useWakeLock = (active: boolean): void => {
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    let sentinel: WakeLockSentinel | null = null;
    const request = (): void => {
      if (navigator.wakeLock === undefined) {
        return;
      }
      navigator.wakeLock
        .request("screen")
        .then((lock) => {
          sentinel = lock;
        })
        .catch(() => {
          reportWarning("屏幕常亮没有开启", "浏览器拒绝了屏幕常亮请求。");
        });
    };
    const handleVisibility = (): void => {
      if (document.visibilityState === "visible") {
        request();
      }
    };
    request();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (sentinel !== null) {
        void sentinel.release();
      }
    };
  }, [active]);
};

/** 应用外壳: 顶栏、账号入口、路由切换与运行提示 */
export function AppShell({ onAddAccount, onLogin }: AppShellProps) {
  const { route, configure } = useRoute();
  const activeUser = useConfigStore(selectActiveUser);
  const customSites = useConfigStore((state) => state.config.custom_sites);
  const phase = useRunStore((state) => state.phase);
  const backgrounded = useRunStore((state) => state.backgrounded);
  const setBackgrounded = useRunStore((state) => state.setBackgrounded);
  const [accountOpen, setAccountOpen] = useState(false);

  const runBusy = phase === "running" || phase === "stopping";
  useWakeLock(runBusy);

  useEffect(() => {
    document.title = `${ROUTE_TITLES[route]} · UCourseAuto`;
  }, [route]);

  useEffect(() => {
    if (!runBusy) {
      return undefined;
    }
    const handleVisibility = (): void => {
      if (document.visibilityState === "hidden") {
        setBackgrounded(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [runBusy, setBackgrounded]);

  const site =
    activeUser !== null ? findSite(activeUser.site, customSites) : null;
  const displayName =
    activeUser !== null
      ? activeUser.name !== ""
        ? activeUser.name
        : activeUser.username
      : "";
  const summary =
    activeUser !== null ? summarizeCourseware(activeUser.courses) : null;
  const percent =
    summary === null || summary.pageCount === 0
      ? 0
      : Math.round((summary.completedPages / summary.pageCount) * 100);

  const renderRoute = () => {
    switch (route) {
      case "home":
        return (
          <HomeScreen
            onGoDashboard={() => {
              navigate("dashboard");
            }}
            onGoLibrary={() => {
              navigate("library");
            }}
          />
        );
      case "dashboard":
        if (activeUser !== null) {
          return <DashboardScreen />;
        }
        return (
          <div className="uc-gate-wrapper">
            <DashboardScreen previewUser={PREVIEW_USER} />
            <AuthGateOverlay
              title="登录以使用工作台"
              description="工作台需要使用您的优学院账号凭证加载课件与执行推进。账号数据保存在当前浏览器的本地存储中。"
              onLogin={() => {
                onLogin?.();
              }}
            />
          </div>
        );
      case "library":
        if (activeUser !== null) {
          return (
            <LibraryScreen
              key={`${accountKeyOf(activeUser.site, activeUser.username)}:${activeUser.site}`}
              initialConfigure={configure}
            />
          );
        }
        return (
          <div className="uc-gate-wrapper">
            <LibraryScreen
              key="guest_preview_library"
              initialConfigure={false}
              previewUser={PREVIEW_USER}
            />
            <AuthGateOverlay
              title="登录以查看课件库"
              description="课件库需要使用您的优学院账号凭证拉取课程结构与学习进度。账号数据保存在当前浏览器的本地存储中。"
              onLogin={() => {
                onLogin?.();
              }}
            />
          </div>
        );
    }
  };

  return (
    <div className="uc-app">
      <header className="uc-topbar">
        <div className="uc-topbar__inner">
          <div className="uc-topbar__left">
            <button
              type="button"
              className="uc-topbar__brand"
              aria-label="回到首页"
              onClick={() => {
                navigate("home");
              }}
            >
              <Brand />
            </button>
            <a
              className="uc-topbar__github"
              href={REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              title="GitHub"
            >
              <IconBrandGithub size={16} />
              <span>GitHub</span>
            </a>
            <nav className="uc-nav" aria-label="主导航">
              {NAV_ITEMS.map((item) => (
                <button
                  type="button"
                  key={item.route}
                  className={`uc-nav__item ${route === item.route ? "is-active" : ""}`}
                  aria-current={route === item.route ? "page" : undefined}
                  onClick={() => {
                    navigate(item.route);
                  }}
                >
                  <item.Icon size={16} />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="uc-topbar__right">
            {runBusy && (
              <button
                type="button"
                className="uc-running-pill"
                onClick={() => {
                  if (route === "dashboard") {
                    document
                      .getElementById("run-console")
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                    return;
                  }
                  navigate("dashboard");
                }}
              >
                <span className="uc-running-pill__dot" />
                <span>正在刷课</span>
                <span className="uc-mono">{percent}%</span>
                <IconPlayerPlay size={12} fill="currentColor" stroke={0} />
              </button>
            )}
            <ThemeToggle />
            {activeUser !== null ? (
              <button
                type="button"
                className="uc-account-chip"
                aria-label="账号管理"
                onClick={() => {
                  setAccountOpen(true);
                }}
              >
                <Avatar name={displayName} url={activeUser.headimage} size={32} />
                <span className="uc-account-chip__text">
                  <span className="uc-account-chip__name">{displayName}</span>
                  <span className="uc-account-chip__site">
                    {site?.name ?? "站点已移除"}
                  </span>
                </span>
                <IconChevronDown size={15} className="uc-account-chip__chevron" />
              </button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                icon={<IconLogin size={15} />}
                onClick={onLogin}
              >
                登录
              </Button>
            )}
          </div>
        </div>
      </header>

      <AnimatePresence initial={false}>
        {backgrounded && runBusy && (
          <motion.div
            className="uc-global-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <IconAlertTriangle size={16} />
            页面进入后台后刷课会暂停，返回页面后自动继续
            <button
              type="button"
              aria-label="关闭提示"
              onClick={() => {
                setBackgrounded(false);
              }}
            >
              <IconX size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="uc-main">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${route}-${configure ? "configure" : ""}`}
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            className="uc-route"
          >
            {renderRoute()}
          </motion.div>
        </AnimatePresence>
      </main>

      <AccountDrawer
        open={accountOpen}
        onClose={() => {
          setAccountOpen(false);
        }}
        onAddAccount={() => {
          setAccountOpen(false);
          onAddAccount?.();
        }}
        runBusy={runBusy}
      />
    </div>
  );
}
