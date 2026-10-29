import { motion, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";

export interface AnimatedNumberProps {
  value: number;
  /** 小数位, 默认 0 */
  decimals?: number;
  className?: string;
}

/** 数字滚动: 数值变化时以弹簧过渡到新值 */
export function AnimatedNumber({
  value,
  decimals = 0,
  className,
}: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const spring = useSpring(value, { stiffness: 110, damping: 24, mass: 0.7 });
  const text = useTransform(spring, (latest) =>
    latest.toLocaleString("zh-CN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }),
  );

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  if (reduced) {
    return (
      <span className={className}>
        {value.toLocaleString("zh-CN", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}
      </span>
    );
  }

  return <motion.span className={className}>{text}</motion.span>;
}
