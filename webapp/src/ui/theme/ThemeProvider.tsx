import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  THEME_STORAGE_KEY,
  ThemeContext,
  applyTheme,
  readThemePreference,
  resolveTheme,
  type ThemePreference,
} from "@/ui/theme/theme";

/** 提供主题偏好、系统主题监听与写入 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(
    readThemePreference,
  );
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  const resolved = resolveTheme(preference, systemDark);

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent): void => {
      setSystemDark(event.matches);
    };
    media.addEventListener("change", handleChange);
    return () => {
      media.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent): void => {
      if (event.key === THEME_STORAGE_KEY) {
        setPreferenceState(readThemePreference());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference): void => {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    setPreferenceState(next);
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
