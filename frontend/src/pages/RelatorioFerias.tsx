import { useEffect, useState } from "react";
import { api } from "../api/client";
import { fieldTechLogoUrl } from "../assets";
import { LeaveModal } from "../features/calendar/LeaveModal";
import { LEAVE_KIND_LABEL } from "../types";
import type { Employee, VacationReport, VacationReportItem } from "../types";

const hm = (m: number | null | undefined) => {
  if (m == null) return "—";
  const sign = m < 0 ? "-" : "";
  const a = Math.abs(m);
  return `${sign}${Math.floor(a / 60)}h${String(a % 60).padStart(2, "0")}`;
};
const br = (iso: string) => iso.split("-").reverse().join("/");

/** Relatório de quem entra de férias no período, com o espelho dos últimos N dias. */
export function RelatorioFerias() {
  const today = new Date();
  const in30 = new Date(today.getTime() + 30 * 86400000);
  const [start, setStart] = useState(today.toISOString().slice(0, 10));
  const [end, setEnd] = useState(in30.toISOString().slice(0, 10));
  const [lookback, setLookback] = useState(90);
  const [report, setReport] = useState<VacationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveModal, setLeaveModal] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api.getEmployees().then(es => setEmployees(es.filter(e => e.active))).catch(console.error);
  }, []);

  const buscar = async () => {
    setErr(""); setLoading(true);
    try { setReport(await api.getVacationReport(start, end, lookback)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro ao buscar."); }
    finally { setLoading(false); }
  };

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4000); };

  const baixarCsv = async () => {
    setBusy(true);
    try { await api.downloadVacationCsv(start, end, lookback); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro ao baixar."); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="print-header">
        <img src={fieldTechLogoUrl} alt="Field Technology" />
        <div>
          <div className="print-header-title">Relatório de Férias e Afastamentos</div>
          <div className="print-header-subtitle">
            {br(start)} a {br(end)} · Gerado em {new Date().toLocaleDateString("pt-BR")}
          </div>
        </div>
      </div>

      <div className="sec-header no-print">
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>🏖 Relatório de férias e afastamentos</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            Quem entra de férias no período, com o espelho de ponto dos dias anteriores
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setLeaveModal(true)}>
          🏖 Marcar férias
        </button>
      </div>

      {msg && <div className="alert alert-success no-print" style={{ marginBottom: 12 }}>{msg}</div>}

      <div className="card no-print">
        <div className="card-title">Período de início das férias</div>
        <div className="form-grid">
          <div className="form-group">
            <label>De</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Até</label>
            <input type="date" value={end} min={start} onChange={e => setEnd(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Espelho dos últimos</label>
            <select value={lookback} onChange={e => setLookback(Number(e.target.value))}>
              <option value={30}>30 dias</option>
              <option value={60}>60 dias</option>
              <option value={90}>90 dias</option>
              <option value={180}>180 dias</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-sm" onClick={buscar} disabled={loading}>
            {loading ? "Buscando…" : "🔍 Buscar"}
          </button>
          {report && report.items.length > 0 && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                📄 Imprimir / PDF
              </button>
              <button className="btn btn-secondary btn-sm" onClick={baixarCsv} disabled={busy}>
                {busy ? "Gerando…" : "📊 Baixar CSV"}
              </button>
            </>
          )}
        </div>
        {err && <div className="alert alert-error" style={{ marginTop: 12 }}>{err}</div>}
      </div>

      {report && (
        report.items.length === 0 ? (
          <div className="card">
            <p style={{ color: "var(--muted)" }}>
              Ninguém entra de férias ou licença entre {br(report.start)} e {br(report.end)}.
            </p>
          </div>
        ) : (
          <>
            <div className="card">
              <div className="card-title">
                {report.items.length} colaborador(es) — {br(report.start)} a {br(report.end)}
              </div>
              <ResumoSaldo items={report.items} />
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Colaborador</th>
                      <th>CPF</th>
                      <th>Afastamento</th>
                      <th>Período</th>
                      <th>Dias</th>
                      <th>Trabalhado</th>
                      <th>Extra 50%</th>
                      <th>Extra 100%</th>
                      <th>Saldo</th>
                      <th className="no-print"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.items.map(it => (
                      <tr key={`${it.employee_id}-${it.leave_start}`}>
                        <td style={{ fontWeight: 500 }}>{it.employee_name}</td>
                        <td className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{it.cpf_masked ?? "—"}</td>
                        <td style={{ fontSize: 12 }}>{LEAVE_KIND_LABEL[it.leave_kind as keyof typeof LEAVE_KIND_LABEL] ?? it.leave_kind}</td>
                        <td className="mono" style={{ fontSize: 12 }}>{br(it.leave_start)} – {br(it.leave_end)}</td>
                        <td className="mono">{it.leave_days}</td>
                        <td className="mono">{hm(it.worked_minutes)}</td>
                        <td className="mono">{it.extra50_minutes > 0 ? hm(it.extra50_minutes) : "—"}</td>
                        <td className="mono" style={{ fontWeight: it.extra100_minutes > 0 ? 700 : undefined }}>
                          {it.extra100_minutes > 0 ? hm(it.extra100_minutes) : "—"}
                        </td>
                        <td className="mono" style={{ color: it.balance >= 0 ? "var(--pos)" : "var(--neg)", fontWeight: 600 }}>
                          {hm(it.balance)}
                        </td>
                        <td className="no-print">
                          <button className="btn btn-secondary btn-sm"
                            onClick={() => setExpanded(expanded === it.employee_id ? null : it.employee_id)}>
                            {expanded === it.employee_id ? "Ocultar" : "Espelho"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {report.items
              .filter(it => expanded === null || expanded === it.employee_id)
              .map(it => (
                <EspelhoCard key={`d-${it.employee_id}-${it.leave_start}`} item={it}
                  visible={expanded === it.employee_id} lookback={report.lookback_days} />
              ))}
          </>
        )
      )}

      {leaveModal && (
        <LeaveModal employees={employees} onClose={() => setLeaveModal(false)}
          onSaved={(m) => { flash(m); if (report) buscar(); }} />
      )}
    </div>
  );
}

/** Resumo visual (KPIs) do lote de férias/afastamentos buscado, exibido acima da tabela. */
function ResumoSaldo({ items }: { items: VacationReportItem[] }) {
  const t = items.reduce((a, it) => ({
    dias: a.dias + it.leave_days,
    trabalhado: a.trabalhado + it.worked_minutes,
    extra100: a.extra100 + it.extra100_minutes,
    saldo: a.saldo + it.balance,
  }), { dias: 0, trabalhado: 0, extra100: 0, saldo: 0 });
  return (
    <div className="stats-grid" style={{ marginBottom: 14 }}>
      <div className="stat"><div className="stat-label">Colaboradores</div><div className="stat-value">{items.length}</div></div>
      <div className="stat"><div className="stat-label">Dias de afastamento</div><div className="stat-value">{t.dias}</div></div>
      <div className="stat"><div className="stat-label">Trabalhado no espelho</div><div className="stat-value">{hm(t.trabalhado)}</div></div>
      <div className="stat"><div className="stat-label">Extra 100% no espelho</div><div className="stat-value">{hm(t.extra100)}</div></div>
      <div className="stat">
        <div className="stat-label">Saldo total</div>
        <div className={`stat-value ${t.saldo >= 0 ? "pos" : "neg"}`}>{hm(t.saldo)}</div>
      </div>
    </div>
  );
}

function EspelhoCard({ item, visible, lookback }: {
  item: VacationReportItem; visible: boolean; lookback: number;
}) {
  if (!visible) return null;
  return (
    <div className="card">
      <div className="card-title">
        Espelho de {item.employee_name} — últimos {lookback} dias ({br(item.window_start)} a {br(item.window_end)})
      </div>
      <div className="stats-grid" style={{ marginBottom: 14 }}>
        <div className="stat"><div className="stat-label">Dias trabalhados</div><div className="stat-value">{item.days_worked}</div></div>
        <div className="stat"><div className="stat-label">H. normais</div><div className="stat-value">{hm(item.normal_minutes)}</div></div>
        <div className="stat"><div className="stat-label">Extra 50% / 100%</div><div className="stat-value">{hm(item.extra50_minutes)} / {hm(item.extra100_minutes)}</div></div>
        <div className="stat">
          <div className="stat-label">Saldo do período</div>
          <div className={`stat-value ${item.balance >= 0 ? "pos" : "neg"}`}>{hm(item.balance)}</div>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th><th>Entrada</th><th>Início Int.</th><th>Fim Int.</th><th>Saída</th>
              <th>Trabalhado</th><th>Referência</th><th>Saldo</th><th>Abono</th>
            </tr>
          </thead>
          <tbody>
            {item.records.length === 0 ? (
              <tr><td colSpan={9} className="empty">Nenhum registro no período.</td></tr>
            ) : [...item.records].sort((a, b) => b.date.localeCompare(a.date)).map(r => (
              <tr key={r.date}>
                <td className="mono">{br(r.date)}</td>
                <td className="mono">{r.entry_time ?? "—"}</td>
                <td className="mono">{r.break_start ?? "—"}</td>
                <td className="mono">{r.break_end ?? "—"}</td>
                <td className="mono">{r.exit_time ?? "—"}</td>
                <td className="mono">{hm(r.worked_minutes)}</td>
                <td className="mono" style={{ color: "var(--muted)" }}>{hm(r.standard_minutes)}</td>
                <td className="mono" style={{ color: (r.overtime_minutes ?? 0) >= 0 ? "var(--pos)" : "var(--neg)" }}>
                  {hm(r.overtime_minutes)}
                </td>
                <td className="mono">{r.abono_code ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assinaturas — só na impressão */}
      <div className="print-signatures">
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">ASSINATURA DO FUNCIONÁRIO</div></div>
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">ASSINATURA DO GESTOR</div></div>
      </div>
    </div>
  );
}
