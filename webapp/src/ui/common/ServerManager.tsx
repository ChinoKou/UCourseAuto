import {
  IconArrowLeft,
  IconCheck,
  IconLock,
  IconPencil,
  IconPlus,
  IconServer,
  IconTrash,
} from "@tabler/icons-react";
import { useId, useState } from "react";

import type { CustomSite } from "@/schema/domain/site";
import {
  BUILTIN_SITES,
  customSiteRef,
  customSiteToSite,
  isValidHttpUrl,
  siteHost,
  type Site,
} from "@/schema/domain/site";
import { useConfigStore } from "@/state/configStore";
import { Button } from "@/ui/common/Button";
import { Modal } from "@/ui/common/Dialog";
import { TextField } from "@/ui/common/Field";
import { useToast } from "@/ui/common/toast";

export interface ServerManagerProps {
  open: boolean;
  onClose: () => void;
  /** 保存后回传被选中或修改的站点引用值 */
  onSaved?: (ref: string) => void;
  /** 删除未使用的站点后回传其引用值 */
  onDeleted?: (ref: string) => void;
}

interface FormState {
  name: string;
  courseApi: string;
  uaApi: string;
}

const EMPTY_FORM: FormState = { name: "", courseApi: "", uaApi: "" };

/** 去掉首尾空白与末尾斜杠 */
const normalizeUrl = (value: string): string => value.trim().replace(/\/+$/, "");

/** 自定义站点表单转站点(用于预览) */
const previewSite = (form: FormState, id: string): Site | null => {
  if (!isValidHttpUrl(normalizeUrl(form.courseApi)) || !isValidHttpUrl(normalizeUrl(form.uaApi))) {
    return null;
  }
  return {
    ref: customSiteRef(id),
    name: form.name.trim() || "未命名站点",
    course_api: normalizeUrl(form.courseApi),
    ua_api: normalizeUrl(form.uaApi),
    builtin: false,
  };
};

/** 站点管理: 内置站点只读, 自定义站点可新增、修改与删除 */
export function ServerManager({
  open,
  onClose,
  onSaved,
  onDeleted,
}: ServerManagerProps) {
  const customSites = useConfigStore((state) => state.config.custom_sites);
  const users = useConfigStore((state) => state.config.users);
  const addCustomSite = useConfigStore((state) => state.addCustomSite);
  const updateCustomSite = useConfigStore((state) => state.updateCustomSite);
  const removeCustomSite = useConfigStore((state) => state.removeCustomSite);
  const toast = useToast();

  const formId = useId();
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = (): void => {
    setMode("list");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSubmitted(false);
    setFormError(null);
    setPendingDelete(null);
  };

  const handleClose = (): void => {
    reset();
    onClose();
  };

  const nameError =
    submitted && form.name.trim().length === 0 ? "给这个站点起一个名字" : null;
  const duplicatedName = customSites.some(
    (site) =>
      site.id !== editingId &&
      site.name.trim().toLowerCase() === form.name.trim().toLowerCase(),
  );
  const nameConflict =
    submitted && form.name.trim().length > 0 && duplicatedName
      ? "已经有同名的站点"
      : null;
  const courseApiError =
    submitted && !isValidHttpUrl(normalizeUrl(form.courseApi))
      ? "填写完整的 http 或 https 地址"
      : null;
  const uaApiError =
    submitted && !isValidHttpUrl(normalizeUrl(form.uaApi))
      ? "填写完整的 http 或 https 地址"
      : null;
  const formValid =
    form.name.trim().length > 0 &&
    !duplicatedName &&
    isValidHttpUrl(normalizeUrl(form.courseApi)) &&
    isValidHttpUrl(normalizeUrl(form.uaApi));

  const startCreate = (): void => {
    setMode("form");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSubmitted(false);
    setFormError(null);
  };

  const startEdit = (site: CustomSite): void => {
    setMode("form");
    setEditingId(site.id);
    setForm({
      name: site.name,
      courseApi: site.course_api,
      uaApi: site.ua_api,
    });
    setSubmitted(false);
    setFormError(null);
  };

  /** 正在编辑的站点当前被多少个账号引用 */
  const editingUsage =
    editingId === null
      ? 0
      : users.filter((user) => user.site === customSiteRef(editingId)).length;

  const handleSave = (): void => {
    setSubmitted(true);
    if (!formValid) {
      return;
    }
    setSaving(true);
    setFormError(null);
    if (editingId !== null) {
      const original = customSites.find((item) => item.id === editingId);
      if (original === undefined) {
        throw new Error(`站点不存在: ${editingId}`);
      }
      const addressChanged =
        normalizeUrl(form.courseApi) !== original.course_api ||
        normalizeUrl(form.uaApi) !== original.ua_api;
      if (addressChanged && editingUsage > 0) {
        setFormError(`有 ${editingUsage} 个账号使用该站点，地址不可修改`);
        setSaving(false);
        return;
      }
      if (
        !updateCustomSite(editingId, {
          name: form.name,
          course_api: form.courseApi,
          ua_api: form.uaApi,
        })
      ) {
        setFormError("站点没有写入，请刷新页面后重试");
        setSaving(false);
        return;
      }
      toast.push({ title: "站点已更新", tone: "success" });
      onSaved?.(customSiteRef(editingId));
    } else {
      const ref = addCustomSite({
        name: form.name,
        course_api: form.courseApi,
        ua_api: form.uaApi,
      });
      if (ref === null) {
        setFormError("站点没有写入，请刷新页面后重试");
        setSaving(false);
        return;
      }
      toast.push({ title: "站点已添加", tone: "success" });
      onSaved?.(ref);
      handleClose();
    }
    setSaving(false);
    setMode("list");
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleDelete = (site: CustomSite): void => {
    const ref = customSiteRef(site.id);
    if (pendingDelete !== site.id) {
      setPendingDelete(site.id);
      return;
    }
    if (!removeCustomSite(site.id)) {
      setPendingDelete(null);
      return;
    }
    toast.push({ title: `已删除「${site.name}」`, tone: "info" });
    setPendingDelete(null);
    onDeleted?.(ref);
  };

  const preview = previewSite(form, editingId ?? "preview");
  const customRows = customSites.map((site) => ({
    site,
    used: users.filter((user) => user.site === customSiteRef(site.id)).length,
  }));

  /** 地址只读只在编辑已有站点且存在引用账号时生效 */
  const addressLocked = editingId !== null && editingUsage > 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="lg"
      title={mode === "list" ? "站点" : editingId === null ? "添加站点" : "编辑站点"}
      description={
        mode === "list"
          ? "内置站点开箱即用；也可以连接自行部署的 优学院 平台。"
          : "填写站点名称与两个 API 地址，账号登录时会直接使用这里的地址。"
      }
      dismissible={!saving}
      footer={
        mode === "list" ? (
          <>
            <Button variant="ghost" onClick={handleClose}>
              完成
            </Button>
            <Button variant="primary" icon={<IconPlus size={16} />} onClick={startCreate}>
              添加站点
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              icon={<IconArrowLeft size={16} />}
              onClick={() => {
                setMode("list");
                setEditingId(null);
                setForm(EMPTY_FORM);
                setSubmitted(false);
              }}
            >
              返回列表
            </Button>
            <Button
              type="submit"
              form={formId}
              variant="primary"
              loading={saving}
              disabled={submitted && !formValid}
              icon={<IconCheck size={16} />}
            >
              保存站点
            </Button>
          </>
        )
      }
    >
      {mode === "list" ? (
        <div className="uc-server-list">
          {BUILTIN_SITES.map((site) => (
            <div className="uc-server-row" key={site.ref}>
              <span className="uc-server-row__icon">
                <IconServer size={18} stroke={1.7} />
              </span>
              <span className="uc-server-row__text">
                <span className="uc-server-row__name">
                  {site.name}
                  <span className="uc-tag">内置</span>
                </span>
                <span className="uc-server-row__host">{siteHost(site)}</span>
              </span>
              <span className="uc-server-row__lock">
                <IconLock size={14} />
              </span>
            </div>
          ))}

          {customRows.map(({ site, used }) => {
            const confirming = pendingDelete === site.id;
            return (
              <div className="uc-server-row uc-server-row--custom" key={site.id}>
                <span className="uc-server-row__icon uc-server-row__icon--custom">
                  <IconServer size={18} stroke={1.7} />
                </span>
                <span className="uc-server-row__text">
                  <span className="uc-server-row__name">
                    {site.name}
                    <span className="uc-tag uc-tag--accent">自定义</span>
                    {used > 0 && (
                      <span className="uc-server-row__used">{used} 个账号使用中</span>
                    )}
                  </span>
                  <span className="uc-server-row__host">
                    {siteHost(customSiteToSite(site))}
                  </span>
                </span>
                {confirming ? (
                  <span className="uc-server-row__confirm">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        handleDelete(site);
                      }}
                    >
                      确认删除
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setPendingDelete(null);
                      }}
                    >
                      取消
                    </Button>
                  </span>
                ) : (
                  <span className="uc-server-row__actions">
                    <button
                      type="button"
                      className="uc-icon-btn uc-icon-btn--sm"
                      aria-label={`编辑站点 ${site.name}`}
                      title="编辑"
                      onClick={() => {
                        startEdit(site);
                      }}
                    >
                      <IconPencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="uc-icon-btn uc-icon-btn--sm"
                      aria-label={`删除站点 ${site.name}`}
                      title={used > 0 ? "仍有账号使用，无法删除" : "删除"}
                      disabled={used > 0}
                      onClick={() => {
                        handleDelete(site);
                      }}
                    >
                      <IconTrash size={15} />
                    </button>
                  </span>
                )}
              </div>
            );
          })}

          {customSites.length === 0 && (
            <p className="uc-server-list__empty">
              还没有自定义站点。添加后，它会出现在登录页与账号设置的站点列表里。
            </p>
          )}
        </div>
      ) : (
        <form
          id={formId}
          className="uc-server-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleSave();
          }}
        >
          <TextField
            label="站点名称"
            value={form.name}
            error={nameError ?? nameConflict}
            hint="用于在列表中辨认，不会发送给平台。"
            maxLength={40}
            autoFocus
            onChange={(event) => {
              const value = event.currentTarget.value;
              setForm((current) => ({ ...current, name: value }));
            }}
          />
          <TextField
            label="课程 API 地址"
            placeholder="https://example.edu.cn/courseapi"
            value={form.courseApi}
            error={courseApiError}
            hint={
              addressLocked
                ? "有账号使用，地址不可修改。"
                : "对应登录、课程、教材与视频行为接口。"
            }
            readOnly={addressLocked}
            disabled={saving}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className="uc-input--mono"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setForm((current) => ({ ...current, courseApi: value }));
            }}
          />
          <TextField
            label="用户 API 地址"
            placeholder="https://example.edu.cn/uaapi"
            value={form.uaApi}
            error={uaApiError}
            hint={
              addressLocked
                ? "有账号使用，地址不可修改。"
                : "对应章节、学习记录、答案与上报接口。"
            }
            readOnly={addressLocked}
            disabled={saving}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            className="uc-input--mono"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setForm((current) => ({ ...current, uaApi: value }));
            }}
          />

          {formError !== null && (
            <p className="uc-field__error" role="alert">
              {formError}
            </p>
          )}

          {preview !== null && (
            <div className="uc-server-preview">
              <span className="uc-server-preview__label">将连接</span>
              <span className="uc-server-preview__name">{preview.name}</span>
              <span className="uc-server-preview__host uc-mono">{siteHost(preview)}</span>
            </div>
          )}

          {(normalizeUrl(form.courseApi).startsWith("http://") ||
            normalizeUrl(form.uaApi).startsWith("http://")) && (
            <p className="uc-form-note">
              http 地址只适合本地调试。页面以 https 打开时，浏览器会拦截这类请求。
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}
