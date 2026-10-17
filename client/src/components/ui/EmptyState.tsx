import type { ReactNode } from 'react';
import Icon from './Icon';

interface EmptyStateProps {
  icon?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

const EmptyState = ({ icon = 'file', title, description, action, className = '' }: EmptyStateProps) => (
  <div className={`flex flex-col items-center px-6 py-14 text-center ${className}`}>
    <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-sunken text-muted">
      <Icon name={icon} size={20} />
    </span>
    <h3 className="text-[0.9375rem] font-semibold text-ink">{title}</h3>
    {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;
