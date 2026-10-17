import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDispatch } from '@/store/hooks';
import { fetchSettings as _fetchSettings } from '@/store/slices/settingsSlice';

// Cast thunks to any to avoid TypeScript errors with JS slice
const fetchSettings = _fetchSettings as any;

import AppShell, { FullPageLoader } from '@/components/AppShell';
import SettingsNav, { SETTINGS_SECTIONS } from '@/components/SettingsNav';
import PageHeader from '@/components/ui/PageHeader';
import AccountSettings from '@/components/settings/AccountSettings';
import BusinessSettings from '@/components/settings/BusinessSettings';
import BankingSettings from '@/components/settings/BankingSettings';
import AADESettings from '@/components/settings/AADESettings';
import InvoicingSettings from '@/components/settings/InvoicingSettings';
import PreferencesSettings from '@/components/settings/PreferencesSettings';
import SubscriptionSettings from '@/components/settings/SubscriptionSettings';

const SECTION_KEYS: string[] = SETTINGS_SECTIONS.map((s) => s.key);

export default function SettingsPage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const dispatch = useAppDispatch();

  const [activeSection, setActiveSection] = useState('business');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchSettings());
    }
  }, [isAuthenticated, dispatch]);

  // Handle URL hash for direct navigation (e.g. /settings#banking)
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && SECTION_KEYS.includes(hash)) {
      setActiveSection(hash);
    }
  }, []);

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    window.history.replaceState(null, '', `#${section}`);
  };

  const renderSettingsContent = () => {
    switch (activeSection) {
      case 'account':
        return <AccountSettings />;
      case 'business':
        return <BusinessSettings />;
      case 'banking':
        return <BankingSettings />;
      case 'aade':
        return <AADESettings />;
      case 'invoicing':
        return <InvoicingSettings />;
      case 'preferences':
        return <PreferencesSettings />;
      case 'subscription':
        return <SubscriptionSettings />;
      default:
        return <BusinessSettings />;
    }
  };

  if (isLoading) {
    return <FullPageLoader label={t('common.loading')} />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppShell>
      <PageHeader title={t('settings')} description={t('settingsDescription')} />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:mt-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
        <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <SettingsNav activeSection={activeSection} onSectionChange={handleSectionChange} />
        </aside>
        <section key={activeSection} className="min-w-0">
          {renderSettingsContent()}
        </section>
      </div>
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
