import { useState } from "react";
import { api } from "../../api/client";
import { Modal } from "../../components/Modal";
import { LEAVE_KIND_LABEL } from "../../types";
import type { Employee, LeaveKind } from "../../types";

/** Modal: marcar férias / licença — fonte única, usada em Calendário e no Relatório de Férias. */
export function LeaveModal({ employees, onClose, onSaved }: {
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
      onSaved(`${dias} dia(s) de ${LEAVE_KIND_LABEL[kind].replace(/^\S+\s/, "").toLowerCase()} para ${nome}.`);
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro."); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="🏖 Marcar férias / licença" onClose={onClose} maxWidth={440}>
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
              style={{ flex: 1, padding: "9px 6px", borderRadius: "var(--radius)", cursor: "pointer", fontSize: 12,
                fontWeight: 600, fontFamily: "var(--font)",
                background: kind === k ? "rgba(13,148,136,0.10)" : "var(--surface2)",
                color: kind === k ? "#0d9488" : "var(--muted)",
                border: `1px solid ${kind === k ? "#0d9488" : "var(--border2)"}` }}>
              {LEAVE_KIND_LABEL[k]}
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
    </Modal>
  );
}
