'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeSwitcher from './ThemeSwitcher';

const Home = () => {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuth();
  const [serverStatus, setServerStatus] = useState<'checking' | 'running' | 'disconnected'>('checking');

  useEffect(() => {
    fetch('http://localhost:7842/api/health')
      .then(res => res.json())
      .then(data => setServerStatus('running'))
      .catch(() => setServerStatus('disconnected'));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200/60 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 transition-all duration-700">
      {/* Complex Background Layers */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Base texture layer */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100/80 via-gray-50/40 to-gray-200/80 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800"></div>
        
        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}></div>
        
        {/* Ambient orbs */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-blue-400/8 via-indigo-400/6 to-purple-600/8 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-emerald-400/8 via-teal-400/6 to-blue-500/8 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-gradient-to-br from-purple-400/4 via-pink-400/3 to-orange-400/4 rounded-full blur-3xl animate-pulse delay-500"></div>
        
        {/* Additional depth layers */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-gray-200/20 via-transparent to-gray-300/20 dark:from-slate-800/20 dark:to-slate-700/20"></div>
      </div>

      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 backdrop-blur-2xl bg-gray-100/70 dark:bg-slate-900/70 border-b border-gray-300/30 dark:border-slate-700/40 shadow-lg shadow-gray-400/10 dark:shadow-slate-900/20">
        {/* Glass effect overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-gray-50/60 via-gray-100/40 to-gray-200/60 dark:from-slate-800/60 dark:via-slate-900/40 dark:to-slate-950/60"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-200/20 to-transparent dark:via-slate-700/20"></div>
        <div className="relative max-w-7xl mx-auto px-6 sm:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3 relative z-10">
              <div className="relative">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
                <div className="absolute inset-0 w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md"></div>
              </div>
              <h1 className="text-xl font-semibold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                Accounty
              </h1>
            </div>

            {/* Controls */}
            <div className="flex items-center space-x-4 relative z-10">
              <LanguageSwitcher />
              <div className="w-px h-6 bg-gradient-to-b from-transparent via-gray-400/60 to-transparent dark:via-slate-600"></div>
              <ThemeSwitcher />
              <div className="w-px h-6 bg-gradient-to-b from-transparent via-gray-400/60 to-transparent dark:via-slate-600"></div>
              
              {/* Auth Controls */}
              {isAuthenticated ? (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="px-3 py-2 text-sm font-medium text-slate-800 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {t('hi')}, {user?.firstName}
                  </button>
                  <button
                    onClick={logout}
                    className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    {t('logout')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => router.push('/login')}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
                >
                  {t('signIn')}
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative">
        {/* Hero Section */}
        <section className="relative pt-24 pb-20 px-6 sm:px-8">
          <div className="max-w-5xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200/60 dark:border-blue-700/60 mb-8 shadow-sm shadow-blue-500/5">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
              <span className="text-sm font-medium bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-300 dark:to-indigo-300 bg-clip-text text-transparent">
                🚀 Beta Version
              </span>
            </div>

            {/* Main Heading */}
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:via-slate-100 dark:to-slate-200 bg-clip-text text-transparent mb-6 leading-tight tracking-tight">
              {t('welcome')}
            </h2>
            
            {/* Subtitle */}
            <p className="text-xl sm:text-2xl text-slate-700 dark:text-slate-200 mb-16 max-w-4xl mx-auto leading-relaxed font-light">
              {t('description')}
            </p>

            {/* Server Status Card */}
            <div className="relative inline-flex items-center">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/8 to-emerald-500/8 rounded-2xl blur-xl"></div>
              <div className="relative flex items-center px-6 py-4 rounded-2xl bg-gray-100/70 dark:bg-slate-800/80 backdrop-blur-2xl border border-gray-300/40 dark:border-slate-700/50 shadow-xl shadow-gray-400/15 dark:shadow-slate-900/20">
                {/* Inner glass effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gray-50/70 via-gray-100/30 to-gray-200/50 dark:from-slate-800/60 dark:via-slate-900/40 dark:to-slate-950/60"></div>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-gray-200/20 to-transparent dark:from-slate-700/20"></div>
                <div className="relative flex items-center space-x-3 z-10">
                  <div className="relative">
                    <div className={`w-3 h-3 rounded-full ${
                      serverStatus === 'running' 
                        ? 'bg-emerald-500 shadow-lg shadow-emerald-500/60' 
                        : serverStatus === 'disconnected'
                        ? 'bg-red-500 shadow-lg shadow-red-500/60'
                        : 'bg-amber-500 shadow-lg shadow-amber-500/60'
                    } transition-all duration-300`}></div>
                    {serverStatus === 'running' && (
                      <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-500 animate-ping opacity-40"></div>
                    )}
                  </div>
                  <span className="text-sm font-medium text-slate-800 dark:text-white">
                    {t('serverStatus')}: {
                      serverStatus === 'running' ? t('running') :
                      serverStatus === 'disconnected' ? t('disconnected') :
                      'Checking...'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="relative py-20 px-6 sm:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Language Feature */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
                <div className="relative h-full p-8 rounded-3xl bg-gray-100/60 dark:bg-slate-800/80 backdrop-blur-2xl border border-gray-300/40 dark:border-slate-700/50 hover:border-blue-400/50 dark:hover:border-blue-500/60 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/15 dark:hover:shadow-blue-500/25 hover:-translate-y-2 group-hover:bg-gray-50/80 dark:group-hover:bg-slate-800/90">
                  {/* Inner glass layers */}
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-gray-50/80 via-gray-100/40 to-gray-200/60 dark:from-slate-800/60 dark:via-slate-900/40 dark:to-slate-950/60"></div>
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-gray-200/30 to-transparent dark:from-slate-700/30"></div>
                  <div className="relative mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:shadow-xl group-hover:shadow-blue-500/40 group-hover:scale-110 transition-all duration-500">
                      <span className="text-2xl">🌍</span>
                    </div>
                    <div className="absolute inset-0 w-14 h-14 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl opacity-0 group-hover:opacity-20 transition-all duration-500 blur-lg"></div>
                  </div>
                  <h3 className="text-xl font-semibold bg-gradient-to-br from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent mb-4">
                    {t('language')} Support
                  </h3>
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed font-light">
                    Switch seamlessly between English, Greek, and German with full localization support.
                  </p>
                </div>
              </div>

              {/* Theme Feature */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-orange-500/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
                <div className="relative h-full p-8 rounded-3xl bg-gray-100/60 dark:bg-slate-800/80 backdrop-blur-2xl border border-gray-300/40 dark:border-slate-700/50 hover:border-purple-400/50 dark:hover:border-purple-500/60 transition-all duration-500 hover:shadow-2xl hover:shadow-purple-500/15 dark:hover:shadow-purple-500/25 hover:-translate-y-2 group-hover:bg-gray-50/80 dark:group-hover:bg-slate-800/90">
                  {/* Inner glass layers */}
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-gray-50/80 via-gray-100/40 to-gray-200/60 dark:from-slate-800/60 dark:via-slate-900/40 dark:to-slate-950/60"></div>
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-gray-200/30 to-transparent dark:from-slate-700/30"></div>
                  <div className="relative mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:shadow-xl group-hover:shadow-purple-500/40 group-hover:scale-110 transition-all duration-500">
                      <span className="text-2xl">🎨</span>
                    </div>
                    <div className="absolute inset-0 w-14 h-14 bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl opacity-0 group-hover:opacity-20 transition-all duration-500 blur-lg"></div>
                  </div>
                  <h3 className="text-xl font-semibold bg-gradient-to-br from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent mb-4">
                    {t('theme')} Toggle
                  </h3>
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed font-light">
                    Beautiful dark and light themes with smooth transitions and system preference detection.
                  </p>
                </div>
              </div>

              {/* Server Feature */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-cyan-500/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
                <div className="relative h-full p-8 rounded-3xl bg-gray-100/60 dark:bg-slate-800/80 backdrop-blur-2xl border border-gray-300/40 dark:border-slate-700/50 hover:border-emerald-400/50 dark:hover:border-emerald-500/60 transition-all duration-500 hover:shadow-2xl hover:shadow-emerald-500/15 dark:hover:shadow-emerald-500/25 hover:-translate-y-2 group-hover:bg-gray-50/80 dark:group-hover:bg-slate-800/90">
                  {/* Inner glass layers */}
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-gray-50/80 via-gray-100/40 to-gray-200/60 dark:from-slate-800/60 dark:via-slate-900/40 dark:to-slate-950/60"></div>
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-gray-200/30 to-transparent dark:from-slate-700/30"></div>
                  <div className="relative mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:shadow-xl group-hover:shadow-emerald-500/40 group-hover:scale-110 transition-all duration-500">
                      <span className="text-2xl">⚡</span>
                    </div>
                    <div className="absolute inset-0 w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl opacity-0 group-hover:opacity-20 transition-all duration-500 blur-lg"></div>
                  </div>
                  <h3 className="text-xl font-semibold bg-gradient-to-br from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent mb-4">
                    Real-time Connection
                  </h3>
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed font-light">
                    Live server monitoring with instant status updates and health checks on port 7842.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom Spacer */}
        <div className="h-20"></div>
      </main>
    </div>
  );
};

export default Home;