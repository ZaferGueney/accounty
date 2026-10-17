import { useState, type ReactNode } from 'react';
import { useTranslation } from 'next-i18next';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { getApiBaseUrl } from '@/utils/api';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Field from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { apiErrorText } from '@/components/ui/format';

type FormKey = 'profile' | 'email' | 'password' | 'accountType';

const SettingsCard = ({
  title,
  description,
  onSubmit,
  footer,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  footer: ReactNode;
  children: ReactNode;
}) => (
  <form onSubmit={onSubmit} className="card" noValidate={false}>
    <div className="card-pad space-y-4">
      <div>
        <h3 className="section-title">{title}</h3>
        {description && <p className="section-desc">{description}</p>}
      </div>
      {children}
    </div>
    <div className="flex justify-end gap-2 border-t border-line px-4 py-3 sm:px-6">{footer}</div>
  </form>
);

const AccountSettings = () => {
  const { t } = useTranslation('common');
  const { user, refreshUser } = useAuth();
  const toast = useToast();

  const [busy, setBusy] = useState<FormKey | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FormKey, string>>>({});
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || ''
  });

  const [emailData, setEmailData] = useState({
    newEmail: '',
    password: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [accountTypeData, setAccountTypeData] = useState({
    isAccountant: user?.isAccountant || false
  });

  const api = axios.create({
    baseURL: getApiBaseUrl()
  });

  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('accounty_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  const setError = (key: FormKey, text?: string) =>
    setErrors((prev) => ({ ...prev, [key]: text }));

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy('profile');
    setError('profile');

    try {
      const response = await api.put('/api/users/names', profileData);
      if (response.data.success) {
        toast.success(t('settingsUi.account.profileSaved'));
        refreshUser();
      }
    } catch (error: any) {
      setError('profile', apiErrorText(error, t('settingsUi.account.profileFailed')));
    } finally {
      setBusy(null);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy('email');
    setError('email');

    try {
      const response = await api.put('/api/users/email', emailData);
      if (response.data.success) {
        toast.success(t('settingsUi.account.emailSaved'));
        setEmailData({ newEmail: '', password: '' });
        refreshUser();
      }
    } catch (error: any) {
      setError('email', apiErrorText(error, t('settingsUi.account.emailFailed')));
    } finally {
      setBusy(null);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('password');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMismatch(true);
      return;
    }
    setPasswordMismatch(false);
    setBusy('password');

    try {
      const response = await api.put('/api/users/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      if (response.data.success) {
        toast.success(t('settingsUi.account.passwordSaved'));
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (error: any) {
      setError('password', apiErrorText(error, t('settingsUi.account.passwordFailed')));
    } finally {
      setBusy(null);
    }
  };

  const handleUpdateAccountType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy('accountType');
    setError('accountType');

    try {
      const response = await api.put('/api/users/account-type', {
        isAccountant: accountTypeData.isAccountant
      });
      if (response.data.success) {
        toast.success(t('settingsUi.account.typeSaved'));
        refreshUser();
      }
    } catch (error: any) {
      setError('accountType', apiErrorText(error, t('settingsUi.account.typeFailed')));
    } finally {
      setBusy(null);
    }
  };

  const errorAlert = (key: FormKey) =>
    errors[key] ? (
      <Alert tone="danger" onDismiss={() => setError(key)} dismissLabel={t('common.dismiss')}>
        {errors[key]}
      </Alert>
    ) : null;

  const accountTypes = [
    { key: 'individual', isAccountant: false },
    { key: 'accountant', isAccountant: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">{t('settingsUi.account.title')}</h2>
        <p className="section-desc">{t('settingsUi.account.description')}</p>
      </div>

      {/* Name */}
      <SettingsCard
        title={t('settingsUi.account.nameTitle')}
        onSubmit={handleUpdateProfile}
        footer={
          <Button type="submit" variant="primary" loading={busy === 'profile'} disabled={!!busy && busy !== 'profile'}>
            {busy === 'profile' ? t('common.saving') : t('common.saveChanges')}
          </Button>
        }
      >
        {errorAlert('profile')}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('firstName')} required>
            <input
              type="text"
              className="input"
              autoComplete="given-name"
              value={profileData.firstName}
              onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
            />
          </Field>
          <Field label={t('lastName')} required>
            <input
              type="text"
              className="input"
              autoComplete="family-name"
              value={profileData.lastName}
              onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
            />
          </Field>
        </div>
      </SettingsCard>

      {/* Email */}
      <SettingsCard
        title={t('email')}
        description={
          <>
            {t('settingsUi.account.currentEmail')}{' '}
            <span className="font-medium text-ink">{user?.email}</span>
          </>
        }
        onSubmit={handleUpdateEmail}
        footer={
          <Button type="submit" variant="primary" loading={busy === 'email'} disabled={!!busy && busy !== 'email'}>
            {busy === 'email' ? t('updating') : t('updateEmail')}
          </Button>
        }
      >
        {errorAlert('email')}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('newEmail')} required>
            <input
              type="email"
              className="input"
              autoComplete="email"
              value={emailData.newEmail}
              onChange={(e) => setEmailData(prev => ({ ...prev, newEmail: e.target.value }))}
            />
          </Field>
          <Field label={t('currentPassword')} required hint={t('settingsUi.account.confirmWithPassword')}>
            <input
              type="password"
              className="input"
              autoComplete="current-password"
              value={emailData.password}
              onChange={(e) => setEmailData(prev => ({ ...prev, password: e.target.value }))}
            />
          </Field>
        </div>
      </SettingsCard>

      {/* Password */}
      <SettingsCard
        title={t('password')}
        onSubmit={handleChangePassword}
        footer={
          <Button type="submit" variant="primary" loading={busy === 'password'} disabled={!!busy && busy !== 'password'}>
            {busy === 'password' ? t('changing') : t('changePassword')}
          </Button>
        }
      >
        {errorAlert('password')}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('currentPassword')} required className="sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
            <input
              type="password"
              className="input"
              autoComplete="current-password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
            />
          </Field>
          <Field label={t('newPassword')} required hint={t('settingsUi.account.passwordHint')}>
            <input
              type="password"
              className="input"
              autoComplete="new-password"
              minLength={6}
              value={passwordData.newPassword}
              onChange={(e) => {
                setPasswordMismatch(false);
                setPasswordData(prev => ({ ...prev, newPassword: e.target.value }));
              }}
            />
          </Field>
          <Field
            label={t('confirmPassword')}
            required
            error={passwordMismatch ? t('settingsUi.account.passwordMismatch') : undefined}
          >
            <input
              type="password"
              className="input"
              autoComplete="new-password"
              minLength={6}
              value={passwordData.confirmPassword}
              onChange={(e) => {
                setPasswordMismatch(false);
                setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }));
              }}
            />
          </Field>
        </div>
      </SettingsCard>

      {/* Account type */}
      <SettingsCard
        title={t('settingsUi.account.typeTitle')}
        description={t('settingsUi.account.typeDescription')}
        onSubmit={handleUpdateAccountType}
        footer={
          <Button
            type="submit"
            variant="primary"
            loading={busy === 'accountType'}
            disabled={!!busy && busy !== 'accountType'}
          >
            {busy === 'accountType' ? t('updating') : t('settingsUi.account.typeSave')}
          </Button>
        }
      >
        {errorAlert('accountType')}
        <fieldset>
          <legend className="sr-only">{t('settingsUi.account.typeTitle')}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {accountTypes.map((type) => {
              const checked = accountTypeData.isAccountant === type.isAccountant;
              const current = !!user?.isAccountant === type.isAccountant;
              return (
                <label
                  key={type.key}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors ${
                    checked ? 'border-accent bg-accent-soft/60' : 'border-line-strong hover:bg-sunken'
                  }`}
                >
                  <input
                    type="radio"
                    name="accountType"
                    value={type.key}
                    checked={checked}
                    onChange={() => setAccountTypeData(prev => ({ ...prev, isAccountant: type.isAccountant }))}
                    className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                      {t(`settingsUi.account.types.${type.key}.title`)}
                      {current && <span className="badge badge-neutral">{t('settingsUi.account.current')}</span>}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {t(`settingsUi.account.types.${type.key}.description`)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        {accountTypeData.isAccountant && (
          <Alert tone="info">{t('settingsUi.account.accountantNote')}</Alert>
        )}
      </SettingsCard>
    </div>
  );
};

export default AccountSettings;
