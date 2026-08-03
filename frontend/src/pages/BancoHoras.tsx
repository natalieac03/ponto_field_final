import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Badge, fmtMin, fmtMinUnsigned } from "../components/Badge";
import { StatCard } from "../components/StatCard";
import type { BankReport } from "../types";

export function BancoHoras() {
  const [report, setReport] = useState<BankReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getBankReport().then(setReport).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "var(--muted)", padding: 20 }}>Carregando…</p>;
  if (!report) return null;

  return (
    <div>
      <div className="stats-grid">
        <StatCard label="Colaboradores" value={String(report.employees.length)} />
        <StatCard
          label="Saldo Consolidado"
          value={fmtMin(report.total_balance)}
          variant={report.total_balance >= 0 ? "pos" : "neg"}
        />
        <StatCard label="Total Registros" value={String(report.total_records)} />
        {report.open_records > 0 && (
          <StatCard label="Em Aberto" value={String(report.open_records)} variant="warn" />
        )}
      </div>

      <div className="card">
        <div className="card-title">Saldo por Colaborador</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Registros</th>
                <th>Em Aberto</th>
                <th>H. Trabalhadas</th>
                <th>H. Padrão Esperada</th>
                <th>Saldo Líquido</th>
              </tr>
            </thead>
            <tbody>
              {report.employees.length === 0 ? (
                <tr><td colSpan={6} className="empty">Nenhum colaborador cadastrado.</td></tr>
              ) : (
                report.employees.map((e) => (
                  <tr key={e.employee_id}>
                    <td style={{ fontWeight: 500 }}>{e.employee_name}</td>
                    <td className="mono">{e.total_records}</td>
                    <td className="mono">
                      {e.open_records > 0
                        ? <span style={{ color: "var(--accent2)", fontFamily: "var(--mono)" }}>{e.open_records}</span>
                        : <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    <td className="mono">{fmtMinUnsigned(e.worked_minutes)}</td>
                    <td className="mono">{fmtMinUnsigned(e.standard_minutes)}</td>
                    <td><Badge minutes={e.balance} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
