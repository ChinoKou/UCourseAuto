/** 品牌图形: 站点图标与界面共用 public/favicon.svg */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <img
      src="/favicon.svg"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className="uc-logo-mark"
      decoding="async"
    />
  );
}

/** 顶栏与登录页共用的品牌标识 */
export function Brand() {
  return (
    <span className="uc-brand">
      <LogoMark size={34} />
      <span className="uc-brand__text">
        <span className="uc-brand__name">
          UCourse<span className="uc-brand__accent">Auto</span>
        </span>
      </span>
    </span>
  );
}
