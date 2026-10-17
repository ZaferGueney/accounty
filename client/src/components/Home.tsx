'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { healthCheck } from '@/utils/api';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeSwitcher from './ThemeSwitcher';
import Brand from './ui/Brand';
import Icon from './ui/Icon';

type ServerStatus = 'checking' | 'running' | 'disconnected';

const Home = () => {
  const { t } = useTranslation('common');
  const { isAuthenticated } = useAuth();
  const [serverStatus, setServerStatus] = useState<ServerStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    healthCheck()
      .then(() => !cancelled && setServerStatus('running'))
      .catch(() => !cancelled && setServerStatus('disconnected'));
    return () => {
      cancelled = true;
    };
  }, []);

  const facts = [
    { icon: 'file', title: t('home.facts.invoicesTitle'), text: t('home.facts.invoicesText') },
    { icon: 'send', title: t('home.facts.aadeTitle'), text: t('home.facts.aadeText') },
    { icon: 'users', title: t('home.facts.customersTitle'), text: t('home.facts.customersText') },
    { icon: 'globe', title: t('home.facts.languagesTitle'), text: t('home.facts.languagesText') },
  ];

  const statusDot =
    serverStatus === 'running' ? 'bg-success' : serverStatus === 'disconnected' ? 'bg-danger' : 'bg-muted animate-pulse';
  const statusText =
    serverStatus === 'running' ? t('running') : serverStatus === 'disconnected' ? t('disconnected') : t('home.checking');

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="mr-auto rounded-md" aria-label="BillMou">
            <Brand />
          </Link>
          <LanguageSwitcher />
          <ThemeSwitcher />
          <Link
            href={isAuthenticated ? '/dashboard' : '/login'}
            className="btn btn-primary btn-sm ml-1"
          >
            {isAuthenticated ? t('home.openDashboard') : t('signIn')}
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pt-28">
          <div className="max-w-2xl">
            <h1 className="text-balance text-[2.25rem] font-semibold leading-[1.1] tracking-[-0.025em] text-ink sm:text-5xl">
              {t('home.headline')}
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-ink-2">{t('home.lead')}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href={isAuthenticated ? '/dashboard' : '/login'} className="btn btn-primary btn-lg">
                {isAuthenticated ? t('home.openDashboard') : t('home.cta')}
                <Icon name="arrowRight" />
              </Link>
              {!isAuthenticated && (
                <Link href="/register" className="btn btn-ghost btn-lg">
                  {t('home.createAccount')}
                </Link>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="home-facts" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <h2 id="home-facts" className="sr-only">
              {t('home.factsHeading')}
            </h2>
            <dl className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
              {facts.map((f) => (
                <div key={f.title} className="flex gap-4">
                  <Icon name={f.icon} size={20} className="mt-0.5 text-accent" />
                  <div>
                    <dt className="font-semibold text-ink">{f.title}</dt>
                    <dd className="mt-1 max-w-md text-sm leading-relaxed text-muted">{f.text}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-muted sm:px-6 lg:px-8">
          <span>{t('description')}</span>
          <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${statusDot}`} aria-hidden="true" />
            {t('serverStatus')}: {statusText}
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Home;
