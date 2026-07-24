interface StatCardProps {
  label: string;
  value: string;
  variant?: "pos" | "neg" | "warn" | "default";
}

export function StatCard({ label, value, variant = "default" }: StatCardProps) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value${variant !== "default" ? ` ${variant}` : ""}`}>
        {value}
      </div>
    </div>
  );
}
