import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { Badge, fmtDate, fmtMinUnsigned } from "../../components/Badge";
import { StatCard } from "../../components/StatCard";
import type { DailyRecord, Employee } from "../../types";

const ABONO_LABELS: Record<string, string> = {
  AB: "Abono", AT: "Atestado", VG: "Viagem", FA: "Falta", FE: "Folga",
};

export function PendingApprovals({ employees, onChanged }: {
  employees: Employee[];
  onChanged?: () => void;
}) {
  const [pending, setPending] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const nameById = useMemo(() => {
    const m: Record<number, string> = {};
    employees.forEach(e => { m[e.id] = e.name; });
    return m;
  }, [employees]);

  const load = () => {
    setLoading(true);
    api.getPendingRecords().then(setPending).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const review = async (r: DailyRecord, action: "approve" | "reject") => {
    let note: string | undefined;
    if (action === "approve" && r.removal_requested) {
      if (!window.confirm("Confirmar a EXCLUSÃO deste registro? Esta ação não pode ser desfeita.")) return;
    }
    if (action === "reject") {
      const label = r.removal_requested ? "Motivo para negar a exclusão (opcional):" : "Motivo da reprovação (opcional):";
      const input = window.prompt(label, "");
      if (input === null) return; // cancelou
      note = input.trim() || undefined;
    }
    setBusyId(r.id);
    try {
      await api.reviewRecord(r.id, { action, note });
      setPending(prev => prev.filter(p => p.id !== r.id));
      onChanged?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao processar.");
    } finally { setBusyId(null); }
  };

  if (loading) return <p style={{ color: "var(--muted)", padding: 20 }}>Carregando…</p>;

  return (
    <div>
      <div className="stats-grid">
        <StatCard label="Lançamentos pendentes" value={String(pending.length)} variant={pending.length > 0 ? "warn" : undefined} />
      </div>

      <div className="card">
        <div className="card-title">Fila de aprovação</div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: -6, marginBottom: 14 }}>
          Lançamentos retroativos, edições e pedidos de exclusão do colaborador entram aqui. Aprovar um lançamento/edição faz contar no banco de horas; aprovar uma <strong>exclusão</strong> remove o registro definitivamente.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Colaborador</th>
                <th>Solicitação</th>
                <th>Tipo</th>
                <th>Entrada</th>
                <th>Saída</th>
                <th>Trab.</th>
                <th>Saldo</th>
                <th>Abono</th>
                <th>Observação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {pending.length === 0 ? (
                <tr><td colSpan={11} className="empty">Nenhum lançamento pendente. 🎉</td></tr>
              ) : (
                pending.map(r => (
                  <tr key={r.id} style={r.removal_requested ? { background: "rgba(220,38,38,0.05)" } : undefined}>
                    <td className="mono">{fmtDate(r.date)}</td>
                    <td>{nameById[r.employee_id] ?? `#${r.employee_id}`}</td>
                    <td>
                      {r.removal_requested
                        ? <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "rgba(220,38,38,0.12)", color: "#dc2626", whiteSpace: "nowrap" }}>🗑 Exclusão</span>
                        : <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "rgba(245,166,35,0.16)", color: "#b45309", whiteSpace: "nowrap" }}>＋ Lançamento</span>}
                    </td>
                    <td className="mono">{r.day_type ?? "—"}</td>
                    <td className="mono">{r.entry_time ?? "—"}</td>
                    <td className="mono">{r.exit_time ?? "—"}</td>
                    <td className="mono">{r.worked_minutes != null ? fmtMinUnsigned(r.worked_minutes) : "—"}</td>
                    <td>{r.overtime_minutes != null ? <Badge minutes={r.overtime_minutes} /> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                    <td>{r.abono_code ? <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "rgba(0,174,239,0.12)", color: "#0284c7" }}>{ABONO_LABELS[r.abono_code] ?? r.abono_code}</span> : "—"}</td>
                    <td style={{ maxWidth: 200, fontSize: 12, color: "var(--muted)" }}>{r.note || "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className={`btn btn-sm ${r.removal_requested ? "btn-danger" : "btn-primary"}`}
                          disabled={busyId === r.id}
                          onClick={() => review(r, "approve")}
                        >
                          {r.removal_requested ? "✓ Excluir" : "✓ Aprovar"}
                        </button>
                        <button className="btn btn-secondary btn-sm" disabled={busyId === r.id} onClick={() => review(r, "reject")}>
                          {r.removal_requested ? "✕ Manter" : "✕ Reprovar"}
                        </button>
                      </div>
                    </td>
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
