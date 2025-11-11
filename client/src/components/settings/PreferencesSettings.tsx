import { useTranslation } from 'next-i18next';

const PreferencesSettings = () => {
  const { t } = useTranslation('common');

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:via-slate-100 dark:to-slate-200 bg-clip-text text-transparent mb-2">
          ⚙️ Preferences
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Customize your app experience and notification settings
        </p>
      </div>

      {/* Content */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-blue-500/5 to-cyan-500/10 rounded-3xl blur-xl"></div>
        <div className="relative bg-gray-100/70 dark:bg-slate-800/80 backdrop-blur-2xl border border-gray-300/40 dark:border-slate-700/50 rounded-3xl shadow-2xl shadow-gray-500/10 dark:shadow-slate-900/20 p-8">
          
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl text-white">⚙️</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">
              App Preferences
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Language, theme, and notification preferences are available in the main navigation.<br/>
              Additional preferences will be added here.
            </p>
            <div className="inline-flex items-center px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-xl text-sm">
              🚧 Coming Soon - Advanced Preferences
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreferencesSettings;