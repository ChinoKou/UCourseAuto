import { createContext, useContext } from "react";

import type {
  ConfigurePorts,
  ConfigObserver,
  PrunePorts,
  RunPorts,
  SignInPorts,
} from "@/usecases/ports";

/**
 * 界面可用的业务动作端口: 由装配根在应用入口构造, 经上下文下发给界面,
 * 界面自身不引用访问层与装配根。
 */
export interface AppPorts {
  signIn: SignInPorts;
  prune: PrunePorts;
  run: RunPorts;
  /** 课件配置端口按次构造, 观察者由打开向导的界面注入 */
  configure: (observer: ConfigObserver) => ConfigurePorts;
}

const PortsContext = createContext<AppPorts | null>(null);

export const PortsProvider = PortsContext.Provider;

/** 读取业务动作端口, 不在提供范围内时抛出 */
export const usePorts = (): AppPorts => {
  const ports = useContext(PortsContext);
  if (ports === null) {
    throw new Error("usePorts 必须在 PortsProvider 内使用");
  }
  return ports;
};
