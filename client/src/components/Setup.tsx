import { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchSettings as _fetchSettings,
  fetchCompletionStatus as _fetchCompletionStatus,
  updateSection as _updateSection,
  updateSettings as _updateSettings,
  fetchTaxOffices as _fetchTaxOffices,
  fetchActivityCodes as _fetchActivityCodes,
  validateAFM as _validateAFM,
  selectSettings,
  selectCompletionStatus,
  selectTaxOffices,
  selectActivityCodes,
  selectSettingsSaving,
  selectAFMValidation
} from '@/store/slices/settingsSlice';

// Cast thunks to any to avoid TypeScript errors with JS slice
const fetchSettings = _fetchSettings as any;
const fetchCompletionStatus = _fetchCompletionStatus as any;
const updateSection = _updateSection as any;
const updateSettings = _updateSettings as any;
const fetchTaxOffices = _fetchTaxOffices as any;
const fetchActivityCodes = _fetchActivityCodes as any;
const validateAFM = _validateAFM as any;
import DashboardNavigation from '@/components/DashboardNavigation';
import KADSelector from '@/components/KADSelector';

const Setup = () => {
  const { t } = useTranslation('common');
  const router = useRouter();
  const dispatch = useAppDispatch();
  
  const settings = useAppSelector(selectSettings);
  const completionStatus = useAppSelector(selectCompletionStatus);
  const taxOffices = useAppSelector(selectTaxOffices);
  const activityCodes = useAppSelector(selectActivityCodes);
  const isSaving = useAppSelector(selectSettingsSaving);
  const afmValidation = useAppSelector(selectAFMValidation);
  

  const [currentStep, setCurrentStep] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  // Initialize form data with proper default values to prevent uncontrolled input warnings
  const getInitialFormData = () => ({
    business: {
      legalName: '',
      tradingName: '',
      legalForm: '',
      description: ''
    },
    tax: {
      afm: '',
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
    },
    banking: {
      accountName: '',
      bankName: '',
      iban: '',
      swift: ''
    }
  });

  const [formData, setFormData] = useState(getInitialFormData);

  const steps = [
    { key: 'business', title: t('businessInformation'), icon: '🏢' },
    { key: 'tax', title: t('taxDetails'), icon: '📊' },
    { key: 'address', title: t('businessAddress'), icon: '📍' },
    { key: 'contact', title: t('contactInformation'), icon: '📞' },
    { key: 'banking', title: t('bankingDetails'), icon: '🏦' }
  ];

  const legalForms = [
    { value: 'individual', label: t('legalForms.individual') },
    { value: 'oe', label: t('legalForms.oe') },
    { value: 'ee', label: t('legalForms.ee') },
    { value: 'epe', label: t('legalForms.epe') },
    { value: 'ae', label: t('legalForms.ae') },
    { value: 'ike', label: t('legalForms.ike') },
    { value: 'other', label: t('legalForms.other') }
  ];

  useEffect(() => {
    dispatch(fetchSettings());
    dispatch(fetchCompletionStatus());
    dispatch(fetchTaxOffices());
    dispatch(fetchActivityCodes());
  }, [dispatch]);

  // Load form data when settings are available
  useEffect(() => {
    if (settings && settings._id) {
      // Settings exist in database, merge with defaults
      const initialData = getInitialFormData();
      setFormData({
        business: {
          ...initialData.business,
          ...(settings.business || {})
        },
        tax: {
          ...initialData.tax,
          ...(settings.tax || {}),
          doy: settings.tax?.doy || initialData.tax.doy,
          activityCodes: settings.tax?.activityCodes || []
        },
        address: {
          ...initialData.address,
          ...(settings.address || {})
        },
        contact: {
          ...initialData.contact,
          ...(settings.contact || {})
        },
        banking: {
          ...initialData.banking,
          ...(settings.banking || {})
        }
      });
    }
  }, [settings?._id]); // Only run when settings ID changes

  useEffect(() => {
    // Only set initial step once based on completion status
    if (!hasInitialized && completionStatus.completedSteps) {
      const stepIndex = steps.findIndex(step => !completionStatus.completedSteps[step.key]);
      if (stepIndex !== -1) {
        setCurrentStep(stepIndex);
      }
      setHasInitialized(true);
    }
  }, [completionStatus.completedSteps, hasInitialized, steps]);

  // Auto-save form data after user stops typing (debounced)
  useEffect(() => {
    const autoSaveTimer = setTimeout(async () => {
      if (hasInitialized && !isNavigating) {
        const currentStepKey = steps[currentStep].key;
        try {
          await dispatch(updateSection({
            section: currentStepKey,
            data: formData[currentStepKey as keyof typeof formData]
          })).unwrap();
        } catch (error) {
          // Auto-save failed silently
        }
      }
    }, 2000); // Save after 2 seconds of inactivity

    return () => clearTimeout(autoSaveTimer);
  }, [formData, currentStep, hasInitialized, isNavigating, dispatch, steps]);

  const handleInputChange = (section: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section as keyof typeof prev] as any),
        [field]: value
      }
    }));
  };

  // Validation functions
  const validateVATNumber = (vatNumber: string) => {
    // VAT number should be EL + 9 digits
    const vatPattern = /^EL\d{9}$/;
    return vatPattern.test(vatNumber);
  };

  const validateGreekIBAN = (iban: string) => {
    // Greek IBAN should be GR + 2 check digits + 21 alphanumeric chars = 27 total
    const greekIBANPattern = /^GR\d{25}$/;
    return greekIBANPattern.test(iban);
  };

  const handleVATNumberChange = (value: string) => {
    // Auto-format VAT number
    let formatted = value.toUpperCase();
    if (formatted && !formatted.startsWith('EL')) {
      formatted = 'EL' + formatted.replace(/^EL/, '');
    }
    // Limit to EL + 9 digits
    if (formatted.length > 11) {
      formatted = formatted.substring(0, 11);
    }
    // Only allow EL followed by digits
    if (formatted.length > 2 && !/^EL\d*$/.test(formatted)) {
      return; // Don't update if invalid characters
    }
    handleInputChange('tax', 'vatNumber', formatted);
  };

  const handleIBANChange = (value: string) => {
    // Auto-format IBAN
    let formatted = value.replace(/\s/g, '').toUpperCase();
    if (formatted && !formatted.startsWith('GR')) {
      formatted = 'GR' + formatted.replace(/^GR/, '');
    }
    // Limit to GR + 25 characters
    if (formatted.length > 27) {
      formatted = formatted.substring(0, 27);
    }
    // Only allow GR followed by alphanumeric
    if (formatted.length > 2 && !/^GR[0-9A-Z]*$/.test(formatted)) {
      return; // Don't update if invalid characters
    }
    handleInputChange('banking', 'iban', formatted);
  };

  const handleNestedInputChange = (section: string, parent: string, field: string, value: any) => {
    setFormData(prev => {
      const sectionData = prev[section as keyof typeof prev] as any;
      return {
        ...prev,
        [section]: {
          ...sectionData,
          [parent]: {
            ...sectionData[parent],
            [field]: value
          }
        }
      };
    });
  };

  const handleAFMChange = (value: string) => {
    handleInputChange('tax', 'afm', value);
    if (value.length === 9) {
      dispatch(validateAFM(value));
    }
  };

  const handleNext = async () => {
    const currentStepKey = steps[currentStep].key;
    
    try {
      setIsNavigating(true);
      
      await dispatch(updateSection({
        section: currentStepKey,
        data: formData[currentStepKey as keyof typeof formData]
      })).unwrap();
      
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
        setTimeout(() => {
          setIsNavigating(false);
        }, 500);
      } else {
        // Complete the setup by updating settings to mark as complete
        console.log('Completing setup...');
        await dispatch(updateSettings({ 
          isComplete: true 
        })).unwrap();
        
        // Refresh completion status
        await dispatch(fetchCompletionStatus());
        
        console.log('Setup completed successfully, redirecting...');
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Error saving section:', error);
      console.error('Error details:', error.response?.data || error.message);
      setIsNavigating(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setIsNavigating(true);
      setCurrentStep(currentStep - 1);
      setTimeout(() => {
        setIsNavigating(false);
      }, 500);
    }
  };

  const isStepValid = () => {
    const step = steps[currentStep];
    const data = formData[step.key as keyof typeof formData] as any;

    switch (step.key) {
      case 'business':
        return data.legalName && data.legalForm;
      case 'tax':
        // Only require AFM validation if AFM is entered, otherwise just check basic fields
        const afmValid = !data.afm || afmValidation.isValid !== false;
        // VAT validation: only validate if VAT registered AND VAT number is provided
        const vatValid = !data.vatRegistered || (data.vatRegistered && data.vatNumber && validateVATNumber(data.vatNumber)) || (data.vatRegistered && !data.vatNumber);
        return data.afm && data.doy.code && data.activityCodes.length > 0 && afmValid && vatValid;
      case 'address':
        return data.street && data.number && data.city && data.postalCode && data.prefecture;
      case 'contact':
        return data.phone && data.email;
      case 'banking':
        const ibanValid = !data.iban || validateGreekIBAN(data.iban);
        return data.accountName && data.bankName && data.iban && ibanValid;
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    const step = steps[currentStep];
    
    switch (step.key) {
      case 'business':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                {t('legalBusinessName')} *
              </label>
              <input
                type="text"
                value={formData.business.legalName}
                onChange={(e) => handleInputChange('business', 'legalName', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                placeholder={t('placeholders.legalBusinessName')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                {t('tradingName')}
              </label>
              <input
                type="text"
                value={formData.business.tradingName}
                onChange={(e) => handleInputChange('business', 'tradingName', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                placeholder={t('placeholders.tradingName')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                {t('legalForm')} *
              </label>
              <select
                value={formData.business.legalForm}
                onChange={(e) => handleInputChange('business', 'legalForm', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
              >
                <option value="">{t('placeholders.selectLegalForm')}</option>
                {legalForms.map(form => (
                  <option key={form.value} value={form.value}>{form.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                {t('businessDescription')}
              </label>
              <textarea
                value={formData.business.description}
                onChange={(e) => handleInputChange('business', 'description', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                placeholder={t('placeholders.businessDescription')}
              />
            </div>
          </div>
        );

      case 'tax':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                {t('afm')} *
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
                  placeholder={t('placeholders.afm')}
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
                {t('taxOffice')} *
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
                className=""
              />
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="vatRegistered"
                checked={formData.tax.vatRegistered}
                onChange={(e) => {
                  handleInputChange('tax', 'vatRegistered', e.target.checked);
                  // Clear VAT number when unchecking VAT registration
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
          </div>
        );

      case 'banking':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                Account Name *
              </label>
              <input
                type="text"
                value={formData.banking.accountName}
                onChange={(e) => handleInputChange('banking', 'accountName', e.target.value)}
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
                value={formData.banking.bankName}
                onChange={(e) => handleInputChange('banking', 'bankName', e.target.value)}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                placeholder="Bank name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                IBAN *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.banking.iban}
                  onChange={(e) => handleIBANChange(e.target.value)}
                  className={`w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border ${
                    formData.banking.iban && !validateGreekIBAN(formData.banking.iban)
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                      : formData.banking.iban && validateGreekIBAN(formData.banking.iban)
                      ? 'border-green-500 focus:border-green-500 focus:ring-green-500/20'
                      : 'border-gray-300/50 dark:border-slate-600/50 focus:border-blue-500/50 focus:ring-blue-500/20'
                  } rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 transition-all`}
                  placeholder="GR1601101250000000012300695"
                  maxLength={27}
                />
                {formData.banking.iban && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    {validateGreekIBAN(formData.banking.iban) ? (
                      <span className="text-green-500">✓</span>
                    ) : (
                      <span className="text-red-500">✗</span>
                    )}
                  </div>
                )}
              </div>
              {formData.banking.iban && !validateGreekIBAN(formData.banking.iban) && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  IBAN must be in format GR + 25 digits (27 characters total)
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">
                SWIFT/BIC
              </label>
              <input
                type="text"
                value={formData.banking.swift}
                onChange={(e) => handleInputChange('banking', 'swift', e.target.value.toUpperCase())}
                className="w-full px-4 py-3 bg-gray-50/80 dark:bg-slate-700/80 border border-gray-300/50 dark:border-slate-600/50 rounded-xl text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                placeholder="ETHNGRAA"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-200/60 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 transition-all duration-700">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100/80 via-gray-50/40 to-gray-200/80 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800"></div>
        <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-blue-400/8 via-indigo-400/6 to-purple-600/8 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-emerald-400/8 via-teal-400/6 to-blue-500/8 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative min-h-screen flex flex-col">
        {/* Global Navigation */}
        <DashboardNavigation />

        {/* Setup Content */}
        <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-4xl">
          {/* Setup Card */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10 rounded-3xl blur-xl"></div>
            <div className="relative bg-gray-100/70 dark:bg-slate-800/80 backdrop-blur-2xl border border-gray-300/40 dark:border-slate-700/50 rounded-3xl shadow-2xl shadow-gray-500/10 dark:shadow-slate-900/20">
              
              {/* Header */}
              <div className="p-8 border-b border-gray-300/30 dark:border-slate-700/40">
                <div className="text-center">
                  <h2 className="text-3xl font-bold bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:via-slate-100 dark:to-slate-200 bg-clip-text text-transparent mb-2">
                    🚀 Setup Your Business
                  </h2>
                  <p className="text-slate-700 dark:text-slate-200">
                    Let's get your business information set up for legal invoicing in Greece
                  </p>
                </div>

                {/* Progress Steps */}
                <div className="mt-8">
                  <div className="flex items-center justify-between">
                    {steps.map((step, index) => (
                      <div key={step.key} className="flex items-center">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                          index <= currentStep 
                            ? 'bg-blue-500 border-blue-500 text-white' 
                            : 'bg-gray-200 dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400'
                        }`}>
                          {completionStatus.completedSteps[step.key] ? (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <span className="text-sm font-medium">{index + 1}</span>
                          )}
                        </div>
                        {index < steps.length - 1 && (
                          <div className={`w-12 h-0.5 mx-2 transition-all ${
                            index < currentStep ? 'bg-blue-500' : 'bg-gray-300 dark:bg-slate-600'
                          }`}></div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-3">
                    {steps.map((step, index) => (
                      <div key={step.key} className={`text-xs text-center transition-all ${
                        index <= currentStep 
                          ? 'text-slate-800 dark:text-white font-medium' 
                          : 'text-gray-500 dark:text-slate-400'
                      }`} style={{ width: '80px' }}>
                        <div className="mb-1">{step.icon}</div>
                        {step.title}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-8">
                <div className="mb-8">
                  <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">
                    {steps[currentStep].icon} {steps[currentStep].title}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm">
                    Step {currentStep + 1} of {steps.length}
                  </p>
                </div>

                {renderStepContent()}
              </div>

              {/* Navigation */}
              <div className="p-8 border-t border-gray-300/30 dark:border-slate-700/40">
                <div className="flex justify-between">
                  <button
                    onClick={handlePrevious}
                    disabled={currentStep === 0}
                    className="px-6 py-3 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Previous
                  </button>
                  
                  <button
                    onClick={handleNext}
                    disabled={!isStepValid()}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    {currentStep === steps.length - 1 ? (
                      'Complete Setup'
                    ) : (
                      'Next →'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default Setup;