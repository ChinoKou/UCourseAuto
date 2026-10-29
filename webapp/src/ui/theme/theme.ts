import { createContext, useContext } from "react";

/** 主题偏好: 跟随系统 / 固定浅色 / 固定深色 */
export type ThemePreference = "system" | "light" | "dark";

/** 实际生效的主题 */
export type ResolvedTheme = "light" | "dark";

/** 主题偏好的存储键 */
export const THEME_STORAGE_KEY = "ucourse_theme";

/** 主题上下文值 */
export interface ThemeContextValue {
  /** 用户选择的偏好 */
  preference: ThemePreference;
  /** 当前实际主题 */
  resolved: ResolvedTheme;
  /** 修改偏好并写入 localStorage */
  setPreference: (next: ThemePreference) => void;
}

/** 主题上下文 */
export const ThemeContext = createContext<ThemeContextValue | null>(null);

/** 读取主题偏好, 未设置或值异常时跟随系统 */
export const readThemePreference = (): ThemePreference => {
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") {
    return raw;
  }
  return "system";
};

/** 根据偏好与系统状态计算实际主题 */
export const resolveTheme = (
  preference: ThemePreference,
  systemDark: boolean,
): ResolvedTheme => {
  if (preference === "system") {
    return systemDark ? "dark" : "light";
  }
  return preference;
};

/** 把主题写到文档根元素与 theme-color */
export const applyTheme = (theme: ResolvedTheme): void => {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta !== null) {
    meta.setAttribute("content", theme === "dark" ? "#0c0c0e" : "#f1eee8");
  }
};

/** 读取当前主题上下文, 不在 ThemeProvider 内时抛出 */
export const useTheme = (): ThemeContextValue => {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error("useTheme 必须在 ThemeProvider 内使用");
  }
  return value;
};
