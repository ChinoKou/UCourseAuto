import { createContext, useContext } from "react";

/** 提示条语气 */
export type ToastTone = "info" | "success" | "warning" | "error";

/** 一条提示的内容 */
export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
}

/** 提示上下文值 */
export interface ToastContextValue {
  push: (input: ToastInput) => void;
}

/** 提示上下文 */
export const ToastContext = createContext<ToastContextValue | null>(null);

/** 读取提示上下文, 不在 ToastProvider 内时抛出 */
export const useToast = (): ToastContextValue => {
  const value = useContext(ToastContext);
  if (value === null) {
    throw new Error("useToast 必须在 ToastProvider 内使用");
  }
  return value;
};
