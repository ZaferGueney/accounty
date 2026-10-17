import { useTranslation } from 'next-i18next';
import EmptyState from '@/components/ui/EmptyState';

const PreferencesSettings = () => {
  const { t } = useTranslation('common');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">{t('settingsUi.preferences.title')}</h2>
        <p className="section-desc">{t('settingsUi.preferences.description')}</p>
      </div>
      <div className="card">
        <EmptyState
          icon="sliders"
          title={t('settingsUi.preferences.emptyTitle')}
          description={t('settingsUi.preferences.emptyDescription')}
          action={<span className="badge badge-neutral">{t('common.comingSoon')}</span>}
        />
      </div>
    </div>
  );
};

export default PreferencesSettings;
