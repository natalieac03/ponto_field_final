import { StyleSheet } from "@react-pdf/renderer";

/** Paleta de marca FieldTech (relatórios oficiais). */
export const C = {
  blue: "#00AEEF",
  blueDeep: "#1E5A8C",
  dark: "#0D1B2A",
  muted: "#5A6B7A",
  border: "#D9E2EC",
  subtle: "#F4F7FA",
  total: "#E3F3FB",
  white: "#FFFFFF",
  pos: "#16A34A",
  neg: "#DC2626",
  warn: "#B45309",
  warnBg: "#FEF3D7",
  rejBg: "#FBE2E4",
  h1: "#00AEEF",
  h2: "#1E5A8C",
  h3: "#7BC8E8",
};

export const DOC_CODE = "FPRESI-RH-0134 Rev.04";

export const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
export const WEEKDAY_ABBR = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
export const ABONO_LABELS: Record<string, string> = {
  AB: "Abono", AT: "Atestado", VG: "Viagem", FA: "Falta", FE: "Folga",
};
export const STATUS_LABELS: Record<string, string> = {
  aprovado: "Aprovado", pendente: "Pendente", reprovado: "Reprovado",
};

export const hm = (m: number | null | undefined): string => {
  if (m == null) return "—";
  const a = Math.abs(m);
  return `${Math.floor(a / 60)}h${String(a % 60).padStart(2, "0")}`;
};
export const hmSigned = (m: number | null | undefined): string => {
  if (m == null) return "—";
  const a = Math.abs(m);
  return `${m < 0 ? "−" : "+"}${Math.floor(a / 60)}h${String(a % 60).padStart(2, "0")}`;
};
export const brDate = (iso: string): string => {
  const [y, mo, d] = iso.split("-");
  return `${d}/${mo}/${y}`;
};
export const weekdayAbbr = (iso: string): string =>
  WEEKDAY_ABBR[(new Date(`${iso}T00:00:00`).getDay() + 6) % 7];

export const styles = StyleSheet.create({
  page: {
    paddingTop: 40, paddingBottom: 46, paddingHorizontal: 34,
    fontFamily: "Helvetica", fontSize: 9, color: C.dark, lineHeight: 1.35,
  },
  // Cabeçalho de marca
  brandBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  brandLeft: { flexDirection: "row", alignItems: "baseline" },
  brandField: { fontFamily: "Helvetica-Bold", fontSize: 15, color: C.blue, letterSpacing: 0.3 },
  brandTech: { fontFamily: "Helvetica-Bold", fontSize: 15, color: C.dark, letterSpacing: 0.3 },
  brandDoc: { fontSize: 7.5, color: C.muted },
  title: { fontFamily: "Helvetica-Bold", fontSize: 13, color: C.dark, marginTop: 8 },
  subtitle: { fontSize: 8.5, color: C.muted, marginTop: 1 },
  rule: { height: 2, backgroundColor: C.blue, marginTop: 6, marginBottom: 12, borderRadius: 2 },

  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: C.dark, marginBottom: 6, marginTop: 4 },

  // KPI cards
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  kpiCard: {
    flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 8,
    paddingVertical: 10, paddingHorizontal: 10, backgroundColor: C.white,
  },
  kpiLabel: { fontSize: 7.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  kpiValue: { fontFamily: "Helvetica-Bold", fontSize: 17, marginTop: 3 },

  // Painéis (gráficos)
  panelsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  panel: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10, backgroundColor: C.white },
  panelTitle: { fontFamily: "Helvetica-Bold", fontSize: 9, color: C.dark, marginBottom: 8 },

  // Tabelas
  table: { borderWidth: 1, borderColor: C.border, borderRadius: 6, overflow: "hidden" },
  tHead: { flexDirection: "row", backgroundColor: C.blue },
  tHeadCell: { color: C.white, fontFamily: "Helvetica-Bold", fontSize: 7.5, paddingVertical: 5, paddingHorizontal: 4 },
  tRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border },
  tCell: { fontSize: 7.8, paddingVertical: 4, paddingHorizontal: 4, color: C.dark },
  tTotal: { flexDirection: "row", backgroundColor: C.total, borderTopWidth: 1, borderTopColor: C.border },
  tTotalCell: { fontFamily: "Helvetica-Bold", fontSize: 7.8, paddingVertical: 5, paddingHorizontal: 4, color: C.dark },

  legend: { fontSize: 7, color: C.muted, marginTop: 8 },

  footer: {
    position: "absolute", bottom: 20, left: 34, right: 34,
    flexDirection: "row", justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: C.border, paddingTop: 5,
    fontSize: 7, color: C.muted,
  },

  // Assinaturas
  signRow: { flexDirection: "row", justifyContent: "space-around", gap: 44, marginTop: 34, marginBottom: 6 },
  signCell: { flex: 1, alignItems: "center" },
  signLine: { alignSelf: "stretch", borderTopWidth: 1, borderTopColor: C.dark, marginHorizontal: 12, marginBottom: 4 },
  signRole: { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: C.dark },
  signHint: { fontSize: 6.5, color: C.muted, marginTop: 1 },
});
