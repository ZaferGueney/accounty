import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import InvoiceFilter from './InvoiceFilter';
import InvoiceEdit from './InvoiceEdit';
import { invoiceAPI } from '@/utils/api';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Modal from '@/components/ui/Modal';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { formatMoney, formatDate, formatNumber, apiErrorText } from '@/components/ui/format';

// A 'sent' invoice past its due date is overdue, even if the stored status
// hasn't flipped yet. The list shows what the user needs to act on.
const displayStatus = (invoice) =>
  invoice.status === 'sent' && invoice.daysOverdue > 0 ? 'overdue' : invoice.status;

/** Compact page list: 1 … 4 5 [6] 7 8 … 20 */
const pageList = (current, total) => {
  const pages = [];
  const add = (p) => pages.push(p);
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  add(1);
  if (start > 2) add('…l');
  for (let p = start; p <= end; p++) add(p);
  if (end < total - 1) add('…r');
  if (total > 1) add(total);
  return pages;
};

const SkeletonRows = () => (
  <div aria-hidden="true">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-4 last:border-b-0">
        <div className="skeleton h-4 w-16" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="skeleton h-4 w-40 max-w-full" />
          <div className="skeleton h-3 w-24" />
        </div>
        <div className="skeleton hidden h-4 w-20 sm:block" />
        <div className="skeleton hidden h-5 w-16 rounded-full sm:block" />
        <div className="skeleton h-4 w-20" />
      </div>
    ))}
  </div>
);

const Invoice = () => {
  const router = useRouter();
  const locale = router.locale;
  const { t } = useTranslation('common');
  const toast = useToast();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  const [filters, setFilters] = useState({
    status: '',
    aadeStatus: '',
    customerId: '',
    startDate: '',
    endDate: ''
  });
  const [stats, setStats] = useState(null);
  const [showInvoiceEdit, setShowInvoiceEdit] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [editorMode, setEditorMode] = useState('create'); // create | edit | view | duplicate
  const [duplicatingInvoice, setDuplicatingInvoice] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const [activeTab, setActiveTab] = useState('invoices'); // 'invoices' or 'receipts'
  const [reloadKey, setReloadKey] = useState(0);
  const requestSeq = useRef(0);

  // Fetch invoices
  const fetchInvoices = async () => {
    const seq = ++requestSeq.current;
    try {
      setLoading(true);
      setError('');
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters,
        // Filter by series based on active tab
        series: activeTab === 'receipts' ? 'R' : 'A'
      };

      const response = await invoiceAPI.getInvoices(params);
      // Ignore answers to requests that were superseded (fast tab/page switching)
      if (seq !== requestSeq.current) return;
      if (response.data.success) {
        setInvoices(response.data.invoices);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(apiErrorText(err, t('invoiceList.loadFailed')));
      console.error('Fetch invoices error:', err);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await invoiceAPI.getInvoiceStats({
        startDate: new Date(new Date().getFullYear(), 0, 1).toISOString(),
        endDate: new Date().toISOString()
      });
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (err) {
      console.error('Fetch stats error:', err);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, filters, activeTab, reloadKey]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const switchTab = (tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setInvoices([]);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const goToPage = (page) => {
    setPagination(prev => ({ ...prev, page }));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateInvoice = () => {
    setEditingInvoiceId(null);
    setDuplicatingInvoice(null);
    setEditorMode('create');
    setShowInvoiceEdit(true);
  };

  const handleEditInvoice = (id) => {
    setEditingInvoiceId(id);
    setEditorMode('edit');
    setShowInvoiceEdit(true);
  };

  const handleCloseInvoiceEdit = () => {
    setShowInvoiceEdit(false);
    setEditingInvoiceId(null);
    setDuplicatingInvoice(null);
    setEditorBusy(false);
    // Refresh invoices list
    fetchInvoices();
    fetchStats();
  };

  const handleViewInvoice = (id) => {
    // The editor doubles as the detail view; it locks what can't be changed.
    setEditingInvoiceId(id);
    setEditorMode('view');
    setShowInvoiceEdit(true);
  };

  const handleDuplicateInvoice = async (id) => {
    if (duplicatingId) return;
    try {
      setDuplicatingId(id);
      // Fetch the invoice data
      const response = await invoiceAPI.getInvoice(id);
      if (response.data.success) {
        const invoice = response.data.invoice;

        // Prepare duplicate data - keep customer, services, descriptions but reset dates and numbers
        const duplicateData = {
          customerId: invoice.customerId?._id || invoice.customerId,
          series: invoice.series,
          invoiceType: invoice.invoiceType,
          currency: invoice.currency,
          exchangeRate: invoice.exchangeRate,
          vatRegulation: invoice.vatRegulation,
          counterpart: invoice.counterpart,
          invoiceDetails: invoice.invoiceDetails.map((detail, idx) => ({
            lineNumber: idx + 1,
            description: detail.description,
            itemDescription: detail.itemDescription,
            quantity: detail.quantity,
            unit: detail.unit,
            unitPrice: detail.unitPrice,
            netValue: detail.netValue,
            vatCategory: detail.vatCategory,
            vatAmount: detail.vatAmount,
            incomeClassification: detail.incomeClassification
          })),
          notes: invoice.notes,
          footerText: invoice.footerText,
          // Only the method carries over; amounts/dates belong to the original
          payment: { method: invoice.payment?.method },
          hideBankDetails: invoice.hideBankDetails
        };

        setDuplicatingInvoice(duplicateData);
        setEditingInvoiceId(null);
        setEditorMode('duplicate');
        setShowInvoiceEdit(true);
      }
    } catch (err) {
      console.error('Duplicate invoice error:', err);
      toast.error(apiErrorText(err, t('invoiceList.duplicateFailed')));
    } finally {
      setDuplicatingId(null);
    }
  };

  const editorTitle = {
    create: t('invoice.createNewInvoice'),
    edit: t('invoice.editInvoice'),
    view: t('invoiceList.invoiceDetails'),
    duplicate: t('invoice.duplicateInvoice')
  }[editorMode];

  const isReceipts = activeTab === 'receipts';
  const firstRow = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const lastRow = Math.min(pagination.page * pagination.limit, pagination.total);
  const hasFilters = Object.values(filters).some(Boolean);

  const customerName = (invoice) =>
    invoice.counterpart?.name || invoice.customerId?.displayName || t('invoiceList.noCustomer');

  const typeLabel = (code) => {
    const map = {
      '1.1': 'salesInvoice',
      '2.1': 'serviceInvoice',
      '2.2': 'serviceInvoiceEU',
      '5.1': 'creditNoteAssoc',
      '5.2': 'creditNoteNonAssoc'
    };
    return map[code] ? t(`invoice.invoiceTypes.${map[code]}`) : code;
  };

  const renderActions = (invoice) => (
    <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => handleViewInvoice(invoice._id)}
        className="btn btn-ghost btn-icon btn-sm hidden lg:inline-flex"
        title={t('invoiceList.view')}
        aria-label={`${t('invoiceList.view')} ${invoice.invoiceNumber}`}
      >
        <Icon name="eye" />
      </button>
      {(invoice.status === 'draft' && invoice.aadeStatus !== 'transmitted') && (
        <button
          type="button"
          onClick={() => handleEditInvoice(invoice._id)}
          className="btn btn-ghost btn-icon btn-sm hidden lg:inline-flex"
          title={t('common.edit')}
          aria-label={`${t('common.edit')} ${invoice.invoiceNumber}`}
        >
          <Icon name="pencil" />
        </button>
      )}
      {!isReceipts && (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon="copy"
          loading={duplicatingId === invoice._id}
          disabled={!!duplicatingId}
          onClick={() => handleDuplicateInvoice(invoice._id)}
          title={t('invoiceList.duplicate')}
          aria-label={`${t('invoiceList.duplicate')} ${invoice.invoiceNumber}`}
        />
      )}
    </div>
  );

  const openRow = (invoice) =>
    invoice.status === 'draft' && invoice.aadeStatus !== 'transmitted'
      ? handleEditInvoice(invoice._id)
      : handleViewInvoice(invoice._id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={isReceipts ? t('invoiceList.receipts') : t('invoices')}
        description={isReceipts ? t('invoiceList.receiptsDescription') : t('invoicesDescription')}
        actions={
          !isReceipts && (
            <Button variant="primary" icon="plus" onClick={handleCreateInvoice}>
              {t('invoiceList.newInvoice')}
            </Button>
          )
        }
      />

      {/* Year-to-date summary */}
      <section aria-label={t('invoiceList.summary')} className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5 sm:px-5">
          <h2 className="text-[0.8125rem] font-medium text-ink-2">
            {t('invoiceList.yearToDate', { year: new Date().getFullYear() })}
          </h2>
          <span className="text-xs text-muted">{t('invoiceList.allDocuments')}</span>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-line">
          {[
            {
              key: 'issued',
              label: t('invoiceList.issued'),
              amount: stats?.totalRevenue,
              count: stats?.totalInvoices,
              tone: 'text-ink'
            },
            {
              key: 'paid',
              label: t('invoiceList.paid'),
              amount: stats?.paidRevenue,
              count: stats?.paidInvoices,
              tone: 'text-success'
            },
            {
              key: 'overdue',
              label: t('invoiceList.overdue'),
              amount: stats?.overdueRevenue,
              count: stats?.overdueInvoices,
              tone: stats?.overdueInvoices > 0 ? 'text-danger' : 'text-ink'
            }
          ].map((s) => (
            <div key={s.key} className="min-w-0 px-3 py-3 sm:px-5 sm:py-4">
              <dt className="truncate text-xs text-muted sm:text-[0.8125rem]">{s.label}</dt>
              <dd className="mt-0.5 sm:mt-1">
                {stats ? (
                  <>
                    <span className={`num block truncate text-base font-semibold tracking-[-0.01em] sm:text-2xl ${s.tone}`}>
                      {formatMoney(s.amount, locale, 'EUR', { decimals: 0 })}
                    </span>
                    <span className="num block truncate text-[0.6875rem] text-muted sm:text-xs">
                      {t('invoiceList.documentsCount', { count: s.count || 0, formatted: formatNumber(s.count, locale) })}
                    </span>
                  </>
                ) : (
                  <span className="block space-y-1.5">
                    <span className="skeleton block h-6 w-full max-w-[7rem]" />
                    <span className="skeleton block h-3 w-16" />
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Tabs + filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label={t('invoiceList.documentType')} className="segmented">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'invoices'}
            onClick={() => switchTab('invoices')}
          >
            {t('invoices')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'receipts'}
            onClick={() => switchTab('receipts')}
          >
            {t('invoiceList.receipts')}
          </button>
        </div>
        <InvoiceFilter onFilterChange={handleFilterChange} filters={filters} />
      </div>

      {/* List */}
      <section className="card overflow-hidden" aria-busy={loading}>
        {loading && invoices.length === 0 ? (
          <SkeletonRows />
        ) : error ? (
          <div className="p-4 sm:p-6">
            <Alert tone="danger" title={t('invoiceList.loadFailed')}>
              {error}
            </Alert>
            <div className="mt-4">
              <Button icon="refresh" onClick={() => setReloadKey((k) => k + 1)}>
                {t('common.retry')}
              </Button>
            </div>
          </div>
        ) : invoices.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon="filter"
              title={t('invoiceList.noMatchesTitle')}
              description={t('invoiceList.noMatchesBody')}
              action={
                <Button
                  onClick={() =>
                    handleFilterChange({ status: '', aadeStatus: '', customerId: '', startDate: '', endDate: '' })
                  }
                >
                  {t('common.clearAll')}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={isReceipts ? 'receipt' : 'file'}
              title={isReceipts ? t('invoiceList.noReceiptsTitle') : t('invoiceList.noInvoicesTitle')}
              description={isReceipts ? t('invoiceList.noReceiptsBody') : t('invoiceList.noInvoicesBody')}
              action={
                !isReceipts && (
                  <Button variant="primary" icon="plus" onClick={handleCreateInvoice}>
                    {t('invoiceList.newInvoice')}
                  </Button>
                )
              }
            />
          )
        ) : (
          <div className={`transition-opacity duration-150 ${loading ? 'opacity-60' : ''}`}>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">{t('invoiceList.colNumber')}</th>
                    <th scope="col">{t('invoiceList.colCustomer')}</th>
                    <th scope="col">{t('invoiceList.colIssued')}</th>
                    <th scope="col">{t('invoiceList.colDue')}</th>
                    <th scope="col">{t('invoiceList.colStatus')}</th>
                    <th scope="col">AADE</th>
                    <th scope="col" className="!text-right">{t('invoiceList.colAmount')}</th>
                    <th scope="col"><span className="sr-only">{t('common.actions')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const status = displayStatus(invoice);
                    return (
                      <tr
                        key={invoice._id}
                        onClick={() => openRow(invoice)}
                        className="cursor-pointer hover:bg-sunken/60"
                      >
                        <td className="whitespace-nowrap">
                          <span className="num font-semibold text-ink">{invoice.invoiceNumber}</span>
                          <span className="mt-0.5 block text-xs text-muted" title={typeLabel(invoice.invoiceType)}>
                            {invoice.invoiceType}
                          </span>
                        </td>
                        <td className="max-w-[18rem]">
                          <span className="block truncate font-medium text-ink" title={customerName(invoice)}>
                            {customerName(invoice)}
                          </span>
                          {invoice.counterpart?.taxInfo?.afm && (
                            <span className="num mt-0.5 block text-xs text-muted">
                              {t('editor.afmShort')} {invoice.counterpart.taxInfo.afm}
                            </span>
                          )}
                        </td>
                        <td className="num whitespace-nowrap text-ink-2">{formatDate(invoice.issueDate, locale)}</td>
                        <td className="whitespace-nowrap">
                          <span className="num text-ink-2">{formatDate(invoice.dueDate, locale)}</span>
                          {invoice.daysOverdue > 0 && (
                            <span className="num mt-0.5 block text-xs font-medium text-danger">
                              {t('invoiceList.daysOverdue', { count: invoice.daysOverdue })}
                            </span>
                          )}
                        </td>
                        <td><StatusBadge status={status} /></td>
                        <td><StatusBadge kind="aade" status={invoice.aadeStatus} /></td>
                        <td className="whitespace-nowrap text-right">
                          <span className="num font-semibold text-ink">
                            {formatMoney(invoice.totals?.totalAmount, locale, invoice.currency || 'EUR')}
                          </span>
                          {invoice.amountDue > 0 && invoice.status !== 'cancelled' && invoice.amountDue !== invoice.totals?.totalAmount && (
                            <span className="num mt-0.5 block text-xs text-muted">
                              {t('invoiceList.openAmount', { amount: formatMoney(invoice.amountDue, locale, invoice.currency || 'EUR') })}
                            </span>
                          )}
                        </td>
                        <td className="w-px whitespace-nowrap pr-2">
                          {renderActions(invoice)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phone/tablet list */}
            <ul className="divide-y divide-line lg:hidden">
              {invoices.map((invoice) => {
                const status = displayStatus(invoice);
                return (
                  <li key={invoice._id} className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => openRow(invoice)}
                      className="min-w-0 flex-1 px-4 py-3.5 text-left transition-colors active:bg-sunken"
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate font-medium text-ink">{customerName(invoice)}</span>
                        <span className="num shrink-0 font-semibold text-ink">
                          {formatMoney(invoice.totals?.totalAmount, locale, invoice.currency || 'EUR')}
                        </span>
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-3 text-xs text-muted">
                        <span className="num truncate">
                          <span className="font-semibold text-ink-2">{invoice.invoiceNumber}</span>
                          {' · '}
                          {formatDate(invoice.issueDate, locale)}
                          {invoice.daysOverdue > 0 && (
                            <span className="font-medium text-danger">
                              {' · '}
                              {t('invoiceList.daysOverdue', { count: invoice.daysOverdue })}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        <StatusBadge status={status} />
                        <StatusBadge kind="aade" status={invoice.aadeStatus} />
                      </span>
                    </button>
                    <div className="flex items-center pr-2">
                      {renderActions(invoice)}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Pagination */}
        {!error && pagination.pages > 1 && (
          <nav
            aria-label={t('invoiceList.pagination')}
            className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3"
          >
            <p className="num text-xs text-muted sm:text-sm">
              {t('invoiceList.showingRange', {
                from: formatNumber(firstRow, locale),
                to: formatNumber(lastRow, locale),
                total: formatNumber(pagination.total, locale)
              })}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => goToPage(Math.max(1, pagination.page - 1))}
                disabled={pagination.page === 1 || loading}
                className="btn btn-ghost btn-sm btn-icon"
                aria-label={t('common.previous')}
              >
                <Icon name="chevronLeft" />
              </button>
              {pageList(pagination.page, pagination.pages).map((p) =>
                typeof p === 'string' ? (
                  <span key={p} className="px-1 text-sm text-muted" aria-hidden="true">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => goToPage(p)}
                    disabled={loading}
                    aria-current={pagination.page === p ? 'page' : undefined}
                    className={`num hidden h-8 min-w-8 rounded px-2 text-sm font-medium transition-colors sm:inline-block ${
                      pagination.page === p ? 'bg-ink text-canvas' : 'text-ink-2 hover:bg-sunken'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <span className="num px-2 text-sm text-ink-2 sm:hidden">
                {pagination.page} / {pagination.pages}
              </span>
              <button
                type="button"
                onClick={() => goToPage(Math.min(pagination.pages, pagination.page + 1))}
                disabled={pagination.page === pagination.pages || loading}
                className="btn btn-ghost btn-sm btn-icon"
                aria-label={t('common.next')}
              >
                <Icon name="chevronRight" />
              </button>
            </div>
          </nav>
        )}
      </section>

      {/* Invoice editor */}
      <Modal
        open={showInvoiceEdit}
        onClose={handleCloseInvoiceEdit}
        title={editorTitle}
        size="2xl"
        busy={editorBusy}
        closeLabel={t('common.close')}
      >
        <InvoiceEdit
          invoiceId={editingInvoiceId}
          initialData={duplicatingInvoice}
          onClose={handleCloseInvoiceEdit}
          onSave={handleCloseInvoiceEdit}
          onBusyChange={setEditorBusy}
        />
      </Modal>
    </div>
  );
};

export default Invoice;
