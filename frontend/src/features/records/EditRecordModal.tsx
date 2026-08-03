import { useState } from "react";
import { api } from "../../api/client";
import { Modal } from "../../components/Modal";
import type { DailyRecord, RecordRequestEdit } from "../../types";

const ABONOS: { code: string; label: string }[] = [
  { code: "", label: "— sem abono —" },
  { code: "AT", label: "AT — Atestado" },
  { code: "AB", label: "AB — Abono" },
  { code: "VG", label: "VG — Viagem" },
  { code: "FA", label: "FA — Falta" },
  { code: "FE", label: "FE — Folga" },
];

const NOTE_MAX = 500;

function brDate(iso: string) {
  const [y, mo, d] = iso.split("-");
  return `${d}/${mo}/${y}`;
}

export function EditRecordModal({ record, onClose, onSaved }: {
  record: DailyRecord;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [entry, setEntry] = useState(record.entry_time ?? "");
  const [bs, setBs] = useState(record.break_start ?? "");
  const [be, setBe] = useState(record.break_end ?? "");
  const [exit, setExit] = useState(record.exit_time ?? "");
  const [abono, setAbono] = useState(record.abono_code ?? "");
  const [note, setNote] = useState(record.note ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError("");
    if (!entry && !abono) {
      setError("Informe o horário de entrada ou selecione um abono.");
      return;
    }
    if (be && !bs) {
      setError("Fim do intervalo exige o início.");
      return;
    }
    const payload: RecordRequestEdit = {
      entry_time: entry, break_start: bs, break_end: be, exit_time: exit,
      abono_code: abono, note: note.trim(),
    };
    setSaving(true);
    try {
      await api.requestEditRecord(record.id, payload);
      onSaved("Solicitação de edição enviada — aguardando aprovação do gestor ✓");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar a edição.");
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`✎ Editar registro — ${brDate(record.date)}`} onClose={onClose} maxWidth={440}>
      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: -6, marginBottom: 16 }}>
        A alteração entra como <strong>pendente</strong> e passa pela aprovação do gestor antes de valer no banco de horas.
      </p>

      <div className="form-grid">
        <div className="form-group"><label>Entrada</label><input type="time" value={entry} onChange={e => setEntry(e.target.value)} /></div>
        <div className="form-group"><label>Saída</label><input type="time" value={exit} onChange={e => setExit(e.target.value)} /></div>
        <div className="form-group"><label>Início intervalo</label><input type="time" value={bs} onChange={e => setBs(e.target.value)} /></div>
        <div className="form-group"><label>Fim intervalo</label><input type="time" value={be} onChange={e => setBe(e.target.value)} /></div>
      </div>

      <div className="form-group" style={{ marginTop: 12 }}>
        <label>Abono</label>
        <select value={abono} onChange={e => setAbono(e.target.value)}>
          {ABONOS.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}
        </select>
      </div>

      <div className="form-group" style={{ marginTop: 12 }}>
        <label>Observação <span style={{ color: "var(--muted)", fontWeight: 400 }}>({note.length}/{NOTE_MAX})</span></label>
        <input type="text" maxLength={NOTE_MAX} value={note} onChange={e => setNote(e.target.value)} placeholder="Motivo da correção (opcional)" />
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? "Enviando…" : "Enviar para aprovação"}</button>
      </div>
    </Modal>
  );
}
