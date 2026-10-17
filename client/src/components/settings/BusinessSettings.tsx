import { useState, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'next-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchSettings as _fetchSettings,
  updateSection as _updateSection,
  fetchTaxOffices as _fetchTaxOffices,
  validateAFM as _validateAFM,
  selectSettings,
  selectTaxOffices,
  selectSettingsSaving,
  selectAFMValidation
} from '@/store/slices/settingsSlice';

// Cast thunks to any to avoid TypeScript errors with JS slice
const fetchSettings = _fetchSettings as any;
const updateSection = _updateSection as any;
const fetchTaxOffices = _fetchTaxOffices as any;
const validateAFM = _validateAFM as any;

import KADSelector from '@/components/KADSelector';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Field from '@/components/ui/Field';
import Icon from '@/components/ui/Icon';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

type Section = 'business' | 'tax' | 'address' | 'contact';

const BusinessSettings = () => {
  const { t } = useTranslation('common');
  const dispatch = useAppDispatch();
  const toast = useToast();

  const settings = useAppSelector(selectSettings);
  const taxOffices = useAppSelector(selectTaxOffices);
  const isSaving = useAppSelector(selectSettingsSaving);
  const afmValidation = useAppSelector(selectAFMValidation);

  const [savingSection, setSavingSection] = useState<Section | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Section, string>>>({});

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

  const legalForms = ['individual', 'oe', 'ee', 'epe', 'ae', 'ike', 'other'];

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

  const handleInputChange = (section: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section as keyof typeof prev] as any),
        [field]: value
      }
    }));
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

  const handleSave = async (section: Section) => {
    if (isSaving || savingSection) return;
    setSavingSection(section);
    setErrors(prev => ({ ...prev, [section]: undefined }));
    try {
      await dispatch(updateSection({
        section,
        data: formData[section as keyof typeof formData]
      })).unwrap();
      toast.success(t('settingsUi.business.saved', { section: t(`settingsUi.business.sections.${section}`) }));
    } catch (error: any) {
      const text =
        typeof error === 'string'
          ? error
          : error?.message || t('settingsUi.business.saveFailed');
      setErrors(prev => ({ ...prev, [section]: text }));
    } finally {
      setSavingSection(null);
    }
  };

  const validateVATNumber = (vatNumber: string) => {
    return /^EL\d{9}$/.test(vatNumber);
  };

  const sectionCard = (section: Section, description: ReactNode, children: ReactNode) => (
    <div className="card">
      <div className="card-pad space-y-4">
        <div>
          <h3 className="section-title">{t(`settingsUi.business.sections.${section}`)}</h3>
          <p className="section-desc">{description}</p>
        </div>
        {errors[section] && (
          <Alert
            tone="danger"
            onDismiss={() => setErrors(prev => ({ ...prev, [section]: undefined }))}
            dismissLabel={t('common.dismiss')}
          >
            {errors[section]}
          </Alert>
        )}
        {children}
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-4 py-3 sm:px-6">
        <Button
          variant="primary"
          onClick={() => handleSave(section)}
          loading={savingSection === section}
          disabled={!!savingSection && savingSection !== section}
        >
          {savingSection === section ? t('common.saving') : t('common.saveChanges')}
        </Button>
      </div>
    </div>
  );

  if (!settings) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="space-y-2">
          <div className="skeleton h-6 w-48" />
          <div className="skeleton h-4 w-72" />
        </div>
        {[0, 1].map(i => (
          <div key={i} className="card card-pad space-y-4">
            <div className="skeleton h-5 w-40" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="skeleton h-10" />
              <div className="skeleton h-10" />
              <div className="skeleton h-10" />
              <div className="skeleton h-10" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const vatValid = formData.tax.vatNumber ? validateVATNumber(formData.tax.vatNumber) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">{t('settingsUi.business.title')}</h2>
        <p className="section-desc">{t('settingsUi.business.description')}</p>
      </div>

      {/* Basic info */}
      {sectionCard(
        'business',
        t('settingsUi.business.sectionDesc.business'),
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('legalBusinessName')} required>
            <input
              type="text"
              className="input"
              value={formData.business.legalName}
              onChange={(e) => handleInputChange('business', 'legalName', e.target.value)}
              placeholder={t('placeholders.legalBusinessName')}
            />
          </Field>
          <Field label={t('tradingName')}>
            <input
              type="text"
              className="input"
              value={formData.business.tradingName}
              onChange={(e) => handleInputChange('business', 'tradingName', e.target.value)}
              placeholder={t('placeholders.tradingName')}
            />
          </Field>
          <Field label={t('legalForm')} required>
            <select
              className="input"
              value={formData.business.legalForm}
              onChange={(e) => handleInputChange('business', 'legalForm', e.target.value)}
            >
              <option value="">{t('placeholders.selectLegalForm')}</option>
              {legalForms.map(form => (
                <option key={form} value={form}>{t(`legalForms.${form}`)}</option>
              ))}
            </select>
          </Field>
          <Field label={t('businessDescription')} className="sm:col-span-2">
            <textarea
              className="input"
              rows={3}
              value={formData.business.description}
              onChange={(e) => handleInputChange('business', 'description', e.target.value)}
              placeholder={t('placeholders.businessDescription')}
            />
          </Field>
        </div>
      )}

      {/* Tax */}
      {sectionCard(
        'tax',
        t('settingsUi.business.sectionDesc.tax'),
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="biz-afm" className="label">
              {t('afm')}
              <span className="ml-0.5 text-danger" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <input
                id="biz-afm"
                type="text"
                inputMode="numeric"
                required
                className={`input num pr-9 ${afmValidation.isValid === true ? 'border-success' : ''}`}
                aria-invalid={afmValidation.isValid === false ? true : undefined}
                aria-describedby="biz-afm-msg"
                value={formData.tax.afm}
                onChange={(e) => handleAFMChange(e.target.value)}
                maxLength={9}
                placeholder="123456789"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                {afmValidation.isLoading ? (
                  <Spinner size={16} className="text-muted" />
                ) : afmValidation.isValid ? (
                  <Icon name="checkCircle" size={16} className="text-success" />
                ) : null}
              </span>
            </div>
            {afmValidation.error ? (
              <p id="biz-afm-msg" className="field-error">{afmValidation.error}</p>
            ) : afmValidation.isValid ? (
              <p id="biz-afm-msg" className="mt-1.5 text-xs font-medium text-success">{t('settingsUi.business.afmValid')}</p>
            ) : (
              <p id="biz-afm-msg" className="hint">{t('placeholders.afm')}</p>
            )}
          </div>
          <Field label={t('settingsUi.business.gemi')} hint={t('settingsUi.business.gemiHint')}>
            <input
              type="text"
              inputMode="numeric"
              className="input num"
              value={formData.tax.gemi || ''}
              onChange={(e) => handleInputChange('tax', 'gemi', e.target.value.replace(/\D/g, ''))}
              placeholder={t('settingsUi.business.gemiPlaceholder')}
            />
          </Field>
          <Field label={t('taxOffice')} required className="sm:col-span-2">
            <select
              className="input"
              value={formData.tax.doy?.code || ''}
              onChange={(e) => {
                const selectedOffice = taxOffices.find((office: any) => office.code === e.target.value);
                if (selectedOffice) {
                  handleNestedInputChange('tax', 'doy', 'code', selectedOffice.code);
                  handleNestedInputChange('tax', 'doy', 'name', selectedOffice.name);
                }
              }}
            >
              <option value="">{t('placeholders.selectTaxOffice')}</option>
              {taxOffices.map((office: any) => (
                <option key={office.code} value={office.code}>
                  {office.name} - {office.city}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <span className="label">
              {t('activityCode')}
              <span className="ml-0.5 text-danger" aria-hidden="true">*</span>
            </span>
            <KADSelector
              selectedKADs={formData.tax.activityCodes}
              onKADsChange={(kads) => handleInputChange('tax', 'activityCodes', kads)}
              maxSelections={50}
              placeholder={t('settingsUi.business.kadPlaceholder')}
            />
          </div>
          <label htmlFor="vatRegistered" className="flex cursor-pointer items-center gap-3 sm:col-span-2">
            <input
              type="checkbox"
              id="vatRegistered"
              className="checkbox"
              checked={formData.tax.vatRegistered}
              onChange={(e) => {
                handleInputChange('tax', 'vatRegistered', e.target.checked);
                if (!e.target.checked) {
                  handleInputChange('tax', 'vatNumber', '');
                }
              }}
            />
            <span className="text-sm font-medium text-ink">{t('vatRegistered')}</span>
          </label>
          {formData.tax.vatRegistered && (
            <div>
              <label htmlFor="biz-vat" className="label">{t('vatNumber')}</label>
              <div className="relative">
                <input
                  id="biz-vat"
                  type="text"
                  className={`input num pr-9 ${vatValid === true ? 'border-success' : ''}`}
                  aria-invalid={vatValid === false ? true : undefined}
                  aria-describedby={vatValid === false ? 'biz-vat-err' : undefined}
                  value={formData.tax.vatNumber}
                  onChange={(e) => handleVATNumberChange(e.target.value)}
                  placeholder="EL123456789"
                  maxLength={11}
                />
                {vatValid !== null && (
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <Icon
                      name={vatValid ? 'checkCircle' : 'alertCircle'}
                      size={16}
                      className={vatValid ? 'text-success' : 'text-danger'}
                    />
                  </span>
                )}
              </div>
              {vatValid === false && (
                <p id="biz-vat-err" className="field-error">{t('settingsUi.business.vatFormat')}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Address */}
      {sectionCard(
        'address',
        t('settingsUi.business.sectionDesc.address'),
        <div className="grid gap-4 sm:grid-cols-6">
          <Field label={t('street')} required className="sm:col-span-4">
            <input
              type="text"
              className="input"
              autoComplete="address-line1"
              value={formData.address.street}
              onChange={(e) => handleInputChange('address', 'street', e.target.value)}
              placeholder={t('placeholders.streetName')}
            />
          </Field>
          <Field label={t('number')} required className="sm:col-span-2">
            <input
              type="text"
              className="input"
              value={formData.address.number}
              onChange={(e) => handleInputChange('address', 'number', e.target.value)}
              placeholder={t('placeholders.number')}
            />
          </Field>
          <Field label={t('area')} className="sm:col-span-3">
            <input
              type="text"
              className="input"
              value={formData.address.area}
              onChange={(e) => handleInputChange('address', 'area', e.target.value)}
              placeholder={t('placeholders.areaDistrict')}
            />
          </Field>
          <Field label={t('city')} required className="sm:col-span-3">
            <input
              type="text"
              className="input"
              autoComplete="address-level2"
              value={formData.address.city}
              onChange={(e) => handleInputChange('address', 'city', e.target.value)}
            />
          </Field>
          <Field label={t('postalCode')} required className="sm:col-span-2">
            <input
              type="text"
              inputMode="numeric"
              className="input num"
              autoComplete="postal-code"
              value={formData.address.postalCode}
              onChange={(e) => handleInputChange('address', 'postalCode', e.target.value)}
              maxLength={5}
              placeholder="12345"
            />
          </Field>
          <Field label={t('prefecture')} required className="sm:col-span-4">
            <input
              type="text"
              className="input"
              value={formData.address.prefecture}
              onChange={(e) => handleInputChange('address', 'prefecture', e.target.value)}
            />
          </Field>
        </div>
      )}

      {/* Contact */}
      {sectionCard(
        'contact',
        t('settingsUi.business.sectionDesc.contact'),
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('phone')} required>
            <input
              type="tel"
              className="input num"
              autoComplete="tel"
              value={formData.contact.phone}
              onChange={(e) => handleInputChange('contact', 'phone', e.target.value)}
              placeholder={t('placeholders.phoneNumber')}
            />
          </Field>
          <Field label={t('mobile')}>
            <input
              type="tel"
              className="input num"
              value={formData.contact.mobile}
              onChange={(e) => handleInputChange('contact', 'mobile', e.target.value)}
              placeholder={t('placeholders.mobileNumber')}
            />
          </Field>
          <Field label={t('email')} required>
            <input
              type="email"
              className="input"
              autoComplete="email"
              value={formData.contact.email}
              onChange={(e) => handleInputChange('contact', 'email', e.target.value)}
              placeholder={t('placeholders.businessEmail')}
            />
          </Field>
          <Field label={t('website')}>
            <input
              type="url"
              className="input"
              value={formData.contact.website}
              onChange={(e) => handleInputChange('contact', 'website', e.target.value)}
              placeholder={t('placeholders.websiteUrl')}
            />
          </Field>
        </div>
      )}
    </div>
  );
};

export default BusinessSettings;
