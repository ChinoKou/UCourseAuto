import { Select } from "@base-ui/react/select";
import { IconCheck, IconChevronDown, IconPlus, IconServer } from "@tabler/icons-react";

import { siteHost, type Site } from "@/schema/domain/site";

export interface ServerSelectProps {
  value: string;
  onChange: (ref: string) => void;
  sites: ReadonlyArray<Site>;
  onManage: () => void;
  disabled?: boolean;
  /** 是否显示站点管理按钮 */
  showManage?: boolean;
}

/** 站点选择: 下拉列出全部站点, 右侧按钮进入站点管理 */
export function ServerSelect({
  value,
  onChange,
  sites,
  onManage,
  disabled = false,
  showManage = true,
}: ServerSelectProps) {
  const selected = sites.find((site) => site.ref === value) ?? null;
  const items = sites.map((site) => ({ value: site.ref, label: site.name }));

  return (
    <div className="uc-server-control">
      <Select.Root
        value={value}
        onValueChange={(next) => {
          if (next !== null) {
            onChange(next);
          }
        }}
        items={items}
        disabled={disabled}
      >
        <Select.Trigger className="uc-server-trigger">
          <span className="uc-server-trigger__icon">
            <IconServer size={18} stroke={1.7} />
          </span>
          <span className="uc-server-trigger__text">
            <span className="uc-server-trigger__name">
              {selected === null ? "选择站点" : selected.name}
            </span>
            <span className="uc-server-trigger__host">
              {selected === null ? "尚未选择" : siteHost(selected)}
            </span>
          </span>
          <Select.Icon className="uc-server-trigger__chevron">
            <IconChevronDown size={16} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner className="uc-select-positioner" sideOffset={8}>
            <Select.Popup className="uc-select-popup">
              <Select.List className="uc-select-list">
                {sites.map((site) => (
                  <Select.Item
                    key={site.ref}
                    value={site.ref}
                    label={site.name}
                    className="uc-server-option"
                  >
                    <span className="uc-server-option__icon">
                      <IconServer size={16} stroke={1.7} />
                    </span>
                    <span className="uc-server-option__text">
                      <span className="uc-server-option__name">{site.name}</span>
                      <span className="uc-server-option__host">{siteHost(site)}</span>
                    </span>
                    <span
                      className={`uc-tag ${site.builtin ? "" : "uc-tag--accent"}`}
                    >
                      {site.builtin ? "内置" : "自定义"}
                    </span>
                    <Select.ItemIndicator className="uc-server-option__check">
                      <IconCheck size={16} stroke={2} />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      <button
        type="button"
        className="uc-server-manage"
        aria-label="添加或管理站点"
        title="添加或管理站点"
        disabled={disabled}
        onClick={onManage}
        hidden={!showManage}
      >
        <IconPlus size={18} stroke={2} />
      </button>
    </div>
  );
}
