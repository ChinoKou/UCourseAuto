import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { findSite } from "@/schema/domain/site";
import type { UserConfig } from "@/schema/domain/config";
import { selectActiveUser, useConfigStore } from "@/state/configStore";
import { useToast } from "@/ui/common/toast";
import { LibraryCard } from "@/ui/dashboard/LibraryCard";
import { ConfigWizard } from "@/ui/library/ConfigWizard";
import { staggerContainer, staggerItem } from "@/ui/motion/presets";
import { RunConsole } from "@/ui/run/RunConsole";

export interface DashboardScreenProps {
  previewUser?: UserConfig;
}

/** 首页工作台: 刷课卡与课件库卡并排占满内容区 */
export function DashboardScreen({ previewUser }: DashboardScreenProps = {}) {
  const storeUser = useConfigStore(selectActiveUser);
  const activeUser = storeUser ?? previewUser ?? null;
  const customSites = useConfigStore((state) => state.config.custom_sites);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [libraryHighlighted, setLibraryHighlighted] = useState(false);
  const libraryRef = useRef<HTMLElement>(null);
  const timerRef = useRef<number | null>(null);
  const toast = useToast();

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (activeUser === null) {
    throw new Error("首页需要活跃账号");
  }

  const site = findSite(activeUser.site, customSites);

  const openWizard = (): void => {
    if (site === null) {
      toast.push({ title: "站点配置缺失", tone: "error" });
      return;
    }
    setWizardOpen(true);
  };

  const handleRequireSelection = useCallback((): void => {
    toast.push({
      title: "请先勾选需要学习的课件",
      tone: "info",
    });
    setLibraryHighlighted(true);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setLibraryHighlighted(false);
      timerRef.current = null;
    }, 2200);

    const target = libraryRef.current;
    if (target !== null) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.focus({ preventScroll: true });
    }
  }, [toast]);

  return (
    <div className="uc-page uc-home">
      <motion.div
        className="uc-home-grid"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <motion.div className="uc-home-grid__run" variants={staggerItem}>
          <RunConsole
            previewUser={previewUser}
            onConfigure={openWizard}
            onRequireSelection={handleRequireSelection}
          />
        </motion.div>

        <motion.div className="uc-home-grid__library" variants={staggerItem}>
          <LibraryCard
            ref={libraryRef}
            previewUser={previewUser}
            highlighted={libraryHighlighted}
            onConfigure={openWizard}
          />
        </motion.div>
      </motion.div>

      {site !== null && wizardOpen && (
        <ConfigWizard
          site={site}
          token={activeUser.token}
          onClose={() => {
            setWizardOpen(false);
          }}
        />
      )}
    </div>
  );
}
