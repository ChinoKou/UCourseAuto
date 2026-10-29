import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { useId, type ReactNode } from "react";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
  /** 开关右侧的补充标识 */
  badge?: ReactNode;
}

/** 开关行: 左侧标题与说明, 右侧开关 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  badge,
}: SwitchProps) {
  const id = useId();
  return (
    <div className={`uc-switch-row ${disabled ? "is-disabled" : ""}`}>
      <div className="uc-switch-row__text">
        <div className="uc-switch-row__title">
          <label htmlFor={id}>{label}</label>
          {badge}
        </div>
        {description !== undefined && (
          <p className="uc-switch-row__desc">{description}</p>
        )}
      </div>
      <BaseSwitch.Root
        id={id}
        className="uc-switch"
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      >
        <BaseSwitch.Thumb className="uc-switch__thumb" />
      </BaseSwitch.Root>
    </div>
  );
}
