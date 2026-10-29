import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { IconEye, IconEyeOff } from "@tabler/icons-react";

interface FieldShellProps {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  extra?: ReactNode;
}

/** 表单字段外壳: 标签、控件、提示与错误 */
function FieldShell({ id, label, hint, error, children, extra }: FieldShellProps) {
  return (
    <div className="uc-field">
      <div className="uc-field__head">
        <label className="uc-field__label" htmlFor={id}>
          {label}
        </label>
        {extra}
      </div>
      {children}
      {error !== undefined && error !== null ? (
        <p className="uc-field__error" role="alert">
          {error}
        </p>
      ) : (
        hint !== undefined && <p className="uc-field__hint">{hint}</p>
      )}
    </div>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
  icon?: ReactNode;
  trailing?: ReactNode;
  extra?: ReactNode;
}

/** 单行文本输入 */
export function TextField({
  label,
  hint,
  error,
  icon,
  trailing,
  extra,
  id,
  className,
  ...rest
}: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FieldShell
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      extra={extra}
    >
      <div className={`uc-input-shell ${error ? "is-invalid" : ""}`}>
        {icon !== undefined && <span className="uc-input-shell__icon">{icon}</span>}
        <input
          id={fieldId}
          className={`uc-input ${className ?? ""}`}
          aria-invalid={error !== undefined && error !== null}
          {...rest}
        />
        {trailing !== undefined && (
          <span className="uc-input-shell__trailing">{trailing}</span>
        )}
      </div>
    </FieldShell>
  );
}

export interface PasswordFieldProps
  extends Omit<TextFieldProps, "type" | "trailing"> {
  /** 初始是否显示明文 */
  defaultVisible?: boolean;
}

/** 带显示切换的密码输入 */
export function PasswordField({
  defaultVisible = false,
  ...rest
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(defaultVisible);
  return (
    <TextField
      {...rest}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          className="uc-input-action"
          aria-label={visible ? "隐藏密码" : "显示密码"}
          title={visible ? "隐藏密码" : "显示密码"}
          onClick={() => {
            setVisible((current) => !current);
          }}
        >
          {visible ? <IconEyeOff size={17} /> : <IconEye size={17} />}
        </button>
      }
    />
  );
}

export interface TextAreaFieldProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

/** 多行文本输入 */
export function TextAreaField({
  label,
  hint,
  error,
  id,
  className,
  ...rest
}: TextAreaFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      <textarea
        id={fieldId}
        className={`uc-input uc-textarea ${className ?? ""}`}
        aria-invalid={error !== undefined && error !== null}
        {...rest}
      />
    </FieldShell>
  );
}
