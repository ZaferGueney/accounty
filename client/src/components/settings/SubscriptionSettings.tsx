import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { useAuth } from '@/contexts/AuthContext';
import EmptyState from '@/components/ui/EmptyState';
import { formatDate } from '@/components/ui/format';

const statusTone: Record<string, string> = {
  active: 'badge-success',
  inactive: 'badge-neutral',
  canceled: 'badge-warning',
  expired: 'badge-danger',
};

const SubscriptionSettings = () => {
  const { t } = useTranslation('common');
  const { locale } = useRouter();
  const { user } = useAuth();

  const plan = user?.subscription?.plan || 'free';
  const status = user?.subscription?.status || 'inactive';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">{t('settingsUi.subscription.title')}</h2>
        <p className="section-desc">{t('settingsUi.subscription.description')}</p>
      </div>

      <div className="card">
        <div className="card-pad">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="section-title">{t('settingsUi.subscription.currentPlan')}</h3>
              <p className="section-desc">{t('settingsUi.subscription.currentPlanDesc')}</p>
            </div>
            <span className={`badge badge-dot ${statusTone[status] || 'badge-neutral'}`}>
              {t(`settingsUi.subscription.statuses.${status}`, { defaultValue: status })}
            </span>
          </div>
          <dl className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-muted">{t('plan')}</dt>
              <dd className="mt-1 text-[0.9375rem] font-semibold text-ink">
                {t(`settingsUi.subscription.plans.${plan}`, { defaultValue: plan })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">{t('status')}</dt>
              <dd className="mt-1 text-[0.9375rem] font-semibold text-ink">
                {t(`settingsUi.subscription.statuses.${status}`, { defaultValue: status })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">{t('settingsUi.subscription.nextBilling')}</dt>
              <dd className="num mt-1 text-[0.9375rem] font-semibold text-ink">
                {user?.subscription?.endDate ? formatDate(user.subscription.endDate, locale) : '—'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="card">
        <EmptyState
          icon="card"
          title={t('settingsUi.subscription.manageTitle')}
          description={t('settingsUi.subscription.manageDescription')}
          action={<span className="badge badge-neutral">{t('common.comingSoon')}</span>}
        />
      </div>
    </div>
  );
};

export default SubscriptionSettings;
