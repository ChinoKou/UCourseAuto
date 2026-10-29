import {
  IconAlertTriangle,
  IconBook2,
  IconBooks,
  IconChevronRight,
  IconFileText,
  IconFolder,
  IconListDetails,
  IconLoader2,
} from "@tabler/icons-react";
import type { CSSProperties, ReactNode } from "react";

/** 课件树层级: 决定默认图标与色调 */
export type TreeTone = "course" | "textbook" | "chapter" | "section" | "page";

/** 树节点状态: 已完成、当前路径、正在处理、当前节点、尚未开始、发生异常、已跳过 */
export type TreeState =
  | "done"
  | "path"
  | "active"
  | "current"
  | "pending"
  | "error"
  | "skipped";

export interface TreeRowProps {
  depth: number;
  tone: TreeTone;
  title: string;
  meta?: string;
  state?: TreeState;
  /** 发生异常时的简短说明提示 */
  errorHint?: string;
  /** 后代页面完成度, 0 到 100; 提供时在行底部显示完成条 */
  percent?: number;
  expanded?: boolean;
  onToggle?: () => void;
  /** 行首插槽: 复选框等 */
  leading?: ReactNode;
  /** 行尾插槽: 计数、状态与删除按钮 */
  trailing?: ReactNode;
  /** 覆盖默认层级图标 */
  icon?: ReactNode;
}

const iconOf = (tone: TreeTone, state?: TreeState): ReactNode => {
  if (state === "error") {
    return <IconAlertTriangle size={14} />;
  }
  if (state === "active") {
    return <IconLoader2 size={14} className="uc-spin" />;
  }
  switch (tone) {
    case "course":
      return <IconBooks size={15} />;
    case "textbook":
      return <IconBook2 size={14} />;
    case "chapter":
      return <IconFolder size={14} />;
    case "section":
      return <IconListDetails size={14} />;
    case "page":
      return <IconFileText size={13} />;
  }
};

/** 课件树的一行: 课程库、配置向导与首页课件库卡片共用 */
export function TreeRow({
  depth,
  tone,
  title,
  meta,
  state = "pending",
  errorHint,
  percent,
  expanded = false,
  onToggle,
  leading,
  trailing,
  icon,
}: TreeRowProps) {
  const style = { "--depth": String(depth) } as CSSProperties;
  const content = (
    <>
      {onToggle !== undefined && (
        <span className="uc-tree__toggle" aria-hidden="true">
          <IconChevronRight size={14} />
        </span>
      )}
      <span className="uc-tree__icon">{icon ?? iconOf(tone, state)}</span>
      <span className="uc-tree__body">
        <span className="uc-tree__title">{title}</span>
        {meta !== undefined && meta !== "" && (
          <span className="uc-tree__meta">{meta}</span>
        )}
        {errorHint !== undefined && errorHint !== "" && (
          <span className="uc-tree__error-hint">{errorHint}</span>
        )}
      </span>
    </>
  );

  return (
    <div
      className={`uc-tree__row is-${state} tone-${tone} ${depth > 0 ? "is-nested" : ""}`}
      style={style}
    >
      {leading !== undefined && <span className="uc-tree__lead">{leading}</span>}
      {onToggle === undefined ? (
        <div className="uc-tree__main">{content}</div>
      ) : (
        <button
          type="button"
          className="uc-tree__main"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          {content}
        </button>
      )}
      {trailing !== undefined && <span className="uc-tree__tail">{trailing}</span>}
      {percent !== undefined && (
        <span
          className="uc-tree__rail"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={`${title} 完成度`}
        >
          <span
            style={{ transform: `scaleX(${Math.min(100, Math.max(0, percent)) / 100})` }}
          />
        </span>
      )}
    </div>
  );
}
