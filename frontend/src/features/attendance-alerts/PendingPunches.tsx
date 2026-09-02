import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { StatCard } from "../../components/StatCard";
import { fmtDate } from "../../components/Badge";
import type { PendingPunch } from "../../types";

const DAYS_OPTIONS = [7, 15, 30];

export function PendingPunches() {
  const [items, setItems] = useState<PendingPunch[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  const load = (d: number) => {
    setLoading(true);
    api.getPendingPunches(d).then(setItems).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => load(days), [days]);

  const faltas = items.filter(i => i.kind === "falta").length;
  const abertos = items.filter(i => i.kind === "aberto").length;

  return (
    <div>
      <div className="stats-grid">
        <StatCard label="Faltas de ponto" value={String(faltas)} variant={faltas > 0 ? "warn" : undefined} />
        <StatCard label="Batidas em aberto" value={String(abertos)} variant={abertos > 0 ? "warn" : undefined} />
      </div>

      <div className="card">
        <div className="card-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span>Pendências de ponto</span>
          <div style={{ display: "flex", gap: 6 }}>
            {DAYS_OPTIONS.map(d => (
              <button
                key={d}
                className={`btn btn-sm ${d === days ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setDays(d)}
              >
                {d} dias
              </button>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: -6, marginBottom: 14 }}>
          Dias úteis dos últimos {days} dias sem batida completa. Não considera hoje (ainda em andamento), férias/licença, folgas nem feriados.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Colaborador</th>
                <th>Situação</th>
                <th>Entrada</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="empty">Carregando…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={4} className="empty">Nenhuma pendência nos últimos {days} dias. 🎉</td></tr>
              ) : (
                items.map((p, i) => (
                  <tr key={`${p.employee_id}-${p.date}-${i}`}>
                    <td className="mono">{fmtDate(p.date)}</td>
                    <td>{p.employee_name}</td>
                    <td>
                      {p.kind === "falta"
                        ? <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "rgba(220,38,38,0.12)", color: "#dc2626", whiteSpace: "nowrap" }}>⚠ Falta</span>
                        : <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "rgba(245,166,35,0.16)", color: "#b45309", whiteSpace: "nowrap" }}>⏳ Em aberto</span>}
                    </td>
                    <td className="mono">{p.entry_time ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
