import { IconAlertTriangle } from "@tabler/icons-react";
import { useState } from "react";

import { useConfigStore } from "@/state/configStore";
import { Button } from "@/ui/common/Button";
import { Modal } from "@/ui/common/Dialog";
import { Switch } from "@/ui/common/Switch";
import { useToast } from "@/ui/common/toast";

export interface AntiDetectionControlProps {
  disabled?: boolean;
}

/** 反刷课检测开关与开启前的风险确认对话框 */
export function AntiDetectionControl({ disabled = false }: AntiDetectionControlProps) {
  const antiDetection = useConfigStore((state) => state.config.anti_detection);
  const updateSettings = useConfigStore((state) => state.updateSettings);
  const toast = useToast();
  const [riskOpen, setRiskOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const handleChange = (checked: boolean): void => {
    if (checked) {
      setAccepted(false);
      setRiskOpen(true);
      return;
    }
    if (!updateSettings({ anti_detection: false })) {
      toast.push({ title: "设置没有写入，请刷新页面后重试", tone: "error" });
      return;
    }
    toast.push({ title: "已关闭反刷课检测", tone: "info" });
  };

  const confirmEnable = (): void => {
    if (!updateSettings({ anti_detection: true })) {
      setRiskOpen(false);
      toast.push({ title: "设置没有写入，请刷新页面后重试", tone: "error" });
      return;
    }
    setRiskOpen(false);
    toast.push({ title: "已开启反刷课检测", tone: "warning" });
  };

  return (
    <>
      <div className="uc-anti-card">
        <Switch
          checked={antiDetection}
          onCheckedChange={handleChange}
          disabled={disabled}
          label="反刷课检测"
          badge={
            <span className="uc-badge uc-badge--experimental">
              实验性功能
            </span>
          }
        />
      </div>

      <Modal
        open={riskOpen}
        onClose={() => {
          setRiskOpen(false);
        }}
        title="开启反刷课检测？"
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setRiskOpen(false);
              }}
            >
              保持关闭
            </Button>
            <Button
              variant="danger"
              disabled={!accepted}
              onClick={confirmEnable}
            >
              确认开启
            </Button>
          </>
        }
      >
        <div className="uc-risk">
          <div className="uc-risk__banner">
            <IconAlertTriangle size={18} />
            <span>此功能基于平台前端行为分析，需自行评估使用场景。</span>
          </div>
          <ul className="uc-risk__list">
            <li>
              每个教材将先以 0 时长上报学习记录，用于尝试短路平台的刷课检测。
            </li>
            <li>
              随后调用 information 接口触发刷课检测（超时 120 秒），最后上报真实学习时长。
            </li>
            <li>
              风险：第一段上报进行时若出现网络错误且重试耗尽，已上报节的学习进度会丢失。
            </li>
            <li>
              风险：若第一段上报完成后中断刷课，课件将处于 0 时长但已完成的状态，容易被人工排查发现。
            </li>
            <li>
              该功能基于对平台前端行为的观察，不保证持续有效。
            </li>
          </ul>
          <label className="uc-risk__check">
            <input
              type="checkbox"
              className="uc-checkbox"
              checked={accepted}
              onChange={(event) => {
                setAccepted(event.currentTarget.checked);
              }}
            />
            <span>我已阅读并理解上述运行机制与风险，确认开启反刷课检测。</span>
          </label>
        </div>
      </Modal>
    </>
  );
}
