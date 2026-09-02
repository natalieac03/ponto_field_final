import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { VacationReport, VacationReportItem } from "../../../types";
import { LEAVE_KIND_LABEL } from "../../../types";
import { Brand, type Col, Footer, Kpi, Row, SignatureBlock, TableHead } from "./PdfLayout";
import { brDate, C, hm, hmSigned, styles } from "./theme";

const SUMMARY_COLS: Col[] = [
  { label: "Colaborador", width: 116 },
  { label: "CPF", width: 60 },
  { label: "Afastamento", width: 56 },
  { label: "Período", width: 76, align: "center" },
  { label: "Dias", width: 26, align: "center" },
  { label: "Trab.", width: 46, align: "right" },
  { label: "Ex.50%", width: 42, align: "right" },
  { label: "Ex.100%", width: 46, align: "right" },
  { label: "Saldo", width: 54, align: "right" },
];

const RECORD_COLS: Col[] = [
  { label: "Data", width: 62 },
  { label: "Entrada", width: 52, align: "center" },
  { label: "Início", width: 52, align: "center" },
  { label: "Fim", width: 52, align: "center" },
  { label: "Saída", width: 52, align: "center" },
  { label: "Trab.", width: 64, align: "right" },
  { label: "Ref.", width: 64, align: "right" },
  { label: "Saldo", width: 64, align: "right" },
  { label: "Abono", width: 48, align: "center" },
];

const leaveLabel = (kind: string): string =>
  (LEAVE_KIND_LABEL[kind as keyof typeof LEAVE_KIND_LABEL] ?? kind).replace(/^\p{Emoji}\s*/u, "");

// Versão curta p/ caber na coluna "Afastamento" da tabela-resumo sem quebrar linha.
const LEAVE_LABEL_SHORT: Record<string, string> = { ferias: "Férias", licenca: "Licença", folga: "Folga" };
const leaveLabelShort = (kind: string): string => LEAVE_LABEL_SHORT[kind] ?? leaveLabel(kind);

function SummaryPage({ report }: { report: VacationReport }) {
  const t = report.items.reduce((a, it) => ({
    dias: a.dias + it.leave_days,
    trabalhado: a.trabalhado + it.worked_minutes,
    extra100: a.extra100 + it.extra100_minutes,
    saldo: a.saldo + it.balance,
  }), { dias: 0, trabalhado: 0, extra100: 0, saldo: 0 });

  return (
    <Page size="A4" style={styles.page}>
      <Brand title="Relatório de Férias e Afastamentos"
        subtitle={`${brDate(report.start)} a ${brDate(report.end)}  ·  Gerado em ${new Date().toLocaleDateString("pt-BR")}`} />

      <View style={styles.kpiRow}>
        <Kpi label="Colaboradores" value={String(report.items.length)} />
        <Kpi label="Dias afastados" value={String(t.dias)} />
        <Kpi label="Trabalhado" value={hm(t.trabalhado)} />
        <Kpi label="Extra 100%" value={t.extra100 > 0 ? hm(t.extra100) : "—"} />
        <Kpi label="Saldo total" value={hmSigned(t.saldo)} color={t.saldo >= 0 ? C.pos : C.neg} />
      </View>

      <Text style={styles.sectionTitle}>Colaboradores no período</Text>
      <View style={styles.table}>
        <TableHead cols={SUMMARY_COLS} />
        {report.items.map((it) => (
          <Row key={`${it.employee_id}-${it.leave_start}`} cols={SUMMARY_COLS} cells={[
            it.employee_name, it.cpf_masked ?? "—", leaveLabelShort(it.leave_kind),
            `${brDate(it.leave_start)} – ${brDate(it.leave_end)}`, String(it.leave_days),
            hm(it.worked_minutes), it.extra50_minutes > 0 ? hm(it.extra50_minutes) : "—",
            it.extra100_minutes > 0 ? hm(it.extra100_minutes) : "—", hmSigned(it.balance),
          ]} />
        ))}
      </View>

      <Text style={styles.legend}>
        Espelho de ponto dos {report.lookback_days} dias anteriores a cada afastamento, usado para conferir o saldo
        acumulado antes da saída. Extra 50%/100% e saldo consideram apenas os dias trabalhados nessa janela.
      </Text>

      <Footer label="Férias e Afastamentos" />
    </Page>
  );
}

function EmployeeLeavePage({ item, lookback }: { item: VacationReportItem; lookback: number }) {
  return (
    <Page size="A4" style={styles.page}>
      <Brand title={`Espelho antes das férias — ${item.employee_name}`}
        subtitle={`${leaveLabel(item.leave_kind)} de ${brDate(item.leave_start)} a ${brDate(item.leave_end)}  ·  Espelho dos últimos ${lookback} dias (${brDate(item.window_start)} a ${brDate(item.window_end)})`} />

      <View style={styles.kpiRow}>
        <Kpi label="Dias trabalhados" value={String(item.days_worked)} />
        <Kpi label="H. normais" value={hm(item.normal_minutes)} />
        <Kpi label="Extra 50% / 100%" value={`${hm(item.extra50_minutes)} / ${hm(item.extra100_minutes)}`} />
        <Kpi label="Saldo do período" value={hmSigned(item.balance)} color={item.balance >= 0 ? C.pos : C.neg} />
      </View>

      <Text style={styles.sectionTitle}>Detalhamento diário</Text>
      <View style={styles.table}>
        <TableHead cols={RECORD_COLS} />
        {item.records.length === 0 ? (
          <View style={styles.tRow} wrap={false}>
            <Text style={[styles.tCell, { width: RECORD_COLS.reduce((a, c) => a + c.width, 0), textAlign: "center", color: C.muted }]}>
              Nenhum registro no período.
            </Text>
          </View>
        ) : [...item.records].sort((a, b) => b.date.localeCompare(a.date)).map((r, i) => (
          <Row key={r.date} cols={RECORD_COLS} bg={i % 2 === 1 ? C.subtle : undefined} cells={[
            brDate(r.date), r.entry_time ?? "—", r.break_start ?? "—", r.break_end ?? "—", r.exit_time ?? "—",
            hm(r.worked_minutes), hm(r.standard_minutes), hmSigned(r.overtime_minutes), r.abono_code ?? "—",
          ]} />
        ))}
      </View>

      <SignatureBlock roles={["Colaborador", "Gestor"]} />

      <Footer label="Férias e Afastamentos" />
    </Page>
  );
}

export function VacationReportPDF({ report }: { report: VacationReport }) {
  return (
    <Document title="Relatório de Férias e Afastamentos" author="Field Technology">
      <SummaryPage report={report} />
      {report.items.map((it) => (
        <EmployeeLeavePage key={`${it.employee_id}-${it.leave_start}`} item={it} lookback={report.lookback_days} />
      ))}
    </Document>
  );
}
