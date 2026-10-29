import { IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";

import { useTheme, type ThemePreference } from "@/ui/theme/theme";

/** 单按钮轮换的外观顺序: 跟随系统 → 浅色 → 深色 */
const ORDER: ReadonlyArray<ThemePreference> = ["system", "light", "dark"];

const LABELS: Record<ThemePreference, string> = {
  system: "跟随系统",
  light: "浅色",
  dark: "深色",
};

/** 顶栏外观按钮: 每点一次按顺序切换到下一种外观 */
export function ThemeToggle() {
  const theme = useTheme();
  const index = ORDER.indexOf(theme.preference);
  const next = ORDER[(index + 1) % ORDER.length];

  const icon =
    theme.preference === "system" ? (
      <IconDeviceDesktop size={17} />
    ) : theme.resolved === "dark" ? (
      <IconMoon size={17} />
    ) : (
      <IconSun size={17} />
    );

  return (
    <button
      type="button"
      className="uc-icon-btn uc-theme-trigger"
      aria-label={`外观：${LABELS[theme.preference]}，点击切换到${LABELS[next]}`}
      title={`外观：${LABELS[theme.preference]}`}
      onClick={() => {
        theme.setPreference(next);
      }}
    >
      {icon}
    </button>
  );
}
