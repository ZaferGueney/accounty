import { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchSettings,
  updateSection,
  fetchTaxOffices,
  validateAFM,
  selectSettings,
  selectTaxOffices,
  selectSettingsSaving,
  selectAFMValidation
} from '@/store/slices/settingsSlice';
import KADSelector from '@/components/KADSelector';

const BusinessSettings = () => {
  const { t } = useTranslation('common');
  const dispatch = useAppDispatch();
  
  const settings = useAppSelector(selectSettings);
  const taxOffices = useAppSelector(selectTaxOffices);
  const isSaving = useAppSelector(selectSettingsSaving);
  const afmValidation = useAppSelector(selectAFMValidation);

  const [activeTab, setActiveTab] = useState('basic');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [formData, setFormData] = useState({
    business: {
      legalName: '',
      tradingName: '',
      legalForm: '',
      description: ''
    },
    tax: {
      afm: '',
      gemi: '',
      doy: { code: '', name: '' },
      activityCodes: [],
      vatRegistered: false,
      vatNumber: ''
    },
    address: {
      street: '',
      number: '',
      area: '',
      city: '',
      postalCode: '',
      prefecture: ''
    },
    contact: {
      phone: '',
      mobile: '',
      email: '',
      website: ''
    }
  });

  const legalForms = [
    { value: 'individual', label: 'Individual Business (Ατομική Επιχείρηση)' },
    { value: 'oe', label: 'General Partnership (Ο.Ε.)' },
    { value: 'ee', label: 'Limited Partnership (Ε.Ε.)' },
    { value: 'epe', label: 'Limited Liability Company (Ε.Π.Ε.)' },
    { value: 'ae', label: 'Corporation (Α.Ε.)' },
    { value: 'ike', label: 'Private Company (Ι.Κ.Ε.)' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    dispatch(fetchSettings());
    dispatch(fetchTaxOffices());
  }, [dispatch]);

  useEffect(() => {
    if (settings && settings._id) {
      setFormData({
        business: settings.business || formData.business,
        tax: settings.tax || formData.tax,
        address: settings.address || formData.address,
        contact: settings.contact || formData.contact
      });
    }
  }, [settings?._id]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleInputChange = (section: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleNestedInputChange = (section: string, parent: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [parent]: {
          ...prev[section][parent],
          [field]: value
        }
      }
    }));
  };

  const handleAFMChange = (value: string) => {
    handleInputChange('tax', 'afm', value);
    if (value.length === 9) {
      dispatch(validateAFM(value));
    }
  };

  const handleVATNumberChange = (value: string) => {
    let formatted = value.toUpperCase();
    if (formatted && !formatted.startsWith('EL')) {
      formatted = 'EL' + formatted.replace(/^EL/, '');
    }
    if (formatted.length > 11) {
      formatted = formatted.substring(0, 11);
    }
    if (formatted.length > 2 && !/^EL\d*$/.test(formatted)) {
      return;
    }
    handleInputChange('tax', 'vatNumber', formatted);
  };

  const handleSave = async (section: string) => {
    try {
      await dispatch(updateSection({ 
        section, 
        data: formData[section] 
      })).unwrap();
      showMessage('success', `${section.charAt(0).toUpperCase() + section.slice(1)} information updated successfully`);
    } catch (error) {
      showMessage('error', 'Failed to update information');
    }
  };

  const tabs = [
    { key: 'basic', title: 'Basic Info', icon: '🏢' },
    { key: 'tax', title: 'Tax Details', icon: '📊' },
    { key: 'address', title: 'Address', icon: '📍' },
    { key: 'contact', title: 'Contact', icon: '📞' }
  ];

  const validateVATNumber = (vatNumber: string) => {
    return /^EL\d{9}$/.test(vatNumber);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'basic':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                Legal Business Name *
              </label>
              <input
                type="text"
                value={formData.business.legalName}
                onChange={(e) => handleInputChange('business', 'legalName', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                placeholder="Your legal business name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                Trading Name
              </label>
              <input
                type="text"
                value={formData.business.tradingName}
                onChange={(e) => handleInputChange('business', 'tradingName', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                placeholder="Trading name (if different)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                Legal Form *
              </label>
              <select
                value={formData.business.legalForm}
                onChange={(e) => handleInputChange('business', 'legalForm', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
              >
                <option value="">Select legal form</option>
                {legalForms.map(form => (
                  <option key={form.value} value={form.value}>{form.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                Description
              </label>
              <textarea
                value={formData.business.description}
                onChange={(e) => handleInputChange('business', 'description', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                placeholder="Brief description of your business"
              />
            </div>

            <button
              onClick={() => handleSave('business')}
              disabled={isSaving}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        );

      case 'tax':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                AFM (Tax Number) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.tax.afm}
                  onChange={(e) => handleAFMChange(e.target.value)}
                  maxLength={9}
                  className={`w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border ${
                    afmValidation.isValid === true 
                      ? 'border-green-500' 
                      : afmValidation.isValid === false 
                      ? 'border-red-500' 
                      : 'border-gray-300/50 dark:border-slate-600/50'
                  } rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all`}
                  placeholder="9-digit tax number"
                />
                {afmValidation.isLoading && (
                  <div className="absolute right-3 top-3">
                    <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  </div>
                )}
              </div>
              {afmValidation.error && (
                <p className="text-red-500 text-sm mt-1">{afmValidation.error}</p>
              )}
              {afmValidation.isValid && (
                <p className="text-green-500 text-sm mt-1">AFM is valid ✓</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                GEMI (Γ.Ε.ΜΗ.) Number
              </label>
              <input
                type="text"
                value={formData.tax.gemi || ''}
                onChange={(e) => handleInputChange('tax', 'gemi', e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                placeholder="General Commercial Registry number"
              />
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Optional - Company registration number (Γενικό Εμπορικό Μητρώο)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                Tax Office *
              </label>
              <select
                value={formData.tax.doy?.code || ''}
                onChange={(e) => {
                  const selectedOffice = taxOffices.find(office => office.code === e.target.value);
                  if (selectedOffice) {
                    handleNestedInputChange('tax', 'doy', 'code', selectedOffice.code);
                    handleNestedInputChange('tax', 'doy', 'name', selectedOffice.name);
                  }
                }}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
              >
                <option value="">Select tax office</option>
                {taxOffices.map(office => (
                  <option key={office.code} value={office.code}>
                    {office.name} - {office.city}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                Activity Codes (KAD) *
              </label>
              <KADSelector
                selectedKADs={formData.tax.activityCodes}
                onKADsChange={(kads) => handleInputChange('tax', 'activityCodes', kads)}
                maxSelections={50}
                placeholder="Search for your business activity codes..."
              />
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="vatRegistered"
                checked={formData.tax.vatRegistered}
                onChange={(e) => {
                  handleInputChange('tax', 'vatRegistered', e.target.checked);
                  if (!e.target.checked) {
                    handleInputChange('tax', 'vatNumber', '');
                  }
                }}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <label htmlFor="vatRegistered" className="text-sm font-medium text-slate-800 dark:text-white">
                VAT Registered
              </label>
            </div>

            {formData.tax.vatRegistered && (
              <div>
                <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                  VAT Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.tax.vatNumber}
                    onChange={(e) => handleVATNumberChange(e.target.value)}
                    className={`w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border ${
                      formData.tax.vatNumber && !validateVATNumber(formData.tax.vatNumber)
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                        : formData.tax.vatNumber && validateVATNumber(formData.tax.vatNumber)
                        ? 'border-green-500 focus:border-green-500 focus:ring-green-500/20'
                        : 'border-gray-300/50 dark:border-slate-600/50 focus:border-blue-500/50 focus:ring-blue-500/20'
                    } rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 transition-all`}
                    placeholder="EL123456789"
                    maxLength={11}
                  />
                  {formData.tax.vatNumber && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      {validateVATNumber(formData.tax.vatNumber) ? (
                        <span className="text-green-500">✓</span>
                      ) : (
                        <span className="text-red-500">✗</span>
                      )}
                    </div>
                  )}
                </div>
                {formData.tax.vatNumber && !validateVATNumber(formData.tax.vatNumber) && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    VAT number must be in format EL + 9 digits
                  </p>
                )}
              </div>
            )}

            <button
              onClick={() => handleSave('tax')}
              disabled={isSaving}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        );

      case 'address':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                  Street *
                </label>
                <input
                  type="text"
                  value={formData.address.street}
                  onChange={(e) => handleInputChange('address', 'street', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                  placeholder="Street name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                  Number *
                </label>
                <input
                  type="text"
                  value={formData.address.number}
                  onChange={(e) => handleInputChange('address', 'number', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                  placeholder="No."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                Area/District
              </label>
              <input
                type="text"
                value={formData.address.area}
                onChange={(e) => handleInputChange('address', 'area', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                placeholder="Area or district"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                  City *
                </label>
                <input
                  type="text"
                  value={formData.address.city}
                  onChange={(e) => handleInputChange('address', 'city', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                  placeholder="City"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                  Postal Code *
                </label>
                <input
                  type="text"
                  value={formData.address.postalCode}
                  onChange={(e) => handleInputChange('address', 'postalCode', e.target.value)}
                  maxLength={5}
                  className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                  placeholder="12345"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                Prefecture *
              </label>
              <input
                type="text"
                value={formData.address.prefecture}
                onChange={(e) => handleInputChange('address', 'prefecture', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                placeholder="Prefecture"
              />
            </div>

            <button
              onClick={() => handleSave('address')}
              disabled={isSaving}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        );

      case 'contact':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                  Phone *
                </label>
                <input
                  type="tel"
                  value={formData.contact.phone}
                  onChange={(e) => handleInputChange('contact', 'phone', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                  placeholder="2101234567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                  Mobile
                </label>
                <input
                  type="tel"
                  value={formData.contact.mobile}
                  onChange={(e) => handleInputChange('contact', 'mobile', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                  placeholder="6901234567"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                Email *
              </label>
              <input
                type="email"
                value={formData.contact.email}
                onChange={(e) => handleInputChange('contact', 'email', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                placeholder="business@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                Website
              </label>
              <input
                type="url"
                value={formData.contact.website}
                onChange={(e) => handleInputChange('contact', 'website', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                placeholder="https://your-website.com"
              />
            </div>

            <button
              onClick={() => handleSave('contact')}
              disabled={isSaving}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:via-slate-100 dark:to-slate-200 bg-clip-text text-transparent mb-2">
          Business Settings
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Manage your company information and legal details
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
        <div className="relative bg-gray-100/70 dark:bg-slate-800/80 backdrop-blur-2xl border border-gray-300/40 dark:border-slate-700/50 rounded-3xl shadow-2xl shadow-gray-500/10 dark:shadow-slate-900/20">
          
          {/* Tabs */}
          <div className="p-6 border-b border-gray-300/30 dark:border-slate-700/40">
            <div className="flex space-x-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessSettings;