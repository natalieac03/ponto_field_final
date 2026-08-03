// Ícones com variante por tema.
// Convenção dos arquivos: "nome_claro.png" = arte CLARA (branca), usada no TEMA ESCURO.
// Os originais (escuros/coloridos) são usados no TEMA CLARO.
// IMPORTANTE: URLs precisam ser literais estáticos p/ o Vite incluir no build.
import { useEffect, useState } from "react";
import { resolveTheme, getThemeMode, subscribeTheme } from "./theme";

// ── Originais (arte escura → tema claro)
const logoDarkArt      = new URL("../imagens/logo.png", import.meta.url).href;
const employeeDarkArt  = new URL("../imagens/ICON.png", import.meta.url).href;
const adminDarkArt     = new URL("../imagens/ICON_ADM.png", import.meta.url).href;
const clockInDarkArt   = new URL("../imagens/clockin.png", import.meta.url).href;
const breakInDarkArt   = new URL("../imagens/breakin.png", import.meta.url).href;
const breakOutDarkArt  = new URL("../imagens/breakout.png", import.meta.url).href;
const clockOutDarkArt  = new URL("../imagens/clockout.png", import.meta.url).href;
const landingDarkArt   = new URL("../imagens/desenho.png", import.meta.url).href;

// ── "_claro" (arte clara → tema escuro)
const logoLightArt     = new URL("../imagens/logo_claro.png", import.meta.url).href;
const employeeLightArt = new URL("../imagens/ICON_claro.png", import.meta.url).href;
const adminLightArt    = new URL("../imagens/ICON_ADM_claro.png", import.meta.url).href;
const clockInLightArt  = new URL("../imagens/clockin_claro.png", import.meta.url).href;
const breakInLightArt  = new URL("../imagens/breakin_claro.png", import.meta.url).href;
const breakOutLightArt = new URL("../imagens/breakout_claro.png", import.meta.url).href;
const clockOutLightArt = new URL("../imagens/clockout_claro.png", import.meta.url).href;
const landingLightArt  = new URL("../imagens/desenho_claro.png", import.meta.url).href;

// tema escuro → arte clara (_claro); tema claro → arte original
const PICK = (theme: "light" | "dark") => ({
  logoUrl:            theme === "dark" ? logoLightArt     : logoDarkArt,
  employeeIconUrl:    theme === "dark" ? employeeLightArt : employeeDarkArt,
  adminIconUrl:       theme === "dark" ? adminLightArt    : adminDarkArt,
  clockInIconUrl:     theme === "dark" ? clockInLightArt  : clockInDarkArt,
  breakInIconUrl:     theme === "dark" ? breakInLightArt  : breakInDarkArt,
  breakOutIconUrl:    theme === "dark" ? breakOutLightArt : breakOutDarkArt,
  clockOutIconUrl:    theme === "dark" ? clockOutLightArt : clockOutDarkArt,
  landingTopImageUrl: theme === "dark" ? landingLightArt  : landingDarkArt,
  theme,
});

/** URLs dos ícones resolvidas para o tema ativo, reagindo à troca claro/escuro. */
export function useThemedAssets() {
  const [theme, setTheme] = useState<"light" | "dark">(() => resolveTheme(getThemeMode()));
  useEffect(() => subscribeTheme(() => setTheme(resolveTheme(getThemeMode()))), []);
  return PICK(theme);
}

// Compat: exports estáticos (não trocam com o tema) — arte clara p/ fundo escuro.
export const logoUrl            = logoLightArt;
export const employeeIconUrl    = employeeLightArt;
export const adminIconUrl       = adminLightArt;
export const clockInIconUrl     = clockInLightArt;
export const breakInIconUrl     = breakInLightArt;
export const breakOutIconUrl    = breakOutLightArt;
export const clockOutIconUrl    = clockOutLightArt;
export const landingTopImageUrl = landingLightArt;
