import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { customerAPI } from '@/utils/api';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Field from '@/components/ui/Field';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import Icon from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { apiErrorText, formatMoney } from '@/components/ui/format';

const emptyCustomer = () => ({
  name: '',
  email: '',
  phone: '',
  customerType: 'individual',
  address: {
    street: '',
    number: '',
    area: '',
    city: '',
    postalCode: '',
    prefecture: '',
    country: 'Greece'
  },
  taxInfo: {
    afm: '',
    doy: { code: '', name: '' },
    vatNumber: '',
    businessName: ''
  }
});

const Customers = ({ selectionMode = false, onCustomerSelect = undefined }) => {
  const router = useRouter();
  const { t } = useTranslation('common');
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [customerType, setCustomerType] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  const [newCustomer, setNewCustomer] = useState(emptyCustomer());

  useEffect(() => {
    fetchCustomers();
  }, [searchQuery, customerType, pagination.page]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery,
        type: customerType
      };

      const response = await customerAPI.getCustomers(params);
      if (response.data.success) {
        setCustomers(response.data.customers);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      setError(apiErrorText(err, t('customersPage.loadFailed')));
      console.error('Fetch customers error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleTypeFilter = (type) => {
    setCustomerType(type);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const openCreate = () => {
    setEditingId(null);
    setNewCustomer(emptyCustomer());
    setFormError('');
    setShowAddForm(true);
  };

  const openEdit = (customer) => {
    const base = emptyCustomer();
    setEditingId(customer._id);
    setNewCustomer({
      ...base,
      ...customer,
      customerType: customer.customerType || 'individual',
      address: { ...base.address, ...(customer.address || {}) },
      taxInfo: {
        ...base.taxInfo,
        ...(customer.taxInfo || {}),
        doy: { ...base.taxInfo.doy, ...(customer.taxInfo?.doy || {}) }
      }
    });
    setFormError('');
    setShowAddForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowAddForm(false);
    setFormError('');
  };

  const handleAddCustomer = async () => {
    if (saving) return;
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        const response = await customerAPI.updateCustomer(editingId, newCustomer);
        if (response.data.success) {
          setCustomers(prev => prev.map(c => (c._id === editingId ? response.data.customer : c)));
          setShowAddForm(false);
          toast.success(t('customersPage.updated'));
        }
      } else {
        const response = await customerAPI.createCustomer(newCustomer);
        if (response.data.success) {
          setCustomers(prev => [response.data.customer, ...prev]);
          setShowAddForm(false);
          setNewCustomer(emptyCustomer());
          toast.success(t('customersPage.created'));
        }
      }
    } catch (err) {
      setFormError(apiErrorText(err, editingId ? t('customersPage.updateFailed') : t('customersPage.createFailed')));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await customerAPI.deleteCustomer(deleteTarget._id);
      setCustomers(prev => prev.filter(c => c._id !== deleteTarget._id));
      toast.success(t('customersPage.deleted'));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(apiErrorText(err, t('customersPage.deleteFailed')));
    } finally {
      setDeleting(false);
    }
  };

  const setAddress = (field, value) =>
    setNewCustomer(prev => ({ ...prev, address: { ...prev.address, [field]: value } }));
  const setTax = (field, value) =>
    setNewCustomer(prev => ({ ...prev, taxInfo: { ...prev.taxInfo, [field]: value } }));

  const typeLabel = (type) =>
    type === 'business' ? t('customersPage.typeBusiness') : t('customersPage.typeIndividual');

  const nameOf = (c) => c.displayName || c.name;

  const showingSkeleton = loading && customers.length === 0;
  const hasFilter = Boolean(searchQuery || customerType);

  const rowActions = (customer) =>
    selectionMode ? (
      <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onCustomerSelect?.(customer); }}>
        {t('customersPage.select')}
      </Button>
    ) : (
      <div className="flex items-center justify-end gap-0.5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openEdit(customer); }}
          className="btn btn-ghost btn-icon btn-sm"
          aria-label={`${t('common.edit')}: ${nameOf(customer)}`}
          title={t('common.edit')}
        >
          <Icon name="pencil" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setDeleteTarget(customer); }}
          className="btn btn-danger-ghost btn-icon btn-sm"
          aria-label={`${t('common.delete')}: ${nameOf(customer)}`}
          title={t('common.delete')}
        >
          <Icon name="trash" />
        </button>
      </div>
    );

  return (
    <div className="space-y-6">
      {!selectionMode && (
        <PageHeader
          title={t('customers')}
          description={t('customersDescription')}
          actions={
            <Button variant="primary" icon="plus" onClick={openCreate}>
              {t('customersPage.newCustomer')}
            </Button>
          }
        />
      )}

      {error && (
        <Alert tone="danger" onDismiss={() => setError('')} dismissLabel={t('common.dismiss')}>
          {error}
        </Alert>
      )}

      {/* Search and filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder={t('customersPage.searchPlaceholder')}
            aria-label={t('common.search')}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <div className="segmented max-w-full self-start overflow-x-auto" role="group" aria-label={t('customersPage.typeFilter')}>
          {[
            { value: '', label: t('common.all') },
            { value: 'individual', label: t('customersPage.typeIndividual') },
            { value: 'business', label: t('customersPage.typeBusiness') }
          ].map((opt) => (
            <button
              key={opt.value || 'all'}
              type="button"
              aria-pressed={customerType === opt.value}
              onClick={() => handleTypeFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {showingSkeleton ? (
          <div className="divide-y divide-line" aria-busy="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton hidden h-4 w-24 sm:block" />
                <div className="skeleton ml-auto h-4 w-16" />
              </div>
            ))}
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            icon="users"
            title={hasFilter ? t('customersPage.noResults') : t('customersPage.emptyTitle')}
            description={hasFilter ? t('customersPage.noResultsHint') : t('customersPage.emptyHint')}
            action={
              !hasFilter && !selectionMode ? (
                <Button variant="primary" icon="plus" onClick={openCreate}>
                  {t('customersPage.newCustomer')}
                </Button>
              ) : hasFilter ? (
                <Button variant="secondary" onClick={() => { handleSearch(''); handleTypeFilter(''); }}>
                  {t('common.clearAll')}
                </Button>
              ) : null
            }
          />
        ) : (
          <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('customersPage.colName')}</th>
                    <th>{t('customersPage.colAfm')}</th>
                    <th>{t('customersPage.colContact')}</th>
                    <th>{t('city')}</th>
                    <th className="text-right">{t('customersPage.colInvoices')}</th>
                    <th className="text-right">{t('customersPage.colRevenue')}</th>
                    <th><span className="sr-only">{t('common.actions')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr
                      key={customer._id}
                      className={selectionMode ? 'cursor-pointer hover:bg-sunken/60' : 'hover:bg-sunken/40'}
                      onClick={selectionMode ? () => onCustomerSelect?.(customer) : undefined}
                    >
                      <td className="max-w-[18rem]">
                        <div className="truncate font-medium text-ink">{nameOf(customer)}</div>
                        <div className="truncate text-xs text-muted">
                          {customer.taxInfo?.businessName && customer.taxInfo.businessName !== nameOf(customer)
                            ? customer.taxInfo.businessName
                            : typeLabel(customer.customerType)}
                        </div>
                      </td>
                      <td className="num whitespace-nowrap text-ink-2">{customer.taxInfo?.afm || '—'}</td>
                      <td className="max-w-[16rem]">
                        <div className="truncate text-ink-2">{customer.email || '—'}</div>
                        {customer.phone && <div className="num truncate text-xs text-muted">{customer.phone}</div>}
                      </td>
                      <td className="whitespace-nowrap text-ink-2">{customer.address?.city || '—'}</td>
                      <td className="num text-right text-ink-2">{customer.stats?.totalInvoices || 0}</td>
                      <td className="num whitespace-nowrap text-right font-medium text-ink">
                        {formatMoney(customer.stats?.totalAmount || 0, router.locale)}
                      </td>
                      <td className="w-px whitespace-nowrap text-right">{rowActions(customer)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone list */}
            <ul className="divide-y divide-line md:hidden">
              {customers.map((customer) => (
                <li
                  key={customer._id}
                  className={`flex items-start gap-3 px-4 py-3.5 ${selectionMode ? 'cursor-pointer active:bg-sunken' : ''}`}
                  onClick={selectionMode ? () => onCustomerSelect?.(customer) : undefined}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-ink">{nameOf(customer)}</div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                      {customer.taxInfo?.afm && (
                        <span className="num">{t('customersPage.colAfm')} {customer.taxInfo.afm}</span>
                      )}
                      {customer.address?.city && <span>{customer.address.city}</span>}
                    </div>
                    {(customer.email || customer.phone) && (
                      <div className="mt-0.5 truncate text-xs text-muted">{customer.email || customer.phone}</div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="num text-sm font-medium text-ink">
                      {formatMoney(customer.stats?.totalAmount || 0, router.locale)}
                    </span>
                    {rowActions(customer)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
            <Button
              size="sm"
              icon="chevronLeft"
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page === 1 || loading}
            >
              {t('common.previous')}
            </Button>
            <span className="num text-sm text-muted">
              {t('customersPage.pageOf', { page: pagination.page, pages: pagination.pages })}
            </span>
            <Button
              size="sm"
              iconRight="chevronRight"
              onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
              disabled={pagination.page === pagination.pages || loading}
            >
              {t('common.next')}
            </Button>
          </div>
        )}
      </div>

      {/* Add / edit customer */}
      <Modal
        open={showAddForm}
        onClose={closeForm}
        busy={saving}
        size="lg"
        closeLabel={t('common.close')}
        title={editingId ? t('customersPage.editTitle') : t('customersPage.addTitle')}
        footer={
          <>
            <Button onClick={closeForm} disabled={saving}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              onClick={handleAddCustomer}
              loading={saving}
              disabled={!newCustomer.name?.trim()}
            >
              {saving ? t('common.saving') : editingId ? t('common.saveChanges') : t('customersPage.addSubmit')}
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => { e.preventDefault(); if (newCustomer.name?.trim()) handleAddCustomer(); }}
          className="space-y-5"
        >
          {formError && (
            <Alert tone="danger" onDismiss={() => setFormError('')} dismissLabel={t('common.dismiss')}>
              {formError}
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('customer.name')} required>
              <input
                type="text"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                className="input"
                data-autofocus
              />
            </Field>
            <Field label={t('customersPage.type')}>
              <select
                value={newCustomer.customerType}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, customerType: e.target.value }))}
                className="input"
              >
                <option value="individual">{t('customersPage.typeIndividual')}</option>
                <option value="business">{t('customersPage.typeBusiness')}</option>
              </select>
            </Field>
            <Field label={t('customer.email')}>
              <input
                type="email"
                autoComplete="off"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                className="input"
              />
            </Field>
            <Field label={t('customer.phone')}>
              <input
                type="tel"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                className="input num"
              />
            </Field>

            {newCustomer.customerType === 'business' && (
              <>
                <Field label={t('customer.afm')}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={newCustomer.taxInfo.afm}
                    onChange={(e) => setTax('afm', e.target.value)}
                    className="input num"
                    maxLength={9}
                    placeholder="123456789"
                  />
                </Field>
                <Field label={t('customer.businessName')}>
                  <input
                    type="text"
                    value={newCustomer.taxInfo.businessName}
                    onChange={(e) => setTax('businessName', e.target.value)}
                    className="input"
                  />
                </Field>
              </>
            )}
          </div>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-ink">{t('customersPage.address')}</legend>
            <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-4 sm:grid-cols-[minmax(0,1fr)_6rem_minmax(0,1fr)]">
              <Field label={t('street')}>
                <input
                  type="text"
                  value={newCustomer.address.street}
                  onChange={(e) => setAddress('street', e.target.value)}
                  className="input"
                />
              </Field>
              <Field label={t('number')}>
                <input
                  type="text"
                  value={newCustomer.address.number}
                  onChange={(e) => setAddress('number', e.target.value)}
                  className="input"
                />
              </Field>
              <Field label={t('city')} className="col-span-2 sm:col-span-1">
                <input
                  type="text"
                  value={newCustomer.address.city}
                  onChange={(e) => setAddress('city', e.target.value)}
                  className="input"
                />
              </Field>
            </div>
          </fieldset>
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        busy={deleting}
        size="sm"
        closeLabel={t('common.close')}
        title={t('customersPage.deleteTitle')}
        footer={
          <>
            <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>{t('common.cancel')}</Button>
            <Button variant="danger" icon="trash" loading={deleting} onClick={handleDeleteCustomer}>
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          {t('customersPage.deleteConfirm', { name: deleteTarget ? nameOf(deleteTarget) : '' })}
        </p>
      </Modal>
    </div>
  );
};

export default Customers;
