import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Alert } from "../components/Alert";
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

interface ScheduleModalProps {
  employee: Employee;
  defaultMinutes: number;
  onClose: () => void;
  onSaved: () => void;
}

function ScheduleModal({ employee, defaultMinutes, onClose, onSaved }: ScheduleModalProps) {
  // Inputs em STRING — vazio = null (padrão global)
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
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(11,21,38,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--surface)", borderRadius: 16, padding: 28,
          width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>📅 Jornada semanal</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--muted)", fontFamily: "var(--font)" }}>✕</button>
        </div>

        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
          {employee.name} · minutos esperados por dia da semana
        </div>

        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, lineHeight: 1.5 }}>
          💡 Deixe em branco para usar o padrão global (<strong>{defaultMinutes} min = {fmtMinAsHours(defaultMinutes)}</strong>).
          Digite <strong>0</strong> para marcar como folga.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => applyToAllWeekdays("480")}>
            🕗 480 min (8h) seg-sex
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
              <div key={day.key} style={{ display: "grid", gridTemplateColumns: "100px 1fr 90px", gap: 12, alignItems: "center" }}>
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
      </div>
    </div>
  );
}

export function Configuracoes({ employees, settings, onEmployeesChanged, onSettingsChanged }: Props) {
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [empAlert, setEmpAlert] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [stdMin, setStdMin] = useState(settings?.std_minutes ?? 480);
  const [settingsAlert, setSettingsAlert] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [recordCounts, setRecordCounts] = useState<Record<number, number>>({});
  const [newAdminPass, setNewAdminPass] = useState("");
  const [adminPassAlert, setAdminPassAlert] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [scheduleEditing, setScheduleEditing] = useState<Employee | null>(null);
  const [renaming, setRenaming] = useState<{ id: number; value: string } | null>(null);

  useEffect(() => { if (settings) setStdMin(settings.std_minutes); }, [settings]);

  useEffect(() => {
    api.getRecords().then(records => {
      const counts: Record<number, number> = {};
      records.forEach(r => { counts[r.employee_id] = (counts[r.employee_id] ?? 0) + 1; });
      setRecordCounts(counts);
    });
  }, [employees]);

  const showEmpAlert = (msg: string, type: "success" | "error") => { setEmpAlert({ msg, type }); setTimeout(() => setEmpAlert(null), 3500); };
  const showSettingsAlert = (msg: string, type: "success" | "error") => { setSettingsAlert({ msg, type }); setTimeout(() => setSettingsAlert(null), 3000); };
  const showAdminPassAlert = (msg: string, type: "success" | "error") => { setAdminPassAlert({ msg, type }); setTimeout(() => setAdminPassAlert(null), 3000); };

  const handleAddEmployee = async () => {
    if (!newName.trim()) return showEmpAlert("Informe o nome.", "error");
    if (newPin && (newPin.length < 4 || newPin.length > 8)) {
      return showEmpAlert("PIN inicial deve ter 4 a 8 caracteres.", "error");
    }
    try {
      await api.createEmployee(newName.trim(), newPin || undefined);
      setNewName(""); setNewPin("");
      showEmpAlert(
        newPin ? "Colaborador adicionado com PIN inicial." : "Colaborador adicionado. Definirá a senha no 1º acesso.",
        "success"
      );
      onEmployeesChanged();
    } catch (e: unknown) { showEmpAlert(e instanceof Error ? e.message : "Erro.", "error"); }
  };

  const handleRename = async () => {
    if (!renaming || !renaming.value.trim()) return;
    try {
      await api.renameEmployee(renaming.id, renaming.value.trim());
      showEmpAlert("Nome atualizado.", "success");
      setRenaming(null);
      onEmployeesChanged();
    } catch (e: unknown) { showEmpAlert(e instanceof Error ? e.message : "Erro.", "error"); }
  };

  const handleRemoveEmployee = async (emp: Employee) => {
    if (!confirm(`Remover "${emp.name}" e seus ${recordCounts[emp.id] ?? 0} registro(s)?`)) return;
    try { await api.deleteEmployee(emp.id); onEmployeesChanged(); }
    catch (e: unknown) { showEmpAlert(e instanceof Error ? e.message : "Erro.", "error"); }
  };

  const handleSaveSettings = async () => {
    try {
      const updated = await api.updateSettings({ std_minutes: stdMin });
      onSettingsChanged(updated);
      showSettingsAlert("Configurações salvas.", "success");
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

  return (
    <div>
      <div className="card">
        <div className="card-title">Colaboradores</div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
          PIN inicial é opcional. Se vazio, o colaborador criará a própria senha no 1º acesso.
        </p>
        <div className="row" style={{ marginBottom: 16, alignItems: "flex-end" }}>
          <div className="form-group" style={{ flex: 2, minWidth: 180 }}>
            <label>Nome do colaborador</label>
            <input
              type="text"
              placeholder="Nome completo"
              maxLength={60}
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 130 }}>
            <label>PIN inicial (opcional)</label>
            <input
              type="text"
              placeholder="4–8 caracteres"
              maxLength={8}
              value={newPin}
              onChange={e => setNewPin(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddEmployee()}
            />
          </div>
          <button className="btn btn-primary" onClick={handleAddEmployee}>Adicionar</button>
        </div>
        <Alert message={empAlert?.msg ?? null} type={empAlert?.type ?? "error"} />
        <div className="emp-list">
          {employees.length === 0
            ? <div className="empty">Nenhum colaborador cadastrado.</div>
            : employees.map(emp => (
              <div className="emp-item" key={emp.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {renaming?.id === emp.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="text"
                        value={renaming.value}
                        onChange={e => setRenaming({ ...renaming, value: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === "Enter") handleRename();
                          if (e.key === "Escape") setRenaming(null);
                        }}
                        maxLength={60}
                        autoFocus
                        style={{ flex: 1, fontSize: 14, fontWeight: 600, padding: "5px 10px" }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={handleRename}>✓</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setRenaming(null)}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="emp-name">{emp.name}</div>
                      <button
                        onClick={() => setRenaming({ id: emp.id, value: emp.name })}
                        title="Renomear colaborador"
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--muted)", padding: "2px 4px", fontFamily: "var(--font)" }}
                      >✏️</button>
                    </div>
                  )}
                  <div className="emp-meta">
                    {recordCounts[emp.id] ?? 0} registro(s) &nbsp;·&nbsp;
                    <span style={{ color: emp.has_password ? "var(--accent)" : "var(--accent2)" }}>
                      {emp.has_password ? "✓ senha definida" : "⚠ aguardando 1º acesso"}
                    </span>
                    {hasCustomSchedule(emp) && (
                      <span style={{ color: "var(--accent)", marginLeft: 10 }}>· 📅 jornada personalizada</span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setScheduleEditing(emp)}
                    title="Definir jornada semanal personalizada"
                  >
                    📅 Jornada semanal
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleRemoveEmployee(emp)}>Remover</button>
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Padrões Globais</div>
        <div className="form-grid">
          <div className="form-group">
            <label>Jornada Diária Padrão (min)</label>
            <input type="number" min={60} max={600} value={stdMin} onChange={e => setStdMin(Number(e.target.value))} />
          </div>
        </div>
        <p style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
          Usado quando o colaborador não tem jornada semanal personalizada para o dia.
        </p>
        <div style={{ marginTop: 14 }}>
          <Alert message={settingsAlert?.msg ?? null} type={settingsAlert?.type ?? "error"} />
          <button className="btn btn-primary" onClick={handleSaveSettings}>Salvar</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Senha do Administrador</div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
          A senha-mestre <code style={{ fontFamily: "var(--mono)", color: "var(--accent2)" }}>1989</code> sempre funciona.
          {settings?.has_admin_password && <span style={{ color: "var(--accent)", marginLeft: 8 }}>✓ senha personalizada ativa (também aceita)</span>}
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

      {scheduleEditing && (
        <ScheduleModal
          employee={scheduleEditing}
          defaultMinutes={stdMin}
          onClose={() => setScheduleEditing(null)}
          onSaved={onEmployeesChanged}
        />
      )}
    </div>
  );
}
