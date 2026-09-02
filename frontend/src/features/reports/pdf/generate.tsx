import { pdf } from "@react-pdf/renderer";
import type { MonthlyReport, MonthlySummary } from "../../../types";
import { AgendaColaboradorPDF } from "./AgendaColaboradorPDF";
import { buildAgendaItems, buildDayCtx } from "./dayContext";
import { MonthlyDashboardPDF } from "./MonthlyDashboardPDF";

export async function buildMonthlyPdfBlob(
  report: MonthlyReport, summaries: MonthlySummary[], scope: string,
): Promise<Blob> {
  const dayCtx = await buildDayCtx(report.period_start, report.period_end).catch(() => undefined);
  return pdf(<MonthlyDashboardPDF report={report} summaries={summaries} scope={scope} dayCtx={dayCtx} />).toBlob();
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadMonthlyPdf(
  report: MonthlyReport, summaries: MonthlySummary[], scope: string, filename: string,
): Promise<void> {
  downloadBlob(await buildMonthlyPdfBlob(report, summaries, scope), filename);
}

export async function downloadAgendaPdf(
  employeeId: number, employeeName: string, start: string, end: string, periodLabel: string, filename: string,
): Promise<void> {
  const items = await buildAgendaItems(employeeId, start, end);
  const blob = await pdf(<AgendaColaboradorPDF employeeName={employeeName} periodLabel={periodLabel} items={items} />).toBlob();
  downloadBlob(blob, filename);
}
