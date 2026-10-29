import { Dialog } from "@base-ui/react/dialog";
import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";

import {
  buildIssueUrl,
  formatErrorDetail,
  formatRawResponse,
  type AppErrorDetail,
} from "@/error/report";
import { Button } from "@/ui/common/Button";
import { useToast } from "@/ui/common/toast";

export interface ErrorOverlayProps {
  report: AppErrorDetail | null;
  onClose: () => void;
  /** 面向用户的标题, 缺省使用 reports 的 title */
  headline?: string;
}

const formatTime = (time: Date): string => {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())} ${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
};

/** 错误详情面板: 全面重构为结构化、现代化诊断抽屉，支持精确节点提示与一键复制 */
export function ErrorOverlay({ report, onClose, headline }: ErrorOverlayProps) {
  const toast = useToast();
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const copied = report !== null && copiedId === report.id;

  const open = report !== null;

  const handleCopy = async (): Promise<void> => {
    if (report === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(formatErrorDetail(report));
      setCopiedId(report.id);
      toast.push({ title: "完整错误日志已复制到剪贴板", tone: "success" });
    } catch (error) {
      toast.push({
        title: "复制日志未能成功",
        description: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    }
  };

  const handleCopyRaw = async (): Promise<void> => {
    if (report?.raw === undefined || report.raw === "") {
      return;
    }
    try {
      await navigator.clipboard.writeText(formatRawResponse(report.raw));
      setCopiedRaw(true);
      setTimeout(() => {
        setCopiedRaw(false);
      }, 2000);
      toast.push({ title: "原始响应文本已复制", tone: "success" });
    } catch (error) {
      toast.push({
        title: "复制原始响应未能成功",
        description: error instanceof Error ? error.message : String(error),
        tone: "error",
      });
    }
  };

  const handleIssue = (): void => {
    if (report === null) {
      return;
    }
    window.open(buildIssueUrl(report), "_blank", "noopener,noreferrer");
  };

  const rawFormatted =
    report?.raw !== undefined && report.raw !== ""
      ? formatRawResponse(report.raw)
      : "";

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
        <Dialog.Backdrop className="uc-backdrop uc-error-backdrop" />
        <Dialog.Popup className="uc-error-panel">
          {/* 顶部彩色指示条 */}
          <div className="uc-error-panel__topbar" aria-hidden="true" />

          {/* 标题头部 */}
          <header className="uc-error-panel__head">
            <div className="uc-error-panel__icon-wrap">
              <span className="uc-error-panel__icon">
                <IconAlertTriangle size={24} stroke={2} />
              </span>
            </div>

            <div className="uc-error-panel__heading">
              <div className="uc-error-panel__capsules">
                <span className="uc-error-tag uc-error-tag--status">
                  {report?.status !== undefined
                    ? `HTTP ${report.status}`
                    : "接口异常"}
                </span>
                {report?.cause !== undefined && (
                  <span className="uc-error-tag uc-error-tag--cause uc-mono">
                    {report.cause}
                  </span>
                )}
                {report?.targetName !== undefined && (
                  <span className="uc-error-tag uc-error-tag--target">
                    {report.targetKind === "chapter"
                      ? "章节: "
                      : report.targetKind === "textbook"
                        ? "教材: "
                        : "目标: "}
                    {report.targetName}
                  </span>
                )}
                <span className="uc-error-tag uc-error-tag--time uc-mono">
                  {report === null ? "" : formatTime(report.time)}
                </span>
              </div>

              <Dialog.Title className="uc-error-panel__title">
                {headline ?? report?.title ?? "课件同步未能完成"}
              </Dialog.Title>

              <Dialog.Description className="uc-error-panel__message">
                {report?.message ?? ""}
              </Dialog.Description>
            </div>

            <Dialog.Close className="uc-icon-btn uc-error-panel__close" aria-label="关闭诊断窗口">
              <IconX size={18} stroke={2} />
            </Dialog.Close>
          </header>

          {/* 诊断详情主体 */}
          <div className="uc-error-panel__body">
            {/* 诊断指标卡片 */}
            <div className="uc-error-panel__cards">
              <div className="uc-error-card">
                <span className="uc-error-card__label">请求接口端点</span>
                <span className="uc-error-card__value uc-mono" title={report?.endpoint}>
                  {report?.endpoint ?? "未记录接口地址"}
                </span>
              </div>
              <div className="uc-error-card">
                <span className="uc-error-card__label">响应状态</span>
                <span className="uc-error-card__value uc-mono">
                  {report?.status !== undefined ? `${report.status} (OK/FAIL)` : "无响应"}
                </span>
              </div>
              <div className="uc-error-card">
                <span className="uc-error-card__label">所属节点</span>
                <span className="uc-error-card__value" title={report?.targetName}>
                  {report?.targetName ?? "全课程或未定位"}
                </span>
              </div>
            </div>

            {/* 原始响应展示卡片 */}
            <section className="uc-error-raw">
              <header className="uc-error-raw__head">
                <div className="uc-error-raw__title-group">
                  <span>原始接口响应数据</span>
                  {rawFormatted !== "" && (
                    <span className="uc-error-raw__size uc-mono">
                      {rawFormatted.length} 字符
                    </span>
                  )}
                </div>
                {rawFormatted !== "" && (
                  <button
                    type="button"
                    className="uc-text-link uc-error-raw__copy-btn"
                    onClick={() => {
                      void handleCopyRaw();
                    }}
                  >
                    {copiedRaw ? (
                      <>
                        <IconCheck size={13} stroke={2.5} />
                        <span>已复制响应体</span>
                      </>
                    ) : (
                      <>
                        <IconCopy size={13} />
                        <span>复制响应体</span>
                      </>
                    )}
                  </button>
                )}
              </header>
              <pre className="uc-error-raw__body">
                {rawFormatted !== "" ? rawFormatted : "没有记录到原始接口响应文本。"}
              </pre>
            </section>
          </div>

          {/* 底部操作工具条 */}
          <footer className="uc-error-panel__foot">
            <span className="uc-error-panel__privacy">
              提示: 提交 Issue 或复制错误前，请确认数据中不包含个人账号或敏感凭证。
            </span>
            <div className="uc-error-panel__actions">
              <Dialog.Close className="uc-btn uc-btn--ghost uc-btn--sm">
                关闭
              </Dialog.Close>
              <Button
                variant="secondary"
                size="sm"
                icon={<IconExternalLink size={15} />}
                onClick={handleIssue}
              >
                在 GitHub 创建 Issue
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={copied ? <IconCheck size={15} stroke={2.5} /> : <IconCopy size={15} />}
                onClick={() => {
                  void handleCopy();
                }}
              >
                {copied ? "已复制完整日志" : "复制错误日志"}
              </Button>
            </div>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
