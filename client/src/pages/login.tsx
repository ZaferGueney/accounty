import { useState } from 'react';
import { useRouter } from 'next/router';
import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useAuth } from '@/contexts/AuthContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';

export default function LoginPage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { login, isLoading } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(formData.email, formData.password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200/60 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 transition-all duration-700">
      {/* Complex Background Layers */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100/80 via-gray-50/40 to-gray-200/80 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800"></div>
        <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-blue-400/8 via-indigo-400/6 to-purple-600/8 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-emerald-400/8 via-teal-400/6 to-blue-500/8 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Navigation Header */}
      <nav className="relative z-50 backdrop-blur-2xl bg-gray-100/70 dark:bg-slate-900/70 border-b border-gray-300/30 dark:border-slate-700/40 shadow-lg shadow-gray-400/10 dark:shadow-slate-900/20">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-50/60 via-gray-100/40 to-gray-200/60 dark:from-slate-800/60 dark:via-slate-900/40 dark:to-slate-950/60"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-200/20 to-transparent dark:via-slate-700/20"></div>
        <div className="relative max-w-7xl mx-auto px-6 sm:px-8">
          <div className="flex justify-between items-center h-16">
            <button 
              onClick={() => router.push('/')}
              className="flex items-center space-x-3 relative z-10 group"
            >
              <div className="relative">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-all">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
              </div>
              <h1 className="text-xl font-semibold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                Accounty
              </h1>
            </button>

            <div className="flex items-center space-x-4 relative z-10">
              <LanguageSwitcher />
              <div className="w-px h-6 bg-gradient-to-b from-transparent via-gray-400/60 to-transparent dark:via-slate-600"></div>
              <ThemeSwitcher />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative flex items-center justify-center min-h-[calc(100vh-4rem)] px-6 py-12">
        <div className="w-full max-w-md">
          {/* Login Card */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10 rounded-3xl blur-xl"></div>
            <div className="relative bg-gray-100/70 dark:bg-slate-800/80 backdrop-blur-2xl border border-gray-300/40 dark:border-slate-700/50 rounded-3xl p-8 shadow-2xl shadow-gray-500/10 dark:shadow-slate-900/20">
              {/* Inner glass layers */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-gray-50/80 via-gray-100/40 to-gray-200/60 dark:from-slate-800/60 dark:via-slate-900/40 dark:to-slate-950/60"></div>
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-gray-200/30 to-transparent dark:from-slate-700/30"></div>
              
              <div className="relative z-10">
                {/* Header */}
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:via-slate-100 dark:to-slate-200 bg-clip-text text-transparent mb-2">
                    {t('welcomeBack')}
                  </h2>
                  <p className="text-slate-700 dark:text-slate-200">
                    {t('signInToYourDashboard')}
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                      {t('emailAddress')}
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                      placeholder="your@email.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                      {t('password')}
                    </label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                      placeholder="••••••••"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    {isLoading ? t('signingIn') : t('signIn')}
                  </button>
                </form>

                {/* Footer */}
                <div className="mt-8 text-center">
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    {t('dontHaveAccount')}{' '}
                    <button
                      onClick={() => router.push('/register')}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                    >
                      {t('signUp')}
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </div>
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