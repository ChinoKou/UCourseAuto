import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconLock,
  IconLogin,
  IconUserPlus,
} from "@tabler/icons-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { accountKeyOf } from "@/schema/domain/config";
import type { UserConfig } from "@/schema/domain/config";
import {
  allSites,
  DEFAULT_SITE_REF,
  findSite,
  siteHost,
  type Site,
} from "@/schema/domain/site";
import { useConfigStore } from "@/state/configStore";
import { usePorts } from "@/ui/app/ports";
import { navigate } from "@/ui/app/routes";
import { Avatar } from "@/ui/common/Avatar";
import { Button } from "@/ui/common/Button";
import { ConfirmDialog } from "@/ui/common/Dialog";
import { PasswordField, TextField } from "@/ui/common/Field";
import { LogoMark } from "@/ui/common/Logo";
import { ServerManager } from "@/ui/common/ServerManager";
import { ServerSelect } from "@/ui/common/ServerSelect";
import { useToast } from "@/ui/common/toast";
import { addAccountWithLogin, restoreSession } from "@/usecases/signIn";

export interface AuthScreenProps {
  mode: "login" | "add";
  onBack?: () => void;
  /** 页面加载时自动登录失败的说明 */
  restoreError?: string | null;
}

/** 站点名称, 自定义站点被删除时给出明确说明 */
const siteNameOf = (ref: string, sites: ReadonlyArray<Site>): string =>
  sites.find((site) => site.ref === ref)?.name ?? "站点已移除";

/** 登录与账号管理的聚焦卡片界面 */
export function AuthScreen({ mode, onBack, restoreError }: AuthScreenProps) {
  const users = useConfigStore((state) => state.config.users);
  const activeAccountKey = useConfigStore((state) => state.config.active_user);
  const customSites = useConfigStore((state) => state.config.custom_sites);
  const addAccount = useConfigStore((state) => state.addAccount);
  const updateAccount = useConfigStore((state) => state.updateAccount);
  const switchUser = useConfigStore((state) => state.switchUser);
  const saveIdentity = useConfigStore((state) => state.saveIdentity);
  const ports = usePorts();
  const toast = useToast();

  const sites = useMemo(() => allSites(customSites), [customSites]);
  const activeUser = users.find(
    (user) => accountKeyOf(user.site, user.username) === activeAccountKey,
  );
  const initialRef =
    mode === "add"
      ? DEFAULT_SITE_REF
      : (activeUser?.site ?? users[0]?.site ?? DEFAULT_SITE_REF);

  const [tab, setTab] = useState<"accounts" | "login">(
    mode === "login" && users.length > 0 ? "accounts" : "login",
  );
  const [siteRef, setSiteRef] = useState<string>(initialRef);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ username: false, password: false });
  const [submitting, setSubmitting] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const selectedSiteRef = sites.some((site) => site.ref === siteRef)
    ? siteRef
    : (sites.find((site) => site.ref === DEFAULT_SITE_REF)?.ref ?? sites[0].ref);

  const usernameError =
    touched.username && username.trim().length === 0 ? "请输入用户名" : null;
  const passwordError =
    touched.password && password.length === 0 ? "请输入密码" : null;
  const busy = submitting || switching !== null;

  const loginAndSave = async (overwrite: boolean): Promise<void> => {
    const site = sites.find((item) => item.ref === selectedSiteRef);
    if (site === undefined) {
      setError("请选择一个站点");
      return;
    }
    const trimmedName = username.trim();
    setSubmitting(true);
    setError(null);
    try {
      const result = await addAccountWithLogin(ports.signIn, site, trimmedName, password);
      if (!mountedRef.current) {
        return;
      }
      if (result.status === "failed") {
        setError(result.error.message);
        return;
      }
      const accountKey = accountKeyOf(result.data.siteRef, result.data.username);
      const existing = useConfigStore
        .getState()
        .config.users.some(
          (user) => accountKeyOf(user.site, user.username) === accountKey,
        );
      let written = true;
      if (existing && !overwrite) {
        written =
          updateAccount(accountKey, {
            siteRef: result.data.siteRef,
            password: result.data.password,
            token: result.data.token,
          }) && switchUser(accountKey);
      } else {
        written = addAccount({
          siteRef: result.data.siteRef,
          username: result.data.username,
          password: result.data.password,
          token: result.data.token,
          activate: true,
          overwrite: existing,
        });
      }
      if (!written) {
        setError("账号没有写入，请刷新页面后重试。");
        return;
      }
      saveIdentity(accountKey, result.data.identity);
      toast.push({ title: `欢迎回来，${result.data.identity.name}`, tone: "success" });
      navigate("home");
      onBack?.();
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
        setOverwriteOpen(false);
      }
    }
  };

  const handleLogin = async (): Promise<void> => {
    setTouched({ username: true, password: true });
    if (busy || username.trim().length === 0 || password.length === 0) {
      return;
    }
    const site = sites.find((item) => item.ref === selectedSiteRef);
    if (site === undefined) {
      setError("请选择一个站点");
      return;
    }
    if (mode === "add") {
      const accountKey = accountKeyOf(site.ref, username.trim());
      const existing = users.some(
        (user) => accountKeyOf(user.site, user.username) === accountKey,
      );
      if (existing) {
        setError(null);
        setOverwriteOpen(true);
        return;
      }
    }
    await loginAndSave(false);
  };

  const handleSwitch = async (user: UserConfig): Promise<void> => {
    if (busy) {
      return;
    }
    const accountKey = accountKeyOf(user.site, user.username);
    const site = findSite(user.site, customSites);
    if (site === null) {
      setError("这个账号的站点已被移除，请使用账号密码重新登录。");
      return;
    }
    setSwitching(accountKey);
    setError(null);
    try {
      const result = await restoreSession(ports.signIn, user, site);
      if (!mountedRef.current) {
        return;
      }
      if (result.status === "failed") {
        setError(result.error.message);
        return;
      }
      const stillExists = useConfigStore
        .getState()
        .config.users.some(
          (item) => accountKeyOf(item.site, item.username) === accountKey,
        );
      if (!stillExists) {
        setError("这个账号已不存在，请重新登录。");
        return;
      }
      if (!switchUser(accountKey)) {
        setError("账号切换没有完成，请刷新页面后重试。");
        return;
      }
      saveIdentity(accountKey, result.data.identity);
      toast.push({ title: `已切换到 ${user.username}`, tone: "success" });
      navigate("home");
      onBack?.();
    } finally {
      if (mountedRef.current) {
        setSwitching(null);
      }
    }
  };

  const isAdd = mode === "add";

  return (
    <div className="uc-auth">
      <motion.div
        className="uc-auth__card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {isAdd && onBack !== undefined && (
          <button
            type="button"
            className="uc-auth__back"
            disabled={busy}
            onClick={onBack}
          >
            <IconArrowLeft size={15} />
            <span>返回工作台</span>
          </button>
        )}

        <header className="uc-auth__header">
          <div className="uc-auth__brand">
            <LogoMark size={42} />
          </div>
          <h1 className="uc-auth__title">
            {isAdd ? "添加账号" : tab === "accounts" ? "选择登录账号" : "登录优学院"}
          </h1>
          <p className="uc-auth__desc">
            {isAdd
              ? "输入账号凭证以保存到本机"
              : tab === "accounts"
                ? "使用已保存账号快速进入工作台"
                : "输入平台账号与密码登录"}
          </p>
        </header>

        {restoreError !== undefined && restoreError !== null && (
          <div className="uc-alert uc-alert--warning" role="alert">
            <IconAlertTriangle size={16} />
            <span>自动登录没有完成：{restoreError}</span>
          </div>
        )}

        {error !== null && (
          <div className="uc-alert uc-alert--danger" role="alert">
            <IconAlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {users.length > 0 && !isAdd && (
          <div className="uc-auth-tabs" role="tablist" aria-label="登录方式">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "accounts"}
              className={tab === "accounts" ? "is-active" : ""}
              disabled={busy}
              onClick={() => {
                setTab("accounts");
                setError(null);
              }}
            >
              已保存账号
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "login"}
              className={tab === "login" ? "is-active" : ""}
              disabled={busy}
              onClick={() => {
                setTab("login");
                setError(null);
              }}
            >
              账号密码登录
            </button>
          </div>
        )}

        {tab === "accounts" && !isAdd ? (
          <div className="uc-auth-accounts">
            {users.map((user) => {
              const accountKey = accountKeyOf(user.site, user.username);
              const site = findSite(user.site, customSites);
              const isActive = accountKey === activeAccountKey;
              return (
                <button
                  type="button"
                  key={accountKey}
                  className={`uc-account-card ${isActive ? "is-active" : ""}`}
                  disabled={busy}
                  onClick={() => {
                    void handleSwitch(user);
                  }}
                >
                  <Avatar name={user.name || user.username} url={user.headimage} size={40} />
                  <span className="uc-account-card__text">
                    <span className="uc-account-card__name">
                      {user.username}
                      {isActive && <span className="uc-badge uc-badge--success">当前</span>}
                    </span>
                    <span className="uc-account-card__meta">
                      {siteNameOf(user.site, sites)}
                      {site !== null && <span className="uc-mono">{siteHost(site)}</span>}
                    </span>
                  </span>
                  {switching === accountKey ? (
                    <span className="uc-spinner" aria-label="正在登录" />
                  ) : (
                    <IconArrowRight size={17} className="uc-account-card__arrow" />
                  )}
                </button>
              );
            })}
            <Button
              variant="secondary"
              block
              icon={<IconUserPlus size={15} />}
              disabled={busy}
              onClick={() => {
                setTab("login");
                setError(null);
              }}
            >
              使用其他账号登录
            </Button>
          </div>
        ) : (
          <form
            className="uc-auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleLogin();
            }}
          >
            <div className="uc-field">
              <div className="uc-field__head">
                <span className="uc-field__label">站点</span>
              </div>
              <ServerSelect
                value={selectedSiteRef}
                onChange={setSiteRef}
                sites={sites}
                onManage={() => {
                  setManagerOpen(true);
                }}
                disabled={busy}
              />
            </div>

            <TextField
              label="用户名"
              placeholder="学号或登录名"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              error={usernameError}
              disabled={busy}
              onChange={(event) => {
                setUsername(event.currentTarget.value);
              }}
              onBlur={() => {
                setTouched((current) => ({ ...current, username: true }));
              }}
            />
            <PasswordField
              label="密码"
              placeholder="账号密码"
              autoComplete="current-password"
              value={password}
              error={passwordError}
              disabled={busy}
              onChange={(event) => {
                setPassword(event.currentTarget.value);
              }}
              onBlur={() => {
                setTouched((current) => ({ ...current, password: true }));
              }}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              loading={submitting}
              icon={<IconLogin size={17} />}
            >
              {isAdd ? "添加并登录" : "登录"}
            </Button>

            {users.length > 0 && !isAdd && (
              <button
                type="button"
                className="uc-auth__switch-link"
                disabled={busy}
                onClick={() => {
                  setTab("accounts");
                  setError(null);
                }}
              >
                返回已保存账号
              </button>
            )}
          </form>
        )}

        <footer className="uc-auth__privacy">
          <IconLock size={12} />
          <span>账号与凭证仅保存在本机浏览器中</span>
        </footer>
      </motion.div>

      <ServerManager
        open={managerOpen}
        onClose={() => {
          setManagerOpen(false);
        }}
        onSaved={(ref) => {
          setSiteRef(ref);
        }}
        onDeleted={(ref) => {
          if (ref === selectedSiteRef) {
            setSiteRef(sites[0].ref);
          }
        }}
      />

      <ConfirmDialog
        open={overwriteOpen}
        onClose={() => {
          setOverwriteOpen(false);
        }}
        onConfirm={() => {
          void loginAndSave(true);
        }}
        title="覆盖已有账号？"
        danger
        busy={submitting}
        confirmText="覆盖并登录"
      >
        这个站点上已经保存了同名账号。继续会清空该账号原有的课件树，并替换为本次登录的凭据。
      </ConfirmDialog>
    </div>
  );
}
