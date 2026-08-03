import { useRef, useState } from "react";
import { api } from "../../api/client";
import { Avatar } from "../../components/Avatar";
import { Modal } from "../../components/Modal";
import { CONTRACT_TYPES } from "../../types";
import type { Employee } from "../../types";

interface Props {
  employee?: Employee | null;   // null/undefined → modo criar
  onClose: () => void;
  onSaved: (msg: string) => void;
}

/** Modal único de cadastro/edição de colaborador — dados de acesso + RH + foto. */
export function EmployeeFormModal({ employee, onClose, onSaved }: Props) {
  const isEdit = !!employee;
  const [name, setName] = useState(employee?.name ?? "");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState(employee?.role ?? "");
  const [hireDate, setHireDate] = useState(employee?.hire_date ?? "");
  const [department, setDepartment] = useState(employee?.department ?? "");
  const [registration, setRegistration] = useState(employee?.registration ?? "");
  const [email, setEmail] = useState(employee?.email ?? "");
  const [phone, setPhone] = useState(employee?.phone ?? "");
  const [contractType, setContractType] = useState(employee?.contract_type ?? "");
  const [cpf, setCpf] = useState("");   // vazio = não mexe; digitar novo substitui
  const [photo, setPhoto] = useState(employee?.photo ?? null);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState("");
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const photoUrl = photo ? api.employeePhotoUrl(photo) : null;

  const profilePayload = () => ({
    role, hire_date: hireDate, department, registration, email, phone, contract_type: contractType,
    ...(cpf.trim() !== "" ? { cpf: cpf.trim() } : {}),
  });

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;
    setError(""); setPhotoBusy(true);
    try {
      const updated = await api.uploadEmployeePhoto(employee.id, file);
      setPhoto(updated.photo);
      onSaved("Foto atualizada ✓");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar a foto.");
    } finally {
      setPhotoBusy(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (!employee) return;
    setError(""); setPhotoBusy(true);
    try {
      await api.deleteEmployeePhoto(employee.id);
      setPhoto(null);
      onSaved("Foto removida ✓");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover a foto.");
    } finally { setPhotoBusy(false); }
  };

  const submit = async () => {
    setError("");
    if (!name.trim()) { setError("Informe o nome do colaborador."); return; }
    if (!isEdit && pin && (pin.length < 4 || pin.length > 8)) {
      setError("PIN inicial deve ter 4 a 8 caracteres."); return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        if (name.trim() !== employee!.name) await api.renameEmployee(employee!.id, name.trim());
        await api.updateEmployeeProfile(employee!.id, profilePayload());
        onSaved("Colaborador atualizado ✓");
      } else {
        await api.createEmployee({ name: name.trim(), pin: pin || undefined, ...profilePayload() });
        onSaved(pin ? "Colaborador criado com PIN inicial ✓" : "Colaborador criado — definirá a senha no 1º acesso ✓");
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally { setSaving(false); }
  };

  return (
    <Modal title={isEdit ? "✎ Editar colaborador" : "＋ Novo colaborador"} onClose={onClose} maxWidth={520}>
        {isEdit && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
            <Avatar name={name || "?"} src={photoUrl} size={64} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
              <button className="btn btn-secondary btn-sm" disabled={photoBusy} onClick={() => photoInputRef.current?.click()}>
                {photoBusy ? "Enviando…" : photo ? "Trocar foto" : "Adicionar foto"}
              </button>
              {photo && (
                <button className="btn btn-danger btn-sm" disabled={photoBusy} onClick={handleRemovePhoto}>Remover foto</button>
              )}
            </div>
          </div>
        )}

        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Nome completo</label>
          <input type="text" maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="Nome do colaborador" />
        </div>

        {!isEdit && (
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>PIN inicial <span style={{ color: "var(--muted)", fontWeight: 400 }}>(opcional — 4 a 8 caracteres)</span></label>
            <input type="text" maxLength={8} value={pin} onChange={e => setPin(e.target.value)} placeholder="Vazio = define no 1º acesso" />
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4, margin: "6px 0 10px" }}>Dados de RH</div>

        <div className="form-grid">
          <div className="form-group">
            <label>CPF {employee?.cpf_masked && <span style={{ color: "var(--muted)", fontWeight: 400 }}>· atual {employee.cpf_masked}</span>}</label>
            <input type="text" maxLength={14} value={cpf} onChange={e => setCpf(e.target.value)}
              placeholder={employee?.has_cpf ? "Novo CPF (vazio = manter)" : "000.000.000-00"} />
            <span style={{ fontSize: 11, color: "var(--muted)" }}>Sempre mascarado nas telas e relatórios (123.***.**4-56).</span>
          </div>
          <div className="form-group"><label>Cargo / função</label><input type="text" maxLength={60} value={role} onChange={e => setRole(e.target.value)} placeholder="Ex.: Técnico de Campo" /></div>
          <div className="form-group"><label>Data de admissão</label><input type="date" value={hireDate ?? ""} onChange={e => setHireDate(e.target.value)} /></div>
          <div className="form-group"><label>Departamento / setor</label><input type="text" maxLength={60} value={department} onChange={e => setDepartment(e.target.value)} placeholder="Ex.: Operações" /></div>
          <div className="form-group"><label>Matrícula / registro</label><input type="text" maxLength={30} value={registration} onChange={e => setRegistration(e.target.value)} placeholder="Ex.: FT-0012" /></div>
          <div className="form-group"><label>E-mail</label><input type="email" maxLength={120} value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@empresa.com.br" /></div>
          <div className="form-group"><label>Telefone</label><input type="text" maxLength={30} value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" /></div>
        </div>

        <div className="form-group" style={{ marginTop: 12 }}>
          <label>Tipo de contrato</label>
          <select value={contractType} onChange={e => setContractType(e.target.value)}>
            <option value="">— não informado —</option>
            {CONTRACT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar colaborador"}
          </button>
        </div>
    </Modal>
  );
}
