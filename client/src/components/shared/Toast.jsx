import { useToast } from "../../context/ToastContext";

export default function Toast() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast${t.dismissing ? " dismissing" : ""}`}>
          <div className="toast-icon">✓</div>
          <div className="toast-message">{t.message}</div>
        </div>
      ))}
    </div>
  );
}
