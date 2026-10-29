import type { ButtonHTMLAttributes, ReactNode } from "react";

/** 按钮外观 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "quiet";

/** 按钮尺寸 */
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
  block?: boolean;
}

/** 统一按钮: 原生 button 语义, loading 时禁用并展示转圈 */
export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  trailing,
  block = false,
  className,
  disabled,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [
    "uc-btn",
    `uc-btn--${variant}`,
    `uc-btn--${size}`,
    block ? "uc-btn--block" : "",
    className ?? "",
  ]
    .filter((item) => item !== "")
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled === true || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading ? (
        <span className="uc-spinner" aria-hidden="true" />
      ) : (
        icon !== undefined && <span className="uc-btn__icon">{icon}</span>
      )}
      <span className="uc-btn__label">{children}</span>
      {trailing !== undefined && <span className="uc-btn__trailing">{trailing}</span>}
    </button>
  );
}
