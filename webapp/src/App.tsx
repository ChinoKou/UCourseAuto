import { MotionConfig } from "motion/react";

import { AppRoot } from "@/ui/app/AppRoot";
import { PortsProvider, type AppPorts } from "@/ui/app/ports";
import { ToastProvider } from "@/ui/common/ToastProvider";
import { ThemeProvider } from "@/ui/theme/ThemeProvider";

export interface AppProps {
  /** 装配根构造的业务动作端口 */
  ports: AppPorts;
}

/** 应用入口: 端口注入、主题、提示与全局动效降级 */
export default function App({ ports }: AppProps) {
  return (
    <PortsProvider value={ports}>
      <ThemeProvider>
        <ToastProvider>
          <MotionConfig reducedMotion="user">
            <AppRoot />
          </MotionConfig>
        </ToastProvider>
      </ThemeProvider>
    </PortsProvider>
  );
}
