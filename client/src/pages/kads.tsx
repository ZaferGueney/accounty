import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useAuth } from '@/contexts/AuthContext';
import AppShell, { FullPageLoader } from '@/components/AppShell';
import KADManager from '@/components/KADManager';

const KADManagementPage = () => {
  const { t } = useTranslation('common');
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <FullPageLoader label={t('common.loading')} />;
  }

  if (!user) {
    return null;
  }

  return (
    <AppShell>
      <KADManager />
    </AppShell>
  );
};

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale ?? 'en', ['common'])),
    },
  };
};

export default KADManagementPage;
