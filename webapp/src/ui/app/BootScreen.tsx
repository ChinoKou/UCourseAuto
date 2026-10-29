import { motion, useReducedMotion } from "motion/react";

import { LogoMark } from "@/ui/common/Logo";

export interface BootScreenProps {
  /** 0 到 100 */
  progress: number;
  label: string;
}

/** 启动加载屏: 等待字体与会话结算，完成后平滑淡出 */
export function BootScreen({ progress, label }: BootScreenProps) {
  const reduced = useReducedMotion();
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <motion.div
      className="uc-boot"
      initial={{ opacity: 1 }}
      exit={
        reduced
          ? { opacity: 0 }
          : { opacity: 0, scale: 1.02, filter: "blur(8px)" }
      }
      transition={{ duration: reduced ? 0 : 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="uc-boot__aurora" aria-hidden="true" />
      <div className="uc-boot__grid" aria-hidden="true" />

      <div className="uc-boot__stage">
        <div className="uc-boot__mark">
          <span className="uc-boot__halo" aria-hidden="true" />
          <span className="uc-boot__ring" aria-hidden="true" />
          <LogoMark size={72} />
        </div>

        <div className="uc-boot__word">
          <h1 className="uc-boot__name">
            UCourse<span>Auto</span>
          </h1>
        </div>

        <div className="uc-boot__meter">
          <div
            className="uc-boot__track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(clamped)}
            aria-label="正在加载"
          >
            <span
              className="uc-boot__fill"
              style={{ width: `${clamped}%` }}
            />
          </div>
          <div className="uc-boot__status">
            <span>{label}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
