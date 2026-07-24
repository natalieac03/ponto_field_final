import { useEffect, useRef, useState } from "react";
import { api } from "./api/client";
import { adminIconUrl, logoUrl } from "./assets";
import { BancoHoras } from "./pages/BancoHoras";
import { Calendario } from "./pages/Calendario";
import { Configuracoes } from "./pages/Configuracoes";
import { EmployeePortal } from "./pages/EmployeePortal";
import { Landing } from "./pages/Landing";
import { RelatorioMensal } from "./pages/RelatorioMensal";
import type { Employee, Session, Settings } from "./types";

type AdminTab = "banco" | "relatorio" | "calendario" | "config";

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

export default function App() {
  const [session, setSession] = useState<Session>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [adminTab, setAdminTab] = useState<AdminTab>("banco");
  const [menuOpen, setMenuOpen] = useState(false);
  const now = useNow();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const loadEmployees = () => api.getEmployees().then(setEmployees).catch(console.error);
  const loadSettings  = () => api.getSettings().then(setSettings).catch(console.error);

  useEffect(() => {
    loadEmployees();
    loadSettings();
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
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleEmployeeLogin = (emp: { id: number; name: string }) => {
    setSession({ role: "employee", employee: emp });
  };

  const handleAdminLogin = () => {
    setSession({ role: "admin" });
    loadEmployees();
    loadSettings();
  };

  const handleLogout = () => {
    setSession(null);
    setMenuOpen(false);
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
            <div className="user-info">
              <img src={adminIconUrl} alt="Administrador" className="user-avatar" />
              <div className="user-name" style={{ color: "var(--accent2)" }}>Administrador</div>
            </div>
            <button className="config-btn" onClick={() => setMenuOpen(v => !v)} aria-label="Configurações">⚙️</button>
            {menuOpen && (
              <div className="config-menu">
                <button className="config-menu-item config-menu-item-danger" onClick={handleLogout}>
                  🚪 Sair
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="tabs">
          <button className={`tab${adminTab === "banco"     ? " active" : ""}`} onClick={() => setAdminTab("banco")}>Banco de Horas</button>
          <button className={`tab${adminTab === "relatorio" ? " active" : ""}`} onClick={() => setAdminTab("relatorio")}>Relatório Mensal</button>
          <button className={`tab${adminTab === "calendario" ? " active" : ""}`} onClick={() => setAdminTab("calendario")}>Calendário</button>
          <button className={`tab${adminTab === "config"    ? " active" : ""}`} onClick={() => setAdminTab("config")}>Configurações</button>
        </div>

        {adminTab === "banco"     && <BancoHoras />}
        {adminTab === "relatorio" && <RelatorioMensal />}
        {adminTab === "calendario" && <Calendario />}
        {adminTab === "config"    && (
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
