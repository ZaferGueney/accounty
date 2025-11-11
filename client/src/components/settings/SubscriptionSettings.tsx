import { useTranslation } from 'next-i18next';
import { useAuth } from '@/contexts/AuthContext';

const SubscriptionSettings = () => {
  const { t } = useTranslation('common');
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:via-slate-100 dark:to-slate-200 bg-clip-text text-transparent mb-2">
          💎 Subscription
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Manage your subscription plan and billing information
        </p>
      </div>

      {/* Current Plan */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-blue-500/10 rounded-3xl blur-xl"></div>
        <div className="relative bg-gray-100/70 dark:bg-slate-800/80 backdrop-blur-2xl border border-gray-300/40 dark:border-slate-700/50 rounded-3xl shadow-2xl shadow-gray-500/10 dark:shadow-slate-900/20 p-8">
          
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">
                Current Plan
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Your active subscription details
              </p>
            </div>
            <div className={`px-4 py-2 rounded-full text-sm font-medium ${
              user?.subscription?.plan === 'premium' 
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white'
                : user?.subscription?.plan === 'basic'
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                : 'bg-gray-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
            }`}>
              {user?.subscription?.plan?.toUpperCase() || 'FREE'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-gray-50/70 dark:bg-slate-700/70 rounded-2xl">
              <div className="text-2xl mb-2">📊</div>
              <h4 className="font-medium text-slate-800 dark:text-white mb-1">Plan</h4>
              <p className="text-slate-600 dark:text-slate-400 capitalize">
                {user?.subscription?.plan || 'Free'}
              </p>
            </div>

            <div className="text-center p-4 bg-gray-50/70 dark:bg-slate-700/70 rounded-2xl">
              <div className="text-2xl mb-2">✅</div>
              <h4 className="font-medium text-slate-800 dark:text-white mb-1">Status</h4>
              <p className={`capitalize ${
                user?.subscription?.status === 'active' 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {user?.subscription?.status || 'Inactive'}
              </p>
            </div>

            <div className="text-center p-4 bg-gray-50/70 dark:bg-slate-700/70 rounded-2xl">
              <div className="text-2xl mb-2">📅</div>
              <h4 className="font-medium text-slate-800 dark:text-white mb-1">Next Billing</h4>
              <p className="text-slate-600 dark:text-slate-400">
                {user?.subscription?.endDate 
                  ? new Date(user.subscription.endDate).toLocaleDateString()
                  : 'N/A'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Options */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-orange-500/10 rounded-3xl blur-xl"></div>
        <div className="relative bg-gray-100/70 dark:bg-slate-800/80 backdrop-blur-2xl border border-gray-300/40 dark:border-slate-700/50 rounded-3xl shadow-2xl shadow-gray-500/10 dark:shadow-slate-900/20 p-8">
          
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl text-white">💎</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">
              Subscription Management
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Stripe integration for plan upgrades, downgrades, and billing management.
            </p>
            <div className="inline-flex items-center px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-xl text-sm">
              🚧 Coming Soon - Stripe Integration
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionSettings;