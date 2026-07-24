interface AlertProps {
  message: string | null;
  type: "success" | "error";
}

export function Alert({ message, type }: AlertProps) {
  if (!message) return null;
  return <div className={`alert alert-${type}`}>{message}</div>;
}
