import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

const PageHeader = ({ title, description, actions, className = '' }: PageHeaderProps) => (
  <div className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
    <div className="min-w-0">
      <h1 className="page-title">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export default PageHeader;
