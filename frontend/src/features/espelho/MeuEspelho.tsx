import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { downloadMonthlyPdf } from "../reports/pdf/generate";
import { Badge, fmtMinUnsigned } from "../../components/Badge";
import type { BankEntry, MonthlyReport, WeeklyBucket } from "../../types";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WD = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const POS = "#16a34a";
const NEG = "#dc2626";

const hm = (m: number | null | undefined) => {
  if (m == null) return "—";
  const a = Math.abs(m);
  return `${Math.floor(a / 60)}h${String(a % 60).padStart(2, "0")}`;
};
const hmSigned = (m: number | null | undefined) => {
  if (m == null) return "—";
  const a = Math.abs(m);
  return `${m < 0 ? "−" : "+"}${Math.floor(a / 60)}h${String(a % 60).padStart(2, "0")}`;
};
const wd = (iso: string) => WD[(new Date(`${iso}T00:00:00`).getDay() + 6) % 7];
const brDate = (iso: string) => { const [, mo, d] = iso.split("-"); return `${d}/${mo}`; };

/* ── Mini gráfico de saldo por semana (SVG web) ── */
function WeekBars({ weeks }: { weeks: WeeklyBucket[] }) {
  if (weeks.length === 0) return <div style={{ color: "var(--muted)", fontSize: 13 }}>Sem dados no período.</div>;
  const W = 340, H = 128, top = 14, bottom = H - 16;
  const plotH = bottom - top;
  const maxV = Math.max(0, ...weeks.map(w => w.balance));
  const minV = Math.min(0, ...weeks.map(w => w.balance));
  const range = maxV - minV || 60;
  const zeroY = top + (maxV / range) * plotH;
  const slot = W / weeks.length;
  const barW = Math.min(30, slot * 0.5);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 140 }} preserveAspectRatio="xMidYMid meet">
      <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="var(--border2)" strokeWidth={1} />
      {weeks.map((w, i) => {
        const cx = i * slot + slot / 2;
        const h = (Math.abs(w.balance) / range) * plotH;
        const y = w.balance >= 0 ? zeroY - h : zeroY;
        const color = w.balance >= 0 ? POS : NEG;
        return (
          <g key={w.week}>
            <rect x={cx - barW / 2} y={y} width={barW} height={Math.max(h, 1.5)} rx={3} fill={color} />
            <text x={cx} y={w.balance >= 0 ? y - 3 : Math.min(y + h + 10, bottom - 1)} fontSize={8.5} fontWeight={600} fill={color} textAnchor="middle">{hmSigned(w.balance)}</text>
            <text x={cx} y={H - 3} fontSize={8.5} fill="var(--muted)" textAnchor="middle">{w.label.split("–")[0]}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function MeuEspelho({ employeeId }: { employeeId: number }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [bank, setBank] = useState<BankEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => { api.getEmployeeBank(employeeId).then(setBank).catch(console.error); }, [employeeId]);
  useEffect(() => {
    setLoading(true);
    api.getEmployeeMonthly(employeeId, year, month).then(setReport).catch(console.error).finally(() => setLoading(false));
  }, [employeeId, year, month]);

  const s = report?.summary[0];

  /** Baixa o espelho do mês em PDF — funciona no celular (abre o compartilhar). */
  const baixarEspelho = async () => {
    if (!report || !s) return;
    setDownloading(true);
    try {
      const tag = `${year}${String(month).padStart(2, "0")}`;
      const nome = s.employee_name.replace(/\s+/g, "_").toLowerCase();
      await downloadMonthlyPdf(report, report.summary, s.employee_name, `espelho_${nome}_${tag}.pdf`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Não foi possível gerar o PDF.");
    } finally { setDownloading(false); }
  };
  const changeMonth = (dir: -1 | 1) => {
    const d = new Date(year, month - 1 + dir, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  return (
    <div className="espelho">
      {/* HERO — banco de horas acumulado */}
      <div className="espelho-hero">
        <div>
          <div className="espelho-hero-label">Seu banco de horas</div>
          <div className={`espelho-hero-value ${(bank?.balance ?? 0) >= 0 ? "pos" : "neg"}`}>
            {bank ? hmSigned(bank.balance) : "…"}
          </div>
          <div className="espelho-hero-sub">acumulado até ontem</div>
        </div>
        {bank && bank.pending_records > 0 && (
          <div className="espelho-hero-pending">
            {bank.pending_records} lançamento{bank.pending_records > 1 ? "s" : ""} pendente{bank.pending_records > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* NAV DE MÊS + DOWNLOAD DO ESPELHO */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10, margin: "18px 0", flexWrap: "wrap" }}>
        <div className="month-nav" style={{ margin: 0 }}>
          <button className="icon-btn" onClick={() => changeMonth(-1)} aria-label="Mês anterior" title="Mês anterior">‹</button>
          <span className="month-display">{MONTHS[month - 1]} {year}</span>
          <button className="icon-btn" onClick={() => changeMonth(1)} aria-label="Próximo mês" title="Próximo mês">›</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-sm" onClick={baixarEspelho}
            disabled={downloading || !s} title="Baixar o espelho deste mês em PDF">
            {downloading ? "Gerando…" : "📄 Baixar espelho (PDF)"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}
            title="Imprimir esta tela">🖨</button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "var(--muted)", padding: 20 }}>Carregando…</p>
      ) : !s ? (
        <div className="card"><p style={{ color: "var(--muted)" }}>Nenhum registro neste mês.</p></div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat"><div className="stat-label">Saldo do mês</div><div className={`stat-value ${s.balance >= 0 ? "pos" : "neg"}`}>{hmSigned(s.balance)}</div></div>
            <div className="stat"><div className="stat-label">Trabalhado</div><div className="stat-value">{hm(s.worked_minutes)}</div></div>
            <div className="stat"><div className="stat-label">Referência</div><div className="stat-value">{hm(s.reference_minutes)}</div></div>
            <div className="stat"><div className="stat-label">Dias (Ú/S/D)</div><div className="stat-value">{s.days_h1}/{s.days_h2}/{s.days_h3}</div></div>
          </div>

          <div className="card">
            <div className="card-title">Saldo por semana</div>
            <WeekBars weeks={s.weeks} />
          </div>

          {(s.faltas > 0 || s.atestados > 0 || s.folgas > 0 || s.extra100_minutes > 0 || s.night_bonus_minutes > 0) && (
            <div className="card">
              <div className="card-title">Destaques do mês</div>
              <div className="espelho-chips">
                {s.extra100_minutes > 0 && <span className="chip">Extra 100%: <strong>{hm(s.extra100_minutes)}</strong></span>}
                {s.night_bonus_minutes > 0 && <span className="chip">Adic. noturno: <strong>{hm(s.night_bonus_minutes)}</strong></span>}
                {s.atestados > 0 && <span className="chip">Atestados: <strong>{s.atestados}</strong></span>}
                {s.faltas > 0 && <span className="chip chip-warn">Faltas: <strong>{s.faltas}</strong></span>}
                {s.folgas > 0 && <span className="chip">Folgas: <strong>{s.folgas}</strong></span>}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-title">Dias do mês</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Data</th><th>Dia</th><th>Tipo</th><th>Entrada</th><th>Saída</th><th>Trab.</th><th>Saldo</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {[...report!.records].sort((a, b) => b.date.localeCompare(a.date)).map(r => (
                    <tr key={r.id}>
                      <td className="mono">{brDate(r.date)}</td>
                      <td className="mono">{wd(r.date)}</td>
                      <td className="mono">{r.day_type ?? "—"}{r.abono_code && <span className="tag-abono">{r.abono_code}</span>}</td>
                      <td className="mono">{r.entry_time ?? "—"}</td>
                      <td className="mono">{r.exit_time ?? "—"}</td>
                      <td className="mono">{r.worked_minutes != null ? fmtMinUnsigned(r.worked_minutes) : "—"}</td>
                      <td>{r.overtime_minutes != null ? <Badge minutes={r.overtime_minutes} /> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                      <td>{r.status !== "aprovado" ? <span className={`tag-status ${r.status}`}>{r.status === "pendente" ? "Pendente" : "Reprovado"}</span> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
