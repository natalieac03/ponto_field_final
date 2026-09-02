import { Document, Page, Text, View } from "@react-pdf/renderer";
import { CATEGORY_BG, CATEGORY_COLOR, CategoryLegend } from "./categoryStyle";
import type { AgendaItem } from "./dayContext";
import { brDate, C, DOC_CODE, styles, weekdayAbbr } from "./theme";

function Brand({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View>
      <View style={styles.brandBar}>
        <View style={styles.brandLeft}>
          <Text style={styles.brandField}>FIELD</Text>
          <Text style={styles.brandTech}> TECHNOLOGY</Text>
        </View>
        <Text style={styles.brandDoc}>{DOC_CODE}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.rule} />
    </View>
  );
}

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>Field Technology — Agenda do Colaborador</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

interface Col { label: string; width: number; align?: "left" | "right" | "center" }
const COLS: Col[] = [
  { label: "Data", width: 60 },
  { label: "Dia", width: 34, align: "center" },
  { label: "Tipo", width: 90 },
  { label: "Detalhe", width: 260 },
];

function TableHead() {
  return (
    <View style={styles.tHead}>
      {COLS.map((c, i) => (
        <Text key={i} style={[styles.tHeadCell, { width: c.width, textAlign: c.align ?? "left" }]}>{c.label}</Text>
      ))}
    </View>
  );
}

export function AgendaColaboradorPDF({ employeeName, periodLabel, items }: {
  employeeName: string; periodLabel: string; items: AgendaItem[];
}) {
  return (
    <Document title={`Agenda — ${employeeName}`} author="Field Technology">
      <Page size="A4" style={styles.page}>
        <Brand title={`Agenda do Colaborador — ${employeeName}`}
          subtitle={`Referência ${periodLabel}  ·  Gerado em ${new Date().toLocaleDateString("pt-BR")}`} />

        <Text style={styles.sectionTitle}>Escalas, férias e calendário da equipe no período</Text>
        <View style={styles.table}>
          <TableHead />
          {items.length === 0 ? (
            <View style={styles.tRow} wrap={false}>
              <Text style={[styles.tCell, { width: COLS.reduce((a, c) => a + c.width, 0), textAlign: "center", color: C.muted }]}>
                Nenhum evento no período.
              </Text>
            </View>
          ) : items.map((it, i) => (
            <View key={`${it.date}-${i}`} style={[styles.tRow, { backgroundColor: CATEGORY_BG[it.category] }]} wrap={false}>
              <Text style={[styles.tCell, { width: COLS[0].width }]}>{brDate(it.date)}</Text>
              <Text style={[styles.tCell, { width: COLS[1].width, textAlign: "center" }]}>{weekdayAbbr(it.date)}</Text>
              <Text style={[styles.tCell, { width: COLS[2].width, color: CATEGORY_COLOR[it.category], fontFamily: "Helvetica-Bold" }]}>
                {it.label}
              </Text>
              <Text style={[styles.tCell, { width: COLS[3].width, color: C.muted }]}>{it.note ?? "—"}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.legend}>
          Escala extra = dia adicional de trabalho marcado na agenda. Férias/licença/folga não geram jornada esperada.
          Feriado, facultativo e evento são marcações gerais do calendário, válidas para toda a equipe.
        </Text>
        <CategoryLegend />

        <Footer />
      </Page>
    </Document>
  );
}
