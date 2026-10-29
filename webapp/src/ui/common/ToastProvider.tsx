import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
  IconX,
} from "@tabler/icons-react";

import { subscribeNotices, type AppNotice } from "@/error/report";
import {
  ToastContext,
  type ToastInput,
  type ToastTone,
} from "@/ui/common/toast";

/** 自动消失时长(毫秒) */
const AUTO_DISMISS_MS = 4600;

/** 同时可见的提示上限 */
const MAX_VISIBLE = 4;

interface ToastItem extends ToastInput {
  id: number;
  tone: ToastTone;
}

const TONE_ICON: Record<ToastTone, ReactNode> = {
  info: <IconInfoCircle size={18} stroke={1.8} />,
  success: <IconCircleCheck size={18} stroke={1.8} />,
  warning: <IconAlertTriangle size={18} stroke={1.8} />,
  error: <IconAlertTriangle size={18} stroke={1.8} />,
};

/** 提供全局提示条, 并承接逻辑层上报的错误与警告 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const recentRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: number): void => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (input: ToastInput): void => {
      nextId.current += 1;
      const item: ToastItem = {
        ...input,
        id: nextId.current,
        tone: input.tone ?? "info",
      };
      setItems((current) => [...current.slice(-(MAX_VISIBLE - 1)), item]);
      window.setTimeout(() => {
        dismiss(item.id);
      }, AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push }), [push]);

  useEffect(() => {
    const handleNotice = (notice: AppNotice): void => {
      const key = `${notice.level}:${notice.title}:${notice.message ?? ""}`;
      const now = Date.now();
      const last = recentRef.current.get(key);
      if (last !== undefined && now - last < 2400) {
        return;
      }
      recentRef.current.set(key, now);
      push({
        title: notice.title,
        description: notice.message,
        tone: notice.level,
      });
    };
    return subscribeNotices(handleNotice);
  }, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="uc-toasts" aria-live="polite">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.div
                key={item.id}
                layout
                className={`uc-toast uc-toast--${item.tone}`}
                role={item.tone === "error" ? "alert" : "status"}
                initial={{ opacity: 0, y: -14, x: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, x: 8, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              >
                <span className="uc-toast__icon">{TONE_ICON[item.tone]}</span>
                <span className="uc-toast__text">
                  <span className="uc-toast__title">{item.title}</span>
                  {item.description !== undefined && (
                    <span className="uc-toast__desc">{item.description}</span>
                  )}
                </span>
                <button
                  type="button"
                  className="uc-toast__close"
                  aria-label="关闭提示"
                  onClick={() => {
                    dismiss(item.id);
                  }}
                >
                  <IconX size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
