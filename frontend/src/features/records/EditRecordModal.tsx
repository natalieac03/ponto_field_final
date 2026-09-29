import { useRef, useState } from "react";
import { api } from "../../api/client";
import { Modal } from "../../components/Modal";
import { confirmDialog } from "../../components/ConfirmDialog";
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
const ATTACHMENTS_MAX = 2;

function brDate(iso: string) {
  const [y, mo, d] = iso.split("-");
  return `${d}/${mo}/${y}`;
}

export function EditRecordModal({ record, onClose, onSaved, onAttachmentsChanged }: {
  record: DailyRecord;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onAttachmentsChanged?: () => void;
}) {
  const [entry, setEntry] = useState(record.entry_time ?? "");
  const [bs, setBs] = useState(record.break_start ?? "");
  const [be, setBe] = useState(record.break_end ?? "");
  const [exit, setExit] = useState(record.exit_time ?? "");
  const [abono, setAbono] = useState(record.abono_code ?? "");
  const [note, setNote] = useState(record.note ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState(record.attachments ?? []);
  const [attError, setAttError] = useState("");
  const [attBusy, setAttBusy] = useState<"upload" | "delete" | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadFile = async (file: File) => {
    if (attachments.length >= ATTACHMENTS_MAX) {
      setAttError(`Limite de ${ATTACHMENTS_MAX} anexos atingido.`);
      return;
    }
    setAttError("");
    setAttBusy("upload");
    try {
      const updated = await api.uploadAttachment(record.id, file);
      setAttachments(updated.attachments);
      onAttachmentsChanged?.();
    } catch (e) {
      setAttError(e instanceof Error ? e.message : "Erro ao enviar arquivo.");
    } finally {
      setAttBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAttachment = async (filename: string) => {
    if (!(await confirmDialog("Remover este anexo?", { danger: true }))) return;
    setAttError("");
    setAttBusy("delete");
    try {
      const updated = await api.deleteAttachment(record.id, filename);
      setAttachments(updated.attachments);
      onAttachmentsChanged?.();
    } catch (e) {
      setAttError(e instanceof Error ? e.message : "Erro ao remover anexo.");
    } finally { setAttBusy(null); }
  };

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
        <div className="form-group"><label>Início intervalo</label><input type="time" value={bs} onChange={e => setBs(e.target.value)} /></div>
        <div className="form-group"><label>Fim intervalo</label><input type="time" value={be} onChange={e => setBe(e.target.value)} /></div>
        <div className="form-group"><label>Saída</label><input type="time" value={exit} onChange={e => setExit(e.target.value)} /></div>
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

      <div className="form-group" style={{ marginTop: 12 }}>
        <label>
          Anexos <span style={{ color: "var(--muted)", fontWeight: 400 }}>({attachments.length}/{ATTACHMENTS_MAX} — png, jpg, pdf — máx. 5 MB)</span>
        </label>

        {attachments.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {attachments.map(filename => (
              <div
                key={filename}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                }}
              >
                <a
                  href={api.attachmentUrl(filename)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent)", textDecoration: "none", fontSize: 13, fontFamily: "var(--mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 10 }}
                  title={filename}
                >
                  📎 {filename}
                </a>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDeleteAttachment(filename)}
                  disabled={attBusy !== null}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}

        {attachments.length < ATTACHMENTS_MAX && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.gif,.pdf,.webp,.heic"
              style={{ display: "none" }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleUploadFile(f);
              }}
            />
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={attBusy === "upload"}
            >
              {attBusy === "upload" ? "⏳ enviando…" : "📎 Adicionar anexo"}
            </button>
          </>
        )}

        {attError && <div className="alert alert-error" style={{ marginTop: 10 }}>{attError}</div>}
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? "Enviando…" : "Enviar para aprovação"}</button>
      </div>
    </Modal>
  );
}
