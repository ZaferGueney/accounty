import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useAuth } from '@/contexts/AuthContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import Brand from '@/components/ui/Brand';
import Field from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';

const MIN_PASSWORD = 6;

export default function RegisterPage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { register } = useAuth();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [touchedConfirm, setTouchedConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const mismatch = touchedConfirm && form.confirmPassword !== '' && form.password !== form.confirmPassword;
  const tooShort = form.password.length > 0 && form.password.length < MIN_PASSWORD;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (form.password.length < MIN_PASSWORD) {
      setError(t('auth.passwordTooShort', { count: MIN_PASSWORD }));
      return;
    }
    if (form.password !== form.confirmPassword) {
      setTouchedConfirm(true);
      setError(t('auth.passwordMismatch'));
      return;
    }
    setSubmitting(true);
    try {
      await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        company: form.company.trim() || undefined,
      });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message || t('errors.generic'));
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <header className="mx-auto flex h-14 w-full max-w-6xl items-center justify-end gap-1 px-4 sm:px-6">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 inline-flex rounded-md" aria-label="Accounty">
            <Brand />
          </Link>

          <h1 className="text-2xl font-semibold tracking-[-0.015em] text-ink">{t('auth.registerTitle')}</h1>
          <p className="mt-1 text-sm text-muted">{t('auth.registerSubtitle')}</p>

          <div className="card card-pad mt-6">
            {error && (
              <Alert tone="danger" className="mb-5" onDismiss={() => setError('')} dismissLabel={t('common.dismiss')}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('firstName')} required>
                  <input
                    name="firstName"
                    autoComplete="given-name"
                    value={form.firstName}
                    onChange={handleChange}
                    className="input"
                    autoFocus
                  />
                </Field>
                <Field label={t('lastName')} required>
                  <input
                    name="lastName"
                    autoComplete="family-name"
                    value={form.lastName}
                    onChange={handleChange}
                    className="input"
                  />
                </Field>
              </div>

              <Field label={t('emailAddress')} required>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  value={form.email}
                  onChange={handleChange}
                  className="input"
                  placeholder="name@company.gr"
                />
              </Field>

              <Field label={t('company')} optionalLabel={`(${t('common.optional')})`}>
                <input
                  name="company"
                  autoComplete="organization"
                  value={form.company}
                  onChange={handleChange}
                  className="input"
                />
              </Field>

              <Field
                label={t('password')}
                required
                hint={t('auth.passwordHint', { count: MIN_PASSWORD })}
                error={tooShort ? t('auth.passwordTooShort', { count: MIN_PASSWORD }) : undefined}
              >
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD}
                  value={form.password}
                  onChange={handleChange}
                  className="input"
                />
              </Field>

              <Field
                label={t('confirmPassword')}
                required
                error={mismatch ? t('auth.passwordMismatch') : undefined}
              >
                <input
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  onBlur={() => setTouchedConfirm(true)}
                  className="input"
                />
              </Field>

              <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full">
                {submitting ? t('auth.creatingAccount') : t('auth.createAccount')}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-muted">
            {t('auth.haveAccount')}{' '}
            <Link href="/login" className="font-medium text-accent underline-offset-4 hover:underline">
              {t('signIn')}
            </Link>
          </p>
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
