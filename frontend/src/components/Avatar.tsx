import { useState } from "react";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

interface Props {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}

/** Avatar circular: mostra a foto se houver (e carregar), senão as iniciais do nome. */
export function Avatar({ name, src, size = 44, className = "" }: Props) {
  const [broken, setBroken] = useState(false);
  const showImg = !!src && !broken;
  return (
    <span
      className={`avatar${showImg ? " avatar-img" : ""} ${className}`.trim()}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {showImg ? (
        <img src={src!} alt="" onError={() => setBroken(true)} />
      ) : (
        <span className="avatar-initials">{initials(name)}</span>
      )}
    </span>
  );
}
