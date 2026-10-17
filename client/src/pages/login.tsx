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

export default function LoginPage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { login } = useAuth();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await login(formData.email, formData.password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message || t('errors.generic'));
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <header className="mx-auto flex h-14 w-full max-w-6xl items-center justify-end gap-1 px-4 sm:px-6">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 inline-flex rounded-md" aria-label="BillMou">
            <Brand />
          </Link>

          <h1 className="text-2xl font-semibold tracking-[-0.015em] text-ink">{t('welcomeBack')}</h1>
          <p className="mt-1 text-sm text-muted">{t('signInToYourDashboard')}</p>

          <div className="card card-pad mt-6">
            {error && (
              <Alert tone="danger" className="mb-5" onDismiss={() => setError('')} dismissLabel={t('common.dismiss')}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
              <Field label={t('emailAddress')} required>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input"
                  placeholder="name@company.gr"
                  autoFocus
                />
              </Field>

              <Field label={t('password')} required>
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  className="input"
                />
              </Field>

              <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full">
                {submitting ? t('signingIn') : t('signIn')}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-muted">
            {t('dontHaveAccount')}{' '}
            <Link href="/register" className="font-medium text-accent underline-offset-4 hover:underline">
              {t('signUp')}
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
