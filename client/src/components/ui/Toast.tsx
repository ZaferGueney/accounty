import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import Icon from './Icon';

type Tone = 'success' | 'danger' | 'info';
interface ToastItem {
  id: number;
  tone: Tone;
  message: ReactNode;
}

interface ToastApi {
  show: (message: ReactNode, tone?: Tone, ms?: number) => void;
  success: (message: ReactNode) => void;
  error: (message: ReactNode) => void;
}

const noop: ToastApi = { show: () => {}, success: () => {}, error: () => {} };
const ToastContext = createContext<ToastApi>(noop);

export const useToast = () => useContext(ToastContext);

const toneStyle: Record<Tone, { icon: string; cls: string }> = {
  success: { icon: 'checkCircle', cls: 'text-success' },
  danger: { icon: 'alertCircle', cls: 'text-danger' },
  info: { icon: 'info', cls: 'text-accent' },
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (message: ReactNode, tone: Tone = 'info', ms = 4500) => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-3), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), ms);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m) => show(m, 'success'),
      error: (m) => show(m, 'danger', 9000),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end sm:p-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'danger' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm animate-sheet-in items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink shadow-pop"
          >
            <Icon name={toneStyle[t.tone].icon} size={18} className={`mt-px ${toneStyle[t.tone].cls}`} />
            <div className="min-w-0 flex-1 whitespace-pre-line break-words">{t.message}</div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="-m-1 rounded p-1 text-muted hover:text-ink"
              aria-label="Dismiss"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
