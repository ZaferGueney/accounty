import { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { settingsAPI } from '@/utils/api';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Field from '@/components/ui/Field';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { apiErrorText } from '@/components/ui/format';

type Result = { type: 'success' | 'error'; text: string } | null;

const AADESettings = () => {
  const { t } = useTranslation('common');
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<Result>(null);
  const [testResult, setTestResult] = useState<Result>(null);
  const [missing, setMissing] = useState<{ username?: boolean; subscriptionKey?: boolean }>({});
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    subscriptionKey: '',
    environment: 'development' as 'development' | 'production',
    isConfigured: false
  });

  useEffect(() => {
    fetchAADESettings();
  }, []);

  const fetchAADESettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.getSettings();
      if (response.data.success && response.data.data.aadeCredentials) {
        const creds = response.data.data.aadeCredentials;
        setFormData({
          username: creds.username || '',
          subscriptionKey: '', // Don't populate from backend for security
          environment: creds.environment || 'development',
          isConfigured: creds.isConfigured || false
        });
      }
    } catch (error) {
      console.error('Failed to fetch AADE settings:', error);
      setMessage({ type: 'error', text: apiErrorText(error, t('settingsUi.aade.loadFailed')) });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === 'username' || field === 'subscriptionKey') {
      setMissing(prev => ({ ...prev, [field]: false }));
    }
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (saving) return;
    setMessage(null);
    if (!formData.username || !formData.subscriptionKey) {
      setMissing({ username: !formData.username, subscriptionKey: !formData.subscriptionKey });
      return;
    }

    try {
      setSaving(true);
      const response = await settingsAPI.updateSection('aadeCredentials', formData);
      if (response.data.success) {
        toast.success(t('settingsUi.aade.saved'));
        fetchAADESettings();
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: apiErrorText(error, t('settingsUi.aade.saveFailed')) });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (testing) return;
    setTestResult(null);
    if (!formData.username || !formData.subscriptionKey) {
      setTestResult({ type: 'error', text: t('settingsUi.aade.saveFirst') });
      return;
    }

    try {
      setTesting(true);
      const response = await settingsAPI.testAADEConnection();
      if (response.data.success) {
        setTestResult({ type: 'success', text: t('settingsUi.aade.testOk') });
      } else {
        setTestResult({ type: 'error', text: response.data.message || t('settingsUi.aade.testFailed') });
      }
    } catch (error: any) {
      setTestResult({ type: 'error', text: apiErrorText(error, t('settingsUi.aade.testFailed')) });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="space-y-2">
          <div className="skeleton h-6 w-56" />
          <div className="skeleton h-4 w-80 max-w-full" />
        </div>
        <div className="card card-pad space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="skeleton h-10" />
            <div className="skeleton h-10" />
          </div>
          <div className="skeleton h-10" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">{t('settingsUi.aade.title')}</h2>
          <p className="section-desc">{t('settingsUi.aade.description')}</p>
        </div>
        <span className={`badge badge-dot ${formData.isConfigured ? 'badge-success' : 'badge-warning'}`}>
          {formData.isConfigured ? t('settingsUi.aade.configured') : t('settingsUi.aade.notConfigured')}
        </span>
      </div>

      {message && (
        <Alert tone={message.type === 'success' ? 'success' : 'danger'} onDismiss={() => setMessage(null)} dismissLabel={t('common.dismiss')}>
          {message.text}
        </Alert>
      )}

      <div className="card">
        <div className="card-pad space-y-4">
          <h3 className="section-title">{t('settingsUi.aade.credentials')}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('settingsUi.aade.username')}
              required
              hint={t('settingsUi.aade.usernameHint')}
              error={missing.username ? t('settingsUi.aade.usernameRequired') : undefined}
            >
              <input
                type="text"
                className="input"
                autoComplete="off"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder={t('settingsUi.aade.usernamePlaceholder')}
              />
            </Field>

            <div>
              <span className="label" id="aade-env-label">{t('settingsUi.aade.environment')}</span>
              <div className="segmented" role="group" aria-labelledby="aade-env-label">
                {(['production', 'development'] as const).map(env => (
                  <button
                    key={env}
                    type="button"
                    aria-pressed={formData.environment === env}
                    onClick={() => handleInputChange('environment', env)}
                  >
                    {t(`settingsUi.aade.env.${env}`)}
                  </button>
                ))}
              </div>
              <p className="hint">{t('settingsUi.aade.environmentHint')}</p>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="aade-key" className="label">
                {t('settingsUi.aade.subscriptionKey')}
                <span className="ml-0.5 text-danger" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <input
                  id="aade-key"
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-11"
                  autoComplete="off"
                  aria-invalid={missing.subscriptionKey ? true : undefined}
                  aria-describedby="aade-key-msg"
                  value={formData.subscriptionKey}
                  onChange={(e) => handleInputChange('subscriptionKey', e.target.value)}
                  placeholder={
                    formData.isConfigured
                      ? t('settingsUi.aade.keyConfiguredPlaceholder')
                      : t('settingsUi.aade.keyPlaceholder')
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-1 my-auto flex h-8 w-8 items-center justify-center rounded text-muted transition-colors hover:bg-sunken hover:text-ink"
                  aria-label={showPassword ? t('settingsUi.aade.hideKey') : t('settingsUi.aade.showKey')}
                  aria-pressed={showPassword}
                >
                  <Icon name={showPassword ? 'lock' : 'eye'} size={16} />
                </button>
              </div>
              {missing.subscriptionKey ? (
                <p id="aade-key-msg" className="field-error">{t('settingsUi.aade.keyRequired')}</p>
              ) : (
                <p id="aade-key-msg" className="hint">{t('settingsUi.aade.keyHint')}</p>
              )}
            </div>
          </div>

          {testResult && (
            <Alert
              tone={testResult.type === 'success' ? 'success' : 'danger'}
              onDismiss={() => setTestResult(null)}
              dismissLabel={t('common.dismiss')}
            >
              {testResult.text}
            </Alert>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3 sm:px-6">
          {formData.isConfigured && (
            <Button variant="secondary" icon="refresh" loading={testing} disabled={saving} onClick={handleTestConnection}>
              {testing ? t('settingsUi.aade.testing') : t('settingsUi.aade.testConnection')}
            </Button>
          )}
          <Button variant="primary" loading={saving} disabled={testing} onClick={handleSave}>
            {saving ? t('common.saving') : t('settingsUi.aade.saveCredentials')}
          </Button>
        </div>
      </div>

      <div className="card card-pad">
        <h3 className="section-title">{t('settingsUi.aade.howTo')}</h3>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink-2 marker:text-muted">
          <li>
            {t('settingsUi.aade.step1')}{' '}
            <a
              href="https://www1.aade.gr/saadeapps2/bookkeeper-web"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-accent underline"
            >
              {t('settingsUi.aade.portal')}
              <Icon name="external" size={13} />
            </a>
          </li>
          <li>{t('settingsUi.aade.step2')}</li>
          <li>{t('settingsUi.aade.step3')}</li>
          <li>{t('settingsUi.aade.step4')}</li>
          <li>{t('settingsUi.aade.step5')}</li>
        </ol>
      </div>
    </div>
  );
};

export default AADESettings;
