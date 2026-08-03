import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { ActivityFeed } from "./ActivityFeed";
import type { ActivityLog } from "../../types";

export function AdminActivity() {
  const [entries, setEntries] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getActivity(90).then(setEntries).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="card">
      <div className="card-title">Log de atividades — últimos 90 dias</div>
      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: -6, marginBottom: 14 }}>
        Trilha de auditoria de todas as ações que alteram dados. O evento mais recente fica no topo.
      </p>
      <ActivityFeed entries={entries} loading={loading} showFilter emptyText="Nenhuma atividade registrada nos últimos 90 dias." />
    </div>
  );
}
