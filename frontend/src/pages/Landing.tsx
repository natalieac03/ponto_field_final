import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "../api/client";
import { useThemedAssets } from "../assets";
import type { Employee } from "../types";

/** A landing só precisa de id/nome/tem-senha (endpoint público mínimo). */
type LandingEmployee = Pick<Employee, "id" | "name" | "has_password">;

interface Props {
  onEmployeeLogin: (emp: { id: number; name: string }) => void;
  onAdminLogin: (info: { name: string; employeeId: number | null }) => void;
}

type View = "choose" | "employee" | "admin";

/** Normaliza texto p/ busca: remove acentos e caixa. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function ChoiceIcon({ src, alt, tint }: { src: string; alt: string; tint: string }) {
  return (
    <div className="landing-choice-icon" style={{ background: tint }}>
      <img src={src} alt={alt} />
    </div>
  );
}

export function Landing({ onEmployeeLogin, onAdminLogin }: Props) {
  const { adminIconUrl, employeeIconUrl, landingTopImageUrl, logoUrl } = useThemedAssets();
  const [view, setView] = useState<View>("choose");
  const [employees, setEmployees] = useState<LandingEmployee[]>([]);
  const [search, setSearch] = useState("");
  const [selectedEmp, setSelectedEmp] = useState<LandingEmployee | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Fluxo de definir senha pela primeira vez
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [adminPass, setAdminPass] = useState("");
  const [showAdminPass, setShowAdminPass] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const chooseRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const clearError = () => setError("");

  const filteredEmployees = useMemo(() => {
    const sorted = [...employees].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
    );
    if (!search.trim()) return sorted;
    const q = normalize(search);
    return sorted.filter(e => normalize(e.name).includes(q));
  }, [employees, search]);

  useEffect(() => {
    api.getPublicEmployees().then(setEmployees).catch(() => setError("Não foi possível conectar ao servidor."));
  }, []);

  useEffect(() => {
    if (view === "choose") chooseRefs.current[0]?.focus();
    if (view === "employee" && !selectedEmp) searchInputRef.current?.focus();
    if (view === "employee" && selectedEmp && !needsPasswordSetup) passwordInputRef.current?.focus();
  }, [view, selectedEmp, needsPasswordSetup]);

  const selectEmployee = (emp: LandingEmployee) => {
    setSelectedEmp(emp);
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setNeedsPasswordSetup(!emp.has_password);
    clearError();
  };

  const backToList = () => {
    setSelectedEmp(null);
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setNeedsPasswordSetup(false);
    clearError();
  };

  const handleEmployeeLogin = async () => {
    if (!selectedEmp) return;
    if (password.length < 4 || password.length > 8) {
      setError("Senha deve ter entre 4 e 8 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const result = await api.authEmployee(selectedEmp.id, password);
      onEmployeeLogin(result);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 428) {
        // Backend sinalizou que o colab ainda não tem senha
        setNeedsPasswordSetup(true);
        setError("");
      } else {
        setError(e instanceof Error ? e.message : "Erro.");
        setPassword("");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async () => {
    if (!selectedEmp) return;
    if (newPassword.length < 4 || newPassword.length > 8) {
      setError("Senha deve ter entre 4 e 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      await api.setEmployeePassword(selectedEmp.id, newPassword);
      // Já loga automaticamente
      const result = await api.authEmployee(selectedEmp.id, newPassword);
      onEmployeeLogin(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    if (!adminPass.trim()) {
      setError("Informe a senha.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.authAdmin(adminPass);
      onAdminLogin({ name: res.name, employeeId: res.employeeId });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro.");
      setAdminPass("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-page">
      <div className="landing-brand">
        <img
          src={landingTopImageUrl}
          alt=""
          style={{ width: 320, maxWidth: "32vw", height: "auto", display: "block", margin: "0 auto 18px" }}
        />
        <img
          src={logoUrl}
          alt="Ponto Field"
          style={{ width: 220, maxWidth: "72vw", height: "auto", display: "block", margin: "0 auto" }}
        />
      </div>

      {view === "choose" && (
        <div className="landing-choices">
          <button
            ref={el => { chooseRefs.current[0] = el; }}
            onClick={() => { setView("employee"); clearError(); }}
            onKeyDown={e => {
              if (e.key === "ArrowRight") { e.preventDefault(); chooseRefs.current[1]?.focus(); }
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setView("employee"); clearError(); }
            }}
            className="landing-choice"
          >
            <ChoiceIcon src={employeeIconUrl} alt="Colaborador" tint="rgba(37,99,235,0.1)" />
            <div className="landing-choice-title" style={{ color: "var(--accent)" }}>Colaborador</div>
            <div className="landing-choice-sub">Bater ponto e ver meus registros</div>
          </button>

          <button
            ref={el => { chooseRefs.current[1] = el; }}
            onClick={() => { setView("admin"); clearError(); }}
            onKeyDown={e => {
              if (e.key === "ArrowLeft") { e.preventDefault(); chooseRefs.current[0]?.focus(); }
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setView("admin"); clearError(); }
            }}
            className="landing-choice"
          >
            <ChoiceIcon src={adminIconUrl} alt="Administrador" tint="rgba(22,63,149,0.1)" />
            <div className="landing-choice-title" style={{ color: "var(--accent2)" }}>Administrador</div>
            <div className="landing-choice-sub">Banco de horas e relatórios</div>
          </button>
        </div>
      )}

      {view === "employee" && (
        <div className="landing-panel" style={{ maxWidth: 380 }}>
          <div className="landing-card">
            {!selectedEmp ? (
              <>
                <div className="landing-eyebrow">
                  Quem é você?
                </div>

                <div style={{ position: "relative", marginBottom: 14 }}>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Digite seu nome…"
                    autoComplete="off"
                    style={{ paddingLeft: 36 }}
                    onKeyDown={e => {
                      if (e.key === "Enter" && filteredEmployees.length === 1) {
                        e.preventDefault();
                        selectEmployee(filteredEmployees[0]);
                      }
                    }}
                  />
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none", fontSize: 14 }}>🔍</span>
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="landing-icon-btn"
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14 }}
                      aria-label="Limpar"
                    >✕</button>
                  )}
                </div>

                {employees.length === 0 ? (
                  <p style={{ color: "var(--muted)", fontSize: 13 }}>Nenhum colaborador cadastrado.</p>
                ) : filteredEmployees.length === 0 ? (
                  <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
                    Nenhum colaborador encontrado para "<strong>{search}</strong>".
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto", paddingRight: 4 }}>
                    {filteredEmployees.map(emp => (
                      <button
                        key={emp.id}
                        onClick={() => selectEmployee(emp)}
                        className="landing-emp-item"
                      >
                        <span>{emp.name}</span>
                        {!emp.has_password && <span style={{ fontSize: 10, color: "var(--accent2)", fontWeight: 600 }}>1º acesso</span>}
                      </button>
                    ))}
                  </div>
                )}
                {error && <div style={{ fontSize: 12, color: "var(--danger)", textAlign: "center", marginTop: 12 }}>{error}</div>}
              </>
            ) : needsPasswordSetup ? (
              <>
                <div style={{ textAlign: "center", marginBottom: 18 }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedEmp.name}</div>
                  <div style={{ fontSize: 12, color: "var(--accent2)", marginTop: 4, fontWeight: 600 }}>
                    👋 Primeiro acesso — crie sua senha
                  </div>
                  <button onClick={backToList} className="landing-link" style={{ marginTop: 6 }}>← trocar</button>
                </div>

                {/* Form com autocomplete — usuário invisível p/ o navegador associar */}
                <input type="text" name="username" value={selectedEmp.name} readOnly autoComplete="username" style={{ display: "none" }} />

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label>Nova senha (4 a 8 caracteres)</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value.slice(0, 8)); clearError(); }}
                    placeholder="Crie uma senha"
                    autoComplete="new-password"
                    maxLength={8}
                    onKeyDown={e => e.key === "Enter" && handleSetPassword()}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label>Confirme a senha</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value.slice(0, 8)); clearError(); }}
                    placeholder="Repita a senha"
                    autoComplete="new-password"
                    maxLength={8}
                    onKeyDown={e => e.key === "Enter" && handleSetPassword()}
                  />
                </div>

                {error && <div style={{ fontSize: 12, color: "var(--danger)", textAlign: "center", marginBottom: 10 }}>{error}</div>}

                <button
                  onClick={handleSetPassword}
                  disabled={loading || newPassword.length < 4 || newPassword !== confirmPassword}
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "12px" }}
                >
                  {loading ? "Criando…" : "Criar senha e entrar →"}
                </button>
              </>
            ) : (
              <>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedEmp.name}</div>
                  <button onClick={backToList} className="landing-link" style={{ marginTop: 4 }}>← trocar</button>
                </div>

                {/* Form layout autocomplete-friendly */}
                <input type="text" name="username" value={selectedEmp.name} readOnly autoComplete="username" style={{ display: "none" }} />

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Senha</label>
                  <div style={{ position: "relative" }}>
                    <input
                      ref={passwordInputRef}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => { setPassword(e.target.value.slice(0, 8)); clearError(); }}
                      placeholder="Sua senha (4–8 caracteres)"
                      autoComplete="current-password"
                      maxLength={8}
                      onKeyDown={e => e.key === "Enter" && handleEmployeeLogin()}
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      onClick={() => setShowPassword(v => !v)}
                      className="landing-icon-btn"
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14 }}
                      aria-label="Mostrar/esconder senha"
                    >
                      {showPassword ? "🙈" : "👁"}
                    </button>
                  </div>
                </div>

                {error && <div style={{ fontSize: 12, color: "var(--danger)", textAlign: "center", marginBottom: 10 }}>{error}</div>}

                <button
                  onClick={handleEmployeeLogin}
                  disabled={loading || password.length < 4}
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "12px" }}
                >
                  {loading ? "Verificando…" : "Entrar →"}
                </button>
              </>
            )}
          </div>

          <button
            onClick={() => { setView("choose"); backToList(); setSearch(""); }}
            className="landing-link"
            style={{ marginTop: 16 }}
          >
            ← voltar
          </button>
        </div>
      )}

      {view === "admin" && (
        <div className="landing-panel" style={{ maxWidth: 340 }}>
          <div className="landing-card">
            <div className="landing-eyebrow">Área Administrativa</div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Senha</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showAdminPass ? "text" : "password"}
                  placeholder="Digite a senha"
                  value={adminPass}
                  onChange={e => { setAdminPass(e.target.value); clearError(); }}
                  onKeyDown={e => e.key === "Enter" && handleAdminLogin()}
                  autoComplete="current-password"
                  autoFocus
                  style={{ paddingRight: 40 }}
                />
                <button
                  onClick={() => setShowAdminPass(v => !v)}
                  className="landing-icon-btn"
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14 }}
                  aria-label="Mostrar/esconder senha"
                >{showAdminPass ? "🙈" : "👁"}</button>
              </div>
            </div>
            {error && <div style={{ fontSize: 12, color: "var(--danger)", marginBottom: 10 }}>{error}</div>}
            <button onClick={handleAdminLogin} disabled={loading} className="btn btn-primary" style={{ width: "100%", padding: "12px" }}>
              {loading ? "Verificando…" : "Acessar Painel →"}
            </button>
          </div>

          <button onClick={() => { setView("choose"); setAdminPass(""); clearError(); }} className="landing-link" style={{ marginTop: 16 }}>← voltar</button>
        </div>
      )}
    </div>
  );
}
