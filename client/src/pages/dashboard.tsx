import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchCompletionStatus as _fetchCompletionStatus,
  fetchSettings as _fetchSettings,
  selectCompletionStatus,
} from '@/store/slices/settingsSlice';

// Cast thunks to any to avoid TypeScript errors with JS slice
const fetchCompletionStatus = _fetchCompletionStatus as any;
const fetchSettings = _fetchSettings as any;

import AppShell, { FullPageLoader } from '@/components/AppShell';
import Setup from '@/components/Setup';
import Invoice from '@/components/Invoice';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';

type CheckState = 'pending' | 'done' | 'failed';

export default function DashboardPage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  const dispatch = useAppDispatch();
  const completionStatus = useAppSelector(selectCompletionStatus);
  const [check, setCheck] = useState<CheckState>('pending');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    setCheck('pending');
    dispatch(fetchSettings());
    // Wait for the completion check before deciding between the wizard and the app,
    // so a slow request never flashes the setup wizard.
    Promise.resolve(dispatch(fetchCompletionStatus()))
      .then((res: any) => {
        if (cancelled) return;
        setCheck(res?.error ? 'failed' : 'done');
      })
      .catch(() => !cancelled && setCheck('failed'));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, dispatch, attempt]);

  if (isLoading || (isAuthenticated && check === 'pending')) {
    return <FullPageLoader label={t('common.loading')} />;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (check === 'failed') {
    return (
      <AppShell>
        <div className="card">
          <EmptyState
            icon="alertCircle"
            title={t('errors.loadFailedTitle')}
            description={t('errors.serverUnreachable')}
            action={
              <Button variant="primary" icon="refresh" onClick={() => setAttempt((a) => a + 1)}>
                {t('common.retry')}
              </Button>
            }
          />
        </div>
      </AppShell>
    );
  }

  // Show setup wizard if settings are not complete
  if (!completionStatus.isComplete) {
    return <Setup />;
  }

  return (
    <AppShell>
      <Invoice />
    </AppShell>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale ?? 'en', ['common'])),
    },
  };
};
