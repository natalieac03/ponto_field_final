import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Alert } from "../components/Alert";
import { Avatar } from "../components/Avatar";
import { Modal } from "../components/Modal";
import { EmployeeFormModal } from "../features/employees/EmployeeFormModal";
import { useAutoDismissAlert } from "../hooks/useAutoDismissAlert";
import type { Employee, Settings, WeeklySchedule } from "../types";

interface Props {
  employees: Employee[];
  settings: Settings | null;
  onEmployeesChanged: () => void;
  onSettingsChanged: (s: Settings) => void;
}

const WEEKDAYS: { key: keyof WeeklySchedule; label: string; short: string }[] = [
  { key: "mon_minutes", label: "Segunda-feira", short: "Seg" },
  { key: "tue_minutes", label: "Terça-feira", short: "Ter" },
  { key: "wed_minutes", label: "Quarta-feira", short: "Qua" },
  { key: "thu_minutes", label: "Quinta-feira", short: "Qui" },
  { key: "fri_minutes", label: "Sexta-feira", short: "Sex" },
  { key: "sat_minutes", label: "Sábado", short: "Sáb" },
  { key: "sun_minutes", label: "Domingo", short: "Dom" },
];

function fmtMinAsHours(min: number | null): string {
  if (min === null || min === undefined) return "padrão global";
  if (min === 0) return "folga";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/** "8", "8,5" ou "8.5" → minutos. Vazio → 0. */
function hoursToMin(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (t === "") return 0;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 24) return null;
  return Math.round(n * 60);
}
function minToHoursStr(min: number): string {
  const h = min / 60;
  return Number.isInteger(h) ? String(h) : h.toFixed(2).replace(/\.?0+$/, "");
}

interface ScheduleModalProps {
  employee: Employee;
  defaultMinutes: number;
  onClose: () => void;
  onSaved: () => void;
}

function ScheduleModal({ employee, defaultMinutes, onClose, onSaved }: ScheduleModalProps) {
  const [values, setValues] = useState<Record<keyof WeeklySchedule, string>>(() => ({
    mon_minutes: employee.mon_minutes?.toString() ?? "",
    tue_minutes: employee.tue_minutes?.toString() ?? "",
    wed_minutes: employee.wed_minutes?.toString() ?? "",
    thu_minutes: employee.thu_minutes?.toString() ?? "",
    fri_minutes: employee.fri_minutes?.toString() ?? "",
    sat_minutes: employee.sat_minutes?.toString() ?? "",
    sun_minutes: employee.sun_minutes?.toString() ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setError("");
    const payload: WeeklySchedule = {
      mon_minutes: null, tue_minutes: null, wed_minutes: null, thu_minutes: null,
      fri_minutes: null, sat_minutes: null, sun_minutes: null,
    };
    for (const day of WEEKDAYS) {
      const raw = values[day.key].trim();
      if (raw === "") { payload[day.key] = null; continue; }
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0 || n > 1440) {
        setError(`${day.label}: digite um número entre 0 e 1440 (ou deixe vazio para usar o padrão).`);
        return;
      }
      payload[day.key] = n;
    }
    setSaving(true);
    try {
      await api.updateEmployeeSchedule(employee.id, payload);
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro.");
    } finally {
      setSaving(false);
    }
  };

  const applyToAllWeekdays = (val: string) => {
    setValues(v => ({
      ...v,
      mon_minutes: val, tue_minutes: val, wed_minutes: val,
      thu_minutes: val, fri_minutes: val,
    }));
  };

  return (
    <Modal title="📅 Jornada semanal" onClose={onClose}>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: -6, marginBottom: 16 }}>
          {employee.name} · minutos esperados por dia da semana
        </div>

        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, lineHeight: 1.5 }}>
          💡 Deixe em branco para usar o padrão global (<strong>{fmtMinAsHours(defaultMinutes)}</strong>).
          Digite <strong>0</strong> para marcar como folga/descanso.
        </p>

        <div style={{ background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.2)",
          borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontSize: 11.5,
          color: "var(--muted)", lineHeight: 1.5 }}>
          ℹ️ Só preencha aqui se este colaborador tiver jornada <strong>diferente</strong> das 44h
          semanais (meio período, folga fixa etc.). Escala de sábado <strong>não</strong> se
          configura aqui — marque na aba <strong>Calendário → 📋 Marcar escala</strong>.
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => applyToAllWeekdays("480")}>
            🕗 8h (480 min) seg-sex
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => applyToAllWeekdays("")}>
            ↺ Resetar
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {WEEKDAYS.map(day => {
            const val = values[day.key];
            const num = val ? Number(val) : null;
            return (
              <div key={day.key} className="weekday-row">
                <label style={{ fontSize: 13, fontWeight: 600 }}>{day.label}</label>
                <input
                  type="number"
                  min={0}
                  max={1440}
                  placeholder="padrão"
                  value={val}
                  onChange={e => setValues(v => ({ ...v, [day.key]: e.target.value }))}
                />
                <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)", textAlign: "right" }}>
                  {Number.isInteger(num) ? fmtMinAsHours(num) : <span style={{ color: "var(--accent)" }}>padrão</span>}
                </div>
              </div>
            );
          })}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar jornada"}
          </button>
        </div>
    </Modal>
  );
}

export function Configuracoes({ employees, settings, onEmployeesChanged, onSettingsChanged }: Props) {
  const [empAlert, showEmpAlert] = useAutoDismissAlert(3500);
  const [settingsAlert, showSettingsAlert] = useAutoDismissAlert(3000);
  const [adminPassAlert, showAdminPassAlert] = useAutoDismissAlert(3000);
  const [recordCounts, setRecordCounts] = useState<Record<number, number>>({});
  const [newAdminPass, setNewAdminPass] = useState("");
  const [scheduleEditing, setScheduleEditing] = useState<Employee | null>(null);
  const [formEditing, setFormEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);

  // Jornada semanal padrão em HORAS (deriva de h1/h2, os drivers reais do motor).
  const [weekdayH, setWeekdayH] = useState("8");
  const [satH, setSatH] = useState("4");

  useEffect(() => {
    if (settings) {
      setWeekdayH(minToHoursStr(settings.h1_minutes));
      setSatH(minToHoursStr(settings.h2_minutes));
    }
  }, [settings]);

  useEffect(() => {
    api.getRecords().then(records => {
      const counts: Record<number, number> = {};
      records.forEach(r => { counts[r.employee_id] = (counts[r.employee_id] ?? 0) + 1; });
      setRecordCounts(counts);
    }).catch(() => { /* noop */ });
  }, [employees]);

  const [offboarding, setOffboarding] = useState<Employee | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const activeEmployees = employees.filter(e => e.active);
  const inactiveEmployees = employees.filter(e => !e.active);

  const handleReactivate = async (emp: Employee) => {
    if (!confirm(`Reativar ${emp.name}? Ele volta a aparecer na tela de login.`)) return;
    try { await api.reactivateEmployee(emp.id); showEmpAlert(`${emp.name} reativado.`, "success"); onEmployeesChanged(); }
    catch (e: unknown) { showEmpAlert(e instanceof Error ? e.message : "Erro.", "error"); }
  };

  const weekdayMin = hoursToMin(weekdayH);
  const satMin = hoursToMin(satH);
  const weeklyMin = weekdayMin !== null && satMin !== null ? weekdayMin * 5 + satMin : null;
  const weeklyLabel = weeklyMin !== null ? fmtMinAsHours(weeklyMin) : "—";

  const handleSaveJornada = async () => {
    if (weekdayMin === null || satMin === null) {
      return showSettingsAlert("Informe horas válidas (0 a 24).", "error");
    }
    try {
      const updated = await api.updateSettings({
        h1_minutes: weekdayMin, h2_minutes: satMin,
      });
      onSettingsChanged(updated);
      showSettingsAlert("Jornada padrão salva.", "success");
    } catch (e: unknown) { showSettingsAlert(e instanceof Error ? e.message : "Erro.", "error"); }
  };

  const handleUpdateAdminPass = async () => {
    if (newAdminPass.trim().length < 4) return showAdminPassAlert("Senha deve ter pelo menos 4 caracteres.", "error");
    try {
      await api.updateAdminPassword(newAdminPass.trim());
      setNewAdminPass(""); showAdminPassAlert("Senha atualizada.", "success");
    } catch (e: unknown) { showAdminPassAlert(e instanceof Error ? e.message : "Erro.", "error"); }
  };

  const hasCustomSchedule = (emp: Employee): boolean =>
    emp.mon_minutes !== null || emp.tue_minutes !== null || emp.wed_minutes !== null ||
    emp.thu_minutes !== null || emp.fri_minutes !== null || emp.sat_minutes !== null ||
    emp.sun_minutes !== null;

  const applyPreset = (wd: string, sat: string) => { setWeekdayH(wd); setSatH(sat); };

  return (
    <div>
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 12, flexWrap: "wrap" }}>
          <div className="card-title" style={{ margin: 0 }}>Colaboradores</div>
          <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>＋ Adicionar colaborador</button>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
          Cadastre nome, dados de RH (cargo, admissão, contato) e foto. O PIN inicial é opcional — se vazio, o colaborador cria a própria senha no 1º acesso.
        </p>
        <Alert message={empAlert?.msg ?? null} type={empAlert?.type ?? "error"} />
        <div className="emp-list">
          {activeEmployees.length === 0
            ? <div className="empty">Nenhum colaborador cadastrado.</div>
            : activeEmployees.map(emp => (
              <div className="emp-item" key={emp.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                  <Avatar name={emp.name} src={emp.photo ? api.employeePhotoUrl(emp.photo) : null} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={async () => {
                          const on = !emp.is_admin;
                          if (on && !emp.has_password) { alert(`${emp.name} precisa definir a senha no 1º acesso antes de virar admin.`); return; }
                          if (!confirm(on
                            ? `Dar acesso de ADMINISTRADOR para ${emp.name}?\nEle entra no painel com a própria senha e o nome fica na trilha de auditoria.`
                            : `Remover o acesso de administrador de ${emp.name}?`)) return;
                          try { await api.updateEmployeeProfile(emp.id, { is_admin: on }); onEmployeesChanged(); }
                          catch (e) { alert(e instanceof Error ? e.message : "Erro."); }
                        }}
                        title={emp.is_admin ? "Administrador — clique para remover" : "Dar acesso de administrador"}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 17, padding: "0 2px",
                          filter: emp.is_admin ? "none" : "grayscale(1)", opacity: emp.is_admin ? 1 : 0.45 }}
                      >{emp.is_admin ? "⭐" : "☆"}</button>
                      <div className="emp-name">{emp.name}</div>
                      {emp.is_admin && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                          background: "rgba(245,166,35,0.15)", color: "#b45309", letterSpacing: 0.4 }}>ADMIN</span>
                      )}
                      {emp.role && <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 12, background: "rgba(0,174,239,0.12)", color: "#0284c7" }}>{emp.role}</span>}
                    </div>
                    <div className="emp-meta">
                      {recordCounts[emp.id] ?? 0} registro(s) &nbsp;·&nbsp;
                      {emp.cpf_masked && <span style={{ fontFamily: "var(--mono)" }}>{emp.cpf_masked} · </span>}
                      <span style={{ color: emp.has_password ? "var(--accent)" : "var(--accent2)" }}>
                        {emp.has_password ? "✓ senha definida" : "⚠ aguardando 1º acesso"}
                      </span>
                      {hasCustomSchedule(emp) && (
                        <span style={{ color: "var(--accent)", marginLeft: 10 }}>· 📅 jornada personalizada</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="emp-actions" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setFormEditing(emp)}>✎ Editar</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setScheduleEditing(emp)} title="Definir jornada semanal personalizada">📅 Jornada</button>
                  <button className="btn btn-danger btn-sm" onClick={() => setOffboarding(emp)}>Desligar</button>
                </div>
              </div>
            ))}
        </div>

        {inactiveEmployees.length > 0 && (
          <div style={{ marginTop: 14, borderTop: "1px solid var(--border2)", paddingTop: 12 }}>
            <button
              onClick={() => setShowInactive(v => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)",
                fontSize: 12.5, fontWeight: 600, color: "var(--muted)", padding: 0,
                display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span style={{ transform: showInactive ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▸</span>
              Desligados ({inactiveEmployees.length})
            </button>

            {showInactive && (
              <div className="emp-list" style={{ marginTop: 10 }}>
                {inactiveEmployees.map(emp => (
                  <div className="emp-item" key={emp.id} style={{ opacity: 0.72 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar name={emp.name} src={emp.photo ? api.employeePhotoUrl(emp.photo) : null} size={40} />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <div className="emp-name">{emp.name}</div>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                            background: "rgba(148,163,184,0.18)", color: "var(--muted)", letterSpacing: 0.4 }}>
                            DESLIGADO
                          </span>
                        </div>
                        <div className="emp-meta">
                          {emp.termination_date && <>desde {emp.termination_date.split("-").reverse().join("/")} &nbsp;·&nbsp; </>}
                          {recordCounts[emp.id] ?? 0} registro(s) preservado(s)
                        </div>
                      </div>
                    </div>
                    <div className="emp-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setFormEditing(emp)}>✎ Editar</button>
                      <button className="btn btn-primary btn-sm" onClick={() => handleReactivate(emp)}>↩ Reativar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setOffboarding(emp)}>Apagar…</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {offboarding && (
        <OffboardModal
          employee={offboarding}
          recordCount={recordCounts[offboarding.id] ?? 0}
          onClose={() => setOffboarding(null)}
          onDone={(msg) => { showEmpAlert(msg, "success"); onEmployeesChanged(); }}
        />
      )}

      <div className="card">
        <div className="card-title">Jornada semanal padrão</div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
          Referência do banco de horas para quem não tem jornada personalizada. Domingos/feriados não têm referência.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => applyPreset("8", "4")}>44h (8h seg–sex + 4h sáb)</button>
          <button className="btn btn-secondary btn-sm" onClick={() => applyPreset("8", "0")}>40h (8h seg–sex, sem sábado)</button>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>Seg–Sex (horas por dia)</label>
            <input type="number" min={0} max={24} step={0.5} value={weekdayH} onChange={e => setWeekdayH(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Sábado (horas)</label>
            <input type="number" min={0} max={24} step={0.5} value={satH} onChange={e => setSatH(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
            = <span style={{ color: "var(--accent)" }}>{weeklyLabel}</span>/semana
          </div>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            (5 × {fmtMinAsHours(weekdayMin)} + {fmtMinAsHours(satMin)})
          </span>
        </div>
        <div style={{ marginTop: 14 }}>
          <Alert message={settingsAlert?.msg ?? null} type={settingsAlert?.type ?? "error"} />
          <button className="btn btn-primary" onClick={handleSaveJornada}>Salvar jornada padrão</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Senha do Administrador</div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
          Defina a senha pessoal do gestor. A senha-mestra de recuperação é configurada por variável de ambiente no servidor (não fica no código).
          {settings?.has_admin_password
            ? <span style={{ color: "var(--accent)", marginLeft: 8 }}>✓ senha personalizada ativa</span>
            : <span style={{ color: "var(--accent2)", marginLeft: 8 }}>⚠ ainda sem senha pessoal — defina uma abaixo</span>}
        </p>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
            <label>Nova senha personalizada</label>
            <input type="password" placeholder="Mínimo 4 caracteres" value={newAdminPass} onChange={e => setNewAdminPass(e.target.value)} />
          </div>
          <button className="btn btn-secondary" onClick={handleUpdateAdminPass}>Atualizar</button>
        </div>
        <Alert message={adminPassAlert?.msg ?? null} type={adminPassAlert?.type ?? "error"} />
      </div>

      {creating && (
        <EmployeeFormModal
          onClose={() => setCreating(false)}
          onSaved={msg => { showEmpAlert(msg, "success"); onEmployeesChanged(); }}
        />
      )}
      {formEditing && (
        <EmployeeFormModal
          employee={formEditing}
          onClose={() => setFormEditing(null)}
          onSaved={msg => { showEmpAlert(msg, "success"); onEmployeesChanged(); }}
        />
      )}
      {scheduleEditing && (
        <ScheduleModal
          employee={scheduleEditing}
          defaultMinutes={settings?.h1_minutes ?? 480}
          onClose={() => setScheduleEditing(null)}
          onSaved={onEmployeesChanged}
        />
      )}
    </div>
  );
}

/* ─── Modal de desligamento: inativar (reversível) ou apagar (definitivo) ─── */
function OffboardModal({ employee, recordCount, onClose, onDone }: {
  employee: Employee;
  recordCount: number;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [mode, setMode] = useState<"inativar" | "apagar">("inativar");
  const [date, setDate] = useState(employee.termination_date ?? today);
  const [confirmText, setConfirmText] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const go = async () => {
    setErr("");
    if (mode === "apagar" && confirmText.trim().toUpperCase() !== "APAGAR") {
      setErr('Digite APAGAR para confirmar a exclusão definitiva.');
      return;
    }
    setSaving(true);
    try {
      if (mode === "inativar") {
        await api.deactivateEmployee(employee.id, date);
        onDone(`${employee.name} foi desligado. Os registros ficam preservados.`);
      } else {
        await api.deleteEmployee(employee.id);
        onDone(`${employee.name} e seus registros foram apagados.`);
      }
      onClose();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Erro."); }
    finally { setSaving(false); }
  };

  const Opt = ({ value, icon, title, desc }: { value: "inativar" | "apagar"; icon: string; title: string; desc: string }) => (
    <button
      onClick={() => { setMode(value); setErr(""); }}
      style={{
        textAlign: "left", padding: "12px 14px", borderRadius: 12, cursor: "pointer",
        fontFamily: "var(--font)", width: "100%",
        background: mode === value ? (value === "apagar" ? "rgba(220,38,38,0.08)" : "rgba(37,99,235,0.08)") : "var(--surface2)",
        border: `1px solid ${mode === value ? (value === "apagar" ? "#dc2626" : "var(--accent)") : "var(--border2)"}`,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3,
        color: mode === value ? (value === "apagar" ? "#dc2626" : "var(--accent)") : "var(--text)" }}>
        {icon} {title}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.45 }}>{desc}</div>
    </button>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,21,38,0.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16,
        padding: 26, width: "100%", maxWidth: 440, boxShadow: "var(--shadow-md)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Desligar colaborador</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18,
            cursor: "pointer", color: "var(--muted)", fontFamily: "var(--font)" }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
          {employee.name} · {recordCount} registro(s) de ponto
        </div>

        <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          <Opt value="inativar" icon="📦" title="Inativar (recomendado)"
            desc="Sai da tela de login e dos relatórios ativos, mas o histórico fica guardado e pode ser reativado depois." />
          <Opt value="apagar" icon="🗑" title="Apagar do banco"
            desc={`Exclui o colaborador e os ${recordCount} registro(s) de ponto. Não há como desfazer.`} />
        </div>

        {mode === "inativar" && (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Data de desligamento</label>
            <input type="date" value={date} onChange={e => { setDate(e.target.value); setErr(""); }} />
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              Fica registrada na ficha do colaborador.
            </span>
          </div>
        )}

        {mode === "apagar" && (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Digite <strong>APAGAR</strong> para confirmar</label>
            <input type="text" value={confirmText} placeholder="APAGAR"
              onChange={e => { setConfirmText(e.target.value); setErr(""); }} />
          </div>
        )}

        {err && <div className="alert alert-error" style={{ marginBottom: 12 }}>{err}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className={mode === "apagar" ? "btn btn-danger" : "btn btn-primary"}
            onClick={go} disabled={saving}>
            {saving ? "Salvando…" : mode === "apagar" ? "Apagar definitivamente" : "Confirmar desligamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
