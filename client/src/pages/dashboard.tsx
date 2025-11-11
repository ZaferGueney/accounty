import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { 
  fetchCompletionStatus, 
  fetchSettings,
  selectCompletionStatus, 
  selectSettingsLoading 
} from '@/store/slices/settingsSlice';
import DashboardNavigation from '@/components/DashboardNavigation';
import Setup from '@/components/Setup';
import Invoice from '@/components/Invoice';

export default function DashboardPage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { isAuthenticated, user, logout, isLoading } = useAuth();
  
  const dispatch = useAppDispatch();
  const completionStatus = useAppSelector(selectCompletionStatus);
  const settingsLoading = useAppSelector(selectSettingsLoading);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchSettings());
      dispatch(fetchCompletionStatus());
    }
  }, [isAuthenticated, dispatch]);


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200/60 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-lg text-slate-700 dark:text-slate-200">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Show setup wizard if settings are not complete
  // Only wait for initial load, then show setup if not complete
  if (!isLoading && !completionStatus.isComplete) {
    return <Setup />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200/60 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 transition-all duration-700">
      {/* Complex Background Layers */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100/80 via-gray-50/40 to-gray-200/80 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800"></div>
        <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-blue-400/8 via-indigo-400/6 to-purple-600/8 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-emerald-400/8 via-teal-400/6 to-blue-500/8 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Navigation Header */}
      <DashboardNavigation />

      {/* Main Content */}
      <main className="relative px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <Invoice />
        </div>
      </main>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale ?? 'en', ['common'])),
    },
  };
};