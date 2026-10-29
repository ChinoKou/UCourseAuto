import { useState } from "react";

import type { UserConfig } from "@/schema/domain/config";
import { accountKeyOf } from "@/schema/domain/config";
import { allSites, findSite } from "@/schema/domain/site";
import { useConfigStore } from "@/state/configStore";
import { updateCredential } from "@/usecases/signIn";
import { initialEditForm } from "@/ui/account/editAccountForm";
import { usePorts } from "@/ui/app/ports";
import { Button } from "@/ui/common/Button";
import { ConfirmDialog, Modal } from "@/ui/common/Dialog";
import { PasswordField } from "@/ui/common/Field";
import { ServerSelect } from "@/ui/common/ServerSelect";
import { useToast } from "@/ui/common/toast";

export interface EditAccountDialogProps {
  open: boolean;
  onClose: () => void;
  /** 账号键, 用于在配置中定位当前账号 */
  accountKey: string;
  user: UserConfig;
}

/** 修改当前账号的站点与密码, 保存前自动重新登录校验 */
export function EditAccountDialog({ open, onClose, accountKey, user }: EditAccountDialogProps) {
  const customSites = useConfigStore((state) => state.config.custom_sites);
  const updateAccount = useConfigStore((state) => state.updateAccount);
  const saveIdentity = useConfigStore((state) => state.saveIdentity);
  const ports = usePorts();
  const toast = useToast();

  const sites = allSites(customSites);
  const initial = initialEditForm(user);
  const [siteRef, setSiteRef] = useState(initial.siteRef);
  const [password, setPassword] = useState(initial.password);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [siteChangeOpen, setSiteChangeOpen] = useState(false);

  const siteChanged = siteRef !== user.site;
  const changed = siteRef !== user.site || password !== user.password;

  const save = async (): Promise<void> => {
    if (!changed || submitting) {
      return;
    }
    const nextSite = findSite(siteRef, customSites);
    if (nextSite === null) {
      setError("站点配置缺失，请重新登录这个账号。");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // 先取得登录结果, 成功后再写入, 保存过程中账号资料不会出现空值
      const result = await updateCredential(ports.signIn, {
        username: user.username,
        nextSite,
        nextPassword: password,
      });
      if (result.status === "failed") {
        setError(result.error.message);
        return;
      }
      const written = updateAccount(accountKey, {
        siteRef: result.data.siteRef,
        password: result.data.password,
        token: result.data.token,
      });
      if (!written) {
        setError("账号信息没有写入，请刷新页面后重试。");
        return;
      }
      saveIdentity(
        accountKeyOf(result.data.siteRef, result.data.username),
        result.data.identity,
      );
      toast.push({ title: "账号信息已更新", tone: "success" });
      setSiteChangeOpen(false);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = (): void => {
    if (!changed || submitting) {
      return;
    }
    if (siteChanged) {
      setSiteChangeOpen(true);
      return;
    }
    void save();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="sm"
        title="编辑账号"
        description={`${user.username} · 修改后会立即重新登录校验，失败时账号资料保持不变。`}
        dismissible={!submitting}
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <Button
              variant="primary"
              loading={submitting}
              disabled={!changed}
              onClick={handleSave}
            >
              保存并验证
            </Button>
          </>
        }
      >
        <div className="uc-stack">
          {error !== null && (
            <div className="uc-alert uc-alert--danger" role="alert">
              <span>{error}</span>
            </div>
          )}
          <div className="uc-field">
            <div className="uc-field__head">
              <span className="uc-field__label">站点</span>
            </div>
            <ServerSelect
              value={siteRef}
              onChange={setSiteRef}
              sites={sites}
              onManage={() => {}}
              showManage={false}
              disabled={submitting}
            />
          </div>
          <PasswordField
            label="密码"
            autoComplete="current-password"
            value={password}
            disabled={submitting}
            onChange={(event) => {
              setPassword(event.currentTarget.value);
            }}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={siteChangeOpen}
        onClose={() => {
          setSiteChangeOpen(false);
        }}
        onConfirm={() => {
          void save();
        }}
        title="更换账号站点？"
        danger
        busy={submitting}
        confirmText="更换并清空课件"
      >
        更换站点后，这个账号的课件树会被清空，需要重新配置。密码与令牌会按新站点重新验证。
      </ConfirmDialog>
    </>
  );
}
