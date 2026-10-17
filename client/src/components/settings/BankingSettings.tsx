import { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { bankingAPI } from '@/utils/api';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Field from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { apiErrorText } from '@/components/ui/format';

const BankingSettings = () => {
  const { t } = useTranslation('common');
  const toast = useToast();

  const [banks, setBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBank, setEditingBank] = useState<any>(null);
  const [formError, setFormError] = useState('');
  const [listError, setListError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [defaultBusyId, setDefaultBusyId] = useState<string | null>(null);

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
      setLoadError('');
      const response = await bankingAPI.getBanks();
      if (response.data.success) {
        setBanks(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch banks:', error);
      setLoadError(apiErrorText(error, t('settingsUi.banking.loadFailed')));
    } finally {
      setLoading(false);
    }
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

  const closeModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setEditingBank(null);
    setFormError('');
    resetForm();
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
    if (saving) return;
    try {
      setSaving(true);
      setFormError('');
      const response = await bankingAPI.createBank(formData);
      if (response.data.success) {
        toast.success(t('settingsUi.banking.added'));
        fetchBanks();
        closeModal();
      }
    } catch (error) {
      setFormError(apiErrorText(error, t('settingsUi.banking.addFailed')));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateBank = async () => {
    if (saving || !editingBank) return;
    try {
      setSaving(true);
      setFormError('');
      const response = await bankingAPI.updateBank(editingBank._id, formData);
      if (response.data.success) {
        toast.success(t('settingsUi.banking.updated'));
        fetchBanks();
        closeModal();
      }
    } catch (error) {
      setFormError(apiErrorText(error, t('settingsUi.banking.updateFailed')));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBank = async () => {
    if (!deleteTarget || deleting) return;
    try {
      setDeleting(true);
      setListError('');
      const response = await bankingAPI.deleteBank(deleteTarget._id);
      if (response.data.success) {
        toast.success(t('settingsUi.banking.deleted'));
        setDeleteTarget(null);
        fetchBanks();
      }
    } catch (error) {
      setDeleteTarget(null);
      setListError(apiErrorText(error, t('settingsUi.banking.deleteFailed')));
    } finally {
      setDeleting(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    if (defaultBusyId) return;
    try {
      setDefaultBusyId(id);
      setListError('');
      const response = await bankingAPI.setDefaultBank(id);
      if (response.data.success) {
        toast.success(t('settingsUi.banking.defaultUpdated'));
        fetchBanks();
      }
    } catch (error) {
      setListError(apiErrorText(error, t('settingsUi.banking.defaultFailed')));
    } finally {
      setDefaultBusyId(null);
    }
  };

  const openEditModal = (bank: any) => {
    setEditingBank(bank);
    setFormError('');
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

  const openAdd = () => {
    resetForm();
    setFormError('');
    setShowAddModal(true);
  };

  const ibanValid = formData.iban ? validateGreekIBAN(formData.iban) : null;
  const canSubmit = !!formData.bankName && !!formData.accountName && validateGreekIBAN(formData.iban);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">{t('settingsUi.banking.title')}</h2>
          <p className="section-desc">{t('settingsUi.banking.description')}</p>
        </div>
        {banks.length > 0 && (
          <Button variant="primary" icon="plus" onClick={openAdd}>
            {t('settingsUi.banking.addBank')}
          </Button>
        )}
      </div>

      {listError && (
        <Alert tone="danger" onDismiss={() => setListError('')} dismissLabel={t('common.dismiss')}>
          {listError}
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1].map(i => (
            <div key={i} className="card card-pad space-y-3">
              <div className="skeleton h-5 w-48" />
              <div className="skeleton h-4 w-72" />
              <div className="skeleton h-4 w-40" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="card">
          <EmptyState
            icon="alertCircle"
            title={t('settingsUi.banking.loadFailed')}
            description={loadError}
            action={
              <Button variant="secondary" icon="refresh" onClick={fetchBanks}>
                {t('common.retry')}
              </Button>
            }
          />
        </div>
      ) : banks.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="bank"
            title={t('settingsUi.banking.emptyTitle')}
            description={t('settingsUi.banking.emptyDescription')}
            action={
              <Button variant="primary" icon="plus" onClick={openAdd}>
                {t('settingsUi.banking.addFirst')}
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="card divide-y divide-line">
          {banks.map(bank => (
            <li key={bank._id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
              <div className="flex min-w-0 gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sunken text-muted">
                  <Icon name="bank" size={18} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{bank.bankName}</p>
                    {bank.isDefault && (
                      <span className="badge badge-success">{t('settingsUi.banking.default')}</span>
                    )}
                  </div>
                  <p className="text-sm text-ink-2">{bank.accountName}</p>
                  <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_auto] sm:justify-start">
                    <div className="flex gap-2">
                      <dt className="text-muted">{t('iban')}</dt>
                      <dd className="num break-all text-ink">{formatIBAN(bank.iban)}</dd>
                    </div>
                    {bank.swift && (
                      <div className="flex gap-2">
                        <dt className="text-muted">{t('swift')}</dt>
                        <dd className="num text-ink">{bank.swift}</dd>
                      </div>
                    )}
                  </dl>
                  {bank.notes && <p className="mt-2 text-sm text-muted">{bank.notes}</p>}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5 sm:justify-end">
                {!bank.isDefault && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={defaultBusyId === bank._id}
                    disabled={!!defaultBusyId && defaultBusyId !== bank._id}
                    onClick={() => handleSetDefault(bank._id)}
                  >
                    {t('settingsUi.banking.setDefault')}
                  </Button>
                )}
                <Button size="sm" variant="ghost" icon="pencil" onClick={() => openEditModal(bank)}>
                  {t('common.edit')}
                </Button>
                <Button size="sm" variant="danger-ghost" icon="trash" onClick={() => setDeleteTarget(bank)}>
                  {t('common.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add / edit */}
      <Modal
        open={showAddModal || showEditModal}
        onClose={closeModal}
        busy={saving}
        closeLabel={t('common.close')}
        title={showAddModal ? t('settingsUi.banking.addTitle') : t('settingsUi.banking.editTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              loading={saving}
              disabled={!canSubmit}
              onClick={showAddModal ? handleAddBank : handleUpdateBank}
            >
              {saving
                ? t('common.saving')
                : showAddModal
                ? t('settingsUi.banking.addBank')
                : t('settingsUi.banking.updateBank')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <Alert tone="danger" onDismiss={() => setFormError('')} dismissLabel={t('common.dismiss')}>
              {formError}
            </Alert>
          )}
          <Field label={t('bankName')} required>
            <input
              type="text"
              className="input"
              data-autofocus
              value={formData.bankName}
              onChange={(e) => handleInputChange('bankName', e.target.value)}
              placeholder={t('settingsUi.banking.bankNamePlaceholder')}
            />
          </Field>
          <Field label={t('settingsUi.banking.accountHolder')} required>
            <input
              type="text"
              className="input"
              value={formData.accountName}
              onChange={(e) => handleInputChange('accountName', e.target.value)}
              placeholder={t('placeholders.accountHolderName')}
            />
          </Field>
          <div>
            <label htmlFor="bank-iban" className="label">
              {t('settingsUi.banking.greekIban')}
              <span className="ml-0.5 text-danger" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <input
                id="bank-iban"
                type="text"
                className={`input num pr-9 ${ibanValid === true ? 'border-success' : ''}`}
                aria-invalid={ibanValid === false ? true : undefined}
                aria-describedby="bank-iban-msg"
                value={formData.iban}
                onChange={(e) => handleIBANChange(e.target.value)}
                placeholder={t('placeholders.ibanFormat')}
                maxLength={27}
              />
              {ibanValid !== null && (
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <Icon
                    name={ibanValid ? 'checkCircle' : 'alertCircle'}
                    size={16}
                    className={ibanValid ? 'text-success' : 'text-danger'}
                  />
                </span>
              )}
            </div>
            {ibanValid === false ? (
              <p id="bank-iban-msg" className="field-error">{t('settingsUi.banking.ibanFormat')}</p>
            ) : (
              <p id="bank-iban-msg" className="hint">{t('settingsUi.banking.ibanHint')}</p>
            )}
          </div>
          <Field label={t('settingsUi.banking.swiftLabel')} hint={t('settingsUi.banking.swiftHint')}>
            <input
              type="text"
              className="input num"
              value={formData.swift}
              onChange={(e) => handleInputChange('swift', e.target.value.toUpperCase())}
              placeholder={t('placeholders.swiftCode')}
            />
          </Field>
          <Field label={t('settingsUi.banking.notes')} optionalLabel={t('common.optional')}>
            <textarea
              className="input"
              rows={2}
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder={t('settingsUi.banking.notesPlaceholder')}
            />
          </Field>
          {banks.length === 0 && (
            <label htmlFor="bank-default" className="flex cursor-pointer items-center gap-3">
              <input
                id="bank-default"
                type="checkbox"
                className="checkbox"
                checked={formData.isDefault}
                onChange={(e) => handleInputChange('isDefault', e.target.checked)}
              />
              <span className="text-sm text-ink">{t('settingsUi.banking.setAsDefault')}</span>
            </label>
          )}
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        busy={deleting}
        size="sm"
        closeLabel={t('common.close')}
        title={t('settingsUi.banking.deleteTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" icon="trash" loading={deleting} onClick={handleDeleteBank}>
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          {t('settingsUi.banking.deleteConfirm', { name: deleteTarget?.bankName || '' })}
        </p>
        {deleteTarget?.iban && (
          <p className="num mt-2 text-sm text-muted">{formatIBAN(deleteTarget.iban)}</p>
        )}
      </Modal>
    </div>
  );
};

export default BankingSettings;
