import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icons';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Une fenêtre posée au-dessus du journal.
 *
 * Elle garde le clavier à l'intérieur tant qu'elle est ouverte (Tab fait le
 * tour des champs au lieu de filer derrière), se ferme par Échap, et rend le
 * focus à l'élément qui l'avait ouverte — sans quoi un lecteur d'écran repart
 * du début de la page.
 */
export function Modal({
  title,
  eyebrow,
  onClose,
  children,
  wide = false,
  labelledBy,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  labelledBy?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = () =>
      Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) {
        event.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    const target = panel.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not([data-close])',
    );
    target?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, []);

  return createPortal(
    <div className="overlay" onMouseDown={onClose} role="presentation">
      <div
        className={`modal${wide ? ' modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
        ref={panel}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__head">
          <div>
            {eyebrow ? <p className="modal__eyebrow">{eyebrow}</p> : null}
            <h2 id={labelledBy ?? undefined}>{title}</h2>
          </div>
          <button
            type="button"
            className="iconbtn"
            onClick={onClose}
            aria-label="Fermer"
            data-close
          >
            <Icon name="close" size={17} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
