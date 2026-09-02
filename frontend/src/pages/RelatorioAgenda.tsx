import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { AgendaItem } from "../features/reports/pdf/dayContext";
import { buildAgendaItems } from "../features/reports/pdf/dayContext";
import { downloadAgendaPdf } from "../features/reports/pdf/generate";
import type { Employee } from "../types";

const br = (iso: string) => iso.split("-").reverse().join("/");

const CATEGORY_STYLE: Record<AgendaItem["category"], { bg: string; fg: string; label: string }> = {
  escala: { bg: "rgba(124,58,237,0.10)", fg: "#7c3aed", label: "Escala" },
  leave: { bg: "rgba(13,148,136,0.10)", fg: "#0d9488", label: "Férias/licença" },
  feriado: { bg: "rgba(220,38,38,0.10)", fg: "#dc2626", label: "Feriado" },
  facultativo: { bg: "rgba(245,166,35,0.14)", fg: "#b45309", label: "Facultativo" },
  evento: { bg: "rgba(37,99,235,0.10)", fg: "#2563eb", label: "Evento" },
};

/** Agenda de um colaborador (escalas, férias/licenças e calendário da equipe) num período, exportável em PDF. */
export function RelatorioAgenda() {
  const today = new Date();
  const in30 = new Date(today.getTime() + 30 * 86400000);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState<number | "">("");
  const [start, setStart] = useState(today.toISOString().slice(0, 10));
  const [end, setEnd] = useState(in30.toISOString().slice(0, 10));
  const [items, setItems] = useState<AgendaItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.getEmployees().then(es => setEmployees(es.filter(e => e.active))).catch(console.error);
  }, []);

  const employeeName = useMemo(
    () => employees.find(e => e.id === employeeId)?.name ?? "",
    [employees, employeeId],
  );

  const buscar = async () => {
    if (employeeId === "") { setErr("Selecione o colaborador."); return; }
    setErr(""); setLoading(true);
    try { setItems(await buildAgendaItems(Number(employeeId), start, end)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro ao buscar."); }
    finally { setLoading(false); }
  };

  const baixarPdf = async () => {
    if (employeeId === "") return;
    setBusy(true);
    try {
      const periodo = `${br(start)} a ${br(end)}`;
      const nome = employeeName.replace(/\s+/g, "_").toLowerCase();
      await downloadAgendaPdf(Number(employeeId), employeeName, start, end, periodo, `agenda_${nome}_${start}_a_${end}.pdf`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao gerar PDF."); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="sec-header">
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>🗓 Agenda do colaborador</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            Escalas, férias/licenças e calendário da equipe (feriados, facultativos, eventos) de um colaborador, num período
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Colaborador e período</div>
        <div className="form-grid">
          <div className="form-group">
            <label>Colaborador *</label>
            <select value={employeeId} onChange={e => { setEmployeeId(e.target.value === "" ? "" : Number(e.target.value)); setErr(""); }}>
              <option value="">— selecione —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>De</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Até</label>
            <input type="date" value={end} min={start} onChange={e => setEnd(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-sm" onClick={buscar} disabled={loading}>
            {loading ? "Buscando…" : "🔍 Buscar"}
          </button>
          {items && items.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={baixarPdf} disabled={busy}>
              {busy ? "Gerando…" : "📄 Baixar PDF"}
            </button>
          )}
        </div>
        {err && <div className="alert alert-error" style={{ marginTop: 12 }}>{err}</div>}
      </div>

      {items && (
        items.length === 0 ? (
          <div className="card">
            <p style={{ color: "var(--muted)" }}>Nenhum evento de agenda para {employeeName} entre {br(start)} e {br(end)}.</p>
          </div>
        ) : (
          <div className="card">
            <div className="card-title">
              {employeeName} — {items.length} evento(s) entre {br(start)} e {br(end)}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Data</th><th>Tipo</th><th>Detalhe</th></tr>
                </thead>
                <tbody>
                  {items.map((it, i) => {
                    const st = CATEGORY_STYLE[it.category];
                    return (
                      <tr key={`${it.date}-${i}`}>
                        <td className="mono">{br(it.date)}</td>
                        <td>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: st.bg, color: st.fg, fontWeight: 600, whiteSpace: "nowrap" }}>
                            {st.label}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>{it.label}{it.note ? ` — ${it.note}` : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
