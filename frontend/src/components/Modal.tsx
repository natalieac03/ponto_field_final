import { useEffect, type ReactNode } from "react";

interface Props {
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Largura máxima do card (px). Padrão 480. */
  maxWidth?: number;
}

/** Shell de modal reutilizável: overlay (fecha no backdrop / Esc) + card centralizado.
 * Evita a duplicação do mesmo overlay inline em cada modal do app. */
export function Modal({ title, onClose, children, maxWidth = 480 }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        {title !== undefined && (
          <div className="modal-head">
            <span>{title}</span>
            <button className="modal-close" onClick={onClose} aria-label="Fechar">✕</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
