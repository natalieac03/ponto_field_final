interface BadgeProps {
  minutes: number;
}

export function Badge({ minutes }: BadgeProps) {
  const cls =
    minutes > 0 ? "badge badge-pos" : minutes < 0 ? "badge badge-neg" : "badge badge-zero";
  return <span className={cls}>{fmtMin(minutes)}</span>;
}

export function fmtMin(m: number): string {
  const abs = Math.abs(m);
  const h = Math.floor(abs / 60);
  const min = String(abs % 60).padStart(2, "0");
  const sign = m < 0 ? "-" : "+";
  return `${sign}${h}h${min}`;
}

export function fmtMinUnsigned(m: number): string {
  const h = Math.floor(m / 60);
  const min = String(m % 60).padStart(2, "0");
  return `${h}h${min}`;
}

export function fmtDate(d: string): string {
  const [y, mo, day] = d.split("-");
  return `${day}/${mo}/${y}`;
}
