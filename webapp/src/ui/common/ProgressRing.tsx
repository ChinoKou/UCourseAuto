import { motion, useReducedMotion } from "motion/react";
import { useId, type ReactNode } from "react";

export interface ProgressRingProps {
  /** 0 到 100 */
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  /** 轨道颜色是否更淡 */
  quiet?: boolean;
}

/** 环形进度: 渐变弧线 + 中心内容 */
export function ProgressRing({
  value,
  size = 132,
  stroke = 8,
  children,
  quiet = false,
}: ProgressRingProps) {
  const gradientId = useId();
  const reduced = useReducedMotion();
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="uc-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="var(--ring-from)" />
            <stop offset="1" stopColor="var(--ring-to)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
          opacity={quiet ? 0.5 : 1}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={
            reduced
              ? { duration: 0 }
              : { type: "spring", stiffness: 90, damping: 20 }
          }
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children !== undefined && <div className="uc-ring__center">{children}</div>}
    </div>
  );
}
