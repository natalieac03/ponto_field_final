import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { MonthlyRecord, MonthlyReport, MonthlySummary } from "../../../types";
import { BarChart, Donut, type Bar } from "./charts";
import {
  ABONO_LABELS, brDate, C, DOC_CODE, hm, hmSigned, MONTHS, STATUS_LABELS, styles, weekdayAbbr,
} from "./theme";

interface Col { label: string; width: number; align?: "left" | "right" | "center" }

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
      <Text>Field Technology — Banco de Horas</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

function SignatureBlock({ roles = ["Gestor", "RH"] }: { roles?: string[] }) {
  return (
    <View style={styles.signRow} wrap={false}>
      {roles.map((role) => (
        <View key={role} style={styles.signCell}>
          <View style={styles.signLine} />
          <Text style={styles.signRole}>{role}</Text>
          <Text style={styles.signHint}>Assinatura e data</Text>
        </View>
      ))}
    </View>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, { color: color ?? C.dark }]}>{value}</Text>
    </View>
  );
}

function TableHead({ cols }: { cols: Col[] }) {
  return (
    <View style={styles.tHead}>
      {cols.map((c, i) => (
        <Text key={i} style={[styles.tHeadCell, { width: c.width, textAlign: c.align ?? "left" }]}>{c.label}</Text>
      ))}
    </View>
  );
}

function Row({ cols, cells, bg, bold }: { cols: Col[]; cells: string[]; bg?: string; bold?: boolean }) {
  const base = bold ? styles.tTotal : styles.tRow;
  const cellStyle = bold ? styles.tTotalCell : styles.tCell;
  return (
    <View style={[base, bg ? { backgroundColor: bg } : {}]} wrap={false}>
      {cells.map((v, i) => (
        <Text key={i} style={[cellStyle, { width: cols[i].width, textAlign: cols[i].align ?? "left" }]}>{v}</Text>
      ))}
    </View>
  );
}

/* ── Agrega semanas de vários colaboradores por número de semana ── */
function aggregateWeeks(summaries: MonthlySummary[]): Bar[] {
  const map = new Map<number, { label: string; value: number }>();
  for (const s of summaries) {
    for (const w of s.weeks) {
      const cur = map.get(w.week) ?? { label: w.label.split("–")[0], value: 0 };
      cur.value += w.balance;
      map.set(w.week, cur);
    }
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

const SUMMARY_COLS: Col[] = [
  { label: "Colaborador", width: 120 },
  { label: "Dias Ú/S/D", width: 60, align: "center" },
  { label: "Referência", width: 52, align: "right" },
  { label: "Trabalhado", width: 52, align: "right" },
  { label: "Saldo", width: 56, align: "right" },
  { label: "Ex.100%", width: 46, align: "right" },
  { label: "Noturno", width: 42, align: "right" },
  { label: "Faltas", width: 34, align: "center" },
  { label: "Atest.", width: 34, align: "center" },
  { label: "Pend.", width: 31, align: "center" },
];

const DETAIL_COLS: Col[] = [
  { label: "Data", width: 52 },
  { label: "Dia", width: 24, align: "center" },
  { label: "Tipo", width: 26, align: "center" },
  { label: "Entrada", width: 40, align: "center" },
  { label: "Início", width: 40, align: "center" },
  { label: "Fim", width: 40, align: "center" },
  { label: "Saída", width: 40, align: "center" },
  { label: "Trab.", width: 40, align: "right" },
  { label: "Ref.", width: 38, align: "right" },
  { label: "Saldo", width: 44, align: "right" },
  { label: "Abono", width: 48, align: "center" },
  { label: "Status", width: 55, align: "center" },
];

function DashboardPage({ report, summaries, scope }: {
  report: MonthlyReport; summaries: MonthlySummary[]; scope: string;
}) {
  const period = `${MONTHS[report.month - 1]} / ${report.year}`;
  const t = {
    worked: summaries.reduce((a, s) => a + s.worked_minutes, 0),
    reference: summaries.reduce((a, s) => a + s.reference_minutes, 0),
    balance: summaries.reduce((a, s) => a + s.balance, 0),
    extra100: summaries.reduce((a, s) => a + s.extra100_minutes, 0),
    night: summaries.reduce((a, s) => a + s.night_bonus_minutes, 0),
    pending: summaries.reduce((a, s) => a + s.pending, 0),
    dH1: summaries.reduce((a, s) => a + s.days_h1, 0),
    dH2: summaries.reduce((a, s) => a + s.days_h2, 0),
    dH3: summaries.reduce((a, s) => a + s.days_h3, 0),
    faltas: summaries.reduce((a, s) => a + s.faltas, 0),
    atest: summaries.reduce((a, s) => a + s.atestados, 0),
  };
  const weekly = aggregateWeeks(summaries);
  const totalDays = t.dH1 + t.dH2 + t.dH3;

  return (
    <Page size="A4" style={styles.page}>
      <Brand title="Banco de Horas — Resumo Executivo" subtitle={`${scope}  ·  Referência ${period}  ·  Gerado em ${new Date().toLocaleDateString("pt-BR")}`} />

      <View style={styles.kpiRow}>
        <Kpi label="Trabalhado" value={hm(t.worked)} />
        <Kpi label="Referência" value={hm(t.reference)} />
        <Kpi label="Saldo do mês" value={hmSigned(t.balance)} color={t.balance >= 0 ? C.pos : C.neg} />
        <Kpi label="Pendentes" value={String(t.pending)} color={t.pending > 0 ? C.warn : C.dark} />
      </View>

      <View style={styles.panelsRow}>
        <View style={[styles.panel, { flex: 1.7 }]}>
          <Text style={styles.panelTitle}>Saldo por semana</Text>
          <BarChart data={weekly} width={300} height={116} />
        </View>
        <View style={[styles.panel, { flex: 1 }]}>
          <Text style={styles.panelTitle}>Distribuição de dias</Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Donut
              size={96}
              centerTop={String(totalDays)}
              centerBottom="dias"
              slices={[
                { label: "Úteis", value: t.dH1, color: C.h1 },
                { label: "Sábados", value: t.dH2, color: C.h2 },
                { label: "Dom/Fer", value: t.dH3, color: C.h3 },
              ]}
            />
            <View style={{ marginLeft: 10 }}>
              {[["Úteis (H1)", t.dH1, C.h1], ["Sábados (H2)", t.dH2, C.h2], ["Dom/Fer (H3)", t.dH3, C.h3]].map(([l, v, c], i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: c as string, marginRight: 5 }} />
                  <Text style={{ fontSize: 7.5, color: C.dark }}>{l as string}: {v as number}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Resumo por colaborador</Text>
      <View style={styles.table}>
        <TableHead cols={SUMMARY_COLS} />
        {summaries.map((s) => (
          <Row key={s.employee_id} cols={SUMMARY_COLS} cells={[
            s.employee_name, `${s.days_h1}/${s.days_h2}/${s.days_h3}`,
            hm(s.reference_minutes), hm(s.worked_minutes), hmSigned(s.balance),
            s.extra100_minutes > 0 ? hm(s.extra100_minutes) : "—",
            s.night_bonus_minutes > 0 ? hm(s.night_bonus_minutes) : "—",
            String(s.faltas), String(s.atestados), s.pending > 0 ? String(s.pending) : "—",
          ]} />
        ))}
        <Row cols={SUMMARY_COLS} bold cells={[
          "TOTAL", `${t.dH1}/${t.dH2}/${t.dH3}`, hm(t.reference), hm(t.worked), hmSigned(t.balance),
          t.extra100 > 0 ? hm(t.extra100) : "—", t.night > 0 ? hm(t.night) : "—",
          String(t.faltas), String(t.atest), t.pending > 0 ? String(t.pending) : "—",
        ]} />
      </View>

      <Text style={styles.legend}>
        Tipos de dia: H1 = dia útil (8h) · H2 = sábado (4h) · H3 = domingo/feriado. Saldo = trabalhado efetivo − referência,
        acumulado por calendário. Saldo negativo em fim de semana não trabalhado é esperado (H2 = 4h de referência).
      </Text>

      <SignatureBlock />

      <Footer />
    </Page>
  );
}

function EmployeePage({ report, s }: { report: MonthlyReport; s: MonthlySummary }) {
  const period = `${MONTHS[report.month - 1]} / ${report.year}`;
  const recs = report.records
    .filter((r) => r.employee_id === s.employee_id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const weekly: Bar[] = s.weeks.map((w) => ({ label: w.label.split("–")[0], value: w.balance }));

  const bgFor = (rec: MonthlyRecord, idx: number): string | undefined => {
    if (rec.status === "pendente") return C.warnBg;
    if (rec.status === "reprovado") return C.rejBg;
    return idx % 2 === 1 ? C.subtle : undefined;
  };

  return (
    <Page size="A4" style={styles.page}>
      <Brand title={`Espelho de Ponto — ${s.employee_name}`} subtitle={`Referência ${period}  ·  Gerado em ${new Date().toLocaleDateString("pt-BR")}`} />

      <View style={styles.kpiRow}>
        <Kpi label="Saldo do mês" value={hmSigned(s.balance)} color={s.balance >= 0 ? C.pos : C.neg} />
        <Kpi label="Trabalhado" value={hm(s.worked_minutes)} />
        <Kpi label="Referência" value={hm(s.reference_minutes)} />
        <Kpi label="Dias (Ú/S/D)" value={`${s.days_h1}/${s.days_h2}/${s.days_h3}`} />
      </View>

      <View style={[styles.panel, { marginBottom: 12 }]}>
        <Text style={styles.panelTitle}>Saldo por semana</Text>
        <BarChart data={weekly} width={510} height={96} />
      </View>

      <Text style={styles.sectionTitle}>Detalhamento diário</Text>
      <View style={styles.table}>
        <TableHead cols={DETAIL_COLS} />
        {recs.map((r, i) => (
          <Row key={r.id} cols={DETAIL_COLS} bg={bgFor(r, i)} cells={[
            brDate(r.date), weekdayAbbr(r.date), r.day_type ?? "—",
            r.entry_time ?? "—", r.break_start ?? "—", r.break_end ?? "—", r.exit_time ?? "—",
            hm(r.worked_minutes), hm(r.standard_minutes), hmSigned(r.overtime_minutes),
            r.abono_code ? ABONO_LABELS[r.abono_code] : "—", STATUS_LABELS[r.status] ?? r.status,
          ]} />
        ))}
        <Row cols={DETAIL_COLS} bold cells={[
          "TOTAL", "", "", "", "", "", "",
          hm(s.worked_minutes), hm(s.reference_minutes), hmSigned(s.balance), "", "",
        ]} />
      </View>

      <Text style={styles.legend}>
        Abonos: AB = Abono · AT = Atestado · VG = Viagem · FA = Falta · FE = Folga.
        Faltas: {s.faltas} · Atestados: {s.atestados} · Folgas: {s.folgas} · Extra 100%: {hm(s.extra100_minutes)} · Adicional noturno: {hm(s.night_bonus_minutes)}.
      </Text>

      <SignatureBlock />

      <Footer />
    </Page>
  );
}

export function MonthlyDashboardPDF({ report, summaries, scope }: {
  report: MonthlyReport; summaries: MonthlySummary[]; scope: string;
}) {
  return (
    <Document title={`Banco de Horas ${MONTHS[report.month - 1]}/${report.year}`} author="Field Technology">
      <DashboardPage report={report} summaries={summaries} scope={scope} />
      {summaries.map((s) => (
        <EmployeePage key={s.employee_id} report={report} s={s} />
      ))}
    </Document>
  );
}
