import { Text, View } from "@react-pdf/renderer";
import type { DayCategory } from "./dayContext";
import { C } from "./theme";

export const CATEGORY_BG: Record<DayCategory, string> = {
  escala: C.escalaBg, leave: C.leaveBg, feriado: C.feriadoBg, facultativo: C.facultativoBg, evento: C.eventoBg,
};
export const CATEGORY_COLOR: Record<DayCategory, string> = {
  escala: C.escala, leave: C.leave, feriado: C.feriado, facultativo: C.facultativo, evento: C.evento,
};
export const CATEGORY_LEGEND: { category: DayCategory; label: string }[] = [
  { category: "escala", label: "Escala extra" },
  { category: "leave", label: "Férias / licença / folga" },
  { category: "feriado", label: "Feriado" },
  { category: "facultativo", label: "Facultativo" },
  { category: "evento", label: "Evento" },
];

/** Legenda de categorias de dia (mesma paleta do calendário), reaproveitada nos relatórios em PDF. */
export function CategoryLegend() {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 5 }}>
      {CATEGORY_LEGEND.map((it, i) => (
        <View key={it.category} style={{ flexDirection: "row", alignItems: "center", marginRight: i < CATEGORY_LEGEND.length - 1 ? 12 : 0 }}>
          <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: CATEGORY_COLOR[it.category], marginRight: 4 }} />
          <Text style={{ fontSize: 6.8, color: C.muted }}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}
