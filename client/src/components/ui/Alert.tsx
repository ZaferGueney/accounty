import type { ReactNode } from 'react';
import Icon from './Icon';

type Tone = 'danger' | 'success' | 'warning' | 'info';

interface AlertProps {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
}

// Literal class names so Tailwind keeps them
const toneClass: Record<Tone, string> = {
  danger: 'alert-danger',
  success: 'alert-success',
  warning: 'alert-warning',
  info: 'alert-info',
};

const toneIcon: Record<Tone, string> = {
  danger: 'alertCircle',
  success: 'checkCircle',
  warning: 'alert',
  info: 'info',
};

/** Inline message. Multi-line text (e.g. AADE error lists) keeps its line breaks. */
const Alert = ({ tone = 'danger', title, children, onDismiss, dismissLabel = 'Dismiss', className = '' }: AlertProps) => (
  <div
    role={tone === 'danger' ? 'alert' : 'status'}
    className={`alert ${toneClass[tone]} ${className}`}
  >
    <Icon name={toneIcon[tone]} size={18} className="mt-px" />
    <div className="min-w-0 flex-1">
      {title && <p className="font-semibold">{title}</p>}
      {children && (
        <div className={`whitespace-pre-line break-words ${title ? 'mt-0.5 opacity-90' : ''}`}>{children}</div>
      )}
    </div>
    {onDismiss && (
      <button
        type="button"
        onClick={onDismiss}
        className="-m-1 h-7 w-7 shrink-0 rounded opacity-70 transition-opacity hover:opacity-100"
        aria-label={dismissLabel}
      >
        <Icon name="x" size={16} className="mx-auto" />
      </button>
    )}
  </div>
);

export default Alert;
