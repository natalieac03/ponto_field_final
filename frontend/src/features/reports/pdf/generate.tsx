import { pdf } from "@react-pdf/renderer";
import type { MonthlyReport, MonthlySummary } from "../../../types";
import { MonthlyDashboardPDF } from "./MonthlyDashboardPDF";

export function buildMonthlyPdfBlob(
  report: MonthlyReport, summaries: MonthlySummary[], scope: string,
): Promise<Blob> {
  return pdf(<MonthlyDashboardPDF report={report} summaries={summaries} scope={scope} />).toBlob();
}

export async function downloadMonthlyPdf(
  report: MonthlyReport, summaries: MonthlySummary[], scope: string, filename: string,
): Promise<void> {
  const blob = await buildMonthlyPdfBlob(report, summaries, scope);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
