import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

interface ModalProps {
  open: boolean;
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, title, eyebrow, onClose, children, footer, size = 'md' }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    // On pose le focus sur le panneau, pas sur le premier bouton : le titre est
    // annoncé, et Tab mène au premier champ au lieu de la croix de fermeture.
    panel?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter((item) => !item.hasAttribute('disabled'));
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="modal-root">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        tabIndex={-1}
      >
        <header className="modal__head">
          <div>
            {eyebrow ? <p className="kicker">{eyebrow}</p> : null}
            <h2 id={titleId}>{title}</h2>
          </div>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Fermer">
            <Icon name="close" />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer ? <footer className="modal__foot">{footer}</footer> : null}
      </div>
    </div>,
    document.body
  );
}
