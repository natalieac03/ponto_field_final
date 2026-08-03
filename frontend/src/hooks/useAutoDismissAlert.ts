import { useCallback, useEffect, useRef, useState } from "react";

export type AlertType = "success" | "error";
export interface AlertState {
  msg: string;
  type: AlertType;
}

/**
 * Alerta que se auto-oculta após `timeout` ms. Substitui o padrão repetido
 * `setState(...) + setTimeout(() => setState(null))`, com a vantagem de
 * cancelar o timer anterior quando um novo alerta chega (evita que um alerta
 * antigo apague o atual antes da hora) e de limpar o timer ao desmontar.
 */
export function useAutoDismissAlert(timeout = 3000) {
  const [alert, setAlert] = useState<AlertState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string, type: AlertType) => {
    if (timer.current) clearTimeout(timer.current);
    setAlert({ msg, type });
    timer.current = setTimeout(() => setAlert(null), timeout);
  }, [timeout]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return [alert, show] as const;
}
