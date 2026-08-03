import { useEffect, useRef, useState } from "react";
import { useThemedAssets } from "../assets";
import { api } from "../api/client";
import { Avatar } from "../components/Avatar";
import { Badge, fmtDate, fmtMin, fmtMinUnsigned } from "../components/Badge";
import { ImageLightbox } from "../components/ImageLightbox";
import { ThemeToggleCompact } from "../components/ThemeToggle";
import { isImage, isPdf } from "../helpers/attachments";
import { MeuEspelho } from "../features/espelho/MeuEspelho";
import { EditRecordModal } from "../features/records/EditRecordModal";
import { ActivityFeed } from "../features/activity/ActivityFeed";
import type { AbonoCode, ActivityLog, DailyRecord, Employee, RecordCreate } from "../types";

type Tab = "ponto" | "espelho" | "registros" | "atividades";

const FEEDBACK_DURATION_MS = 7000;
const NOTE_MAX = 500;
const ATTACHMENTS_MAX = 2;
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

function nowHHMM() { return new Date().toTimeString().slice(0, 5); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function timeToMin(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function brkDuration(start: string | null, end: string | null) {
  if (!start || !end) return 0;
  return Math.max(timeToMin(end) - timeToMin(start), 0);
}
function calcWorked(entry: string, exit: string, brk: number) {
  let w = timeToMin(exit) - timeToMin(entry) - brk;
  if (w < 0) w += 1440;
  return w;
}
function fmtClock(d: Date) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDateFull(d: Date) {
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

type PunchState = "none" | "entered" | "break_started" | "break_ended" | "exited";

function getPunchState(record: DailyRecord | null): PunchState {
  if (!record) return "none";
  if (record.exit_time) return "exited";
  if (record.break_end) return "break_ended";
  if (record.break_start) return "break_started";
  return "entered";
}

interface Props {
  employee: { id: number; name: string };
  onLogout: () => void;
}

function ActionIcon({ src, alt, muted = false }: { src: string; alt: string; muted?: boolean }) {
  return <img src={src} alt={alt} style={{ width: 42, height: 42, objectFit: "contain", opacity: muted ? 0.38 : 1, filter: muted ? "grayscale(1)" : "none" }} />;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    aprovado:  { bg: "rgba(22,163,74,0.12)",  fg: "#16a34a", label: "Aprovado" },
    pendente:  { bg: "rgba(245,166,35,0.16)", fg: "#b45309", label: "Pendente" },
    reprovado: { bg: "rgba(220,38,38,0.12)",  fg: "#dc2626", label: "Reprovado" },
  };
  const s = map[status] ?? map.aprovado;
  return <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: s.bg, color: s.fg, whiteSpace: "nowrap" }}>{s.label}</span>;
}

/* ─── Lançamento retroativo (entra pendente p/ aprovação do gestor) ─────────── */
function RetroLaunch({ employeeId, onDone }: { employeeId: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [mode, setMode] = useState<"horarios" | "abono">("horarios");
  const [entry, setEntry] = useState("");
  const [bs, setBs] = useState("");
  const [be, setBe] = useState("");
  const [exit, setExit] = useState("");
  const [abono, setAbono] = useState<AbonoCode>("AT");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setDate(""); setEntry(""); setBs(""); setBe(""); setExit(""); setNote(""); };

  const submit = async () => {
    setError(""); setOk("");
    if (!date) { setError("Escolha a data do lançamento."); return; }
    if (date >= todayISO()) { setError("Use uma data anterior a hoje (lançamento retroativo)."); return; }
    const payload: RecordCreate = { employee_id: employeeId, date };
    if (mode === "horarios") {
      if (!entry) { setError("Informe ao menos o horário de entrada."); return; }
      payload.entry_time = entry;
      if (bs) payload.break_start = bs;
      if (be) payload.break_end = be;
      if (exit) payload.exit_time = exit;
    } else {
      payload.abono_code = abono;
    }
    if (note.trim()) payload.note = note.trim();
    setSaving(true);
    try {
      await api.createRecord(payload);
      setOk("Lançamento enviado para aprovação do gestor ✓");
      reset();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao lançar.");
    } finally { setSaving(false); }
  };

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Lançar dia anterior</div>
        <button className="btn btn-secondary btn-sm" onClick={() => { setOpen(v => !v); setError(""); setOk(""); }}>
          {open ? "Fechar" : "＋ Novo lançamento"}
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
            Esqueceu de bater o ponto? Lance aqui um dia passado. O registro fica <strong>pendente</strong> até o gestor aprovar.
          </p>
          <div className="form-grid">
            <div className="form-group">
              <label>Data</label>
              <input type="date" max={todayISO()} value={date} onChange={e => { setDate(e.target.value); setError(""); }} />
            </div>
            <div className="form-group">
              <label>Tipo de lançamento</label>
              <select value={mode} onChange={e => { setMode(e.target.value as "horarios" | "abono"); setError(""); }}>
                <option value="horarios">Horários (bati ponto)</option>
                <option value="abono">Abono / justificativa</option>
              </select>
            </div>
          </div>

          {mode === "horarios" ? (
            <div className="form-grid" style={{ marginTop: 12 }}>
              <div className="form-group"><label>Entrada</label><input type="time" value={entry} onChange={e => setEntry(e.target.value)} /></div>
              <div className="form-group"><label>Saída</label><input type="time" value={exit} onChange={e => setExit(e.target.value)} /></div>
              <div className="form-group"><label>Início intervalo</label><input type="time" value={bs} onChange={e => setBs(e.target.value)} /></div>
              <div className="form-group"><label>Fim intervalo</label><input type="time" value={be} onChange={e => setBe(e.target.value)} /></div>
            </div>
          ) : (
            <div className="form-grid" style={{ marginTop: 12 }}>
              <div className="form-group">
                <label>Abono</label>
                <select value={abono} onChange={e => setAbono(e.target.value as AbonoCode)}>
                  <option value="AT">AT — Atestado</option>
                  <option value="AB">AB — Abono</option>
                  <option value="VG">VG — Viagem</option>
                  <option value="FA">FA — Falta</option>
                  <option value="FE">FE — Folga</option>
                </select>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>AT/AB/VG contam como trabalhado · FA = falta · FE = folga</span>
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginTop: 12 }}>
            <label>Observação <span style={{ color: "var(--muted)", fontWeight: 400 }}>(opcional)</span></label>
            <input type="text" maxLength={NOTE_MAX} value={note} onChange={e => setNote(e.target.value)} placeholder="Ex.: esqueci de registrar a saída" />
          </div>

          {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
          {ok && <div className="alert alert-success" style={{ marginTop: 12 }}>{ok}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? "Enviando…" : "Enviar para aprovação"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function EmployeePortal({ employee, onLogout }: Props) {
  const { breakInIconUrl, breakOutIconUrl, clockInIconUrl, clockOutIconUrl, logoUrl } = useThemedAssets();
  const [tab, setTab] = useState<Tab>("ponto");
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [stdMin, setStdMin] = useState(480);
  const [now, setNow] = useState(new Date());
  const [feedback, setFeedback] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; filename: string } | null>(null);

  // Perfil do colaborador (foto/avatar)
  const [me, setMe] = useState<Employee | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Ações de linha (editar/excluir) + atividades do colaborador
  const [editingRecord, setEditingRecord] = useState<DailyRecord | null>(null);
  const [rowBusyId, setRowBusyId] = useState<number | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // Observações + anexos do dia
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const photoUrl = me?.photo ? api.employeePhotoUrl(me.photo) : null;

  // Form de alterar senha
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmNewPass, setConfirmNewPass] = useState("");
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");
  const [savingPass, setSavingPass] = useState(false);

  // Clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    api.getSettings().then(s => setStdMin(s.std_minutes)).catch(console.error);
    loadRecords();
    loadMe();
  }, []);

  // Fecha menu ao clicar fora
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const loadRecords = () => api.getRecordsByEmployee(employee.id).then(setRecords).catch(console.error);
  const loadMe = () => api.getEmployee(employee.id)
    .then(setMe)
    .catch(console.error);

  const handleUploadPhoto = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      showFeedback("Selecione um arquivo de imagem (png, jpg, webp…).", "error");
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      showFeedback("Imagem muito grande (máx. 5 MB).", "error");
      return;
    }
    setPhotoBusy(true);
    try {
      const updated = await api.uploadEmployeePhoto(employee.id, file);
      setMe(updated);
      showFeedback("Foto de perfil atualizada ✓", "success");
    } catch (e: unknown) {
      showFeedback(e instanceof Error ? e.message : "Erro ao enviar a foto.", "error");
    } finally {
      setPhotoBusy(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (!me?.photo) return;
    if (!confirm("Remover sua foto de perfil?")) return;
    setPhotoBusy(true);
    try {
      const updated = await api.deleteEmployeePhoto(employee.id);
      setMe(updated);
      showFeedback("Foto removida ✓", "success");
    } catch (e: unknown) {
      showFeedback(e instanceof Error ? e.message : "Erro ao remover a foto.", "error");
    } finally {
      setPhotoBusy(false);
    }
  };

  const loadActivities = () => {
    const d = new Date();
    setActivitiesLoading(true);
    api.getEmployeeActivity(employee.id, d.getFullYear(), d.getMonth() + 1)
      .then(setActivities).catch(console.error).finally(() => setActivitiesLoading(false));
  };

  const requestRemove = async (r: DailyRecord) => {
    if (r.removal_requested) return;
    if (!confirm(`Solicitar exclusão do registro de ${fmtDate(r.date)}? O gestor precisa aprovar.`)) return;
    setRowBusyId(r.id);
    try {
      await api.requestRemoveRecord(r.id);
      showFeedback("Solicitação de exclusão enviada — aguardando aprovação ✓", "success");
      loadRecords();
    } catch (e: unknown) {
      showFeedback(e instanceof Error ? e.message : "Erro ao solicitar exclusão.", "error");
    } finally { setRowBusyId(null); }
  };

  const onRecordEdited = (msg: string) => {
    setEditingRecord(null);
    showFeedback(msg, "success");
    loadRecords();
  };

  // Carrega as atividades ao abrir a aba
  useEffect(() => {
    if (tab === "atividades") loadActivities();
  }, [tab]);

  const showFeedback = (msg: string, type: "success" | "error") => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), FEEDBACK_DURATION_MS);
  };

  const todayRecord = records.find(r => r.date === todayISO()) ?? null;
  const state = getPunchState(todayRecord);

  // Sync da observação com o record do dia
  useEffect(() => {
    setNoteDraft(todayRecord?.note ?? "");
  }, [todayRecord?.id, todayRecord?.note]);

  const handleEntrar = async () => {
    if (state !== "none") return;
    const time = nowHHMM();
    const date = todayISO();
    setLoading("entrar");
    try {
      await api.createRecord({ employee_id: employee.id, date, entry_time: time });
      showFeedback(`Entrada registrada às ${time} ✓`, "success");
      loadRecords();
    } catch (e: unknown) {
      showFeedback(e instanceof Error ? e.message : "Erro.", "error");
    } finally { setLoading(null); }
  };

  const handleIniciarIntervalo = async () => {
    if (state !== "entered" || !todayRecord) return;
    const time = nowHHMM();
    setLoading("break_start");
    try {
      await api.patchBreak(todayRecord.id, { break_start: time });
      showFeedback(`Início do intervalo às ${time} ✓`, "success");
      loadRecords();
    } catch (e: unknown) {
      showFeedback(e instanceof Error ? e.message : "Erro.", "error");
    } finally { setLoading(null); }
  };

  const handleFimIntervalo = async () => {
    if (state !== "break_started" || !todayRecord) return;
    const time = nowHHMM();
    setLoading("break_end");
    try {
      await api.patchBreak(todayRecord.id, { break_end: time });
      showFeedback(`Fim do intervalo às ${time} ✓`, "success");
      loadRecords();
    } catch (e: unknown) {
      showFeedback(e instanceof Error ? e.message : "Erro.", "error");
    } finally { setLoading(null); }
  };

  const handleSair = async () => {
    if ((state !== "entered" && state !== "break_ended") || !todayRecord) return;
    const time = nowHHMM();
    setLoading("sair");
    try {
      await api.patchExit(todayRecord.id, { exit_time: time });
      showFeedback(`Saída registrada às ${time} ✓`, "success");
      loadRecords();
    } catch (e: unknown) {
      showFeedback(e instanceof Error ? e.message : "Erro.", "error");
    } finally { setLoading(null); }
  };

  const handleSaveNote = async () => {
    if (!todayRecord) return;
    if (noteDraft.length > NOTE_MAX) {
      showFeedback(`Observação excede ${NOTE_MAX} caracteres.`, "error");
      return;
    }
    setSavingNote(true);
    try {
      await api.patchNote(todayRecord.id, { note: noteDraft.trim() || null });
      showFeedback("Observação salva ✓", "success");
      loadRecords();
    } catch (e: unknown) {
      showFeedback(e instanceof Error ? e.message : "Erro.", "error");
    } finally { setSavingNote(false); }
  };

  const handleUploadFile = async (file: File) => {
    if (!todayRecord) return;
    if ((todayRecord.attachments?.length ?? 0) >= ATTACHMENTS_MAX) {
      showFeedback(`Limite de ${ATTACHMENTS_MAX} anexos atingido.`, "error");
      return;
    }
    setLoading("upload");
    try {
      await api.uploadAttachment(todayRecord.id, file);
      showFeedback(`"${file.name}" anexado ✓`, "success");
      loadRecords();
    } catch (e: unknown) {
      showFeedback(e instanceof Error ? e.message : "Erro ao enviar arquivo.", "error");
    } finally {
      setLoading(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAttachment = async (filename: string) => {
    if (!todayRecord) return;
    if (!confirm("Remover este anexo?")) return;
    setLoading("delete-att");
    try {
      await api.deleteAttachment(todayRecord.id, filename);
      showFeedback("Anexo removido ✓", "success");
      loadRecords();
    } catch (e: unknown) {
      showFeedback(e instanceof Error ? e.message : "Erro.", "error");
    } finally { setLoading(null); }
  };

  const handleChangePassword = async () => {
    setPassError("");
    setPassSuccess("");
    if (currentPass.length < 4) {
      setPassError("Informe sua senha atual.");
      return;
    }
    if (newPass.length < 4 || newPass.length > 8) {
      setPassError("Nova senha deve ter entre 4 e 8 caracteres.");
      return;
    }
    if (newPass !== confirmNewPass) {
      setPassError("As senhas não coincidem.");
      return;
    }
    setSavingPass(true);
    try {
      await api.changeEmployeePassword(employee.id, currentPass, newPass);
      setPassSuccess("Senha alterada com sucesso ✓");
      setCurrentPass("");
      setNewPass("");
      setConfirmNewPass("");
      setTimeout(() => {
        setShowChangePassword(false);
        setPassSuccess("");
      }, 1500);
    } catch (e: unknown) {
      setPassError(e instanceof Error ? e.message : "Erro.");
    } finally { setSavingPass(false); }
  };

  const liveWorked = todayRecord && state !== "none" && state !== "exited"
    ? calcWorked(todayRecord.entry_time ?? nowHHMM(), nowHHMM(), brkDuration(todayRecord.break_start, todayRecord.break_end))
    : todayRecord?.worked_minutes ?? null;
  const liveOT = liveWorked !== null ? liveWorked - stdMin : null;

  const buttons = [
    {
      id: "entrar",
      label: "Entrar",
      sublabel: state === "none" ? "toque para registrar entrada" : `registrado às ${todayRecord?.entry_time}`,
      active: state === "none",
      done: state !== "none",
      color: "var(--accent)",
      handler: handleEntrar,
      icon: clockInIconUrl,
      iconAlt: "Entrada",
    },
    {
      id: "break_start",
      label: "Iniciar Intervalo",
      sublabel: state === "entered" ? "toque para iniciar o intervalo" : todayRecord?.break_start ? `registrado às ${todayRecord.break_start}` : "disponível após entrada",
      active: state === "entered",
      done: ["break_started", "break_ended", "exited"].includes(state),
      color: "#4a9eff",
      handler: handleIniciarIntervalo,
      icon: breakInIconUrl,
      iconAlt: "Início do intervalo",
    },
    {
      id: "break_end",
      label: "Fim do Intervalo",
      sublabel: state === "break_started" ? "toque para encerrar o intervalo" : todayRecord?.break_end ? `registrado às ${todayRecord.break_end}` : "disponível após iniciar intervalo",
      active: state === "break_started",
      done: ["break_ended", "exited"].includes(state),
      color: "#4a9eff",
      handler: handleFimIntervalo,
      icon: breakOutIconUrl,
      iconAlt: "Fim do intervalo",
    },
    {
      id: "sair",
      label: "Sair",
      sublabel: state === "exited" ? `registrado às ${todayRecord?.exit_time}` : (state === "entered" || state === "break_ended") ? "toque para registrar saída" : "disponível após entrada",
      active: state === "entered" || state === "break_ended",
      done: state === "exited",
      color: "var(--accent2)",
      handler: handleSair,
      icon: clockOutIconUrl,
      iconAlt: "Saída",
    },
  ] as const;

  const attachments = todayRecord?.attachments ?? [];
  const noteChanged = (todayRecord?.note ?? "") !== noteDraft;

  return (
    <div className="shell">
      {/* HEADER NOVO — 3 colunas: LOGO grande | DATA/HORA centro | CONFIG/USUÁRIO direita */}
      <header className="emp-header">
        {/* Coluna esquerda: logo grande — botão invisível pra voltar ao início */}
        <div className="emp-header-logo">
          <button
            onClick={onLogout}
            title="Voltar ao início"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "block",
              lineHeight: 0,
            }}
            aria-label="Voltar ao menu inicial"
          >
            <img src={logoUrl} alt="Ponto Field — voltar ao início" />
          </button>
        </div>

        {/* Coluna central: data e hora */}
        <div className="emp-header-clock">
          <div className="clock-time">{fmtClock(now)}</div>
          <div className="clock-date">{fmtDateFull(now)}</div>
        </div>

        {/* Coluna direita: avatar único com menu de perfil */}
        <div className="emp-header-user" ref={menuRef}>
          <ThemeToggleCompact />
          <button
            className="avatar-btn"
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Menu do perfil"
            aria-expanded={menuOpen}
            title={employee.name}
          >
            <Avatar name={employee.name} src={photoUrl} size={52} />
            <span className={`avatar-caret${menuOpen ? " open" : ""}`}>⌄</span>
          </button>

          {menuOpen && (
            <div className="profile-menu">
              <div className="profile-menu-head">
                <Avatar name={employee.name} src={photoUrl} size={46} />
                <div className="profile-menu-id">
                  <div className="profile-menu-name">{employee.name}</div>
                  <div className="profile-menu-role">Colaborador</div>
                </div>
              </div>
              <div className="profile-menu-sep" />
              <button
                className="config-menu-item"
                onClick={() => { setShowProfile(true); setMenuOpen(false); }}
              >
                👤 Gerenciar perfil
              </button>
              <button
                className="config-menu-item"
                onClick={() => { setShowChangePassword(true); setMenuOpen(false); }}
              >
                🔑 Alterar senha
              </button>
              <div className="profile-menu-sep" />
              <button
                className="config-menu-item config-menu-item-danger"
                onClick={() => { setMenuOpen(false); onLogout(); }}
              >
                🚪 Sair
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="tabs">
        <button className={`tab${tab === "ponto" ? " active" : ""}`} onClick={() => setTab("ponto")}>Bater Ponto</button>
        <button className={`tab${tab === "espelho" ? " active" : ""}`} onClick={() => setTab("espelho")}>Meu Espelho</button>
        <button className={`tab${tab === "registros" ? " active" : ""}`} onClick={() => setTab("registros")}>Meus Registros</button>
        <button className={`tab${tab === "atividades" ? " active" : ""}`} onClick={() => setTab("atividades")}>Atividades</button>
      </div>

      {tab === "espelho" && <MeuEspelho employeeId={employee.id} />}

      {tab === "atividades" && (
        <div className="card">
          <div className="card-title">Minhas atividades — {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</div>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: -6, marginBottom: 14 }}>
            Histórico das ações do mês atual relacionadas aos seus registros (suas e do gestor).
          </p>
          <ActivityFeed entries={activities} loading={activitiesLoading} emptyText="Nenhuma atividade sua neste mês." />
        </div>
      )}

      {tab === "ponto" && (
        <div>
          {feedback && <div className={`alert alert-${feedback.type}`} style={{ marginBottom: 16 }}>{feedback.msg}</div>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
            {buttons.map(btn => (
              <button
                key={btn.id}
                onClick={btn.handler}
                disabled={!btn.active || loading !== null}
                style={{
                  padding: "28px 20px",
                  borderRadius: 16,
                  border: btn.done ? `1px solid ${btn.color}40` : btn.active ? `2px solid ${btn.color}` : "1px solid var(--border)",
                  background: btn.done ? `${btn.color}10` : btn.active ? `${btn.color}18` : "var(--surface)",
                  cursor: btn.active && loading === null ? "pointer" : "default",
                  transition: "all 0.15s",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  fontFamily: "var(--font)",
                }}
                onMouseEnter={e => { if (btn.active && loading === null) e.currentTarget.style.transform = "scale(1.02)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
                onMouseDown={e => { if (btn.active) e.currentTarget.style.transform = "scale(0.97)"; }}
                onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
              >
                <div style={{ minHeight: 42, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {loading === btn.id ? <span style={{ fontSize: 28 }}>⏳</span> : btn.done ? <span style={{ fontSize: 28 }}>✅</span> : <ActionIcon src={btn.icon} alt={btn.iconAlt} muted={!btn.active} />}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: btn.done || btn.active ? btn.color : "var(--muted)" }}>{btn.label}</div>
                <div style={{ fontSize: 11, color: btn.done ? btn.color : "var(--muted)", textAlign: "center", lineHeight: 1.4 }}>{loading === btn.id ? "registrando…" : btn.sublabel}</div>
              </button>
            ))}
          </div>

          {todayRecord && (
            <>
              <div className="card">
                <div className="card-title">Resumo de hoje</div>
                <div className="stats-grid">
                  <div className="stat"><div className="stat-label">Entrada</div><div className="stat-value mono">{todayRecord.entry_time}</div></div>
                  <div className="stat"><div className="stat-label">Início do intervalo</div><div className="stat-value mono">{todayRecord.break_start ?? "—"}</div></div>
                  <div className="stat"><div className="stat-label">Fim do intervalo</div><div className="stat-value mono">{todayRecord.break_end ?? "—"}</div></div>
                  <div className="stat"><div className="stat-label">Saída</div><div className="stat-value mono">{todayRecord.exit_time ?? "—"}</div></div>
                  <div className="stat"><div className="stat-label">Horas trabalhadas</div><div className="stat-value mono">{liveWorked !== null ? fmtMinUnsigned(liveWorked) : "—"}</div></div>
                  <div className="stat"><div className="stat-label">Saldo do dia</div><div className={`stat-value ${liveOT !== null ? (liveOT >= 0 ? "pos" : "neg") : ""}`}>{liveOT !== null ? fmtMin(liveOT) : "—"}</div></div>
                </div>
              </div>

              {/* CARD DE OBSERVAÇÕES + ANEXOS */}
              <div className="card">
                <div className="card-title">Observações e anexos</div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label>
                    Observação <span style={{ color: "var(--muted)", fontWeight: 400 }}>({noteDraft.length}/{NOTE_MAX})</span>
                  </label>
                  <textarea
                    value={noteDraft}
                    onChange={e => setNoteDraft(e.target.value.slice(0, NOTE_MAX))}
                    placeholder="Adicione observações sobre o dia (até 500 caracteres)…"
                    maxLength={NOTE_MAX}
                    rows={4}
                    style={{ resize: "vertical" }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveNote}
                    disabled={savingNote || !noteChanged}
                    style={{ opacity: !noteChanged ? 0.6 : 1 }}
                  >
                    {savingNote ? "Salvando…" : "💾 Salvar observação"}
                  </button>
                  {noteChanged && (
                    <span style={{ fontSize: 12, color: "var(--accent2)" }}>• alterações não salvas</span>
                  )}
                </div>

                <div className="form-group">
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
                            disabled={loading !== null}
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
                        disabled={loading === "upload"}
                      >
                        {loading === "upload" ? "⏳ enviando…" : "📎 Adicionar anexo"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "registros" && (
        <>
        <RetroLaunch employeeId={employee.id} onDone={loadRecords} />
        <div className="card">
          <div className="card-title">Meus registros</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Entrada</th>
                  <th>Início intervalo</th>
                  <th>Fim intervalo</th>
                  <th>Saída</th>
                  <th>Trabalhadas</th>
                  <th>Saldo</th>
                  <th>Status</th>
                  <th>Obs.</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr><td colSpan={10} className="empty">Nenhum registro encontrado.</td></tr>
                ) : (
                  [...records].sort((a, b) => b.date.localeCompare(a.date)).map(r => (
                    <tr key={r.id}>
                      <td>{fmtDate(r.date)}</td>
                      <td className="mono">{r.entry_time ?? "—"}</td>
                      <td className="mono">{r.break_start ?? "—"}</td>
                      <td className="mono">{r.break_end ?? "—"}</td>
                      <td className="mono">{r.exit_time ?? "—"}</td>
                      <td className="mono">{r.worked_minutes !== null ? fmtMinUnsigned(r.worked_minutes) : "—"}</td>
                      <td>{r.overtime_minutes !== null ? <Badge minutes={r.overtime_minutes} /> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                      <td>
                        {r.removal_requested
                          ? <span className="tag-status reprovado" style={{ whiteSpace: "nowrap" }}>Exclusão solicitada</span>
                          : (r.abono_code || r.status !== "aprovado") ? <StatusPill status={r.status} /> : <span style={{ color: "var(--muted)" }}>—</span>}
                      </td>
                      <td style={{ maxWidth: 200 }}>
                        {r.note && (
                          <div title={r.note} style={{ fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: r.attachments.length > 0 ? 6 : 0 }}>
                            📝 {r.note}
                          </div>
                        )}
                        {r.attachments.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {r.attachments.map((filename, idx) => {
                              const url = api.attachmentUrl(filename);
                              if (isImage(filename)) {
                                return (
                                  <button
                                    key={filename}
                                    onClick={() => setLightbox({ url, filename })}
                                    title="Ver imagem"
                                    style={{ padding: 0, border: "2px solid var(--border2)", borderRadius: 8, cursor: "zoom-in", background: "none", overflow: "hidden", width: 48, height: 48, flexShrink: 0 }}
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
                                    📄 PDF
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
                        {!r.note && r.attachments.length === 0 && <span style={{ color: "var(--muted)" }}>—</span>}
                      </td>
                      <td>
                        {r.removal_requested ? (
                          <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>aguardando gestor</span>
                        ) : (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" disabled={rowBusyId === r.id} onClick={() => setEditingRecord(r)} title="Solicitar edição">✎</button>
                            <button className="btn btn-danger btn-sm" disabled={rowBusyId === r.id} onClick={() => requestRemove(r)} title="Solicitar exclusão">🗑</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {/* MODAL: GERENCIAR PERFIL */}
      {showProfile && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(11, 21, 38, 0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 16,
          }}
          onClick={() => setShowProfile(false)}
        >
          <div onClick={e => e.stopPropagation()} className="profile-modal">
            <div className="profile-modal-head">
              <span>👤 Meu perfil</span>
              <button
                onClick={() => setShowProfile(false)}
                style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--muted)", fontFamily: "var(--font)" }}
                aria-label="Fechar"
              >✕</button>
            </div>

            <div className="profile-modal-avatar">
              <Avatar name={employee.name} src={photoUrl} size={116} />
              <button
                type="button"
                className="profile-avatar-edit"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoBusy}
                title="Trocar foto"
                aria-label="Trocar foto"
              >
                {photoBusy ? "⏳" : "📷"}
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/heic,.png,.jpg,.jpeg,.webp,.gif,.heic"
                style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadPhoto(f); }}
              />
            </div>

            <div className="profile-modal-name">{employee.name}</div>
            <div className="profile-modal-role">Colaborador</div>

            <div className="profile-modal-actions">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoBusy}
              >
                {photoBusy ? "⏳ enviando…" : me?.photo ? "📷 Trocar foto" : "📷 Adicionar foto"}
              </button>
              {me?.photo && (
                <button className="btn btn-danger btn-sm" onClick={handleRemovePhoto} disabled={photoBusy}>
                  Remover foto
                </button>
              )}
            </div>

            <p className="profile-modal-hint">
              JPG, PNG, WEBP ou GIF — até 5 MB. A imagem aparece no seu avatar e nos menus.
            </p>

            <div className="profile-modal-sep" />

            {(() => {
              const rows: { label: string; value: string | null | undefined }[] = [
                { label: "Cargo", value: me?.role },
                { label: "Admissão", value: me?.hire_date ? me.hire_date.split("-").reverse().join("/") : null },
                { label: "Departamento", value: me?.department },
                { label: "Matrícula", value: me?.registration },
                { label: "E-mail", value: me?.email },
                { label: "Telefone", value: me?.phone },
                { label: "Contrato", value: me?.contract_type },
              ].filter(r => r.value);
              return (
                <div className="profile-data">
                  <div className="profile-data-title">Dados do colaborador</div>
                  {rows.length === 0 ? (
                    <p className="profile-modal-hint" style={{ margin: 0 }}>
                      Nenhum dado cadastrado ainda — fale com o gestor para preencher cargo, admissão e contato.
                    </p>
                  ) : (
                    <dl className="profile-data-list">
                      {rows.map(r => (
                        <div className="profile-data-row" key={r.label}>
                          <dt>{r.label}</dt>
                          <dd>{r.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              );
            })()}

            <div className="profile-modal-sep" />

            <button
              className="config-menu-item"
              style={{ borderRadius: 10 }}
              onClick={() => { setShowProfile(false); setShowChangePassword(true); }}
            >
              🔑 Alterar senha
            </button>
          </div>
        </div>
      )}

      {/* MODAL: ALTERAR SENHA */}
      {showChangePassword && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(11, 21, 38, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setShowChangePassword(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--surface)",
              borderRadius: 16,
              padding: 28,
              width: "100%",
              maxWidth: 380,
              boxShadow: "var(--shadow-md)",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 18, color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>🔑 Alterar senha</span>
              <button
                onClick={() => setShowChangePassword(false)}
                style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--muted)", fontFamily: "var(--font)" }}
                aria-label="Fechar"
              >✕</button>
            </div>

            <input type="text" name="username" value={employee.name} readOnly autoComplete="username" style={{ display: "none" }} />

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Senha atual</label>
              <input
                type="password"
                value={currentPass}
                onChange={e => { setCurrentPass(e.target.value.slice(0, 8)); setPassError(""); }}
                placeholder="Digite a senha atual"
                autoComplete="current-password"
                maxLength={8}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Nova senha (4 a 8 caracteres)</label>
              <input
                type="password"
                value={newPass}
                onChange={e => { setNewPass(e.target.value.slice(0, 8)); setPassError(""); }}
                placeholder="Nova senha"
                autoComplete="new-password"
                maxLength={8}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Confirme a nova senha</label>
              <input
                type="password"
                value={confirmNewPass}
                onChange={e => { setConfirmNewPass(e.target.value.slice(0, 8)); setPassError(""); }}
                placeholder="Repita a nova senha"
                autoComplete="new-password"
                maxLength={8}
                onKeyDown={e => e.key === "Enter" && handleChangePassword()}
              />
            </div>

            {passError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{passError}</div>}
            {passSuccess && <div className="alert alert-success" style={{ marginBottom: 12 }}>{passSuccess}</div>}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowChangePassword(false)}
              >Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={handleChangePassword}
                disabled={savingPass}
              >
                {savingPass ? "Alterando…" : "Alterar senha"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingRecord && (
        <EditRecordModal
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSaved={onRecordEdited}
        />
      )}

      {lightbox && (
        <ImageLightbox url={lightbox.url} filename={lightbox.filename} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
