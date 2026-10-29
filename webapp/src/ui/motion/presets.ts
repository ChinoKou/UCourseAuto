import type { Transition, Variants } from "motion/react";

/** 页面切换与卡片入场共用的弹簧 */
export const springSoft: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 30,
  mass: 0.8,
};

/** 页面切换 */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: springSoft },
  exit: { opacity: 0, y: -10, transition: { duration: 0.18, ease: "easeIn" } },
};

/** 卡片与列表的逐项入场 */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.055, delayChildren: 0.04 },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 16, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1, transition: springSoft },
};

/** 淡入 */
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.16 } },
};
