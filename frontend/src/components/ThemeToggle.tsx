import { useThemeMode } from "../hooks/useThemeMode";
import type { ThemeMode } from "../theme";

const OPTIONS: { mode: ThemeMode; icon: string; label: string }[] = [
  { mode: "light", icon: "☀️", label: "Claro" },
  { mode: "dark", icon: "🌙", label: "Escuro" },
  { mode: "auto", icon: "💻", label: "Auto" },
];

/** Seletor compacto (só ícones) — fica no header, ao lado do avatar. */
export function ThemeToggleCompact() {
  const [mode, , setMode] = useThemeMode();
  return (
    <div className="theme-toggle-compact" role="group" aria-label="Tema da interface">
      {OPTIONS.map(o => (
        <button
          key={o.mode}
          type="button"
          className={`theme-seg-compact${mode === o.mode ? " active" : ""}`}
          onClick={() => setMode(o.mode)}
          aria-pressed={mode === o.mode}
          title={`Tema ${o.label.toLowerCase()}`}
        >
          <span aria-hidden="true">{o.icon}</span>
        </button>
      ))}
    </div>
  );
}

/** Seletor de tema (claro / escuro / automático) com rótulos. */
export function ThemeToggle() {
  const [mode, , setMode] = useThemeMode();
  return (
    <div className="theme-toggle" role="group" aria-label="Tema da interface">
      <span className="theme-toggle-label">Tema</span>
      <div className="theme-toggle-seg">
        {OPTIONS.map(o => (
          <button
            key={o.mode}
            type="button"
            className={`theme-seg${mode === o.mode ? " active" : ""}`}
            onClick={() => setMode(o.mode)}
            aria-pressed={mode === o.mode}
            title={o.label}
          >
            <span aria-hidden="true">{o.icon}</span>
            <span className="theme-seg-text">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
