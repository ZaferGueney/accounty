import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { useAuth } from '@/contexts/AuthContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';

const DashboardNavigation = () => {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menu when route changes
  useEffect(() => {
    const handleRouteChange = () => setIsMenuOpen(false);
    router.events.on('routeChangeStart', handleRouteChange);
    return () => router.events.off('routeChangeStart', handleRouteChange);
  }, [router.events]);

  const menuItems = [
    {
      key: 'dashboard',
      title: t('dashboard'),
      icon: '🏠',
      href: '/dashboard',
      description: t('dashboardDescription')
    },
    {
      key: 'settings',
      title: t('settings'),
      icon: '⚙️',
      href: '/settings',
      description: t('settingsDescription')
    },
    {
      key: 'kads',
      title: 'KAD Management',
      icon: '📋',
      href: '/kads',
      description: 'Manage Greek Activity Codes'
    },
    {
      key: 'invoices',
      title: t('invoices'),
      icon: '📄',
      href: '/invoices',
      description: t('invoicesDescription')
    },
    {
      key: 'clients',
      title: t('clients'),
      icon: '👥',
      href: '/clients',
      description: t('clientsDescription')
    },
    {
      key: 'reports',
      title: t('reports'),
      icon: '📊',
      href: '/reports',
      description: t('reportsDescription')
    }
  ];

  const handleLogout = async () => {
    setIsMenuOpen(false);
    await logout();
  };

  const navigateTo = (href: string) => {
    setIsMenuOpen(false);
    router.push(href);
  };

  return (
    <nav className="relative z-50 backdrop-blur-2xl bg-gray-100/70 dark:bg-slate-900/70 border-b border-gray-300/30 dark:border-slate-700/40 shadow-lg shadow-gray-400/10 dark:shadow-slate-900/20">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-50/60 via-gray-100/40 to-gray-200/60 dark:from-slate-800/60 dark:via-slate-900/40 dark:to-slate-950/60"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-200/20 to-transparent dark:via-slate-700/20"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side - Logo + Burger Menu */}
          <div className="flex items-center space-x-4">
            {/* Burger Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-xl bg-gray-200/60 dark:bg-slate-700/60 hover:bg-gray-300/60 dark:hover:bg-slate-600/60 transition-all duration-200 group relative z-10"
              aria-label="Toggle menu"
            >
              <div className="w-5 h-5 flex flex-col justify-center items-center space-y-1">
                <span className={`block w-5 h-0.5 bg-slate-700 dark:bg-white transition-all duration-200 ${
                  isMenuOpen ? 'rotate-45 translate-y-1.5' : ''
                }`}></span>
                <span className={`block w-5 h-0.5 bg-slate-700 dark:bg-white transition-all duration-200 ${
                  isMenuOpen ? 'opacity-0' : ''
                }`}></span>
                <span className={`block w-5 h-0.5 bg-slate-700 dark:bg-white transition-all duration-200 ${
                  isMenuOpen ? '-rotate-45 -translate-y-1.5' : ''
                }`}></span>
              </div>
            </button>

            {/* Logo */}
            <button 
              onClick={() => router.push('/dashboard')}
              className="flex items-center space-x-3 relative z-10 group"
            >
              <div className="relative">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-all">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
              </div>
              <h1 className="text-xl font-semibold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent hidden sm:block">
                Accounty
              </h1>
            </button>
          </div>

          {/* Right side - Controls */}
          <div className="flex items-center space-x-4 relative z-10">
            <LanguageSwitcher />
            <div className="w-px h-6 bg-gradient-to-b from-transparent via-gray-400/60 to-transparent dark:via-slate-600"></div>
            <ThemeSwitcher />
            <div className="w-px h-6 bg-gradient-to-b from-transparent via-gray-400/60 to-transparent dark:via-slate-600"></div>
            
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-slate-800 dark:text-white hidden sm:block">
                {t('hi')}, {user?.firstName}
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                {t('logout')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Burger Menu Dropdown */}
      <div
        ref={menuRef}
        className={`absolute top-full left-0 w-full bg-gray-100/95 dark:bg-slate-900/95 backdrop-blur-2xl border-b border-gray-300/30 dark:border-slate-700/40 shadow-2xl transition-all duration-300 ${
          isMenuOpen ? 'opacity-100 visible transform translate-y-0' : 'opacity-0 invisible transform -translate-y-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {menuItems.map((item) => (
              <button
                key={item.key}
                onClick={() => navigateTo(item.href)}
                className={`text-left p-4 rounded-2xl transition-all duration-200 group hover:scale-105 ${
                  router.pathname === item.href
                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-gray-50/80 dark:bg-slate-800/80 hover:bg-gray-100/90 dark:hover:bg-slate-700/90 text-slate-800 dark:text-white'
                }`}
              >
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className={`text-3xl ${
                    router.pathname === item.href
                      ? 'scale-110'
                      : 'group-hover:scale-110'
                  } transition-transform duration-200`}>
                    {item.icon}
                  </div>
                  <div>
                    <h3 className={`font-semibold ${
                      router.pathname === item.href
                        ? 'text-white'
                        : 'text-slate-800 dark:text-white'
                    }`}>
                      {item.title}
                    </h3>
                    <p className={`text-sm mt-1 ${
                      router.pathname === item.href
                        ? 'text-blue-100'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}>
                      {item.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* User Info Section in Mobile */}
          <div className="mt-6 sm:hidden">
            <div className="p-4 bg-gray-50/80 dark:bg-slate-800/80 rounded-2xl">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-medium">
                    {user?.firstName?.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-slate-800 dark:text-white">
                    {user?.fullName}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {user?.email}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </nav>
  );
};

export default DashboardNavigation;