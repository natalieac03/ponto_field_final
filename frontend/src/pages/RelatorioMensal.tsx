import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "../api/client";
import { Badge, fmtDate, fmtMin, fmtMinUnsigned } from "../components/Badge";
import { ImageLightbox } from "../components/ImageLightbox";
import { StatCard } from "../components/StatCard";
import { isImage, isPdf } from "../helpers/attachments";
import type { Employee, MonthlyRecord, MonthlyReport, WeeklyEntry } from "../types";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function fmtDateShort(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/* ─── Modal de edição de horários ─────────────────────────────────────────── */
interface EditModalProps {
  record: MonthlyRecord;
  onClose: () => void;
  onSaved: () => void;
}

function EditTimesModal({ record, onClose, onSaved }: EditModalProps) {
  const [entryTime, setEntryTime]   = useState(record.entry_time);
  const [breakStart, setBreakStart] = useState(record.break_start ?? "");
  const [breakEnd, setBreakEnd]     = useState(record.break_end ?? "");
  const [exitTime, setExitTime]     = useState(record.exit_time ?? "");
  const [error, setError]   = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError("");
    const payload: { entry_time?: string; break_start?: string; break_end?: string; exit_time?: string } = {};
    if (entryTime !== record.entry_time)           payload.entry_time  = entryTime;
    if (breakStart !== (record.break_start ?? "")) payload.break_start = breakStart;
    if (breakEnd   !== (record.break_end   ?? "")) payload.break_end   = breakEnd;
    if (exitTime   !== (record.exit_time   ?? "")) payload.exit_time   = exitTime;
    if (Object.keys(payload).length === 0) { onClose(); return; }
    setSaving(true);
    try { await api.patchTimes(record.id, payload); onSaved(); onClose(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Erro ao salvar."); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,21,38,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 420, boxShadow: "var(--shadow-md)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>⚙️ Alterar horários</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--muted)", fontFamily: "var(--font)" }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 18 }}>{fmtDate(record.date)} · {record.employee_name}</div>
        <div className="form-grid" style={{ marginBottom: 16 }}>
          <div className="form-group"><label>Entrada</label><input type="time" value={entryTime} onChange={e => { setEntryTime(e.target.value); setError(""); }} /></div>
          <div className="form-group"><label>Saída</label><input type="time" value={exitTime} onChange={e => { setExitTime(e.target.value); setError(""); }} /></div>
          <div className="form-group"><label>Início intervalo</label><input type="time" value={breakStart} onChange={e => { setBreakStart(e.target.value); setError(""); }} /></div>
          <div className="form-group"><label>Fim intervalo</label><input type="time" value={breakEnd} onChange={e => { setBreakEnd(e.target.value); setError(""); }} /></div>
        </div>
        <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
          ℹ️ O saldo fecha por SEMANA (44h seg-sex; sábado conta como trabalhado).
          Deixe em branco para limpar um campo.
        </p>
        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
    </div>
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
                  style={{ padding: 0, border: "2px solid var(--border2)", borderRadius: 8, cursor: "zoom-in", background: "none", overflow: "hidden", width: 48, height: 48, flexShrink: 0, transition: "border-color 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border2)"; }}
                >
                  <img src={url} alt={`Anexo ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </button>
              );
            }
            if (isPdf(filename)) {
              return (
                <a key={filename} href={url} target="_blank" rel="noopener noreferrer" title={filename}
                  style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, background: "rgba(220,38,38,0.08)", color: "#dc2626", textDecoration: "none", border: "1px solid rgba(220,38,38,0.2)", fontFamily: "var(--mono)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  📄 PDF {idx + 1}
                </a>
              );
            }
            return (
              <a key={filename} href={url} target="_blank" rel="noopener noreferrer" title={filename}
                style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, background: "rgba(37,99,235,0.08)", color: "var(--accent)", textDecoration: "none", border: "1px solid rgba(37,99,235,0.18)", fontFamily: "var(--mono)" }}>
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

  // Modais
  const [editing, setEditing]   = useState<MonthlyRecord | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; filename: string } | null>(null);

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

  // Semanas: filtra por colaborador e por interseção com o intervalo de datas
  const filteredWeeks = useMemo<WeeklyEntry[]>(() => {
    if (!report) return [];
    return report.weeks.filter(w => {
      if (employeeFilter !== "all" && w.employee_id !== employeeFilter) return false;
      if (dateFrom && w.week_end < dateFrom) return false;
      if (dateTo   && w.week_start > dateTo) return false;
      return true;
    });
  }, [report, employeeFilter, dateFrom, dateTo]);

  const filteredStats = useMemo(() => {
    const worked = filteredWeeks.reduce((a, w) => a + w.worked_minutes, 0);
    const expected = filteredWeeks.reduce((a, w) => a + w.expected_minutes, 0);
    return {
      totalRecords: filteredRecords.length,
      weeks: filteredWeeks.length,
      worked,
      balance: worked - expected,
    };
  }, [filteredRecords, filteredWeeks]);

  // Resumo por colaborador = soma das semanas filtradas
  const filteredSummary = useMemo(() => {
    const map: Record<number, { id: number; name: string; weeks: number; days: number; worked: number; expected: number }> = {};
    filteredWeeks.forEach(w => {
      if (!map[w.employee_id]) map[w.employee_id] = { id: w.employee_id, name: w.employee_name, weeks: 0, days: 0, worked: 0, expected: 0 };
      const s = map[w.employee_id];
      s.weeks += 1;
      s.days += w.days;
      s.worked += w.worked_minutes;
      s.expected += w.expected_minutes;
    });
    return Object.values(map);
  }, [filteredWeeks]);

  /* ── Exportar Excel ── */
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Aba 1 — Detalhamento diário (sem saldo — fechamento é semanal)
    const det = filteredRecords.map(r => ({
      "Data":             r.date,
      "Colaborador":      r.employee_name,
      "Entrada":          r.entry_time,
      "Saída":            r.exit_time ?? "",
      "Início Intervalo": r.break_start ?? "",
      "Fim Intervalo":    r.break_end ?? "",
      "Intervalo (min)":  r.break_minutes ?? "",
      "Trabalhado (min)": r.worked_minutes ?? "",
      "Observação":       r.note ?? "",
      "Anexos":           r.attachments.length,
    }));
    const ws1 = XLSX.utils.json_to_sheet(det);
    ws1["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 8 }, { wch: 8 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 35 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Detalhamento");

    // Aba 2 — Fechamento Semanal
    const sem = filteredWeeks.map(w => ({
      "Semana (início)":  w.week_start,
      "Semana (fim)":     w.week_end,
      "Colaborador":      w.employee_name,
      "Dias":             w.days,
      "Trabalhado (min)": w.worked_minutes,
      "Meta semanal (min)": w.expected_minutes,
      "Abatido (min)":    w.deducted_minutes,
      "Feriados/Eventos": w.deduction_labels.join(" · "),
      "Saldo (min)":      w.balance,
    }));
    const ws2 = XLSX.utils.json_to_sheet(sem);
    ws2["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 6 }, { wch: 16 }, { wch: 18 }, { wch: 13 }, { wch: 34 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Fechamento Semanal");

    // Aba 3 — Resumo por colaborador
    const sum = filteredSummary.map(s => ({
      "Colaborador":       s.name,
      "Semanas":           s.weeks,
      "Dias":              s.days,
      "Trabalhado (min)":  s.worked,
      "Meta (min)":        s.expected,
      "Saldo (min)":       s.worked - s.expected,
    }));
    const ws3 = XLSX.utils.json_to_sheet(sum);
    ws3["!cols"] = [{ wch: 22 }, { wch: 9 }, { wch: 6 }, { wch: 16 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Resumo");

    XLSX.writeFile(wb, `pontofield_${year}${String(month).padStart(2, "0")}.xlsx`);
  };

  /* ── Exportar PDF ── */
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const title = `Relatório de Ponto — ${MONTH_NAMES[month - 1]}/${year}`;
    const subtitle = employeeFilter !== "all"
      ? `Colaborador: ${employees.find(e => e.id === employeeFilter)?.name ?? "—"}`
      : "Todos os colaboradores";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(title, 14, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`${subtitle} · Jornada semanal: 44h (seg-sex) · Sábado: escala`, 14, 22);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 27);

    // Detalhamento diário
    autoTable(doc, {
      startY: 33,
      head: [["Data", "Colaborador", "Entrada", "Saída", "Início Int.", "Fim Int.", "Trabalhado"]],
      body: filteredRecords.map(r => [
        fmtDate(r.date),
        r.employee_name,
        r.entry_time,
        r.exit_time ?? "—",
        r.break_start ?? "—",
        r.break_end ?? "—",
        r.worked_minutes != null ? fmtMinUnsigned(r.worked_minutes) : "—",
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 248, 255] },
    });

    // Fechamento Semanal
    let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Fechamento Semanal (meta 44h)", 14, y);

    autoTable(doc, {
      startY: y + 4,
      head: [["Semana", "Colaborador", "Dias", "Trabalhado", "Meta", "Saldo", "Feriados / Eventos"]],
      body: filteredWeeks.map(w => [
        `${fmtDateShort(w.week_start)} – ${fmtDateShort(w.week_end)}`,
        w.employee_name,
        String(w.days),
        fmtMinUnsigned(w.worked_minutes),
        fmtMinUnsigned(w.expected_minutes),
        w.balance >= 0 ? `+${fmtMinUnsigned(w.balance)}` : `-${fmtMinUnsigned(Math.abs(w.balance))}`,
        w.deduction_labels.join(" · ") || "—",
      ]),
      styles: { fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      columnStyles: { 5: { fontStyle: "bold" }, 6: { cellWidth: 62, fontSize: 7 } },
    });

    // Resumo por colaborador
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Resumo por colaborador", 14, y);

    autoTable(doc, {
      startY: y + 4,
      head: [["Colaborador", "Semanas", "Dias", "Trabalhado", "Meta", "Saldo"]],
      body: [
        ...filteredSummary.map(s => [
          s.name, String(s.weeks), String(s.days),
          fmtMinUnsigned(s.worked), fmtMinUnsigned(s.expected),
          (s.worked - s.expected) >= 0
            ? `+${fmtMinUnsigned(s.worked - s.expected)}`
            : `-${fmtMinUnsigned(Math.abs(s.worked - s.expected))}`,
        ]),
        (() => {
          const t = filteredSummary.reduce((a, s) => ({ w: a.w + s.weeks, d: a.d + s.days, wk: a.wk + s.worked, e: a.e + s.expected }), { w: 0, d: 0, wk: 0, e: 0 });
          const bal = t.wk - t.e;
          return ["TOTAL", String(t.w), String(t.d), fmtMinUnsigned(t.wk), fmtMinUnsigned(t.e),
            bal >= 0 ? `+${fmtMinUnsigned(bal)}` : `-${fmtMinUnsigned(Math.abs(bal))}`];
        })(),
      ],
      styles: { fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      didParseCell(data) {
        if (data.row.index === filteredSummary.length && data.section === "body") {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [220, 231, 255];
        }
      },
    });

    // ── Bloco de assinaturas ──
    const sigY0 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    const pageH = doc.internal.pageSize.getHeight();
    const pageW = doc.internal.pageSize.getWidth();
    let sigY = sigY0 + 24;
    if (sigY + 20 > pageH - 10) {
      doc.addPage();
      sigY = 40;
    }
    const colW = (pageW - 28 - 20) / 2;
    const line1x = 14;
    const line2x = 14 + colW + 20;

    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.4);
    doc.line(line1x, sigY, line1x + colW, sigY);
    doc.line(line2x, sigY, line2x + colW, sigY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("ASSINATURA DO FUNCIONÁRIO", line1x + colW / 2, sigY + 5, { align: "center" });
    doc.text("ASSINATURA DO GESTOR", line2x + colW / 2, sigY + 5, { align: "center" });

    doc.save(`pontofield_${year}${String(month).padStart(2, "0")}.pdf`);
  };

  return (
    <div>
      <div className="sec-header">
        <div className="month-nav">
          <button className="icon-btn" onClick={() => changeMonth(-1)}>‹</button>
          <span className="month-display">{MONTH_NAMES[month - 1]} {year}</span>
          <button className="icon-btn" onClick={() => changeMonth(1)}>›</button>
        </div>
        <div className="row">
          <button className="btn btn-secondary btn-sm" onClick={exportExcel} title="Exportar Excel: Detalhamento + Fechamento Semanal + Resumo">📊 Excel</button>
          <button className="btn btn-secondary btn-sm" onClick={exportPDF} title="Exportar PDF com assinaturas">📄 PDF</button>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>🖨 Imprimir</button>
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
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Data final</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
        {(employeeFilter !== "all" || dateFrom || dateTo) && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "var(--accent)" }}>✓ {filteredRecords.length} registro(s) · {filteredWeeks.length} semana(s)</span>
            <button className="btn btn-secondary btn-sm" onClick={clearFilters}>Limpar filtros</button>
          </div>
        )}
      </div>

      {loading ? (
        <p style={{ color: "var(--muted)", padding: 20 }}>Carregando…</p>
      ) : !report ? null : (
        <>
          <div className="stats-grid">
            <StatCard label="Semanas" value={String(filteredStats.weeks)} />
            <StatCard label="H. Trabalhadas" value={fmtMinUnsigned(filteredStats.worked)} />
            <StatCard label="Saldo (fechamento semanal)" value={fmtMin(filteredStats.balance)} variant={filteredStats.balance >= 0 ? "pos" : "neg"} />
          </div>

          {/* FECHAMENTO SEMANAL — tabela principal */}
          <div className="card">
            <div className="card-title">Fechamento Semanal — meta 44h (seg-sex · sábado conta como trabalhado)</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Semana</th>
                    <th>Colaborador</th>
                    <th>Dias</th>
                    <th>Trabalhado</th>
                    <th>Meta</th>
                    <th>Saldo da Semana</th>
                    <th>Feriados / Eventos</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWeeks.length === 0 ? (
                    <tr><td colSpan={7} className="empty">Nenhuma semana fechada nesse filtro.</td></tr>
                  ) : (
                    filteredWeeks.map(w => (
                      <tr key={`${w.employee_id}-${w.week_start}`}>
                        <td className="mono">{fmtDateShort(w.week_start)} – {fmtDateShort(w.week_end)}</td>
                        <td style={{ fontWeight: 500 }}>{w.employee_name}</td>
                        <td className="mono">{w.days}</td>
                        <td className="mono">{fmtMinUnsigned(w.worked_minutes)}</td>
                        <td className="mono">
                          {fmtMinUnsigned(w.expected_minutes)}
                          {w.deducted_minutes > 0 && (
                            <div title={w.deduction_labels.join(" · ")} style={{ fontSize: 10, color: "var(--accent2)", fontFamily: "var(--font)", marginTop: 2 }}>
                              🏖 −{fmtMinUnsigned(w.deducted_minutes)}
                            </div>
                          )}
                        </td>
                        <td><Badge minutes={w.balance} /></td>
                        <td style={{ fontSize: 11, color: "var(--muted)", maxWidth: 220 }}>
                          {w.deduction_labels.length > 0 ? w.deduction_labels.join(" · ") : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* DETALHAMENTO DIÁRIO — sem saldo por dia */}
          <div className="card">
            <div className="card-title">Detalhamento diário — {MONTH_NAMES[month - 1]}/{year}</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Colaborador</th>
                    <th>Entrada</th>
                    <th>Saída</th>
                    <th>Início Int.</th>
                    <th>Fim Int.</th>
                    <th>Trabalhado</th>
                    <th>Obs / Anexos</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 ? (
                    <tr><td colSpan={9} className="empty">Nenhum registro nesse filtro.</td></tr>
                  ) : (
                    filteredRecords.map(r => (
                      <tr key={r.id}>
                        <td className="mono">{fmtDate(r.date)}</td>
                        <td>{r.employee_name}</td>
                        <td className="mono">{r.entry_time}</td>
                        <td className="mono">
                          {r.exit_time ?? (
                            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "rgba(245,166,35,0.15)", color: "var(--accent2)", fontFamily: "var(--mono)" }}>em aberto</span>
                          )}
                        </td>
                        <td className="mono">{r.break_start ?? "—"}</td>
                        <td className="mono">{r.break_end ?? "—"}</td>
                        <td className="mono">{r.worked_minutes != null ? fmtMinUnsigned(r.worked_minutes) : "—"}</td>
                        <td>
                          <AttachmentsCell note={r.note} attachments={r.attachments} onImageClick={(url, filename) => setLightbox({ url, filename })} />
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

          {/* RESUMO POR COLABORADOR */}
          <div className="card">
            <div className="card-title">Resumo por Colaborador</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Semanas</th>
                    <th>Dias</th>
                    <th>H. Trabalhadas</th>
                    <th>Meta</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummary.length === 0 ? (
                    <tr><td colSpan={6} className="empty">Nenhum dado.</td></tr>
                  ) : (
                    <>
                      {filteredSummary.map(s => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 500 }}>{s.name}</td>
                          <td className="mono">{s.weeks}</td>
                          <td className="mono">{s.days}</td>
                          <td className="mono">{fmtMinUnsigned(s.worked)}</td>
                          <td className="mono">{fmtMinUnsigned(s.expected)}</td>
                          <td><Badge minutes={s.worked - s.expected} /></td>
                        </tr>
                      ))}
                      {(() => {
                        const t = filteredSummary.reduce((acc, s) => ({ weeks: acc.weeks + s.weeks, days: acc.days + s.days, worked: acc.worked + s.worked, expected: acc.expected + s.expected }), { weeks: 0, days: 0, worked: 0, expected: 0 });
                        return (
                          <tr className="total-row">
                            <td>TOTAL</td>
                            <td className="mono">{t.weeks}</td>
                            <td className="mono">{t.days}</td>
                            <td className="mono">{fmtMinUnsigned(t.worked)}</td>
                            <td className="mono">{fmtMinUnsigned(t.expected)}</td>
                            <td><Badge minutes={t.worked - t.expected} /></td>
                          </tr>
                        );
                      })()}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Assinaturas — aparecem SOMENTE na impressão */}
          <div className="print-signatures">
            <div className="sig-block">
              <div className="sig-line" />
              <div className="sig-label">ASSINATURA DO FUNCIONÁRIO</div>
            </div>
            <div className="sig-block">
              <div className="sig-line" />
              <div className="sig-label">ASSINATURA DO GESTOR</div>
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
