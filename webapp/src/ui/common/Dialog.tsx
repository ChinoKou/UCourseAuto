import { Dialog } from "@base-ui/react/dialog";
import { IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";

import { Button } from "@/ui/common/Button";

/** 弹窗宽度 */
export type ModalSize = "sm" | "md" | "lg" | "xl";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
  /** 为 false 时点击遮罩与 Esc 不关闭 */
  dismissible?: boolean;
  /** 标题左侧的图形 */
  eyebrow?: ReactNode;
  className?: string;
}

/** 居中弹窗: Base UI Dialog 提供焦点陷阱、滚动锁定与 Esc */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
  dismissible = true,
  eyebrow,
  className,
}: ModalProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && dismissible) {
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="uc-backdrop" />
        <Dialog.Popup
          className={[
            "uc-modal",
            `uc-modal--${size}`,
            className ?? "",
          ]
            .filter((item) => item !== "")
            .join(" ")}
        >
          <header className="uc-modal__head">
            <div className="uc-modal__heading">
              {eyebrow !== undefined && (
                <span className="uc-modal__eyebrow">{eyebrow}</span>
              )}
              <Dialog.Title className="uc-modal__title">{title}</Dialog.Title>
              {description !== undefined && (
                <Dialog.Description className="uc-modal__desc">
                  {description}
                </Dialog.Description>
              )}
            </div>
            {dismissible && (
              <Dialog.Close className="uc-icon-btn" aria-label="关闭弹窗">
                <IconX size={18} stroke={1.8} />
              </Dialog.Close>
            )}
          </header>
          <div className="uc-modal__body">{children}</div>
          {footer !== undefined && <footer className="uc-modal__footer">{footer}</footer>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

/** 右侧抽屉: 账号管理等次级面板 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 420,
}: DrawerProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="uc-backdrop uc-backdrop--drawer" />
        <Dialog.Popup className="uc-drawer" style={{ width }}>
          <header className="uc-drawer__head">
            <div className="uc-drawer__heading">
              <Dialog.Title className="uc-drawer__title">{title}</Dialog.Title>
              {description !== undefined && (
                <Dialog.Description className="uc-drawer__desc">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="uc-icon-btn" aria-label="关闭面板">
              <IconX size={18} stroke={1.8} />
            </Dialog.Close>
          </header>
          <div className="uc-drawer__body">{children}</div>
          {footer !== undefined && <footer className="uc-drawer__footer">{footer}</footer>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  busy?: boolean;
}

/** 危险或不可逆操作的二次确认 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmText = "确认",
  cancelText = "取消",
  danger = false,
  busy = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      dismissible={!busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelText}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            loading={busy}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="uc-confirm-text">{children}</div>
    </Modal>
  );
}
