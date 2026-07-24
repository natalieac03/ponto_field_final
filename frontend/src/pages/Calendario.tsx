import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { Alert } from "../components/Alert";
import type { CalendarDay, CalendarKind, HolidaySuggestion } from "../types";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const KIND_STYLE: Record<CalendarKind, { bg: string; color: string; border: string; icon: string; label: string }> = {
  feriado:     { bg: "rgba(220,38,38,0.10)",  color: "#dc2626", border: "rgba(220,38,38,0.35)",  icon: "🏖", label: "Feriado" },
  facultativo: { bg: "rgba(245,166,35,0.14)", color: "#b45309", border: "rgba(245,166,35,0.4)",  icon: "🕊", label: "Facultativo" },
  evento:      { bg: "rgba(37,99,235,0.10)",  color: "#2563eb", border: "rgba(37,99,235,0.3)",   icon: "📌", label: "Evento" },
};

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function fmtDeduct(min: number | null): string {
  if (min === null) return "dia inteiro";
  const h = Math.floor(min / 60), mm = min % 60;
  return mm === 0 ? `−${h}h` : `−${h}h${String(mm).padStart(2, "0")}`;
}

interface DayModalProps {
  date: string;
  existing: CalendarDay | null;
  onClose: () => void;
  onSaved: () => void;
}

function DayModal({ date, existing, onClose, onSaved }: DayModalProps) {
  const [kind, setKind]   = useState<CalendarKind>(existing?.kind ?? "feriado");
  const [label, setLabel] = useState(existing?.label ?? "");
  const [partial, setPartial] = useState(existing?.deduct_minutes != null);
  const [hours, setHours] = useState(existing?.deduct_minutes ? String(Math.floor(existing.deduct_minutes / 60)) : "3");
  const [mins, setMins]   = useState(existing?.deduct_minutes ? String(existing.deduct_minutes % 60) : "0");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [y, m, d] = date.split("-");
  const dateLabel = `${d}/${m}/${y}`;

  const save = async () => {
    if (!label.trim()) { setError("Descreva o motivo (ex.: Independência, Jogo do Brasil)."); return; }
    const deduct = partial ? Number(hours) * 60 + Number(mins) : null;
    if (partial && (isNaN(deduct!) || deduct! <= 0)) { setError("Informe um tempo de dispensa válido."); return; }
    setSaving(true);
    try {
      await api.upsertCalendarDay({ date, kind, label: label.trim(), deduct_minutes: deduct });
      onSaved(); onClose();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Erro."); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!existing) return;
    if (!confirm(`Remover a marcação de ${dateLabel}?`)) return;
    setSaving(true);
    try { await api.deleteCalendarDay(existing.id); onSaved(); onClose(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Erro."); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,21,38,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 420, boxShadow: "var(--shadow-md)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>📅 {dateLabel}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--muted)", fontFamily: "var(--font)" }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 18 }}>
          O tempo marcado é abatido da meta de 44h daquela semana.
        </div>

        <div className="form-group" style={{ marginBottom: 14 }}>
          <label>Tipo</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(Object.keys(KIND_STYLE) as CalendarKind[]).map(k => (
              <button
                key={k}
                onClick={() => setKind(k)}
                style={{
                  flex: 1, minWidth: 100, padding: "9px 10px", borderRadius: 10, cursor: "pointer",
                  fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 600,
                  background: kind === k ? KIND_STYLE[k].bg : "var(--surface2)",
                  color: kind === k ? KIND_STYLE[k].color : "var(--muted)",
                  border: `1px solid ${kind === k ? KIND_STYLE[k].border : "var(--border2)"}`,
                }}
              >
                {KIND_STYLE[k].icon} {KIND_STYLE[k].label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 14 }}>
          <label>Descrição</label>
          <input
            type="text" value={label} maxLength={80} autoFocus
            onChange={e => { setLabel(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && save()}
            placeholder="Ex.: Independência · Jogo do Brasil · Dedetização"
          />
        </div>

        <div className="form-group" style={{ marginBottom: 16 }}>
          <label>Abatimento</label>
          <div style={{ display: "flex", gap: 8, marginBottom: partial ? 10 : 0 }}>
            <button
              onClick={() => setPartial(false)}
              style={{ flex: 1, padding: "9px 10px", borderRadius: 10, cursor: "pointer", fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 600,
                background: !partial ? "rgba(37,99,235,0.10)" : "var(--surface2)",
                color: !partial ? "var(--accent)" : "var(--muted)",
                border: `1px solid ${!partial ? "var(--accent)" : "var(--border2)"}` }}
            >Dia inteiro</button>
            <button
              onClick={() => setPartial(true)}
              style={{ flex: 1, padding: "9px 10px", borderRadius: 10, cursor: "pointer", fontFamily: "var(--font)", fontSize: 12.5, fontWeight: 600,
                background: partial ? "rgba(37,99,235,0.10)" : "var(--surface2)",
                color: partial ? "var(--accent)" : "var(--muted)",
                border: `1px solid ${partial ? "var(--accent)" : "var(--border2)"}` }}
            >Parcial</button>
          </div>
          {partial && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input type="number" min={0} max={12} value={hours} onChange={e => setHours(e.target.value)} style={{ width: 80 }} />
              <span style={{ fontSize: 13, color: "var(--muted)" }}>h</span>
              <input type="number" min={0} max={59} value={mins} onChange={e => setMins(e.target.value)} style={{ width: 80 }} />
              <span style={{ fontSize: 13, color: "var(--muted)" }}>min de dispensa</span>
            </div>
          )}
          {!partial && (
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              Abate a jornada esperada do dia (8h48 em dia útil). Sábado/domingo não abatem nada.
            </span>
          )}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
          <div>
            {existing && <button className="btn btn-danger" onClick={remove} disabled={saving}>Remover</button>}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Calendario() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [days, setDays]   = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [suggestions, setSuggestions] = useState<HolidaySuggestion[] | null>(null);
  const [importing, setImporting] = useState(false);

  const load = () => {
    setLoading(true);
    api.getCalendar().then(setDays).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const showAlert = (msg: string, type: "success" | "error") => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const byDate = useMemo(() => {
    const m: Record<string, CalendarDay> = {};
    days.forEach(d => { m[d.date] = d; });
    return m;
  }, [days]);

  const monthDays = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const total = new Date(year, month, 0).getDate();
    const offset = (first.getDay() + 6) % 7; // 0 = segunda
    const cells: (number | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const changeMonth = (dir: -1 | 1) => {
    const d = new Date(year, month - 1 + dir, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const doImport = async (includeFacultativos: boolean) => {
    setImporting(true);
    try {
      const r = await api.importHolidays(year, includeFacultativos);
      showAlert(
        r.added > 0
          ? `${r.added} feriado(s) de ${year} importado(s).`
          : `Nenhum feriado novo para ${year} — já estavam marcados.`,
        "success"
      );
      load();
      setSuggestions(null);
    } catch (e: unknown) {
      showAlert(e instanceof Error ? e.message : "Erro ao importar.", "error");
    } finally { setImporting(false); }
  };

  const loadSuggestions = async () => {
    try { setSuggestions(await api.getHolidaySuggestions(year)); }
    catch (e: unknown) { showAlert(e instanceof Error ? e.message : "Erro.", "error"); }
  };

  const monthMarked = days
    .filter(d => d.date.startsWith(`${year}-${String(month).padStart(2, "0")}`))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <div className="sec-header">
        <div className="month-nav">
          <button className="icon-btn" onClick={() => changeMonth(-1)}>‹</button>
          <span className="month-display">{MONTH_NAMES[month - 1]} {year}</span>
          <button className="icon-btn" onClick={() => changeMonth(1)}>›</button>
        </div>
        <div className="row">
          <button className="btn btn-secondary btn-sm" onClick={() => doImport(false)} disabled={importing}>
            {importing ? "Importando…" : `🇧🇷 Importar feriados ${year}`}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={suggestions ? () => setSuggestions(null) : loadSuggestions}>
            {suggestions ? "Ocultar lista" : "Ver feriados oficiais"}
          </button>
        </div>
      </div>

      <Alert message={alert?.msg ?? null} type={alert?.type ?? "error"} />

      <div className="card">
        <div className="card-title">Calendário — clique em um dia para marcar</div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
          Feriados de Goiânia/GO e nacionais podem ser importados com um clique. Marque também
          eventos manuais (jogo do Brasil, dedetização) com dispensa parcial. Tudo isso abate
          automaticamente da meta de 44h da semana correspondente.
        </p>

        {loading ? (
          <p style={{ color: "var(--muted)" }}>Carregando…</p>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
              {WEEKDAY_LABELS.map((w, i) => (
                <div key={w} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: i >= 5 ? "var(--muted)" : "var(--text)", textTransform: "uppercase", letterSpacing: 0.5, padding: "4px 0" }}>
                  {w}
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {monthDays.map((d, i) => {
                if (d === null) return <div key={`e${i}`} />;
                const dateIso = iso(year, month, d);
                const marked = byDate[dateIso];
                const isWeekend = i % 7 >= 5;
                const st = marked ? KIND_STYLE[marked.kind] : null;
                return (
                  <button
                    key={dateIso}
                    onClick={() => setEditing(dateIso)}
                    title={marked ? `${marked.label} (${fmtDeduct(marked.deduct_minutes)})` : "Marcar este dia"}
                    style={{
                      minHeight: 62, padding: "6px 6px 5px", borderRadius: 10, cursor: "pointer",
                      textAlign: "left", fontFamily: "var(--font)",
                      background: st ? st.bg : isWeekend ? "var(--surface2)" : "var(--surface)",
                      border: `1px solid ${st ? st.border : "var(--border2)"}`,
                      display: "flex", flexDirection: "column", gap: 2, overflow: "hidden",
                      transition: "border-color .12s",
                    }}
                    onMouseEnter={e => { if (!st) e.currentTarget.style.borderColor = "var(--accent)"; }}
                    onMouseLeave={e => { if (!st) e.currentTarget.style.borderColor = "var(--border2)"; }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--mono)", color: st ? st.color : isWeekend ? "var(--muted)" : "var(--text)" }}>
                      {String(d).padStart(2, "0")}
                    </span>
                    {marked && (
                      <>
                        <span style={{ fontSize: 9.5, lineHeight: 1.25, color: st!.color, fontWeight: 600, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {st!.icon} {marked.label}
                        </span>
                        {marked.deduct_minutes !== null && (
                          <span style={{ fontSize: 9, color: st!.color, fontFamily: "var(--mono)", opacity: .85 }}>
                            {fmtDeduct(marked.deduct_minutes)}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 14, fontSize: 11, color: "var(--muted)" }}>
              {(Object.keys(KIND_STYLE) as CalendarKind[]).map(k => (
                <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: KIND_STYLE[k].bg, border: `1px solid ${KIND_STYLE[k].border}`, display: "inline-block" }} />
                  {KIND_STYLE[k].icon} {KIND_STYLE[k].label}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {monthMarked.length > 0 && (
        <div className="card">
          <div className="card-title">Marcações de {MONTH_NAMES[month - 1]}</div>
          <div className="emp-list">
            {monthMarked.map(d => {
              const st = KIND_STYLE[d.kind];
              const [, , dd] = d.date.split("-");
              return (
                <div className="emp-item" key={d.id}>
                  <div>
                    <div className="emp-name">
                      <span style={{ color: st.color }}>{st.icon} {dd}/{String(month).padStart(2, "0")}</span> — {d.label}
                    </div>
                    <div className="emp-meta">
                      {st.label} · abate {fmtDeduct(d.deduct_minutes)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditing(d.date)}>Editar</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {suggestions && (
        <div className="card">
          <div className="card-title">Feriados oficiais {year} — nacionais + Goiás + Goiânia</div>
          <div style={{ marginBottom: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => doImport(true)} disabled={importing}>
              Importar também os facultativos (Carnaval, Corpus Christi…)
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Data</th><th>Feriado</th><th>Tipo</th><th>Status</th></tr>
              </thead>
              <tbody>
                {suggestions.map(s => {
                  const [yy, mm, dd] = s.date.split("-");
                  return (
                    <tr key={s.date}>
                      <td className="mono">{dd}/{mm}/{yy}</td>
                      <td>{s.label}</td>
                      <td style={{ color: KIND_STYLE[s.kind].color, fontSize: 12 }}>
                        {KIND_STYLE[s.kind].icon} {KIND_STYLE[s.kind].label}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {s.already_added
                          ? <span style={{ color: "var(--accent)" }}>✓ marcado</span>
                          : <span style={{ color: "var(--muted)" }}>—</span>}
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
        <DayModal
          date={editing}
          existing={byDate[editing] ?? null}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
