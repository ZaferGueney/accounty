import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { useAuth } from '@/contexts/AuthContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import Brand from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';

interface NavItem {
  key: string;
  href: string;
  icon: string;
  label: string;
}

/**
 * App navigation.
 * Desktop: one top bar with section links. Phone: slim top bar plus a bottom tab bar.
 */
const DashboardNavigation = () => {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, logout } = useAuth();
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  const items: NavItem[] = [
    { key: 'invoices', href: '/dashboard', icon: 'file', label: t('invoices') },
    { key: 'customers', href: '/customers', icon: 'users', label: t('customers') },
    { key: 'kads', href: '/kads', icon: 'list', label: t('nav.kad') },
    { key: 'settings', href: '/settings', icon: 'settings', label: t('settings') },
  ];

  const isActive = (href: string) => router.pathname === href;

  useEffect(() => {
    if (!userOpen) return;
    const onDown = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setUserOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [userOpen]);

  useEffect(() => {
    const close = () => setUserOpen(false);
    router.events.on('routeChangeStart', close);
    return () => router.events.off('routeChangeStart', close);
  }, [router.events]);

  const handleLogout = async () => {
    setUserOpen(false);
    await logout();
  };

  const initials =
    `${user?.firstName?.charAt(0) || ''}${user?.lastName?.charAt(0) || ''}`.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    '?';

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/75">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="shrink-0 rounded-md" aria-label="BillMou">
            <Brand />
          </Link>

          <nav aria-label={t('nav.main')} className="hidden h-full items-stretch gap-1 md:flex">
            {items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex items-center gap-2 px-3 text-sm font-medium transition-colors ${
                    active ? 'text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  <Icon name={item.icon} size={16} />
                  {item.label}
                  {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-ink" />}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeSwitcher />

            <div className="relative ml-1" ref={userRef}>
              <button
                type="button"
                onClick={() => setUserOpen((o) => !o)}
                className="flex h-9 items-center gap-2 rounded-full pl-0.5 pr-0.5 transition-colors hover:bg-sunken sm:pr-2.5"
                aria-haspopup="menu"
                aria-expanded={userOpen}
                aria-label={t('nav.account')}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                  {initials}
                </span>
                <span className="hidden max-w-[9rem] truncate text-sm font-medium text-ink sm:block">
                  {user?.firstName || user?.email}
                </span>
              </button>

              {userOpen && (
                <div role="menu" className="popover absolute right-0 top-full z-50 mt-1.5 w-64 p-1">
                  <div className="border-b border-line px-2.5 pb-2.5 pt-2">
                    <p className="truncate text-sm font-semibold text-ink">
                      {user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ')}
                    </p>
                    <p className="truncate text-xs text-muted">{user?.email}</p>
                  </div>
                  <div className="pt-1">
                    <Link href="/settings" role="menuitem" className="menu-item">
                      <Icon name="settings" />
                      {t('settings')}
                    </Link>
                    <button role="menuitem" onClick={handleLogout} className="menu-item text-danger hover:text-danger">
                      <Icon name="logout" />
                      {t('logout')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Phone: bottom tab bar */}
      <nav
        aria-label={t('nav.main')}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <div className="grid grid-cols-4">
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium transition-colors ${
                  active ? 'text-ink' : 'text-muted'
                }`}
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                    active ? 'bg-sunken' : ''
                  }`}
                >
                  <Icon name={item.icon} size={18} strokeWidth={active ? 2 : 1.75} />
                </span>
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default DashboardNavigation;
