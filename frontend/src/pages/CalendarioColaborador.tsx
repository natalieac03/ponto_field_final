import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { Modal } from "../components/Modal";
import { ESCALA_COLOR, FERIAS_COLOR, KIND, MONTHS, WD, fmtDeduct, iso } from "../features/calendar/shared";
import { AccordionGroup, EmptyGroupState, GroupFilters } from "../features/calendar/GroupedList";
import { LEAVE_KIND_LABEL } from "../types";
import type { CalendarDay, Employee, EmployeeLeave, EmployeeShift } from "../types";

const todayISO = new Date().toISOString().slice(0, 10);

/** Calendário da equipe em modo somente leitura, para o colaborador. */
export function CalendarioColaborador() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [leaves, setLeaves] = useState<EmployeeLeave[]>([]);
  const [employees, setEmployees] = useState<Pick<Employee, "id" | "name" | "has_password">[]>([]);
  const [shifts, setShifts] = useState<EmployeeShift[]>([]);
  const [viewing, setViewing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [shiftEmpFilter, setShiftEmpFilter] = useState<number | "all">("all");
  const [shiftScope, setShiftScope] = useState<"upcoming" | "all">("upcoming");
  const [expandedShiftEmp, setExpandedShiftEmp] = useState<Set<number>>(new Set());
  const [leaveEmpFilter, setLeaveEmpFilter] = useState<number | "all">("all");
  const [leaveScope, setLeaveScope] = useState<"upcoming" | "all">("upcoming");
  const [expandedLeaveEmp, setExpandedLeaveEmp] = useState<Set<number>>(new Set());

  const toggleInSet = (setFn: (updater: (prev: Set<number>) => Set<number>) => void, id: number) => {
    setFn(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    Promise.all([
      api.getCalendar().then(setDays),
      api.getLeaves().then(setLeaves),
      api.getShifts().then(setShifts),
      api.getPublicEmployees().then(setEmployees),
    ]).catch(console.error).finally(() => setLoading(false));
  }, []);

  const empName = (id: number) => employees.find(e => e.id === id)?.name ?? `#${id}`;

  const shiftByDate = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const sh of shifts) (m[sh.date] ??= []).push(empName(sh.employee_id));
    return m;
  }, [shifts, employees]);

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

  const byDate = useMemo(() => Object.fromEntries(days.map(d => [d.date, d])), [days]);

  const shiftGroups = useMemo(() => {
    const filtered = shifts
      .filter(sh => shiftScope === "all" || sh.date >= todayISO)
      .filter(sh => shiftEmpFilter === "all" || sh.employee_id === shiftEmpFilter);
    const byEmp = new Map<number, EmployeeShift[]>();
    for (const sh of filtered) (byEmp.get(sh.employee_id) ?? byEmp.set(sh.employee_id, []).get(sh.employee_id)!).push(sh);
    for (const list of byEmp.values()) list.sort((a, b) => a.date.localeCompare(b.date));
    return [...byEmp.entries()].sort((a, b) => empName(a[0]).localeCompare(empName(b[0])));
  }, [shifts, shiftScope, shiftEmpFilter, employees]);

  const leaveGroups = useMemo(() => {
    const filtered = leaves
      .filter(lv => leaveScope === "all" || lv.end_date >= todayISO)
      .filter(lv => leaveEmpFilter === "all" || lv.employee_id === leaveEmpFilter);
    const byEmp = new Map<number, EmployeeLeave[]>();
    for (const lv of filtered) (byEmp.get(lv.employee_id) ?? byEmp.set(lv.employee_id, []).get(lv.employee_id)!).push(lv);
    for (const list of byEmp.values()) list.sort((a, b) => a.start_date.localeCompare(b.start_date));
    return [...byEmp.entries()].sort((a, b) => empName(a[0]).localeCompare(empName(b[0])));
  }, [leaves, leaveScope, leaveEmpFilter, employees]);

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

  return (
    <div>
      <div className="sec-header">
        <div className="month-nav">
          <button className="icon-btn" onClick={() => changeMonth(-1)}>‹</button>
          <span className="month-display">{MONTHS[month - 1]} {year}</span>
          <button className="icon-btn" onClick={() => changeMonth(1)}>›</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Calendário da equipe</div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
          Feriados, facultativos, escalas e férias da equipe. Clique num dia para ver os detalhes.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 6 }}>
          {WD.map((w, i) => (
            <div key={w} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: i >= 5 ? "var(--muted)" : "var(--text)", padding: "4px 0" }}>{w}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
          {loading ? cells.map((d, i) => d === null
            ? <div key={`e${i}`} />
            : <div key={`sk${i}`} className="skeleton cal-day-cell" />
          ) : cells.map((d, i) => {
            if (d === null) return <div key={`e${i}`} />;
            const dt = iso(year, month, d);
            const mk = byDate[dt];
            const st = mk ? KIND[mk.kind] : null;
            const weekend = i % 7 >= 5;
            return (
              <button key={dt} onClick={() => setViewing(dt)} className="cal-day-cell"
                title={mk ? `${mk.label} (${fmtDeduct(mk.deduct_minutes)})` : "Ver detalhes do dia"}
                style={{
                  padding: 6, borderRadius: "var(--radius)", cursor: "pointer", textAlign: "left",
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
                    {st!.icon} <span className="cal-tag-text">{mk.label}{mk.deduct_minutes !== null && ` (${fmtDeduct(mk.deduct_minutes)})`}</span>
                  </span>
                )}
                {shiftByDate[dt]?.length > 0 && (
                  <span title={`Escala: ${shiftByDate[dt].join(", ")}`}
                    style={{ fontSize: 9, lineHeight: 1.2, color: "var(--escala)", fontWeight: 700, overflow: "hidden" }}>
                    📋 <span className="cal-tag-text">{shiftByDate[dt].length === 1 ? shiftByDate[dt][0].split(" ")[0] : `${shiftByDate[dt].length} escalados`}</span>
                  </span>
                )}
                {leaveByDate[dt]?.length > 0 && (
                  <span title={`Férias: ${leaveByDate[dt].join(", ")}`}
                    style={{ fontSize: 9, lineHeight: 1.2, color: "var(--ferias)", fontWeight: 700, overflow: "hidden" }}>
                    🏖 <span className="cal-tag-text">{leaveByDate[dt].length === 1 ? leaveByDate[dt][0].split(" ")[0] : `${leaveByDate[dt].length} de férias`}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {shifts.length > 0 && (
        <div className="card">
          <div className="card-title">Escalas marcadas</div>
          <GroupFilters empFilter={shiftEmpFilter} setEmpFilter={setShiftEmpFilter}
            scope={shiftScope} setScope={setShiftScope} employees={employees} />
          {shiftGroups.length === 0 ? (
            <EmptyGroupState message="Nenhuma escala neste filtro." filtered={shiftEmpFilter !== "all" || shiftScope !== "upcoming"}
              onClear={() => { setShiftEmpFilter("all"); setShiftScope("upcoming"); }} />
          ) : shiftGroups.map(([empId, list]) => (
            <AccordionGroup key={empId} title={empName(empId)} icon="📋" accent={ESCALA_COLOR} count={list.length} countLabel="escala(s)"
              expanded={expandedShiftEmp.has(empId)} onToggle={() => toggleInSet(setExpandedShiftEmp, empId)}>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Data</th><th>Dia</th><th>Obs.</th></tr></thead>
                  <tbody>
                    {list.map(sh => {
                      const d = new Date(sh.date + "T12:00");
                      return (
                        <tr key={sh.id}>
                          <td className="mono">{sh.date.split("-").reverse().join("/")}</td>
                          <td style={{ fontSize: 12 }}>{["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"][d.getDay()]}</td>
                          <td style={{ fontSize: 12, color: "var(--muted)" }}>{sh.note ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </AccordionGroup>
          ))}
        </div>
      )}

      {leaves.length > 0 && (
        <div className="card">
          <div className="card-title">Férias e licenças programadas</div>
          <GroupFilters empFilter={leaveEmpFilter} setEmpFilter={setLeaveEmpFilter}
            scope={leaveScope} setScope={setLeaveScope} employees={employees} />
          {leaveGroups.length === 0 ? (
            <EmptyGroupState message="Nenhum período neste filtro." filtered={leaveEmpFilter !== "all" || leaveScope !== "upcoming"}
              onClear={() => { setLeaveEmpFilter("all"); setLeaveScope("upcoming"); }} />
          ) : leaveGroups.map(([empId, list]) => (
            <AccordionGroup key={empId} title={empName(empId)} icon="🏖" accent={FERIAS_COLOR} count={list.length} countLabel="período(s)"
              expanded={expandedLeaveEmp.has(empId)} onToggle={() => toggleInSet(setExpandedLeaveEmp, empId)}>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Início</th><th>Fim</th><th>Dias</th><th>Tipo</th><th>Obs.</th></tr></thead>
                  <tbody>
                    {list.map(lv => {
                      const dias = Math.round(
                        (new Date(lv.end_date + "T12:00").getTime() - new Date(lv.start_date + "T12:00").getTime())
                        / 86400000) + 1;
                      return (
                        <tr key={lv.id}>
                          <td className="mono">{lv.start_date.split("-").reverse().join("/")}</td>
                          <td className="mono">{lv.end_date.split("-").reverse().join("/")}</td>
                          <td className="mono">{dias}</td>
                          <td style={{ fontSize: 12 }}>{LEAVE_KIND_LABEL[lv.kind] ?? lv.kind}</td>
                          <td style={{ fontSize: 12, color: "var(--muted)" }}>{lv.note ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </AccordionGroup>
          ))}
        </div>
      )}

      {viewing && (
        <DayDetailModal date={viewing} existing={byDate[viewing] ?? null}
          shiftNames={shiftByDate[viewing] ?? []} leaveNames={leaveByDate[viewing] ?? []}
          onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

function DayDetailModal({ date, existing, shiftNames, leaveNames, onClose }: {
  date: string; existing: CalendarDay | null; shiftNames: string[]; leaveNames: string[]; onClose: () => void;
}) {
  const [y, m, d] = date.split("-");
  const hasEvents = shiftNames.length > 0 || leaveNames.length > 0;
  const st = existing ? KIND[existing.kind] : null;

  return (
    <Modal title={`📅 ${d}/${m}/${y}`} onClose={onClose} maxWidth={440}>
      {existing && (
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label>Marcação do dia</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: st!.color }}>
            {st!.icon} {existing.label} — {st!.label}
            {existing.deduct_minutes !== undefined && (
              <span style={{ color: "var(--muted)", fontWeight: 500 }}>({fmtDeduct(existing.deduct_minutes)})</span>
            )}
          </div>
        </div>
      )}

      {hasEvents ? (
        <div className="form-group" style={{ marginBottom: 4 }}>
          <label>Eventos do dia</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {shiftNames.map(n => (
              <span key={`sh-${n}`} style={{ display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(124,58,237,0.10)", border: "1px solid rgba(124,58,237,0.35)",
                color: ESCALA_COLOR, borderRadius: "var(--radius-lg)", padding: "6px 12px", fontSize: 12, fontWeight: 600 }}>
                📋 {n} — escala
              </span>
            ))}
            {leaveNames.map(n => (
              <span key={`lv-${n}`} style={{ display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(13,148,136,0.10)", border: "1px solid rgba(13,148,136,0.35)",
                color: FERIAS_COLOR, borderRadius: "var(--radius-lg)", padding: "6px 12px", fontSize: 12, fontWeight: 600 }}>
                🏖 {n} — férias
              </span>
            ))}
          </div>
        </div>
      ) : !existing && (
        <p style={{ fontSize: 13, color: "var(--muted)" }}>Nenhuma marcação neste dia.</p>
      )}
    </Modal>
  );
}
