import { useTranslation } from 'next-i18next';

const invoiceTone: Record<string, string> = {
  draft: 'badge-neutral',
  sent: 'badge-info',
  paid: 'badge-success',
  overdue: 'badge-danger',
  cancelled: 'badge-muted',
};

const aadeTone: Record<string, string> = {
  pending: 'badge-warning',
  transmitted: 'badge-success',
  failed: 'badge-danger',
  cancelled: 'badge-muted',
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

interface Props {
  status?: string | null;
  kind?: 'invoice' | 'aade';
  className?: string;
}

/** Status pill for an invoice's own status or its AADE transmission status. */
const StatusBadge = ({ status, kind = 'invoice', className = '' }: Props) => {
  const { t } = useTranslation('common');
  const value = status || (kind === 'aade' ? 'pending' : 'draft');
  const tones = kind === 'aade' ? aadeTone : invoiceTone;
  const tone = tones[value] || 'badge-neutral';
  const label = t(`statuses.${kind}.${value}`, { defaultValue: cap(value) });
  return <span className={`badge badge-dot ${tone} ${className}`}>{label}</span>;
};

export default StatusBadge;
