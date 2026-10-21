import { useToast } from '../lib/toast';
import { Icon } from './Icons';

/** Le message qui accompagne une action, sans bloquer le reste de l'écran. */
export function Toaster() {
  const toast = useToast((state) => state.toast);
  const dismiss = useToast((state) => state.dismiss);

  if (!toast) return null;

  return (
    <div className="toaster" role="status" aria-live="polite">
      <span className="toaster__message">{toast.message}</span>
      {toast.action ? (
        <button
          type="button"
          className="toaster__action"
          onClick={() => {
            toast.action?.run();
            dismiss();
          }}
        >
          {toast.action.label}
        </button>
      ) : null}
      <button type="button" className="toaster__close" onClick={dismiss} aria-label="Fermer">
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
