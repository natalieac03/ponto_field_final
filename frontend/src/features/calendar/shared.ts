import type { CalendarKind } from "../../types";

export const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
export const WD = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];

export const KIND: Record<CalendarKind, { color: string; bg: string; icon: string; label: string }> = {
  feriado:     { color: "#dc2626", bg: "rgba(220,38,38,0.10)",  icon: "🏖", label: "Feriado" },
  facultativo: { color: "#b45309", bg: "rgba(245,166,35,0.14)", icon: "🕊", label: "Facultativo" },
  evento:      { color: "#2563eb", bg: "rgba(37,99,235,0.10)",  icon: "📌", label: "Evento" },
};

// Cor de CATEGORIA de evento (o que é), fixa nos dois temas — não confundir
// com cor de STATUS (bom/ruim/neutro), que vem dos tokens --danger/--success
// em index.css. Espelha --escala/--ferias em index.css; mantidas como
// literais de hex aqui (não var(--...)) porque AccordionGroup soma um sufixo
// de opacidade hex ao valor (`${accent}1a`).
export const ESCALA_COLOR = "#7c3aed";
export const FERIAS_COLOR = "#0d9488";

export const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
export const fmtDeduct = (min: number | null) =>
  min === null ? "dia inteiro" : `−${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
