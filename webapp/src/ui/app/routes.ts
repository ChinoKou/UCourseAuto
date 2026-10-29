import { useEffect, useState } from "react";

import { useConfigStore } from "@/state/configStore";

/** 应用内页面 */
export type AppRoute = "home" | "dashboard" | "library";

/** 路由状态: 页面与页面参数 */
export interface RouteState {
  route: AppRoute;
  /** 进入课件库时直接打开配置向导 */
  configure: boolean;
}

const ROUTES: ReadonlyArray<AppRoute> = ["home", "dashboard", "library"];

const isAppRoute = (value: string): value is AppRoute =>
  ROUTES.some((route) => route === value);

/** 读取地址栏 hash 得到路由状态 */
export const parseRoute = (rawHash?: string): RouteState => {
  const source =
    rawHash ?? (typeof window !== "undefined" ? window.location.hash : "");
  const raw = source.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  const activeUser = useConfigStore.getState().config.active_user;
  const defaultRoute: AppRoute = activeUser !== "" ? "dashboard" : "home";
  const route = isAppRoute(path) ? path : defaultRoute;
  return {
    route,
    configure: new URLSearchParams(query).get("configure") === "1",
  };
};

/** 站内跳转, 只改 hash 不刷新页面 */
export const navigate = (
  route: AppRoute,
  options: { configure?: boolean } = {},
): void => {
  const suffix = options.configure === true ? "?configure=1" : "";
  const next = `#/${route}${suffix}`;
  if (window.location.hash === next) {
    return;
  }
  window.location.hash = next;
};

/** 订阅路由状态 */
export const useRoute = (): RouteState => {
  const [state, setState] = useState<RouteState>(parseRoute);

  useEffect(() => {
    const handleChange = (): void => {
      setState(parseRoute());
    };
    window.addEventListener("hashchange", handleChange);
    return () => {
      window.removeEventListener("hashchange", handleChange);
    };
  }, []);

  return state;
};
