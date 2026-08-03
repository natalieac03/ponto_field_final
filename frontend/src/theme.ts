// Tema claro/escuro do app.
// Modo persistido pelo usuário: "auto" segue o sistema; "light"/"dark" fixam.
// O tema RESOLVIDO (light|dark) é aplicado como data-theme na <html>, e é a
// única fonte de verdade — o CSS reage só a [data-theme="dark"].

export type ThemeMode = "light" | "dark" | "auto";
export type ResolvedTheme = "light" | "dark";

const KEY = "ponto_field_theme";
const mql =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

export function getThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch { /* localStorage indisponível → auto */ }
  return "auto";
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "auto") return mql?.matches ? "dark" : "light";
  return mode;
}

function apply(mode: ThemeMode) {
  const resolved = resolveTheme(mode);
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.style.colorScheme = resolved;
}

export function setThemeMode(mode: ThemeMode) {
  try { localStorage.setItem(KEY, mode); } catch { /* ignore */ }
  apply(mode);
  window.dispatchEvent(new Event("ponto-theme"));
}

/** Assina mudanças (troca manual ou do sistema quando em "auto"). */
export function subscribeTheme(cb: () => void): () => void {
  window.addEventListener("ponto-theme", cb);
  const onSystem = () => { if (getThemeMode() === "auto") { apply("auto"); cb(); } };
  mql?.addEventListener("change", onSystem);
  return () => {
    window.removeEventListener("ponto-theme", cb);
    mql?.removeEventListener("change", onSystem);
  };
}

// Aplica imediatamente na importação (antes do primeiro paint do React).
apply(getThemeMode());
