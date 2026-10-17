import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { customerAPI } from '@/utils/api';
import Icon from '@/components/ui/Icon';
import { formatDate } from '@/components/ui/format';

const EMPTY = {
  status: '',
  aadeStatus: '',
  customerId: '',
  startDate: '',
  endDate: ''
};

const InvoiceFilter = ({ filters, onFilterChange }) => {
  const { t } = useTranslation('common');
  const { locale } = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [localFilters, setLocalFilters] = useState(filters);
  const wrapRef = useRef(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Keep the panel in sync when filters change from outside (chip removal, "clear all")
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setIsOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setIsOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const fetchCustomers = async () => {
    try {
      const response = await customerAPI.getCustomers({ limit: 100 });
      if (response.data.success) {
        setCustomers(response.data.customers);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  const handleFilterChange = (field, value) => {
    setLocalFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleApplyFilters = () => {
    onFilterChange(localFilters);
    setIsOpen(false);
  };

  const handleClearFilters = () => {
    setLocalFilters(EMPTY);
    onFilterChange(EMPTY);
    setIsOpen(false);
  };

  const removeFilter = (keys) => {
    const next = { ...filters };
    keys.forEach((k) => { next[k] = ''; });
    onFilterChange(next);
  };

  const activeFiltersCount = Object.values(filters).filter(v => v).length;

  const customerLabel = (id) => {
    const c = customers.find((x) => x._id === id);
    return c ? (c.displayName || c.name) : t('filters.customer');
  };

  // Active filters shown as removable chips next to the button
  const chips = [];
  if (filters.status) chips.push({ keys: ['status'], label: t(`statuses.invoice.${filters.status}`) });
  if (filters.aadeStatus) chips.push({ keys: ['aadeStatus'], label: `AADE: ${t(`statuses.aade.${filters.aadeStatus}`)}` });
  if (filters.customerId) chips.push({ keys: ['customerId'], label: customerLabel(filters.customerId) });
  if (filters.startDate || filters.endDate) {
    chips.push({
      keys: ['startDate', 'endDate'],
      label: `${filters.startDate ? formatDate(filters.startDate, locale) : '…'} – ${filters.endDate ? formatDate(filters.endDate, locale) : '…'}`
    });
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      {chips.map((chip) => (
        <span key={chip.keys.join()} className="chip max-w-[14rem] pr-1" aria-pressed="true">
          <span className="truncate">{chip.label}</span>
          <button
            type="button"
            onClick={() => removeFilter(chip.keys)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-accent/10"
            aria-label={`${t('filters.remove')}: ${chip.label}`}
          >
            <Icon name="x" size={13} />
          </button>
        </span>
      ))}

      <div className="relative" ref={wrapRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="btn btn-secondary"
          aria-expanded={isOpen}
          aria-haspopup="dialog"
        >
          <Icon name="filter" />
          {t('filters.button')}
          {activeFiltersCount > 0 && (
            <span className="num flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1.5 text-[0.6875rem] font-semibold text-canvas">
              {activeFiltersCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div
            role="dialog"
            aria-label={t('filters.title')}
            className="popover fixed inset-x-3 top-auto z-50 mt-2 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:w-[22rem]"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleApplyFilters();
              }}
            >
              <div className="space-y-4 p-4">
                <h3 className="section-title">{t('filters.title')}</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="flt-status" className="label">{t('filters.status')}</label>
                    <select
                      id="flt-status"
                      value={localFilters.status}
                      onChange={(e) => handleFilterChange('status', e.target.value)}
                      className="input input-sm"
                    >
                      <option value="">{t('filters.any')}</option>
                      {['draft', 'sent', 'paid', 'overdue', 'cancelled'].map((s) => (
                        <option key={s} value={s}>{t(`statuses.invoice.${s}`)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="flt-aade" className="label">{t('filters.aadeStatus')}</label>
                    <select
                      id="flt-aade"
                      value={localFilters.aadeStatus}
                      onChange={(e) => handleFilterChange('aadeStatus', e.target.value)}
                      className="input input-sm"
                    >
                      <option value="">{t('filters.any')}</option>
                      {['pending', 'transmitted', 'failed', 'cancelled'].map((s) => (
                        <option key={s} value={s}>{t(`statuses.aade.${s}`)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="flt-customer" className="label">{t('filters.customer')}</label>
                  <select
                    id="flt-customer"
                    value={localFilters.customerId}
                    onChange={(e) => handleFilterChange('customerId', e.target.value)}
                    className="input input-sm"
                  >
                    <option value="">{t('filters.allCustomers')}</option>
                    {customers.map(customer => (
                      <option key={customer._id} value={customer._id}>
                        {customer.displayName || customer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="flt-from" className="label">{t('filters.fromDate')}</label>
                    <input
                      id="flt-from"
                      type="date"
                      value={localFilters.startDate}
                      onChange={(e) => handleFilterChange('startDate', e.target.value)}
                      className="input input-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="flt-to" className="label">{t('filters.toDate')}</label>
                    <input
                      id="flt-to"
                      type="date"
                      value={localFilters.endDate}
                      min={localFilters.startDate || undefined}
                      onChange={(e) => handleFilterChange('endDate', e.target.value)}
                      className="input input-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
                <button type="button" onClick={handleClearFilters} className="btn btn-ghost btn-sm">
                  {t('common.clearAll')}
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsOpen(false)} className="btn btn-secondary btn-sm">
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    {t('filters.apply')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceFilter;
