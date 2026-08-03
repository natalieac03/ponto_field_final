import { useEffect, useRef, useState } from "react";
import { api, setAuthToken, setOnUnauthorized } from "./api/client";
import { useThemedAssets } from "./assets";
import { Avatar } from "./components/Avatar";
import { ThemeToggleCompact } from "./components/ThemeToggle";
import { BancoHoras } from "./pages/BancoHoras";
import { Calendario } from "./pages/Calendario";
import { RelatorioFerias } from "./pages/RelatorioFerias";
import { Configuracoes } from "./pages/Configuracoes";
import { EmployeePortal } from "./pages/EmployeePortal";
import { Landing } from "./pages/Landing";
import { RelatorioMensal } from "./pages/RelatorioMensal";
import { PendingApprovals } from "./features/approvals/PendingApprovals";
import { AdminActivity } from "./features/activity/AdminActivity";
import type { Employee, Session, Settings } from "./types";

type AdminTab = "banco" | "aprovacoes" | "atividades" | "relatorio" | "ferias" | "calendario" | "config";

function fmtClock(d: Date) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDateFull(d: Date) {
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const SESSION_KEY = "ponto_field_session";
function loadStoredSession(): Session {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch { return null; }
}

export default function App() {
  const { logoUrl } = useThemedAssets();
  const [session, setSession] = useState<Session>(loadStoredSession);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [adminTab, setAdminTab] = useState<AdminTab>("banco");
  const [pendingCount, setPendingCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const now = useNow();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const loadEmployees = () => api.getEmployees().then(setEmployees).catch(console.error);
  const loadSettings  = () => api.getSettings().then(setSettings).catch(console.error);
  const loadPending   = () => api.getPendingRecords().then(rs => setPendingCount(rs.length)).catch(() => setPendingCount(0));

  // Settings é público (o app lê std/h1/h2). Employees agora é restrito ao admin.
  useEffect(() => {
    loadSettings();
  }, []);

  // Carrega a lista completa e a fila de pendentes só quando é admin (endpoints restritos).
  useEffect(() => {
    if (session?.role === "admin") {
      loadEmployees();
      loadPending();
    }
  }, [session?.role]);

  // Persiste a sessão (sobrevive a refresh) — o token fica no client (localStorage).
  useEffect(() => {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }, [session]);

  // Se a API rejeitar o token (401 — expirado/inválido), volta pra landing.
  useEffect(() => {
    setOnUnauthorized(() => {
      setSession(null);
      setMenuOpen(false);
      localStorage.removeItem(SESSION_KEY);
    });
    return () => setOnUnauthorized(null);
  }, []);

  // ── History API ─────────────────────────────────────────────────────────
  // Quando o usuário navega pra dentro do app, empurra uma entrada no histórico.
  // O botão Voltar do navegador dispara `popstate` e volta pra landing.
  useEffect(() => {
    // Estado inicial: landing (sem entry no history)
    window.history.replaceState({ page: "landing" }, "", window.location.pathname);
  }, []);

  // Empurra history quando entra numa sessão
  useEffect(() => {
    if (session) {
      window.history.pushState({ page: session.role }, "", window.location.pathname);
    }
  }, [session?.role]);

  // Escuta o botão Voltar do navegador
  useEffect(() => {
    const handler = (e: PopStateEvent) => {
      const page = (e.state as { page?: string } | null)?.page;
      if (page === "landing" || !page) {
        // volta pra landing sem chamar handleLogout (pra não fazer pushState de novo)
        setSession(null);
        setMenuOpen(false);
        setAuthToken(null);
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleEmployeeLogin = (emp: { id: number; name: string }) => {
    setSession({ role: "employee", employee: emp });
  };

  const handleAdminLogin = (info: { name: string; employeeId: number | null }) => {
    setSession({ role: "admin", name: info.name, employeeId: info.employeeId });
    loadEmployees();
    loadSettings();
  };

  const handleLogout = () => {
    setSession(null);
    setMenuOpen(false);
    setAuthToken(null);
    // Volta ao topo do histórico (landing)
    window.history.pushState({ page: "landing" }, "", window.location.pathname);
  };

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

  // ── Employee portal ───────────────────────────────────────────────────────
  if (session?.role === "employee") {
    return <EmployeePortal employee={session.employee} onLogout={handleLogout} />;
  }

  // ── Admin panel ───────────────────────────────────────────────────────────
  if (session?.role === "admin") {
    return (
      <div className="shell">
        <header className="emp-header">
          {/* Logo invisível como botão de voltar */}
          <div className="emp-header-logo">
            <button
              onClick={handleLogout}
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
              <img src={logoUrl} alt="Ponto Field — voltar ao início" style={{ width: "100%", maxWidth: 240, height: "auto", display: "block" }} />
            </button>
          </div>

          <div className="emp-header-clock">
            <div className="clock-time">{fmtClock(now)}</div>
            <div className="clock-date">{fmtDateFull(now)}</div>
          </div>

          <div className="emp-header-user" ref={menuRef}>
            <ThemeToggleCompact />
            <button
              className="avatar-btn"
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Menu do administrador"
              aria-expanded={menuOpen}
              title={session.name}
            >
              <Avatar name={session.name} size={52} />
              <span className={`avatar-caret${menuOpen ? " open" : ""}`}>⌄</span>
            </button>

            {menuOpen && (
              <div className="profile-menu">
                <div className="profile-menu-head">
                  <Avatar name={session.name} size={46} />
                  <div className="profile-menu-id">
                    <div className="profile-menu-name">Administrador</div>
                    <div className="profile-menu-role">Gestor</div>
                  </div>
                </div>
                <div className="profile-menu-sep" />
                <button
                  className="config-menu-item"
                  onClick={() => { setAdminTab("config"); setMenuOpen(false); }}
                >
                  🔑 Alterar senha
                </button>
                <div className="profile-menu-sep" />
                <button className="config-menu-item config-menu-item-danger" onClick={handleLogout}>
                  🚪 Sair
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="tabs">
          <button className={`tab${adminTab === "banco"      ? " active" : ""}`} onClick={() => setAdminTab("banco")}>Banco de Horas</button>
          <button className={`tab${adminTab === "aprovacoes" ? " active" : ""}`} onClick={() => setAdminTab("aprovacoes")}>
            Aprovações
            {pendingCount > 0 && (
              <span className="tab-badge">{pendingCount}</span>
            )}
          </button>
          <button className={`tab${adminTab === "atividades" ? " active" : ""}`} onClick={() => setAdminTab("atividades")}>Atividades</button>
          <button className={`tab${adminTab === "relatorio"  ? " active" : ""}`} onClick={() => setAdminTab("relatorio")}>Relatório Mensal</button>
          <button className={`tab${adminTab === "ferias"     ? " active" : ""}`} onClick={() => setAdminTab("ferias")}>Férias</button>
          <button className={`tab${adminTab === "calendario" ? " active" : ""}`} onClick={() => setAdminTab("calendario")}>Calendário</button>
          <button className={`tab${adminTab === "config"     ? " active" : ""}`} onClick={() => setAdminTab("config")}>Configurações</button>
        </div>

        {adminTab === "banco"      && <BancoHoras />}
        {adminTab === "ferias"     && <RelatorioFerias />}
        {adminTab === "calendario" && <Calendario />}
        {adminTab === "aprovacoes" && <PendingApprovals employees={employees} onChanged={loadPending} />}
        {adminTab === "atividades" && <AdminActivity />}
        {adminTab === "relatorio"  && <RelatorioMensal />}
        {adminTab === "config"     && (
          <Configuracoes
            employees={employees}
            settings={settings}
            onEmployeesChanged={loadEmployees}
            onSettingsChanged={s => setSettings(s)}
          />
        )}
      </div>
    );
  }

  // ── Landing ───────────────────────────────────────────────────────────────
  return <Landing onEmployeeLogin={handleEmployeeLogin} onAdminLogin={handleAdminLogin} />;
}
