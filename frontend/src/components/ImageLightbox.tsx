import { useEffect } from "react";

interface Props {
  url: string;
  filename: string;
  onClose: () => void;
}

export function ImageLightbox({ url, filename, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(5, 10, 20, 0.88)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        zIndex: 2000, padding: 24,
        cursor: "zoom-out",
      }}
    >
      {/* Barra superior */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 900,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "var(--mono)" }}>
          📎 {filename}
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          <a
            href={url}
            download={filename}
            onClick={e => e.stopPropagation()}
            style={{
              fontSize: 12, padding: "5px 14px", borderRadius: 8,
              background: "rgba(255,255,255,0.12)", color: "#fff",
              textDecoration: "none", border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            ⬇ Baixar
          </a>
          <button
            onClick={onClose}
            style={{
              fontSize: 18, background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#fff", borderRadius: 8, width: 34, height: 34,
              cursor: "pointer", fontFamily: "var(--font)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
        </div>
      </div>

      {/* Imagem */}
      <img
        src={url}
        alt={filename}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: "min(900px, 92vw)",
          maxHeight: "80vh",
          objectFit: "contain",
          borderRadius: 12,
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
          cursor: "default",
        }}
      />

      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 14 }}>
        Clique fora ou pressione ESC para fechar
      </p>
    </div>
  );
}
