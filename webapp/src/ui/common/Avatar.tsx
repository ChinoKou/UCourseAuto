import { useState } from "react";

/** 头像: 支持图片头像, 地址为空或加载失败时回退到姓名首字与稳定色调 */
export interface AvatarProps {
  name: string;
  url?: string | null;
  size?: number;
  className?: string;
}

/** 名称的稳定哈希, 用于挑选渐变色 */
const hashName = (name: string): number => {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 997;
  }
  return hash;
};

export function Avatar({ name, url, size = 36, className }: AvatarProps) {
  const [prevUrl, setPrevUrl] = useState(url);
  const [loadFailed, setLoadFailed] = useState(false);

  if (prevUrl !== url) {
    setPrevUrl(url);
    setLoadFailed(false);
  }

  const trimmed = name.trim();
  const initial = trimmed.length > 0 ? Array.from(trimmed)[0] : "?";
  const tone = hashName(trimmed) % 6;
  const imageUrl = typeof url === "string" ? url.trim() : "";
  const showImage = imageUrl.length > 0 && !loadFailed;

  return (
    <span
      className={`uc-avatar ${showImage ? "uc-avatar--image" : `uc-avatar--tone-${tone}`} ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={name}
          onError={() => {
            setLoadFailed(true);
          }}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        initial.toUpperCase()
      )}
    </span>
  );
}
