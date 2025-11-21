import { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { bankingAPI } from '@/utils/api';

const BankingSettings = () => {
  const { t } = useTranslation('common');

  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [formData, setFormData] = useState({
    accountName: '',
    bankName: '',
    iban: '',
    swift: '',
    notes: '',
    isDefault: false
  });

  useEffect(() => {
    fetchBanks();
  }, []);

  const fetchBanks = async () => {
    try {
      setLoading(true);
      const response = await bankingAPI.getBanks();
      if (response.data.success) {
        setBanks(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch banks:', error);
      showMessage('error', 'Failed to load banking information');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const resetForm = () => {
    setFormData({
      accountName: '',
      bankName: '',
      iban: '',
      swift: '',
      notes: '',
      isDefault: false
    });
  };

  const handleInputChange = (field: string, value: string | boolean) => {
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

  const handleAddBank = async () => {
    try {
      setSaving(true);
      const response = await bankingAPI.createBank(formData);
      if (response.data.success) {
        showMessage('success', 'Bank added successfully');
        fetchBanks();
        setShowAddModal(false);
        resetForm();
      }
    } catch (error) {
      showMessage('error', error.response?.data?.message || 'Failed to add bank');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateBank = async () => {
    try {
      setSaving(true);
      const response = await bankingAPI.updateBank(editingBank._id, formData);
      if (response.data.success) {
        showMessage('success', 'Bank updated successfully');
        fetchBanks();
        setShowEditModal(false);
        setEditingBank(null);
        resetForm();
      }
    } catch (error) {
      showMessage('error', error.response?.data?.message || 'Failed to update bank');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBank = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bank?')) return;

    try {
      const response = await bankingAPI.deleteBank(id);
      if (response.data.success) {
        showMessage('success', 'Bank deleted successfully');
        fetchBanks();
      }
    } catch (error) {
      showMessage('error', error.response?.data?.message || 'Failed to delete bank');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const response = await bankingAPI.setDefaultBank(id);
      if (response.data.success) {
        showMessage('success', 'Default bank updated');
        fetchBanks();
      }
    } catch (error) {
      showMessage('error', error.response?.data?.message || 'Failed to set default bank');
    }
  };

  const openEditModal = (bank) => {
    setEditingBank(bank);
    setFormData({
      accountName: bank.accountName,
      bankName: bank.bankName,
      iban: bank.iban,
      swift: bank.swift || '',
      notes: bank.notes || '',
      isDefault: bank.isDefault
    });
    setShowEditModal(true);
  };

  const formatIBAN = (iban: string) => {
    return iban.replace(/(.{4})/g, '$1 ').trim();
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:via-slate-100 dark:to-slate-200 bg-clip-text text-transparent mb-2">
            Banking Settings
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Manage your bank accounts for invoicing
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
        >
          + Add Bank
        </button>
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

      {/* Banks List */}
      {loading ? (
        <div className="text-center py-12 text-slate-600 dark:text-slate-400">
          Loading banks...
        </div>
      ) : banks.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🏦</div>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            No bank accounts yet
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
          >
            Add Your First Bank
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {banks.map(bank => (
            <div
              key={bank._id}
              className="relative bg-gray-100/70 dark:bg-slate-800/80 backdrop-blur-2xl border border-gray-300/40 dark:border-slate-700/50 rounded-2xl shadow-xl p-6"
            >
              {bank.isDefault && (
                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium rounded-full">
                    Default
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Bank Name</div>
                  <div className="font-semibold text-slate-900 dark:text-white">{bank.bankName}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Account Holder</div>
                  <div className="text-slate-900 dark:text-white">{bank.accountName}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">IBAN</div>
                  <div className="font-mono text-sm text-slate-900 dark:text-white">{formatIBAN(bank.iban)}</div>
                </div>
                {bank.swift && (
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">SWIFT/BIC</div>
                    <div className="font-mono text-sm text-slate-900 dark:text-white">{bank.swift}</div>
                  </div>
                )}
              </div>

              {bank.notes && (
                <div className="mb-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Notes</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">{bank.notes}</div>
                </div>
              )}

              <div className="flex gap-2">
                {!bank.isDefault && (
                  <button
                    onClick={() => handleSetDefault(bank._id)}
                    className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                  >
                    Set as Default
                  </button>
                )}
                <button
                  onClick={() => openEditModal(bank)}
                  className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteBank(bank._id)}
                  className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Bank Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => {
                setShowAddModal(false);
                setShowEditModal(false);
                setEditingBank(null);
                resetForm();
              }}
            ></div>

            <div className="relative inline-block align-bottom bg-white dark:bg-slate-800 rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-slate-800 px-6 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {showAddModal ? 'Add Bank Account' : 'Edit Bank Account'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                      setEditingBank(null);
                      resetForm();
                    }}
                    className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg p-2 transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      value={formData.bankName}
                      onChange={(e) => handleInputChange('bankName', e.target.value)}
                      placeholder="e.g., National Bank of Greece"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Account Holder Name *
                    </label>
                    <input
                      type="text"
                      value={formData.accountName}
                      onChange={(e) => handleInputChange('accountName', e.target.value)}
                      placeholder="Account holder name"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Greek IBAN *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.iban}
                        onChange={(e) => handleIBANChange(e.target.value)}
                        className={`w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border ${
                          formData.iban && !validateGreekIBAN(formData.iban)
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                            : formData.iban && validateGreekIBAN(formData.iban)
                            ? 'border-green-500 focus:border-green-500 focus:ring-green-500/20'
                            : 'border-gray-300 dark:border-slate-600 focus:border-blue-500/50 focus:ring-blue-500/20'
                        } rounded-xl text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 transition-all`}
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      SWIFT/BIC Code
                    </label>
                    <input
                      type="text"
                      value={formData.swift}
                      onChange={(e) => handleInputChange('swift', e.target.value.toUpperCase())}
                      placeholder="ETHNGRAA"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Usually 8 or 11 characters (optional for domestic transfers)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      placeholder="Add any notes about this account..."
                      rows={2}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                    />
                  </div>

                  {banks.length === 0 && (
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.isDefault}
                        onChange={(e) => handleInputChange('isDefault', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Set as default bank
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-slate-700/50 px-6 py-4 sm:flex sm:flex-row-reverse gap-3">
                <button
                  onClick={showAddModal ? handleAddBank : handleUpdateBank}
                  disabled={saving || !formData.bankName || !formData.accountName || !validateGreekIBAN(formData.iban)}
                  className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : showAddModal ? 'Add Bank' : 'Update Bank'}
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setEditingBank(null);
                    resetForm();
                  }}
                  className="w-full sm:w-auto px-6 py-3 bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 text-gray-900 dark:text-white rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankingSettings;
