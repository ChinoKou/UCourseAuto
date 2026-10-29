import {
  IconArrowRight,
  IconHome,
  IconLock,
  IconLogin,
  IconUserCheck,
} from "@tabler/icons-react";
import { motion } from "motion/react";

import { navigate } from "@/ui/app/routes";
import { Button } from "@/ui/common/Button";

export interface AuthGateOverlayProps {
  title: string;
  description: string;
  onLogin: () => void;
}

/**
 * 未登录用户访问工作台或课件库时的毛玻璃阻断提醒层
 */
export function AuthGateOverlay({
  title,
  description,
  onLogin,
}: AuthGateOverlayProps) {
  return (
    <div className="uc-auth-gate" role="region" aria-label="未登录提示">
      <motion.div
        className="uc-auth-gate__card"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="uc-auth-gate__badge">
          <IconUserCheck size={14} />
          <span>需要登录账号</span>
        </div>

        <div className="uc-auth-gate__icon-wrap">
          <div className="uc-auth-gate__icon">
            <IconLock size={26} stroke={1.9} />
          </div>
        </div>

        <h2 className="uc-auth-gate__title">{title}</h2>
        <p className="uc-auth-gate__desc">{description}</p>

        <div className="uc-auth-gate__features">
          <span className="uc-auth-gate__chip">浏览器直接请求</span>
          <span className="uc-auth-gate__chip">数据存留本地</span>
          <span className="uc-auth-gate__chip">随时退出清理</span>
        </div>

        <div className="uc-auth-gate__actions">
          <Button
            variant="primary"
            size="lg"
            block
            icon={<IconLogin size={17} />}
            onClick={onLogin}
          >
            <span>登录 / 添加账号</span>
            <IconArrowRight size={15} />
          </Button>
          <Button
            variant="secondary"
            size="lg"
            block
            icon={<IconHome size={17} />}
            onClick={() => {
              navigate("home");
            }}
          >
            回到首页
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
