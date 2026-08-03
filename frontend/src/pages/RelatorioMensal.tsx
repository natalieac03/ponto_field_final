import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { Badge, fmtDate, fmtMin, fmtMinUnsigned } from "../components/Badge";
import { Modal } from "../components/Modal";
import { downloadMonthlyPdf } from "../features/reports/pdf/generate";
import { ImageLightbox } from "../components/ImageLightbox";
import { StatCard } from "../components/StatCard";
import { isImage, isPdf } from "../helpers/attachments";
import type { Employee, MonthlyRecord, MonthlyReport } from "../types";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function StatusPill({ status, retro }: { status: string; retro?: boolean }) {
  const styles: Record<string, { bg: string; fg: string; label: string }> = {
    aprovado:  { bg: "rgba(22,163,74,0.12)",  fg: "#16a34a", label: "Aprovado" },
    pendente:  { bg: "rgba(245,166,35,0.16)", fg: "#b45309", label: "Pendente" },
    reprovado: { bg: "rgba(220,38,38,0.12)",  fg: "#dc2626", label: "Reprovado" },
  };
  const s = styles[status] ?? styles.aprovado;
  return (
    <span title={retro ? "Lançamento retroativo" : undefined}
      style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: s.bg, color: s.fg, whiteSpace: "nowrap" }}>
      {retro ? "⏱ " : ""}{s.label}
    </span>
  );
}

/* ─── Modal de edição de horários ─────────────────────────────────────────── */
interface EditModalProps {
  record: MonthlyRecord;
  onClose: () => void;
  onSaved: () => void;
}

function EditTimesModal({ record, onClose, onSaved }: EditModalProps) {
  const [entryTime, setEntryTime]   = useState(record.entry_time ?? "");
  const [breakStart, setBreakStart] = useState(record.break_start ?? "");
  const [breakEnd, setBreakEnd]     = useState(record.break_end ?? "");
  const [exitTime, setExitTime]     = useState(record.exit_time ?? "");
  const [abono, setAbono]           = useState(record.abono_code ?? "");
  const [error, setError]   = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError("");
    const payload: { entry_time?: string; break_start?: string; break_end?: string; exit_time?: string; abono_code?: string } = {};
    if (entryTime !== (record.entry_time ?? ""))   payload.entry_time  = entryTime;
    if (breakStart !== (record.break_start ?? "")) payload.break_start = breakStart;
    if (breakEnd   !== (record.break_end   ?? "")) payload.break_end   = breakEnd;
    if (exitTime   !== (record.exit_time   ?? "")) payload.exit_time   = exitTime;
    if (abono      !== (record.abono_code  ?? "")) payload.abono_code  = abono;
    if (Object.keys(payload).length === 0) { onClose(); return; }
    setSaving(true);
    try { await api.patchTimes(record.id, payload); onSaved(); onClose(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Erro ao salvar."); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="⚙️ Alterar horários" onClose={onClose} maxWidth={420}>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: -6, marginBottom: 18 }}>{fmtDate(record.date)} · {record.employee_name}</div>
        <div className="form-grid" style={{ marginBottom: 16 }}>
          <div className="form-group"><label>Entrada</label><input type="time" value={entryTime} onChange={e => { setEntryTime(e.target.value); setError(""); }} /></div>
          <div className="form-group"><label>Saída</label><input type="time" value={exitTime} onChange={e => { setExitTime(e.target.value); setError(""); }} /></div>
          <div className="form-group"><label>Início intervalo</label><input type="time" value={breakStart} onChange={e => { setBreakStart(e.target.value); setError(""); }} /></div>
          <div className="form-group"><label>Fim intervalo</label><input type="time" value={breakEnd} onChange={e => { setBreakEnd(e.target.value); setError(""); }} /></div>
          <div className="form-group">
            <label>Abono do dia <span style={{ color: "var(--muted)", fontWeight: 400 }}>— opcional</span></label>
            <select value={abono} onChange={e => { setAbono(e.target.value); setError(""); }}>
              <option value="">Nenhum</option>
              <option value="AB">AB — Abono</option>
              <option value="AT">AT — Atestado</option>
              <option value="VG">VG — Viagem</option>
              <option value="FA">FA — Falta</option>
              <option value="FE">FE — Folga</option>
            </select>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              AB/AT/VG contam como trabalhado · FA = débito · FE zera a referência
            </span>
          </div>
        </div>
        <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>💡 A jornada de referência (8h útil / 4h sábado) é automática pelo tipo de dia. O saldo é recalculado ao salvar.</p>
        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
        </div>
    </Modal>
  );
}

/* ─── Célula de Anexos ─────────────────────────────────────────────────────── */
interface AttachmentsCellProps {
  note: string | null;
  attachments: string[];
  onImageClick: (url: string, filename: string) => void;
}

function AttachmentsCell({ note, attachments, onImageClick }: AttachmentsCellProps) {
  if (!note && attachments.length === 0) return <span style={{ color: "var(--muted)" }}>—</span>;
  return (
    <div style={{ maxWidth: 240 }}>
      {note && (
        <div title={note} style={{ fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: attachments.length > 0 ? 6 : 0 }}>
          📝 {note}
        </div>
      )}
      {attachments.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {attachments.map((filename, idx) => {
            const url = api.attachmentUrl(filename);
            if (isImage(filename)) {
              return (
                <button
                  key={filename}
                  onClick={() => onImageClick(url, filename)}
                  title={`Ver imagem: ${filename}`}
                  style={{
                    padding: 0, border: "2px solid var(--border2)", borderRadius: 8,
                    cursor: "zoom-in", background: "none", overflow: "hidden",
                    width: 48, height: 48, flexShrink: 0,
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border2)"; }}
                >
                  <img
                    src={url}
                    alt={`Anexo ${idx + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </button>
              );
            }
            if (isPdf(filename)) {
              return (
                <a
                  key={filename}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={filename}
                  style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 8,
                    background: "rgba(220,38,38,0.08)", color: "#dc2626",
                    textDecoration: "none", border: "1px solid rgba(220,38,38,0.2)",
                    fontFamily: "var(--mono)", display: "inline-flex", alignItems: "center", gap: 4,
                  }}
                >
                  📄 PDF {idx + 1}
                </a>
              );
            }
            // Outro tipo — link genérico
            return (
              <a
                key={filename}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title={filename}
                style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 8,
                  background: "rgba(37,99,235,0.08)", color: "var(--accent)",
                  textDecoration: "none", border: "1px solid rgba(37,99,235,0.18)",
                  fontFamily: "var(--mono)",
                }}
              >
                📎 {idx + 1}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Componente principal ─────────────────────────────────────────────────── */
export function RelatorioMensal() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport]       = useState<MonthlyReport | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading]     = useState(true);

  // Filtros
  const [employeeFilter, setEmployeeFilter] = useState<number | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");

  /** Ao escolher uma data de outro mês, navega para esse mês automaticamente
   *  — o relatório é carregado mês a mês, então sem isso o filtro vinha vazio. */
  const syncMonthTo = (iso: string) => {
    if (!iso) return;
    const [y, m] = iso.split("-").map(Number);
    if (!y || !m) return;
    if (y !== year || m !== month) { setYear(y); setMonth(m); }
  };
  const handleDateFrom = (v: string) => { setDateFrom(v); syncMonthTo(v); };
  const handleDateTo = (v: string) => {
    setDateTo(v);
    if (!dateFrom) syncMonthTo(v);
  };

  // Modais
  const [editing, setEditing]     = useState<MonthlyRecord | null>(null);
  const [lightbox, setLightbox]   = useState<{ url: string; filename: string } | null>(null);

  const loadReport = (y: number, m: number) => {
    setLoading(true);
    api.getMonthlyReport(y, m).then(setReport).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadReport(year, month); }, [year, month]);
  useEffect(() => { api.getEmployees().then(setEmployees).catch(console.error); }, []);

  const changeMonth = (dir: -1 | 1) => {
    const d = new Date(year, month - 1 + dir, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const clearFilters = () => { setEmployeeFilter("all"); setDateFrom(""); setDateTo(""); };

  const filteredRecords = useMemo(() => {
    if (!report) return [];
    return report.records.filter(r => {
      if (employeeFilter !== "all" && r.employee_id !== employeeFilter) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo   && r.date > dateTo)   return false;
      return true;
    });
  }, [report, employeeFilter, dateFrom, dateTo]);

  // Resumo vem do servidor (saldo por calendário — sábado não trabalhado = débito).
  const displaySummary = useMemo(() => {
    if (!report) return [];
    return employeeFilter === "all"
      ? report.summary
      : report.summary.filter(s => s.employee_id === employeeFilter);
  }, [report, employeeFilter]);

  const totals = useMemo(() => ({
    worked:    displaySummary.reduce((a, s) => a + s.worked_minutes, 0),
    reference: displaySummary.reduce((a, s) => a + s.reference_minutes, 0),
    balance:   displaySummary.reduce((a, s) => a + s.balance, 0),
    normal:    displaySummary.reduce((a, s) => a + (s.normal_minutes ?? 0), 0),
    shortfall: displaySummary.reduce((a, s) => a + (s.shortfall_minutes ?? 0), 0),
    extra50:   displaySummary.reduce((a, s) => a + (s.extra50_minutes ?? 0), 0),
    extra100:  displaySummary.reduce((a, s) => a + s.extra100_minutes, 0),
    night:     displaySummary.reduce((a, s) => a + s.night_bonus_minutes, 0),
    pending:   displaySummary.reduce((a, s) => a + s.pending, 0),
    days:      displaySummary.reduce((a, s) => a + s.days, 0),
  }), [displaySummary]);

  const monthTag = `${year}${String(month).padStart(2, "0")}`;

  /* ── Exportar Excel / CSV (servidor, formatado A4) — respeitam os filtros ── */
  const exportFilter = useMemo(() => {
    const nome = employeeFilter === "all"
      ? "" : "_" + (employees.find(e => e.id === employeeFilter)?.name ?? "colab")
        .replace(/\s+/g, "_").toLowerCase();
    return {
      employeeId: employeeFilter === "all" ? null : employeeFilter,
      start: dateFrom || undefined,
      end: dateTo || undefined,
      suffix: nome,
    };
  }, [employeeFilter, dateFrom, dateTo, employees]);

  const filtroAtivo = employeeFilter !== "all" || Boolean(dateFrom) || Boolean(dateTo);

  const exportExcel = async () => {
    try { await api.downloadMonthlyXlsx(year, month, exportFilter); }
    catch (e) { alert(e instanceof Error ? e.message : "Falha ao gerar Excel."); }
  };
  const exportCSV = async () => {
    try { await api.downloadMonthlyCsv(year, month, exportFilter); }
    catch (e) { alert(e instanceof Error ? e.message : "Falha ao gerar CSV."); }
  };

  /* ── PDF: dashboard + espelhos, seguindo os filtros da tela ── */
  const [pdfBusy, setPdfBusy] = useState(false);
  const exportPDF = async () => {
    if (!report || displaySummary.length === 0) return;
    const nome = employeeFilter === "all" ? null : (displaySummary[0]?.employee_name ?? null);
    const periodo = dateFrom || dateTo
      ? ` (${dateFrom ? dateFrom.split("-").reverse().join("/") : "início"} a ${dateTo ? dateTo.split("-").reverse().join("/") : "fim"})`
      : "";
    const scope = (nome ?? "Todos os colaboradores") + periodo;
    const suffix = nome ? nome.replace(/\s+/g, "_").toLowerCase() : "todos";
    setPdfBusy(true);
    try { await downloadMonthlyPdf(report, displaySummary, scope, `pontofield_${monthTag}_${suffix}.pdf`); }
    catch (e) { alert(e instanceof Error ? e.message : "Falha ao gerar PDF."); }
    finally { setPdfBusy(false); }
  };

  return (
    <div>
      <div className="sec-header">
        <div className="month-nav">
          <button className="icon-btn" onClick={() => changeMonth(-1)} aria-label="Mês anterior" title="Mês anterior">‹</button>
          <span className="month-display">{MONTH_NAMES[month - 1]} {year}</span>
          <button className="icon-btn" onClick={() => changeMonth(1)} aria-label="Próximo mês" title="Próximo mês">›</button>
        </div>
        <div className="row" style={{ alignItems: "center", gap: 8 }}>
          {filtroAtivo && (
            <span title="Os arquivos sairão apenas com o que está filtrado"
              style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                background: "rgba(37,99,235,0.10)", color: "var(--accent)", whiteSpace: "nowrap" }}>
              🔎 exportando o filtro
            </span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={exportExcel}
            title={filtroAtivo ? "Excel apenas do que está filtrado" : "Planilha completa (Resumo + 1 aba por colaborador), pronta para A4"}>
            📊 Excel
          </button>
          <button className="btn btn-secondary btn-sm" onClick={exportCSV}
            title={filtroAtivo ? "CSV apenas do que está filtrado" : "Exportar dados em CSV (separador ; — abre no Excel)"}>
            🧾 CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={exportPDF} disabled={pdfBusy}
            title={filtroAtivo
              ? "PDF do que está filtrado (dashboard + banco de horas por semana + detalhamento), A4"
              : "PDF dashboard executivo + espelho de todos os colaboradores, A4"}>
            {pdfBusy ? "⏳ Gerando…" : "📄 PDF"}
          </button>
        </div>
      </div>

      {/* FILTROS */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-title">Filtros</div>
        <div className="form-grid">
          <div className="form-group">
            <label>Colaborador</label>
            <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value === "all" ? "all" : Number(e.target.value))}>
              <option value="all">Todos</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Data inicial</label>
            <input type="date" value={dateFrom} onChange={e => handleDateFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Data final</label>
            <input type="date" value={dateTo} onChange={e => handleDateTo(e.target.value)} />
          </div>
        </div>
        {(() => {
          const mesAtual = `${year}-${String(month).padStart(2, "0")}`;
          const foraDoMes = [dateFrom, dateTo].filter(Boolean).some(d => !d.startsWith(mesAtual));
          return foraDoMes ? (
            <div className="alert alert-error" style={{ marginTop: 12, fontSize: 12 }}>
              ⚠️ O relatório mostra um mês por vez ({MONTH_NAMES[month - 1]}/{year}). Datas de outros
              meses não aparecem — ajuste o filtro ou navegue até o mês desejado.
            </div>
          ) : null;
        })()}
        {(employeeFilter !== "all" || dateFrom || dateTo) && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "var(--accent)" }}>✓ {filteredRecords.length} registro(s) após filtro</span>
            <button className="btn btn-secondary btn-sm" onClick={clearFilters}>Limpar filtros</button>
          </div>
        )}
      </div>

      {loading ? (
        <p style={{ color: "var(--muted)", padding: 20 }}>Carregando…</p>
      ) : !report ? null : (
        <>
          <div className="stats-grid">
            <StatCard label="H. Trabalhadas" value={fmtMinUnsigned(totals.worked)} />
            <StatCard label="H. Referência" value={fmtMinUnsigned(totals.reference)} />
            <StatCard label="Saldo do Mês" value={fmtMin(totals.balance)} variant={totals.balance >= 0 ? "pos" : "neg"} />
            {totals.pending > 0 && (
              <StatCard label="Pendentes" value={String(totals.pending)} variant="warn" />
            )}
          </div>

          <div className="card">
            <div className="card-title">Detalhamento — {MONTH_NAMES[month - 1]}/{year}</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Colaborador</th>
                    <th>Tipo</th>
                    <th>Entrada</th>
                    <th>Saída</th>
                    <th>Início Int.</th>
                    <th>Fim Int.</th>
                    <th>Trab.</th>
                    <th>Ref.</th>
                    <th>Saldo</th>
                    <th>Status</th>
                    <th>Obs / Anexos</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 ? (
                    <tr><td colSpan={13} className="empty">Nenhum registro nesse filtro.</td></tr>
                  ) : (
                    filteredRecords.map(r => (
                      <tr key={r.id}>
                        <td className="mono">{fmtDate(r.date)}</td>
                        <td>{r.employee_name}</td>
                        <td className="mono">
                          {r.day_type ?? "—"}
                          {r.abono_code && <span style={{ marginLeft: 4, fontSize: 10, padding: "1px 5px", borderRadius: 10, background: "rgba(0,174,239,0.12)", color: "#0284c7" }}>{r.abono_code}</span>}
                        </td>
                        <td className="mono">{r.entry_time ?? "—"}</td>
                        <td className="mono">
                          {r.exit_time ?? (r.abono_code ? "—" : (
                            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "rgba(245,166,35,0.15)", color: "var(--accent2)", fontFamily: "var(--mono)" }}>
                              em aberto
                            </span>
                          ))}
                        </td>
                        <td className="mono">{r.break_start ?? "—"}</td>
                        <td className="mono">{r.break_end ?? "—"}</td>
                        <td className="mono">{r.worked_minutes != null ? fmtMinUnsigned(r.worked_minutes) : "—"}</td>
                        <td className="mono">{fmtMinUnsigned(r.standard_minutes)}</td>
                        <td>{r.overtime_minutes != null ? <Badge minutes={r.overtime_minutes} /> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                        <td><StatusPill status={r.status} retro={r.is_retroactive} /></td>
                        <td>
                          <AttachmentsCell
                            note={r.note}
                            attachments={r.attachments}
                            onImageClick={(url, filename) => setLightbox({ url, filename })}
                          />
                        </td>
                        <td>
                          <button className="icon-btn" onClick={() => setEditing(r)} title="Alterar horários" style={{ width: 30, height: 30, fontSize: 14 }}>⚙️</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Resumo por Colaborador</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Dias (Ú/S/D)</th>
                    <th>Trabalhado</th>
                    <th>Referência</th>
                    <th>H. Normais</th>
                    <th>Extra 50%</th>
                    <th>Extra 100%</th>
                    <th>Atraso/Falta</th>
                    <th>Saldo</th>
                    <th>Noturno</th>
                    <th>Faltas / Atest.</th>
                    <th>Pend.</th>
                  </tr>
                </thead>
                <tbody>
                  {displaySummary.length === 0 ? (
                    <tr><td colSpan={12} className="empty">Nenhum dado.</td></tr>
                  ) : (
                    <>
                      {displaySummary.map(s => (
                        <tr key={s.employee_id}>
                          <td style={{ fontWeight: 500 }}>{s.employee_name}</td>
                          <td className="mono">{s.days_h1}/{s.days_h2}/{s.days_h3}</td>
                          <td className="mono">{fmtMinUnsigned(s.worked_minutes)}</td>
                          <td className="mono">{fmtMinUnsigned(s.reference_minutes)}</td>
                          <td className="mono">{fmtMinUnsigned(s.normal_minutes ?? 0)}</td>
                          <td className="mono" style={{ color: (s.extra50_minutes ?? 0) > 0 ? "var(--pos)" : undefined }}>
                            {(s.extra50_minutes ?? 0) > 0 ? fmtMinUnsigned(s.extra50_minutes) : "—"}
                          </td>
                          <td className="mono" style={{ color: s.extra100_minutes > 0 ? "#0d9488" : undefined, fontWeight: s.extra100_minutes > 0 ? 700 : undefined }}>
                            {s.extra100_minutes > 0 ? fmtMinUnsigned(s.extra100_minutes) : "—"}
                          </td>
                          <td className="mono" style={{ color: (s.shortfall_minutes ?? 0) > 0 ? "var(--neg)" : undefined }}>
                            {(s.shortfall_minutes ?? 0) > 0 ? fmtMinUnsigned(s.shortfall_minutes) : "—"}
                          </td>
                          <td><Badge minutes={s.balance} /></td>
                          <td className="mono">{s.night_bonus_minutes > 0 ? fmtMinUnsigned(s.night_bonus_minutes) : "—"}</td>
                          <td className="mono">{s.faltas} / {s.atestados}</td>
                          <td className="mono">{s.pending > 0 ? <span style={{ color: "var(--accent2)" }}>{s.pending}</span> : "—"}</td>
                        </tr>
                      ))}
                      <tr className="total-row">
                        <td>TOTAL</td>
                        <td className="mono">
                          {displaySummary.reduce((a, s) => a + s.days_h1, 0)}/
                          {displaySummary.reduce((a, s) => a + s.days_h2, 0)}/
                          {displaySummary.reduce((a, s) => a + s.days_h3, 0)}
                        </td>
                        <td className="mono">{fmtMinUnsigned(totals.worked)}</td>
                        <td className="mono">{fmtMinUnsigned(totals.reference)}</td>
                        <td className="mono">{fmtMinUnsigned(totals.normal)}</td>
                        <td className="mono">{totals.extra50 > 0 ? fmtMinUnsigned(totals.extra50) : "—"}</td>
                        <td className="mono" style={{ fontWeight: 700 }}>{totals.extra100 > 0 ? fmtMinUnsigned(totals.extra100) : "—"}</td>
                        <td className="mono">{totals.shortfall > 0 ? fmtMinUnsigned(totals.shortfall) : "—"}</td>
                        <td><Badge minutes={totals.balance} /></td>
                        <td className="mono">{totals.night > 0 ? fmtMinUnsigned(totals.night) : "—"}</td>
                        <td className="mono">
                          {displaySummary.reduce((a, s) => a + s.faltas, 0)} / {displaySummary.reduce((a, s) => a + s.atestados, 0)}
                        </td>
                        <td className="mono">{totals.pending || "—"}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {editing && (
        <EditTimesModal record={editing} onClose={() => setEditing(null)} onSaved={() => loadReport(year, month)} />
      )}

      {lightbox && (
        <ImageLightbox url={lightbox.url} filename={lightbox.filename} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
