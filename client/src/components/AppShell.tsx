import type { ReactNode } from 'react';
import DashboardNavigation from '@/components/DashboardNavigation';
import Spinner from '@/components/ui/Spinner';

interface AppShellProps {
  children: ReactNode;
  /** Wider/narrower content column. */
  width?: 'default' | 'narrow' | 'full';
}

/** Signed-in layout: navigation plus a centered content column. */
const AppShell = ({ children, width = 'default' }: AppShellProps) => {
  const max = width === 'narrow' ? 'max-w-4xl' : width === 'full' ? 'max-w-none' : 'max-w-7xl';
  return (
    <div className="min-h-[100dvh] bg-canvas">
      <DashboardNavigation />
      <main className={`mx-auto ${max} px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:pb-16 lg:px-8`}>{children}</main>
    </div>
  );
};

/** Full-page loading state used while auth/session resolves. */
export const FullPageLoader = ({ label }: { label?: string }) => (
  <div className="flex min-h-[100dvh] items-center justify-center bg-canvas text-muted">
    <Spinner size={22} label={label || 'Loading'} />
  </div>
);

export default AppShell;
