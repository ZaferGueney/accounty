import { useState, useEffect, useMemo } from 'react';
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
import AppShell from '@/components/AppShell';
import KADSelector from '@/components/KADSelector';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Alert from '@/components/ui/Alert';
import Icon from '@/components/ui/Icon';
import Spinner from '@/components/ui/Spinner';
import { apiErrorText } from '@/components/ui/format';

const Setup = () => {
  const { t } = useTranslation('common');
  const router = useRouter();
  const dispatch = useAppDispatch();

  const settings = useAppSelector(selectSettings);
  const completionStatus = useAppSelector(selectCompletionStatus);
  const taxOffices = useAppSelector(selectTaxOffices);
  const afmValidation = useAppSelector(selectAFMValidation);

  const [currentStep, setCurrentStep] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
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

  const steps = useMemo(
    () => [
      { key: 'business', title: t('businessInformation'), description: t('setup.steps.business') },
      { key: 'tax', title: t('taxDetails'), description: t('setup.steps.tax') },
      { key: 'address', title: t('businessAddress'), description: t('setup.steps.address') },
      { key: 'contact', title: t('contactInformation'), description: t('setup.steps.contact') },
      { key: 'banking', title: t('bankingDetails'), description: t('setup.steps.banking') }
    ],
    [t]
  );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          // Auto-save failures are surfaced when the user presses Next
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
    if (isSubmitting) return;
    const currentStepKey = steps[currentStep].key;

    try {
      setIsSubmitting(true);
      setIsNavigating(true);
      setStepError(null);

      await dispatch(updateSection({
        section: currentStepKey,
        data: formData[currentStepKey as keyof typeof formData]
      })).unwrap();

      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setIsSubmitting(false);
        setTimeout(() => {
          setIsNavigating(false);
        }, 500);
      } else {
        // Complete the setup by updating settings to mark as complete
        await dispatch(updateSettings({
          isComplete: true
        })).unwrap();

        // Refresh completion status
        await dispatch(fetchCompletionStatus());

        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Error saving section:', error);
      setStepError(typeof error === 'string' ? error : apiErrorText(error, t('setup.saveFailed')));
      setIsSubmitting(false);
      setIsNavigating(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setIsNavigating(true);
      setStepError(null);
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
      case 'tax': {
        // Only require AFM validation if AFM is entered, otherwise just check basic fields
        const afmValid = !data.afm || afmValidation.isValid !== false;
        // VAT validation: only validate if VAT registered AND VAT number is provided
        const vatValid = !data.vatRegistered || (data.vatRegistered && data.vatNumber && validateVATNumber(data.vatNumber)) || (data.vatRegistered && !data.vatNumber);
        return data.afm && data.doy.code && data.activityCodes.length > 0 && afmValid && vatValid;
      }
      case 'address':
        return data.street && data.number && data.city && data.postalCode && data.prefecture;
      case 'contact':
        return data.phone && data.email;
      case 'banking': {
        const ibanValid = !data.iban || validateGreekIBAN(data.iban);
        return data.accountName && data.bankName && data.iban && ibanValid;
      }
      default:
        return false;
    }
  };

  const vatInvalid = !!formData.tax.vatNumber && !validateVATNumber(formData.tax.vatNumber);
  const ibanInvalid = !!formData.banking.iban && !validateGreekIBAN(formData.banking.iban);

  const renderStepContent = () => {
    const step = steps[currentStep];

    switch (step.key) {
      case 'business':
        return (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label={t('legalBusinessName')} required className="sm:col-span-2">
              <input
                type="text"
                value={formData.business.legalName}
                onChange={(e) => handleInputChange('business', 'legalName', e.target.value)}
                className="input"
                placeholder={t('placeholders.legalBusinessName')}
                autoComplete="organization"
              />
            </Field>

            <Field label={t('tradingName')} optionalLabel={t('common.optional')}>
              <input
                type="text"
                value={formData.business.tradingName}
                onChange={(e) => handleInputChange('business', 'tradingName', e.target.value)}
                className="input"
                placeholder={t('placeholders.tradingName')}
              />
            </Field>

            <Field label={t('legalForm')} required>
              <select
                value={formData.business.legalForm}
                onChange={(e) => handleInputChange('business', 'legalForm', e.target.value)}
                className="input"
              >
                <option value="">{t('placeholders.selectLegalForm')}</option>
                {legalForms.map(form => (
                  <option key={form.value} value={form.value}>{form.label}</option>
                ))}
              </select>
            </Field>

            <Field label={t('businessDescription')} optionalLabel={t('common.optional')} className="sm:col-span-2">
              <textarea
                value={formData.business.description}
                onChange={(e) => handleInputChange('business', 'description', e.target.value)}
                rows={3}
                className="input"
                placeholder={t('placeholders.businessDescription')}
              />
            </Field>
          </div>
        );

      case 'tax':
        return (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field
              label={t('afm')}
              required
              error={afmValidation.error || (afmValidation.isValid === false ? t('setup.afmInvalid') : undefined)}
              hint={afmValidation.isValid === true ? t('setup.afmValid') : t('setup.afmHint')}
            >
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.tax.afm}
                  onChange={(e) => handleAFMChange(e.target.value)}
                  maxLength={9}
                  aria-invalid={afmValidation.isValid === false || !!afmValidation.error ? true : undefined}
                  className={`input num pr-9 ${afmValidation.isValid === true ? 'border-success' : ''}`}
                  placeholder={t('placeholders.afm')}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {afmValidation.isLoading ? (
                    <Spinner size={15} className="text-muted" label={t('setup.checkingAfm')} />
                  ) : afmValidation.isValid === true ? (
                    <Icon name="checkCircle" size={16} className="text-success" />
                  ) : null}
                </span>
              </div>
            </Field>

            <Field label={t('taxOffice')} required>
              <select
                value={formData.tax.doy?.code || ''}
                onChange={(e) => {
                  const selectedOffice = taxOffices.find((office: any) => office.code === e.target.value);
                  if (selectedOffice) {
                    handleNestedInputChange('tax', 'doy', 'code', selectedOffice.code);
                    handleNestedInputChange('tax', 'doy', 'name', selectedOffice.name);
                  }
                }}
                className="input"
              >
                <option value="">{t('placeholders.selectTaxOffice')}</option>
                {taxOffices.map((office: any) => (
                  <option key={office.code} value={office.code}>
                    {office.name} – {office.city}
                  </option>
                ))}
              </select>
            </Field>

            <div className="sm:col-span-2">
              <label htmlFor="setup-kad" className="label">
                {t('activityCode')}
                <span className="ml-0.5 text-danger" aria-hidden="true">*</span>
              </label>
              <KADSelector
                id="setup-kad"
                selectedKADs={formData.tax.activityCodes}
                onKADsChange={(kads) => handleInputChange('tax', 'activityCodes', kads)}
                maxSelections={50}
                placeholder={t('setup.kadPlaceholder')}
                className=""
              />
            </div>

            <div className="sm:col-span-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-sunken/50 px-3.5 py-3">
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
                  className="checkbox mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium text-ink">{t('vatRegistered')}</span>
                  <span className="block text-xs text-muted">{t('setup.vatRegisteredHint')}</span>
                </span>
              </label>
            </div>

            {formData.tax.vatRegistered && (
              <Field
                label={t('vatNumber')}
                error={vatInvalid ? t('setup.vatFormat') : undefined}
                hint={t('setup.vatHint')}
              >
                <div className="relative">
                  <input
                    type="text"
                    value={formData.tax.vatNumber}
                    onChange={(e) => handleVATNumberChange(e.target.value)}
                    aria-invalid={vatInvalid || undefined}
                    className={`input num pr-9 ${formData.tax.vatNumber && !vatInvalid ? 'border-success' : ''}`}
                    placeholder="EL123456789"
                    maxLength={11}
                  />
                  {formData.tax.vatNumber && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Icon
                        name={vatInvalid ? 'alertCircle' : 'checkCircle'}
                        size={16}
                        className={vatInvalid ? 'text-danger' : 'text-success'}
                      />
                    </span>
                  )}
                </div>
              </Field>
            )}
          </div>
        );

      case 'address':
        return (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Field label={t('street')} required className="sm:col-span-2">
              <input
                type="text"
                value={formData.address.street}
                onChange={(e) => handleInputChange('address', 'street', e.target.value)}
                className="input"
                placeholder={t('placeholders.streetName')}
                autoComplete="address-line1"
              />
            </Field>
            <Field label={t('number')} required>
              <input
                type="text"
                value={formData.address.number}
                onChange={(e) => handleInputChange('address', 'number', e.target.value)}
                className="input"
                placeholder={t('placeholders.number')}
              />
            </Field>

            <Field label={t('area')} optionalLabel={t('common.optional')} className="sm:col-span-3">
              <input
                type="text"
                value={formData.address.area}
                onChange={(e) => handleInputChange('address', 'area', e.target.value)}
                className="input"
                placeholder={t('placeholders.areaDistrict')}
              />
            </Field>

            <Field label={t('city')} required className="sm:col-span-2">
              <input
                type="text"
                value={formData.address.city}
                onChange={(e) => handleInputChange('address', 'city', e.target.value)}
                className="input"
                placeholder={t('city')}
                autoComplete="address-level2"
              />
            </Field>
            <Field label={t('postalCode')} required>
              <input
                type="text"
                inputMode="numeric"
                value={formData.address.postalCode}
                onChange={(e) => handleInputChange('address', 'postalCode', e.target.value)}
                maxLength={5}
                className="input num"
                placeholder="12345"
                autoComplete="postal-code"
              />
            </Field>

            <Field label={t('prefecture')} required className="sm:col-span-3">
              <input
                type="text"
                value={formData.address.prefecture}
                onChange={(e) => handleInputChange('address', 'prefecture', e.target.value)}
                className="input"
                placeholder={t('prefecture')}
              />
            </Field>
          </div>
        );

      case 'contact':
        return (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label={t('phone')} required>
              <input
                type="tel"
                value={formData.contact.phone}
                onChange={(e) => handleInputChange('contact', 'phone', e.target.value)}
                className="input num"
                placeholder={t('placeholders.phoneNumber')}
                autoComplete="tel"
              />
            </Field>
            <Field label={t('mobile')} optionalLabel={t('common.optional')}>
              <input
                type="tel"
                value={formData.contact.mobile}
                onChange={(e) => handleInputChange('contact', 'mobile', e.target.value)}
                className="input num"
                placeholder={t('placeholders.mobileNumber')}
              />
            </Field>

            <Field label={t('email')} required>
              <input
                type="email"
                value={formData.contact.email}
                onChange={(e) => handleInputChange('contact', 'email', e.target.value)}
                className="input"
                placeholder={t('placeholders.businessEmail')}
                autoComplete="email"
              />
            </Field>

            <Field label={t('website')} optionalLabel={t('common.optional')}>
              <input
                type="url"
                value={formData.contact.website}
                onChange={(e) => handleInputChange('contact', 'website', e.target.value)}
                className="input"
                placeholder={t('placeholders.websiteUrl')}
              />
            </Field>
          </div>
        );

      case 'banking':
        return (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label={t('accountName')} required>
              <input
                type="text"
                value={formData.banking.accountName}
                onChange={(e) => handleInputChange('banking', 'accountName', e.target.value)}
                className="input"
                placeholder={t('placeholders.accountHolderName')}
              />
            </Field>

            <Field label={t('bankName')} required>
              <input
                type="text"
                value={formData.banking.bankName}
                onChange={(e) => handleInputChange('banking', 'bankName', e.target.value)}
                className="input"
                placeholder={t('placeholders.bankName')}
              />
            </Field>

            <Field
              label={t('iban')}
              required
              className="sm:col-span-2"
              error={ibanInvalid ? t('setup.ibanFormat') : undefined}
              hint={t('setup.ibanHint')}
            >
              <div className="relative">
                <input
                  type="text"
                  value={formData.banking.iban}
                  onChange={(e) => handleIBANChange(e.target.value)}
                  aria-invalid={ibanInvalid || undefined}
                  className={`input num pr-9 tracking-wide ${formData.banking.iban && !ibanInvalid ? 'border-success' : ''}`}
                  placeholder={t('placeholders.ibanFormat')}
                  maxLength={27}
                  spellCheck={false}
                />
                {formData.banking.iban && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Icon
                      name={ibanInvalid ? 'alertCircle' : 'checkCircle'}
                      size={16}
                      className={ibanInvalid ? 'text-danger' : 'text-success'}
                    />
                  </span>
                )}
              </div>
            </Field>

            <Field label={t('swift')} optionalLabel={t('common.optional')}>
              <input
                type="text"
                value={formData.banking.swift}
                onChange={(e) => handleInputChange('banking', 'swift', e.target.value.toUpperCase())}
                className="input num"
                placeholder={t('placeholders.swiftCode')}
                spellCheck={false}
              />
            </Field>
          </div>
        );

      default:
        return null;
    }
  };

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const stepValid = !!isStepValid();
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <AppShell width="narrow">
      <div className="space-y-6 sm:space-y-8">
        <header>
          <h1 className="page-title">{t('setup.title')}</h1>
          <p className="mt-1 text-sm text-muted">{t('setup.subtitle')}</p>
        </header>

        {/* Step indicator: full row on larger screens */}
        <ol className="hidden items-start sm:flex" aria-label={t('setup.progressLabel')}>
          {steps.map((s, index) => {
            const done = !!completionStatus.completedSteps?.[s.key] && index !== currentStep;
            const current = index === currentStep;
            return (
              <li key={s.key} className="flex flex-1 items-start last:flex-none" aria-current={current ? 'step' : undefined}>
                <div className="flex flex-col items-center gap-2 text-center">
                  <span
                    className={`num flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                      current
                        ? 'bg-accent text-accent-fg'
                        : done
                        ? 'bg-success-soft text-success'
                        : index < currentStep
                        ? 'bg-accent-soft text-accent'
                        : 'border border-line-strong bg-surface text-muted'
                    }`}
                  >
                    {done ? <Icon name="check" size={15} strokeWidth={2.25} /> : index + 1}
                  </span>
                  <span
                    className={`max-w-[7.5rem] text-xs leading-tight ${
                      current ? 'font-semibold text-ink' : 'text-muted'
                    }`}
                  >
                    {s.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`mx-2 mt-4 h-px flex-1 ${index < currentStep ? 'bg-accent/50' : 'bg-line-strong'}`}
                  />
                )}
              </li>
            );
          })}
        </ol>

        {/* Step indicator: compact on phones */}
        <div className="sm:hidden">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold text-ink">{step.title}</span>
            <span className="num text-muted">
              {t('setup.stepOf', { current: currentStep + 1, total: steps.length })}
            </span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={currentStep + 1}
            aria-label={t('setup.progressLabel')}
          >
            <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <form
          className="card"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (stepValid && !isSubmitting) handleNext();
          }}
        >
          <div className="border-b border-line px-4 py-4 sm:px-6 sm:py-5">
            <p className="num hidden text-xs font-medium text-muted sm:block">
              {t('setup.stepOf', { current: currentStep + 1, total: steps.length })}
            </p>
            <h2 className="section-title sm:mt-0.5">{step.title}</h2>
            <p className="section-desc">{step.description}</p>
          </div>

          <div key={step.key} className="animate-fade-in px-4 py-5 sm:px-6 sm:py-6">
            {stepError && (
              <Alert
                tone="danger"
                title={t('setup.saveFailed')}
                onDismiss={() => setStepError(null)}
                dismissLabel={t('common.dismiss')}
                className="mb-5"
              >
                {stepError}
              </Alert>
            )}
            {renderStepContent()}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line bg-sunken/40 px-4 py-3.5 sm:px-6">
            <Button
              variant="ghost"
              icon="arrowLeft"
              onClick={handlePrevious}
              disabled={currentStep === 0 || isSubmitting}
            >
              {t('common.back')}
            </Button>

            <div className="flex items-center gap-3">
              {!stepValid && (
                <span className="hidden text-xs text-muted sm:inline">{t('setup.fillRequired')}</span>
              )}
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                disabled={!stepValid}
                iconRight={isLast ? 'check' : 'arrowRight'}
              >
                {isSubmitting ? t('common.saving') : isLast ? t('setup.finish') : t('common.next')}
              </Button>
            </div>
          </div>
        </form>

        <p className="flex items-center gap-2 text-xs text-muted">
          <Icon name="info" size={14} />
          {t('setup.autosaveNote')}
        </p>
      </div>
    </AppShell>
  );
};

export default Setup;
