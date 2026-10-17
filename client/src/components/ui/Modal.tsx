import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

type Size = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  size?: Size;
  children: ReactNode;
  /** Sticky action bar at the bottom of the dialog. */
  footer?: ReactNode;
  /** While true, Escape / overlay / close button do nothing (e.g. a save is running). */
  busy?: boolean;
  closeLabel?: string;
  /** CSS selector of the element to focus first; defaults to the first form field. */
  initialFocusSelector?: string;
}

const widths: Record<Size, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  '2xl': 'sm:max-w-6xl',
};

let openCount = 0;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: portal, focus trap, Escape to close, scroll lock.
 * Phones get a full-height bottom sheet; larger screens a centered panel.
 */
const Modal = ({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  busy = false,
  closeLabel = 'Close',
  initialFocusSelector,
}: ModalProps) => {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    openCount += 1;
    document.body.style.overflow = 'hidden';

    const timer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target =
        (initialFocusSelector && panel.querySelector<HTMLElement>(initialFocusSelector)) ||
        panel.querySelector<HTMLElement>('[data-autofocus]') ||
        panel;
      target.focus({ preventScroll: true });
    }, 30);

    return () => {
      window.clearTimeout(timer);
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) document.body.style.overflow = '';
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open, initialFocusSelector]);

  const requestClose = () => {
    if (!busyRef.current) onCloseRef.current();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      requestClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6"
      onKeyDown={onKeyDown}
    >
      <div
        className="absolute inset-0 animate-fade-in bg-black/40 dark:bg-black/60"
        onMouseDown={requestClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`relative flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-xl border border-line bg-surface shadow-modal outline-none animate-sheet-in sm:max-h-[min(92dvh,1100px)] sm:animate-pop-in sm:rounded-xl ${widths[size]}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[1.0625rem] font-semibold leading-snug text-ink">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-0.5 text-sm text-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={busy}
            className="btn btn-ghost btn-icon btn-sm -mr-1.5 shrink-0"
            aria-label={closeLabel}
          >
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-sunken/50 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
