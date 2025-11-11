import { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchSettings,
  updateSection,
  selectSettings,
  selectSettingsSaving
} from '@/store/slices/settingsSlice';

const BankingSettings = () => {
  const { t } = useTranslation('common');
  const dispatch = useAppDispatch();
  
  const settings = useAppSelector(selectSettings);
  const isSaving = useAppSelector(selectSettingsSaving);

  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [formData, setFormData] = useState({
    accountName: '',
    bankName: '',
    iban: '',
    swift: ''
  });

  useEffect(() => {
    dispatch(fetchSettings());
  }, [dispatch]);

  useEffect(() => {
    if (settings && settings.banking) {
      setFormData(settings.banking);
    }
  }, [settings?.banking]);

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

  const handleIBANChange = (value: string) => {
    let formatted = value.replace(/\s/g, '').toUpperCase();
    if (formatted && !formatted.startsWith('GR')) {
      formatted = 'GR' + formatted.replace(/^GR/, '');
    }
    if (formatted.length > 27) {
      formatted = formatted.substring(0, 27);
    }
    if (formatted.length > 2 && !/^GR[0-9A-Z]*$/.test(formatted)) {
      return;
    }
    handleInputChange('iban', formatted);
  };

  const validateGreekIBAN = (iban: string) => {
    return /^GR\d{25}$/.test(iban.replace(/\s/g, ''));
  };

  const handleSave = async () => {
    try {
      await dispatch(updateSection({ 
        section: 'banking', 
        data: formData 
      })).unwrap();
      showMessage('success', 'Banking information updated successfully');
    } catch (error) {
      showMessage('error', 'Failed to update banking information');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:via-slate-100 dark:to-slate-200 bg-clip-text text-transparent mb-2">
          Banking Settings
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Manage your banking and payment information
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-xl border ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Content */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10 rounded-3xl blur-xl"></div>
        <div className="relative bg-gray-100/70 dark:bg-slate-800/80 backdrop-blur-2xl border border-gray-300/40 dark:border-slate-700/50 rounded-3xl shadow-2xl shadow-gray-500/10 dark:shadow-slate-900/20 p-8">
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                Account Name *
              </label>
              <input
                type="text"
                value={formData.accountName}
                onChange={(e) => handleInputChange('accountName', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                placeholder="Account holder name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                Bank Name *
              </label>
              <input
                type="text"
                value={formData.bankName}
                onChange={(e) => handleInputChange('bankName', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                placeholder="Bank name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                Greek IBAN *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.iban}
                  onChange={(e) => handleIBANChange(e.target.value)}
                  className={`w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border ${
                    formData.iban && !validateGreekIBAN(formData.iban)
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                      : formData.iban && validateGreekIBAN(formData.iban)
                      ? 'border-green-500 focus:border-green-500 focus:ring-green-500/20'
                      : 'border-gray-300/50 dark:border-slate-600/50 focus:border-blue-500/50 focus:ring-blue-500/20'
                  } rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 transition-all`}
                  placeholder="GR1601101250000000012300695"
                  maxLength={27}
                />
                {formData.iban && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    {validateGreekIBAN(formData.iban) ? (
                      <span className="text-green-500">✓</span>
                    ) : (
                      <span className="text-red-500">✗</span>
                    )}
                  </div>
                )}
              </div>
              {formData.iban && !validateGreekIBAN(formData.iban) && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  IBAN must be in format GR + 25 digits (27 characters total)
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                SWIFT/BIC Code
              </label>
              <input
                type="text"
                value={formData.swift}
                onChange={(e) => handleInputChange('swift', e.target.value.toUpperCase())}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                placeholder="ETHNGRAA"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Usually 8 or 11 characters (optional for domestic transfers)
              </p>
            </div>

            <div className="pt-4">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            {/* Info Box */}
            <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl">
              <div className="flex items-start space-x-3">
                <div className="text-blue-600 dark:text-blue-400 text-lg">ℹ️</div>
                <div>
                  <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-1">
                    Banking Information Notice
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    This information will be used for invoice generation and payment processing. 
                    Ensure all details are accurate and match your official bank records.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankingSettings;