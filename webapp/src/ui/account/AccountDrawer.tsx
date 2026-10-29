import {
  IconArrowRight,
  IconCheck,
  IconLogout,
  IconPencil,
  IconPlus,
  IconServer,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";

import { accountKeyOf } from "@/schema/domain/config";
import type { UserConfig } from "@/schema/domain/config";
import { findSite, siteHost } from "@/schema/domain/site";
import { selectActiveUser, useConfigStore } from "@/state/configStore";
import { restoreSession } from "@/usecases/signIn";
import { usePorts } from "@/ui/app/ports";
import { navigate } from "@/ui/app/routes";
import { Avatar } from "@/ui/common/Avatar";
import { Button } from "@/ui/common/Button";
import { ConfirmDialog, Drawer } from "@/ui/common/Dialog";
import { useToast } from "@/ui/common/toast";
import { EditAccountDialog } from "@/ui/account/EditAccountDialog";

export interface AccountDrawerProps {
  open: boolean;
  onClose: () => void;
  onAddAccount: () => void;
  runBusy: boolean;
}

/** 账号管理抽屉: 当前账号、切换、编辑、删除与登出 */
export function AccountDrawer({
  open,
  onClose,
  onAddAccount,
  runBusy,
}: AccountDrawerProps) {
  const users = useConfigStore((state) => state.config.users);
  const activeAccountKey = useConfigStore((state) => state.config.active_user);
  const activeUser = useConfigStore(selectActiveUser);
  const customSites = useConfigStore((state) => state.config.custom_sites);
  const switchUser = useConfigStore((state) => state.switchUser);
  const saveCredential = useConfigStore((state) => state.saveCredential);
  const saveIdentity = useConfigStore((state) => state.saveIdentity);
  const removeAccount = useConfigStore((state) => state.removeAccount);
  const logout = useConfigStore((state) => state.logout);
  const ports = usePorts();
  const toast = useToast();

  const activeSite = activeUser === null ? null : findSite(activeUser.site, customSites);

  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<UserConfig | null>(null);

  /** 账号操作禁用条件: 运行中或正在切换 */
  const accountBusy = runBusy || switching !== null;

  const handleSwitch = async (user: UserConfig): Promise<void> => {
    const accountKey = accountKeyOf(user.site, user.username);
    if (accountBusy || accountKey === activeAccountKey) {
      return;
    }
    const site = findSite(user.site, customSites);
    if (site === null) {
      setError("这个账号的站点已被移除。");
      return;
    }
    setSwitching(accountKey);
    setPendingDelete(null);
    setError(null);
    try {
      const result = await restoreSession(ports.signIn, user, site);
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
        setError("这个账号在切换完成前已被删除。");
        return;
      }
      if (!saveCredential({
        siteRef: result.data.siteRef,
        username: result.data.username,
        password: result.data.password,
        token: result.data.token,
        activate: false,
      })) {
        setError("切换没有完成，请刷新页面后重试。");
        return;
      }
      if (!switchUser(accountKey)) {
        setError("切换没有完成，请刷新页面后重试。");
        return;
      }
      saveIdentity(accountKey, result.data.identity);
      toast.push({ title: `已切换到 ${user.username}`, tone: "success" });
      onClose();
    } finally {
      setSwitching(null);
    }
  };

  const handleLogout = (): void => {
    if (!logout()) {
      setError("退出登录没有写入，请刷新页面后重试。");
      return;
    }
    onClose();
    navigate("home");
    toast.push({ title: "已退出登录", tone: "info" });
  };

  const handleDelete = (): void => {
    if (pendingDelete === null || switching !== null) {
      return;
    }
    const accountKey = accountKeyOf(pendingDelete.site, pendingDelete.username);
    if (!removeAccount(accountKey)) {
      setError("删除没有写入，请刷新页面后重试。");
      return;
    }
    toast.push({ title: `已删除账号 ${pendingDelete.username}`, tone: "info" });
    setPendingDelete(null);
    if (accountKey === activeAccountKey) {
      onClose();
      navigate("home");
    }
  };

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title="账号"
        description="切换、编辑或清理保存在本机的账号。"
      >
        <div className="uc-account-drawer">
          {activeUser !== null && (
            <section className="uc-account-current">
              <div className="uc-account-current__glow" aria-hidden="true" />
              <div className="uc-account-current__top">
                <Avatar
                  name={activeUser.name !== "" ? activeUser.name : activeUser.username}
                  url={activeUser.headimage}
                  size={54}
                />
                <div className="uc-account-current__identity">
                  <strong>
                    {activeUser.name !== "" ? activeUser.name : activeUser.username}
                  </strong>
                  <span className="uc-mono">{activeUser.username}</span>
                </div>
                <span className="uc-badge uc-badge--success">
                  <IconCheck size={12} />
                  已登录
                </span>
              </div>
              <div className="uc-account-current__site">
                <IconServer size={15} />
                <span>{activeSite?.name ?? "站点已移除"}</span>
                {activeSite !== null && (
                  <span className="uc-mono">{siteHost(activeSite)}</span>
                )}
              </div>
              <div className="uc-account-current__actions">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<IconPencil size={15} />}
                  disabled={accountBusy}
                  onClick={() => {
                    setEditOpen(true);
                  }}
                >
                  编辑账号
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<IconLogout size={15} />}
                  disabled={accountBusy}
                  onClick={handleLogout}
                >
                  退出登录
                </Button>
              </div>
            </section>
          )}

          {error !== null && (
            <div className="uc-alert uc-alert--danger" role="alert">
              <span>{error}</span>
            </div>
          )}

          <section className="uc-account-list">
            <header className="uc-section-head">
              <h3>全部账号</h3>
            </header>
            {users.map((user) => {
              const accountKey = accountKeyOf(user.site, user.username);
              const site = findSite(user.site, customSites);
              const isActive = accountKey === activeAccountKey;
              return (
                <div
                  key={accountKey}
                  className={`uc-account-row ${isActive ? "is-active" : ""}`}
                >
                  <button
                    type="button"
                    className="uc-account-row__main"
                    disabled={accountBusy}
                    onClick={() => {
                      void handleSwitch(user);
                    }}
                  >
                    <Avatar name={user.name || user.username} url={user.headimage} size={36} />
                    <span className="uc-account-row__text">
                      <span className="uc-account-row__name">
                        {user.username}
                        {isActive && <span className="uc-dot" aria-label="当前账号" />}
                      </span>
                      <span className="uc-account-row__meta">
                        {site?.name ?? "站点已移除"}
                      </span>
                    </span>
                    {switching === accountKey ? (
                      <span className="uc-spinner" aria-label="正在登录" />
                    ) : !isActive ? (
                      <IconArrowRight size={16} className="uc-account-row__arrow" />
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className="uc-icon-btn uc-icon-btn--sm"
                    aria-label={`删除账号 ${user.username}`}
                    title="删除账号"
                    disabled={accountBusy}
                    onClick={() => {
                      setPendingDelete(user);
                    }}
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              );
            })}
          </section>

          <div className="uc-account-drawer__tools">
            <Button
              variant="secondary"
              block
              icon={<IconPlus size={16} />}
              disabled={accountBusy}
              onClick={onAddAccount}
            >
              添加账号
            </Button>
          </div>
        </div>
      </Drawer>

      {editOpen && activeUser !== null && (
        <EditAccountDialog
          key={accountKeyOf(activeUser.site, activeUser.username)}
          open={editOpen}
          onClose={() => {
            setEditOpen(false);
          }}
          accountKey={accountKeyOf(activeUser.site, activeUser.username)}
          user={activeUser}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => {
          setPendingDelete(null);
        }}
        onConfirm={handleDelete}
        title="删除账号"
        danger
        confirmText="确认删除"
      >
        删除「{pendingDelete?.username}」后，这个账号的课件配置与令牌也会一并移除。
      </ConfirmDialog>
    </>
  );
}
