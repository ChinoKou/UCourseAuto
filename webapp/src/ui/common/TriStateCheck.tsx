import { useEffect, useRef } from "react";

export interface TriStateCheckProps {
  checked: boolean;
  indeterminate?: boolean;
  onToggle: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}

/** 原生复选框: 支持半选状态, 点击不冒泡到行展开 */
export function TriStateCheck({
  checked,
  indeterminate = false,
  onToggle,
  label,
  disabled = false,
}: TriStateCheckProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current !== null) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className="uc-checkbox uc-tree-check"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
      }}
      onChange={(event) => {
        onToggle(event.currentTarget.checked);
      }}
    />
  );
}
