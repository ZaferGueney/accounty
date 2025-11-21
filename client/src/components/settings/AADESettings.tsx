import { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { settingsAPI } from '@/utils/api';

const AADESettings = () => {
  const { t } = useTranslation('common');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    subscriptionKey: '',
    environment: 'development' as 'development' | 'production',
    isConfigured: false
  });

  useEffect(() => {
    fetchAADESettings();
  }, []);

  const fetchAADESettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.getSettings();
      if (response.data.success && response.data.data.aadeCredentials) {
        const creds = response.data.data.aadeCredentials;
        setFormData({
          username: creds.username || '',
          subscriptionKey: '', // Don't populate from backend for security
          environment: creds.environment || 'development',
          isConfigured: creds.isConfigured || false
        });
      }
    } catch (error) {
      console.error('Failed to fetch AADE settings:', error);
      showMessage('error', 'Failed to load AADE credentials');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!formData.username || !formData.subscriptionKey) {
      showMessage('error', 'Username and subscription key are required');
      return;
    }

    try {
      setSaving(true);
      const response = await settingsAPI.updateSection('aadeCredentials', formData);
      if (response.data.success) {
        showMessage('success', 'AADE credentials saved successfully');
        fetchAADESettings();
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.message || 'Failed to save AADE credentials');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!formData.username || !formData.subscriptionKey) {
      showMessage('error', 'Please save your credentials first');
      return;
    }

    try {
      setTesting(true);
      const response = await settingsAPI.testAADEConnection();
      if (response.data.success) {
        showMessage('success', 'AADE connection test successful!');
      } else {
        showMessage('error', response.data.message || 'Connection test failed');
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          AADE myDATA Configuration
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Configure your AADE myDATA API credentials to enable electronic invoice submission.
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              AADE Username *
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Your myDATA username"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Your myDATA API username (not your VAT number)
            </p>
          </div>

          {/* Environment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Environment
            </label>
            <select
              value={formData.environment}
              onChange={(e) => handleInputChange('environment', e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="development">Development</option>
              <option value="production">Production</option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Use development for testing, production for live invoices
            </p>
          </div>
        </div>

        {/* Subscription Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Subscription Key *
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={formData.subscriptionKey}
              onChange={(e) => handleInputChange('subscriptionKey', e.target.value)}
              className="w-full px-4 py-2 pr-12 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={formData.isConfigured ? '********** (configured)' : 'Your AADE subscription key'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Your AADE API subscription key (stored encrypted)
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
          >
            {saving ? 'Saving...' : 'Save Credentials'}
          </button>

          {formData.isConfigured && (
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-medium transition-colors"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          )}
        </div>

        {/* Configuration Status */}
        {formData.isConfigured && (
          <div className="mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-700 dark:text-green-300">
              ✅ AADE credentials are configured and ready to use
            </p>
          </div>
        )}
      </div>

      {/* Information */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
          How to get your AADE credentials:
        </h4>
        <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
          <li>Go to <a href="https://www1.aade.gr/saadeapps2/bookkeeper-web" target="_blank" rel="noopener noreferrer" className="underline">AADE myDATA Portal</a></li>
          <li>Log in with your TaxisNet credentials</li>
          <li>Subscribe to myDATA REST API</li>
          <li>Create a username and obtain your subscription key</li>
          <li>Enter the credentials here and save</li>
        </ol>
      </div>
    </div>
  );
};

export default AADESettings;
