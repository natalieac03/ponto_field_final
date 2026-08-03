import { useSyncExternalStore } from "react";
import { getThemeMode, resolveTheme, setThemeMode, subscribeTheme, type ResolvedTheme, type ThemeMode } from "../theme";

/** Estado reativo do tema: [modo escolhido, tema resolvido, setModo]. */
export function useThemeMode(): readonly [ThemeMode, ResolvedTheme, (m: ThemeMode) => void] {
  const mode = useSyncExternalStore(subscribeTheme, getThemeMode, getThemeMode);
  return [mode, resolveTheme(mode), setThemeMode] as const;
}
