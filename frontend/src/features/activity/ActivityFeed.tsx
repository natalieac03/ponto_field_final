import { useMemo, useState } from "react";
import type { ActivityLog } from "../../types";

/** Ícone + cor por ação (categorias visuais da auditoria). */
const META: Record<string, { icon: string; color: string }> = {
  ponto_entrada:         { icon: "→", color: "#16a34a" },
  ponto_intervalo:       { icon: "⏸", color: "#0284c7" },
  ponto_saida:           { icon: "←", color: "#dc2626" },
  lancamento_retroativo: { icon: "＋", color: "#b45309" },
  solicitacao_edicao:    { icon: "✎", color: "#b45309" },
  solicitacao_exclusao:  { icon: "🗑", color: "#b45309" },
  edicao:                { icon: "✎", color: "#0284c7" },
  aprovacao:             { icon: "✓", color: "#16a34a" },
  reprovacao:            { icon: "✕", color: "#dc2626" },
  exclusao_aprovada:     { icon: "🗑", color: "#dc2626" },
  exclusao_reprovada:    { icon: "↩", color: "#64748b" },
  exclusao:              { icon: "🗑", color: "#dc2626" },
  observacao:            { icon: "📝", color: "#64748b" },
  anexo_add:             { icon: "📎", color: "#0284c7" },
  anexo_remove:          { icon: "📎", color: "#dc2626" },
  senha_alterada:        { icon: "🔑", color: "#7c3aed" },
  senha_admin_alterada:  { icon: "🔑", color: "#7c3aed" },
  foto_alterada:         { icon: "📷", color: "#0284c7" },
  foto_removida:         { icon: "📷", color: "#dc2626" },
  colaborador_criado:    { icon: "👤", color: "#16a34a" },
  colaborador_renomeado: { icon: "👤", color: "#0284c7" },
  colaborador_excluido:  { icon: "👤", color: "#dc2626" },
  jornada_alterada:      { icon: "⚙", color: "#0284c7" },
  config_alterada:       { icon: "⚙", color: "#0284c7" },
};
const FALLBACK = { icon: "•", color: "#64748b" };

function fmtWhen(iso: string): string {
  // 'YYYY-MM-DDTHH:MM:SS' → 'DD/MM • HH:MM'
  const [d, t] = iso.split("T");
  const [, mo, day] = d.split("-");
  return `${day}/${mo} • ${(t ?? "").slice(0, 5)}`;
}

interface Props {
  entries: ActivityLog[];
  loading?: boolean;
  showFilter?: boolean;
  emptyText?: string;
}

export function ActivityFeed({ entries, loading, showFilter = false, emptyText = "Nenhuma atividade no período." }: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return entries;
    return entries.filter(e =>
      e.description.toLowerCase().includes(s) ||
      e.actor_name.toLowerCase().includes(s) ||
      e.action.toLowerCase().includes(s));
  }, [entries, q]);

  if (loading) return <p style={{ color: "var(--muted)", padding: 20 }}>Carregando…</p>;

  return (
    <div>
      {showFilter && (
        <div className="activity-filter">
          <input
            type="text"
            placeholder="🔍 Filtrar por nome, ação ou descrição…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <span className="activity-count">{filtered.length} evento{filtered.length === 1 ? "" : "s"}</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card"><p style={{ color: "var(--muted)", margin: 0 }}>{emptyText}</p></div>
      ) : (
        <ul className="activity-feed">
          {filtered.map(e => {
            const m = META[e.action] ?? FALLBACK;
            return (
              <li key={e.id} className="activity-item">
                <span className="activity-dot" style={{ background: `${m.color}1a`, color: m.color }}>{m.icon}</span>
                <div className="activity-body">
                  <div className="activity-desc">{e.description}</div>
                  <div className="activity-meta">
                    <span className={`activity-actor ${e.actor_type}`}>{e.actor_name}</span>
                    <span className="activity-sep">·</span>
                    <span>{fmtWhen(e.created_at)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
