import "@fontsource-variable/manrope";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-700.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@/App";
import { createConfigurePorts, prunePorts, runPorts, signInPorts } from "@/composition/browser";
import type { AppPorts } from "@/ui/app/ports";
import "@/index.css";

/** 装配根构造的端口集合, 只在应用入口构造一次 */
const PORTS: AppPorts = {
  signIn: signInPorts,
  prune: prunePorts,
  run: runPorts,
  configure: createConfigurePorts,
};

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("未找到 #root 挂载元素");
}

createRoot(rootElement).render(
  <StrictMode>
    <App ports={PORTS} />
  </StrictMode>,
);
