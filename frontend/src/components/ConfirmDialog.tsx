import { useEffect, useState } from "react";
import { Modal } from "./Modal";

interface DialogOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Estiliza o botão de confirmação como ação destrutiva. */
  danger?: boolean;
}

interface DialogRequest {
  kind: "confirm" | "alert";
  message: string;
  options?: DialogOptions;
  resolve: (value: boolean) => void;
}

let dispatch: ((req: DialogRequest | null) => void) | null = null;

/** Substitui window.confirm — resolve `true`/`false` conforme o usuário escolhe. */
export function confirmDialog(message: string, options?: DialogOptions): Promise<boolean> {
  return new Promise(resolve => {
    if (!dispatch) { resolve(window.confirm(message)); return; }
    dispatch({ kind: "confirm", message, options, resolve });
  });
}

/** Substitui window.alert — resolve quando o usuário fecha o aviso. */
export function alertDialog(message: string, options?: DialogOptions): Promise<void> {
  return new Promise(resolve => {
    if (!dispatch) { window.alert(message); resolve(); return; }
    dispatch({ kind: "alert", message, options, resolve: () => resolve() });
  });
}

/** Monta uma vez perto da raiz do app; renderiza os pedidos de confirmDialog/alertDialog. */
export function ConfirmHost() {
  const [request, setRequest] = useState<DialogRequest | null>(null);

  useEffect(() => {
    dispatch = setRequest;
    return () => { dispatch = null; };
  }, []);

  if (!request) return null;

  const close = (value: boolean) => {
    request.resolve(value);
    setRequest(null);
  };

  const isAlert = request.kind === "alert";
  const danger = request.options?.danger ?? false;

  return (
    <Modal title={request.options?.title} onClose={() => close(false)} maxWidth={420}>
      <p style={{ margin: "4px 0 20px", whiteSpace: "pre-line", lineHeight: 1.5 }}>{request.message}</p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        {!isAlert && (
          <button className="btn btn-secondary" onClick={() => close(false)}>
            {request.options?.cancelLabel ?? "Cancelar"}
          </button>
        )}
        <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={() => close(true)}>
          {request.options?.confirmLabel ?? (isAlert ? "OK" : "Confirmar")}
        </button>
      </div>
    </Modal>
  );
}
