import type { ReactNode } from "react";
import type { Employee } from "../../types";

/** Filtro de colaborador + período, usado nas listas agrupadas por colaborador. */
export function GroupFilters({ empFilter, setEmpFilter, scope, setScope, employees }: {
  empFilter: number | "all"; setEmpFilter: (v: number | "all") => void;
  scope: "upcoming" | "all"; setScope: (v: "upcoming" | "all") => void;
  employees: Pick<Employee, "id" | "name">[];
}) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
      <select value={empFilter} style={{ maxWidth: 220 }}
        onChange={e => setEmpFilter(e.target.value === "all" ? "all" : Number(e.target.value))}>
        <option value="all">Todos os colaboradores</option>
        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      <div style={{ display: "flex", gap: 6 }}>
        {(["upcoming", "all"] as const).map(s => (
          <button key={s} onClick={() => setScope(s)}
            style={{ padding: "7px 12px", borderRadius: "var(--radius)", cursor: "pointer", fontSize: 12,
              fontWeight: 600, fontFamily: "var(--font)",
              background: scope === s ? "rgba(37,99,235,0.10)" : "var(--surface2)",
              color: scope === s ? "#2563eb" : "var(--muted)",
              border: `1px solid ${scope === s ? "#2563eb" : "var(--border2)"}` }}>
            {s === "upcoming" ? "A partir de hoje" : "Todas as datas"}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Estado vazio de uma lista agrupada, com atalho para limpar o filtro ativo. */
export function EmptyGroupState({ message, filtered, onClear }: {
  message: string; filtered: boolean; onClear: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>{message}</p>
      {filtered && (
        <button onClick={onClear}
          style={{ padding: "4px 10px", borderRadius: "var(--radius)", cursor: "pointer", fontSize: 11.5,
            fontWeight: 600, fontFamily: "var(--font)", background: "var(--surface2)",
            color: "var(--accent)", border: "1px solid var(--border2)" }}>
          ✕ Limpar filtro
        </button>
      )}
    </div>
  );
}

/** Card colapsável de um colaborador, usado nas listas agrupadas por colaborador. */
export function AccordionGroup({ title, icon, accent, count, countLabel, expanded, onToggle, children }: {
  title: string; icon: string; accent: string; count: number; countLabel: string;
  expanded: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <div style={{ border: `1px solid ${expanded ? accent : "var(--border2)"}`, borderLeft: `3px solid ${accent}`,
      borderRadius: "var(--radius)", marginBottom: 8, overflow: "hidden", transition: "border-color .15s" }}>
      <button onClick={onToggle}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 14px", cursor: "pointer", background: expanded ? `${accent}14` : "var(--surface2)",
          border: "none", fontFamily: "var(--font)", textAlign: "left", transition: "background .15s" }}>
        <span style={{ fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15 }}>{icon}</span>{title}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: accent, background: `${accent}1a`,
            padding: "2px 8px", borderRadius: 999 }}>{count} {countLabel}</span>
          <span style={{ fontSize: 11, color: "var(--muted)", display: "inline-block",
            transition: "transform .2s ease", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
        </span>
      </button>
      <div style={{ display: "grid", gridTemplateRows: expanded ? "1fr" : "0fr", transition: "grid-template-rows .2s ease" }}>
        <div style={{ minHeight: 0, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
