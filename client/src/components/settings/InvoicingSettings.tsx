import { useTranslation } from 'next-i18next';
import EmptyState from '@/components/ui/EmptyState';

const InvoicingSettings = () => {
  const { t } = useTranslation('common');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">{t('settingsUi.invoicing.title')}</h2>
        <p className="section-desc">{t('settingsUi.invoicing.description')}</p>
      </div>
      <div className="card">
        <EmptyState
          icon="file"
          title={t('settingsUi.invoicing.emptyTitle')}
          description={t('settingsUi.invoicing.emptyDescription')}
          action={<span className="badge badge-neutral">{t('common.comingSoon')}</span>}
        />
      </div>
    </div>
  );
};

export default InvoicingSettings;
