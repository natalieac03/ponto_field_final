import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { CalendarDay, CalendarKind, Employee, EmployeeLeave, EmployeeShift, HolidaySuggestion, LeaveKind } from "../types";

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const WD = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];

const KIND: Record<CalendarKind, { color: string; bg: string; icon: string; label: string }> = {
  feriado:     { color: "#dc2626", bg: "rgba(220,38,38,0.10)",  icon: "🏖", label: "Feriado" },
  facultativo: { color: "#b45309", bg: "rgba(245,166,35,0.14)", icon: "🕊", label: "Facultativo" },
  evento:      { color: "#2563eb", bg: "rgba(37,99,235,0.10)",  icon: "📌", label: "Evento" },
};

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const fmtDeduct = (min: number | null) =>
  min === null ? "dia inteiro" : `−${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;

export function Calendario() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<HolidaySuggestion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [leaves, setLeaves] = useState<EmployeeLeave[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveModal, setLeaveModal] = useState(false);
  const [shifts, setShifts] = useState<EmployeeShift[]>([]);
  const [shiftModal, setShiftModal] = useState(false);

  const load = () => api.getCalendar().then(setDays).catch(console.error);
  const loadLeaves = () => api.getLeaves().then(setLeaves).catch(console.error);
  const loadShifts = () => api.getShifts().then(setShifts).catch(console.error);
  useEffect(() => {
    load(); loadLeaves(); loadShifts();
    api.getEmployees().then(es => setEmployees(es.filter(e => e.active))).catch(console.error);
  }, []);

  const empName = (id: number) => employees.find(e => e.id === id)?.name ?? `#${id}`;

  // Escalas por data: {data: [nomes]}
  const shiftByDate = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const sh of shifts) (m[sh.date] ??= []).push(empName(sh.employee_id));
    return m;
  }, [shifts, employees]);

  // Dias cobertos por férias no mês visível: {data: "Nome (Férias)"}
  const leaveByDate = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const lv of leaves) {
      const start = new Date(lv.start_date + "T12:00");
      const end = new Date(lv.end_date + "T12:00");
      for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        (m[key] ??= []).push(empName(lv.employee_id));
      }
    }
    return m;
  }, [leaves, employees]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4000); };

  const byDate = useMemo(() => Object.fromEntries(days.map(d => [d.date, d])), [days]);

  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const total = new Date(year, month, 0).getDate();
    const off = (first.getDay() + 6) % 7;
    const out: (number | null)[] = Array(off).fill(null);
    for (let d = 1; d <= total; d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month]);

  const changeMonth = (dir: -1 | 1) => {
    const d = new Date(year, month - 1 + dir, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth() + 1);
  };

  const doImport = async (fac: boolean) => {
    setBusy(true);
    try {
      const r = await api.importHolidays(year, fac);
      flash(r.added > 0 ? `${r.added} feriado(s) de ${year} importado(s).` : `Nada novo para ${year}.`);
      load(); setSuggestions(null);
    } catch (e) { flash(e instanceof Error ? e.message : "Erro."); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="sec-header">
        <div className="month-nav">
          <button className="icon-btn" onClick={() => changeMonth(-1)}>‹</button>
          <span className="month-display">{MONTHS[month - 1]} {year}</span>
          <button className="icon-btn" onClick={() => changeMonth(1)}>›</button>
        </div>
        <div className="row">
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => doImport(false)}>
            {busy ? "Importando…" : `🇧🇷 Importar feriados ${year}`}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShiftModal(true)}>
            📋 Marcar escala
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setLeaveModal(true)}>
            🏖 Marcar férias
          </button>
          <button className="btn btn-secondary btn-sm"
            onClick={() => suggestions ? setSuggestions(null) : api.getHolidaySuggestions(year).then(setSuggestions)}>
            {suggestions ? "Ocultar lista" : "Ver feriados oficiais"}
          </button>
        </div>
      </div>

      {msg && <div className="alert alert-success" style={{ marginBottom: 12 }}>{msg}</div>}

      <div className="card">
        <div className="card-title">Calendário — clique num dia para marcar</div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
          Feriado/facultativo de dia inteiro vira H3 (referência 0). Evento com dispensa
          parcial (ex.: jogo do Brasil −3h) abate da jornada do dia. Nacionais + Goiás +
          Goiânia importados em um clique.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 6 }}>
          {WD.map((w, i) => (
            <div key={w} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: i >= 5 ? "var(--muted)" : "var(--text)", padding: "4px 0" }}>{w}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
          {cells.map((d, i) => {
            if (d === null) return <div key={`e${i}`} />;
            const dt = iso(year, month, d);
            const mk = byDate[dt];
            const st = mk ? KIND[mk.kind] : null;
            const weekend = i % 7 >= 5;
            return (
              <button key={dt} onClick={() => setEditing(dt)}
                title={mk ? `${mk.label} (${fmtDeduct(mk.deduct_minutes)})` : "Marcar este dia"}
                style={{
                  minHeight: 60, padding: 6, borderRadius: 10, cursor: "pointer", textAlign: "left",
                  fontFamily: "var(--font)",
                  background: st ? st.bg : weekend ? "var(--surface2)" : "var(--surface)",
                  border: `1px solid ${st ? st.color + "55" : "var(--border2)"}`,
                  display: "flex", flexDirection: "column", gap: 2, overflow: "hidden",
                }}>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--mono)", color: st ? st.color : weekend ? "var(--muted)" : "var(--text)" }}>
                  {String(d).padStart(2, "0")}
                </span>
                {mk && (
                  <span style={{ fontSize: 9.5, lineHeight: 1.25, color: st!.color, fontWeight: 600, overflow: "hidden" }}>
                    {st!.icon} {mk.label}{mk.deduct_minutes !== null && ` (${fmtDeduct(mk.deduct_minutes)})`}
                  </span>
                )}
                {shiftByDate[dt]?.length > 0 && (
                  <span title={`Escala: ${shiftByDate[dt].join(", ")}`}
                    style={{ fontSize: 9, lineHeight: 1.2, color: "#7c3aed", fontWeight: 700, overflow: "hidden" }}>
                    📋 {shiftByDate[dt].length === 1 ? shiftByDate[dt][0].split(" ")[0] : `${shiftByDate[dt].length} escalados`}
                  </span>
                )}
                {leaveByDate[dt]?.length > 0 && (
                  <span title={`Férias: ${leaveByDate[dt].join(", ")}`}
                    style={{ fontSize: 9, lineHeight: 1.2, color: "#0d9488", fontWeight: 700, overflow: "hidden" }}>
                    🏖 {leaveByDate[dt].length === 1 ? leaveByDate[dt][0].split(" ")[0] : `${leaveByDate[dt].length} de férias`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {suggestions && (
        <div className="card">
          <div className="card-title">Feriados oficiais {year} — nacionais + Goiás + Goiânia</div>
          <button className="btn btn-secondary btn-sm" disabled={busy} style={{ marginBottom: 10 }}
            onClick={() => doImport(true)}>Importar também os facultativos</button>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Feriado</th><th>Tipo</th><th>Status</th></tr></thead>
              <tbody>
                {suggestions.map(s0 => {
                  const [yy, mm, dd] = s0.date.split("-");
                  return (
                    <tr key={s0.date}>
                      <td className="mono">{dd}/{mm}/{yy}</td>
                      <td>{s0.label}</td>
                      <td style={{ color: KIND[s0.kind].color, fontSize: 12 }}>{KIND[s0.kind].icon} {KIND[s0.kind].label}</td>
                      <td style={{ fontSize: 12 }}>{s0.already_added ? "✓ marcado" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {shifts.length > 0 && (
        <div className="card">
          <div className="card-title">Escalas marcadas</div>
          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
            Dia escalado conta como jornada normal (4h no sábado). Quem trabalhar em dia
            <strong> não escalado</strong> recebe as horas como <strong>extra 100%</strong>.
          </p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Dia</th><th>Colaborador</th><th>Obs.</th><th></th></tr></thead>
              <tbody>
                {shifts.map(sh => {
                  const d = new Date(sh.date + "T12:00");
                  return (
                    <tr key={sh.id}>
                      <td className="mono">{sh.date.split("-").reverse().join("/")}</td>
                      <td style={{ fontSize: 12 }}>{["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"][d.getDay()]}</td>
                      <td style={{ fontWeight: 500 }}>{empName(sh.employee_id)}</td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>{sh.note ?? "—"}</td>
                      <td>
                        <button className="btn btn-danger btn-sm"
                          onClick={async () => {
                            if (!confirm(`Remover a escala de ${empName(sh.employee_id)} em ${sh.date.split("-").reverse().join("/")}?`)) return;
                            try { await api.deleteShift(sh.id); loadShifts(); flash("Escala removida."); }
                            catch (e) { flash(e instanceof Error ? e.message : "Erro."); }
                          }}>Remover</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {leaves.length > 0 && (
        <div className="card">
          <div className="card-title">Férias e licenças programadas</div>
          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
            Nos dias marcados o colaborador não tem jornada esperada — não gera débito no banco de horas.
          </p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Colaborador</th><th>Início</th><th>Fim</th><th>Dias</th><th>Tipo</th><th>Obs.</th><th></th></tr></thead>
              <tbody>
                {leaves.map(lv => {
                  const dias = Math.round(
                    (new Date(lv.end_date + "T12:00").getTime() - new Date(lv.start_date + "T12:00").getTime())
                    / 86400000) + 1;
                  return (
                    <tr key={lv.id}>
                      <td style={{ fontWeight: 500 }}>{empName(lv.employee_id)}</td>
                      <td className="mono">{lv.start_date.split("-").reverse().join("/")}</td>
                      <td className="mono">{lv.end_date.split("-").reverse().join("/")}</td>
                      <td className="mono">{dias}</td>
                      <td style={{ fontSize: 12 }}>{LEAVE_LABEL[lv.kind] ?? lv.kind}</td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>{lv.note ?? "—"}</td>
                      <td>
                        <button className="btn btn-danger btn-sm"
                          onClick={async () => {
                            if (!confirm(`Remover as férias de ${empName(lv.employee_id)}?`)) return;
                            try { await api.deleteLeave(lv.id); loadLeaves(); flash("Período removido."); }
                            catch (e) { flash(e instanceof Error ? e.message : "Erro."); }
                          }}>Remover</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <DayModal date={editing} existing={byDate[editing] ?? null}
          onClose={() => setEditing(null)} onSaved={() => { load(); }} />
      )}

      {leaveModal && (
        <LeaveModal employees={employees} onClose={() => setLeaveModal(false)}
          onSaved={(m) => { loadLeaves(); flash(m); }} />
      )}

      {shiftModal && (
        <ShiftModal employees={employees} onClose={() => setShiftModal(false)}
          onSaved={(m) => { loadShifts(); flash(m); }} />
      )}
    </div>
  );
}

const LEAVE_LABEL: Record<string, string> = {
  ferias: "🏖 Férias", licenca: "📋 Licença", folga: "😴 Folga programada",
};

/* ─── Modal: marcar férias / licença ─── */
function LeaveModal({ employees, onClose, onSaved }: {
  employees: Employee[]; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [employeeId, setEmployeeId] = useState<number | "">("");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [kind, setKind] = useState<LeaveKind>("ferias");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const dias = (() => {
    const a = new Date(start + "T12:00").getTime();
    const b = new Date(end + "T12:00").getTime();
    if (isNaN(a) || isNaN(b) || b < a) return 0;
    return Math.round((b - a) / 86400000) + 1;
  })();

  const save = async () => {
    setErr("");
    if (employeeId === "") { setErr("Selecione o colaborador."); return; }
    if (dias <= 0) { setErr("A data final não pode ser antes da inicial."); return; }
    setSaving(true);
    try {
      await api.addLeave({ employee_id: Number(employeeId), start_date: start, end_date: end, kind,
        ...(note.trim() ? { note: note.trim() } : {}) });
      const nome = employees.find(e => e.id === Number(employeeId))?.name ?? "Colaborador";
      onSaved(`${dias} dia(s) de ${LEAVE_LABEL[kind].replace(/^\S+\s/, "").toLowerCase()} para ${nome}.`);
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro."); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,21,38,0.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16,
        padding: 26, width: "100%", maxWidth: 440, boxShadow: "var(--shadow-md)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>🏖 Marcar férias / licença</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18,
            cursor: "pointer", color: "var(--muted)", fontFamily: "var(--font)" }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
          Nesses dias o colaborador não tem jornada esperada — nada é descontado do banco de horas.
        </div>

        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Colaborador *</label>
          <select value={employeeId} onChange={e => { setEmployeeId(e.target.value === "" ? "" : Number(e.target.value)); setErr(""); }}>
            <option value="">— selecione —</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>

        <div className="form-grid" style={{ marginBottom: 12 }}>
          <div className="form-group">
            <label>De</label>
            <input type="date" value={start} onChange={e => { setStart(e.target.value); setErr(""); }} />
          </div>
          <div className="form-group">
            <label>Até</label>
            <input type="date" value={end} min={start} onChange={e => { setEnd(e.target.value); setErr(""); }} />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Tipo</label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["ferias", "licenca", "folga"] as LeaveKind[]).map(k => (
              <button key={k} onClick={() => setKind(k)}
                style={{ flex: 1, padding: "9px 6px", borderRadius: 10, cursor: "pointer", fontSize: 12,
                  fontWeight: 600, fontFamily: "var(--font)",
                  background: kind === k ? "rgba(13,148,136,0.10)" : "var(--surface2)",
                  color: kind === k ? "#0d9488" : "var(--muted)",
                  border: `1px solid ${kind === k ? "#0d9488" : "var(--border2)"}` }}>
                {LEAVE_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 14 }}>
          <label>Observação (opcional)</label>
          <input type="text" maxLength={120} value={note} onChange={e => setNote(e.target.value)}
            placeholder="Ex.: Férias anuais 2026" />
        </div>

        {dias > 0 && (
          <div style={{ fontSize: 12.5, color: "var(--accent)", marginBottom: 12, fontWeight: 600 }}>
            ✓ {dias} dia(s) no período
          </div>
        )}
        {err && <div className="alert alert-error" style={{ marginBottom: 12 }}>{err}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Marcar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DayModal({ date, existing, onClose, onSaved }: {
  date: string; existing: CalendarDay | null; onClose: () => void; onSaved: () => void;
}) {
  const [kind, setKind] = useState<CalendarKind>(existing?.kind ?? "feriado");
  const [label, setLabel] = useState(existing?.label ?? "");
  const [partial, setPartial] = useState(existing?.deduct_minutes != null);
  const [hours, setHours] = useState(existing?.deduct_minutes ? String(Math.floor(existing.deduct_minutes / 60)) : "3");
  const [mins, setMins] = useState(existing?.deduct_minutes ? String(existing.deduct_minutes % 60) : "0");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [y, m, d] = date.split("-");

  const save = async () => {
    if (!label.trim()) { setErr("Descreva o motivo (ex.: Independência, Jogo do Brasil)."); return; }
    const deduct = partial ? Number(hours) * 60 + Number(mins) : null;
    if (partial && (!deduct || deduct <= 0)) { setErr("Informe um tempo de dispensa válido."); return; }
    setSaving(true);
    try { await api.upsertCalendarDay({ date, kind, label: label.trim(), deduct_minutes: deduct }); onSaved(); onClose(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro."); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!existing || !confirm(`Remover a marcação de ${d}/${m}/${y}?`)) return;
    setSaving(true);
    try { await api.deleteCalendarDay(existing.id); onSaved(); onClose(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro."); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,21,38,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 26, width: "100%", maxWidth: 420, boxShadow: "var(--shadow-md)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>📅 {d}/{m}/{y}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--muted)" }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
          Dia inteiro = referência 0 (H3). Parcial = abate N minutos da jornada.
        </div>

        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Tipo</label>
          <div style={{ display: "flex", gap: 8 }}>
            {(Object.keys(KIND) as CalendarKind[]).map(k => (
              <button key={k} onClick={() => setKind(k)}
                style={{ flex: 1, padding: "9px 8px", borderRadius: 10, cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font)",
                  background: kind === k ? KIND[k].bg : "var(--surface2)",
                  color: kind === k ? KIND[k].color : "var(--muted)",
                  border: `1px solid ${kind === k ? KIND[k].color : "var(--border2)"}` }}>
                {KIND[k].icon} {KIND[k].label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Descrição</label>
          <input type="text" value={label} maxLength={80} autoFocus
            onChange={e => { setLabel(e.target.value); setErr(""); }}
            onKeyDown={e => e.key === "Enter" && save()}
            placeholder="Ex.: Independência · Jogo do Brasil · Dedetização" />
        </div>

        <div className="form-group" style={{ marginBottom: 14 }}>
          <label>Abatimento</label>
          <div style={{ display: "flex", gap: 8, marginBottom: partial ? 8 : 0 }}>
            <button onClick={() => setPartial(false)}
              style={{ flex: 1, padding: 9, borderRadius: 10, cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font)",
                background: !partial ? "rgba(37,99,235,0.10)" : "var(--surface2)",
                color: !partial ? "#2563eb" : "var(--muted)",
                border: `1px solid ${!partial ? "#2563eb" : "var(--border2)"}` }}>Dia inteiro</button>
            <button onClick={() => setPartial(true)}
              style={{ flex: 1, padding: 9, borderRadius: 10, cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font)",
                background: partial ? "rgba(37,99,235,0.10)" : "var(--surface2)",
                color: partial ? "#2563eb" : "var(--muted)",
                border: `1px solid ${partial ? "#2563eb" : "var(--border2)"}` }}>Parcial</button>
          </div>
          {partial && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="number" min={0} max={12} value={hours} onChange={e => setHours(e.target.value)} style={{ width: 76 }} />
              <span style={{ fontSize: 13, color: "var(--muted)" }}>h</span>
              <input type="number" min={0} max={59} value={mins} onChange={e => setMins(e.target.value)} style={{ width: 76 }} />
              <span style={{ fontSize: 13, color: "var(--muted)" }}>min de dispensa</span>
            </div>
          )}
        </div>

        {err && <div className="alert alert-error" style={{ marginBottom: 10 }}>{err}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div>{existing && <button className="btn btn-danger" onClick={remove} disabled={saving}>Remover</button>}</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal: marcar escala (um dia ou vários sábados de uma vez) ─── */
function ShiftModal({ employees, onClose, onSaved }: {
  employees: Employee[]; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [employeeId, setEmployeeId] = useState<number | "">("");
  const [mode, setMode] = useState<"dia" | "periodo">("dia");
  const [date, setDate] = useState(today);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [onlySaturdays, setOnlySaturdays] = useState(true);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // Datas que serão marcadas
  const dates = (() => {
    if (mode === "dia") return date ? [date] : [];
    const out: string[] = [];
    const a = new Date(start + "T12:00");
    const b = new Date(end + "T12:00");
    if (isNaN(a.getTime()) || isNaN(b.getTime()) || b < a) return out;
    for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
      if (onlySaturdays && d.getDay() !== 6) continue;
      out.push(d.toISOString().slice(0, 10));
      if (out.length > 200) break;
    }
    return out;
  })();

  const save = async () => {
    setErr("");
    if (employeeId === "") { setErr("Selecione o colaborador."); return; }
    if (dates.length === 0) { setErr("Nenhuma data no período selecionado."); return; }
    setSaving(true);
    try {
      const r = await api.addShifts({ employee_id: Number(employeeId), dates,
        ...(note.trim() ? { note: note.trim() } : {}) });
      const nome = employees.find(e => e.id === Number(employeeId))?.name ?? "Colaborador";
      onSaved(r.added > 0
        ? `${r.added} dia(s) de escala marcados para ${nome}.`
        : `Nenhuma data nova (já estavam marcadas).`);
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro."); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,21,38,0.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16,
        padding: 26, width: "100%", maxWidth: 440, boxShadow: "var(--shadow-md)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>📋 Marcar escala</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18,
            cursor: "pointer", color: "var(--muted)", fontFamily: "var(--font)" }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 }}>
          Dia escalado conta como <strong>jornada normal</strong> (sábado = 4h, semana passa a 8h/dia).
          Sem escala, o sábado é descanso e o trabalho vira <strong>extra 100%</strong>.
        </div>

        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Colaborador *</label>
          <select value={employeeId} onChange={e => { setEmployeeId(e.target.value === "" ? "" : Number(e.target.value)); setErr(""); }}>
            <option value="">— selecione —</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["dia", "periodo"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setErr(""); }}
              style={{ flex: 1, padding: "9px 8px", borderRadius: 10, cursor: "pointer", fontSize: 12.5,
                fontWeight: 600, fontFamily: "var(--font)",
                background: mode === m ? "rgba(124,58,237,0.10)" : "var(--surface2)",
                color: mode === m ? "#7c3aed" : "var(--muted)",
                border: `1px solid ${mode === m ? "#7c3aed" : "var(--border2)"}` }}>
              {m === "dia" ? "Um dia" : "Período"}
            </button>
          ))}
        </div>

        {mode === "dia" ? (
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Data da escala</label>
            <input type="date" value={date} onChange={e => { setDate(e.target.value); setErr(""); }} />
          </div>
        ) : (
          <>
            <div className="form-grid" style={{ marginBottom: 10 }}>
              <div className="form-group">
                <label>De</label>
                <input type="date" value={start} onChange={e => { setStart(e.target.value); setErr(""); }} />
              </div>
              <div className="form-group">
                <label>Até</label>
                <input type="date" value={end} min={start} onChange={e => { setEnd(e.target.value); setErr(""); }} />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5,
              color: "var(--muted)", cursor: "pointer", marginBottom: 12 }}>
              <input type="checkbox" checked={onlySaturdays} style={{ width: "auto", margin: 0 }}
                onChange={e => setOnlySaturdays(e.target.checked)} />
              Somente os sábados do período
            </label>
          </>
        )}

        <div className="form-group" style={{ marginBottom: 14 }}>
          <label>Observação (opcional)</label>
          <input type="text" maxLength={120} value={note} onChange={e => setNote(e.target.value)}
            placeholder="Ex.: Escala de sábado — equipe A" />
        </div>

        {dates.length > 0 && (
          <div style={{ fontSize: 12.5, color: "#7c3aed", marginBottom: 12, fontWeight: 600 }}>
            ✓ {dates.length} dia(s) serão marcados
          </div>
        )}
        {err && <div className="alert alert-error" style={{ marginBottom: 12 }}>{err}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Marcar escala"}
          </button>
        </div>
      </div>
    </div>
  );
}
