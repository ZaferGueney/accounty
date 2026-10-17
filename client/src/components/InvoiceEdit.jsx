import { useState, useEffect, useRef, useId } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { invoiceAPI, customerAPI, serviceAPI } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSelector, useDispatch } from 'react-redux';
import { fetchSettings, selectSettings, selectSettingsLoading } from '@/store/slices/settingsSlice';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Alert from '@/components/ui/Alert';
import Icon from '@/components/ui/Icon';
import StatusBadge from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { formatMoney, apiErrorText, readApiError } from '@/components/ui/format';

const emptyCounterpart = () => ({
  name: '',
  vatNumber: '',
  country: 'GR',
  branch: 0,
  address: { street: '', number: '', postalCode: '', city: '', prefecture: '', country: 'GR' },
  taxInfo: { afm: '', doy: { code: '', name: '' } }
});

const emptyNewCustomer = () => ({
  name: '',
  email: '',
  phone: '',
  address: { street: '', number: '', city: '', postalCode: '', prefecture: '' },
  taxInfo: { afm: '', businessName: '' }
});

// Desktop line-item grid: description | qty | unit | price | VAT | total | remove
const LINE_GRID = 'lg:grid-cols-[minmax(0,1fr)_5.5rem_7rem_7.5rem_7.5rem_8rem_2.25rem]';

const InvoiceEdit = ({ invoiceId, initialData, onClose, onSave, onBusyChange }) => {
  const router = useRouter();
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const dispatch = useDispatch();
  const toast = useToast();
  const locale = router.locale || 'en';
  const comboId = useId();

  // Redux state
  const settings = useSelector(selectSettings);
  const settingsLoading = useSelector(selectSettingsLoading);

  // Component state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAs, setSavingAs] = useState(null); // 'draft' | 'sent'
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState(null); // { title?, message }
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [activeCustomer, setActiveCustomer] = useState(-1);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [showEditCustomer, setShowEditCustomer] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [newCustomer, setNewCustomer] = useState(emptyNewCustomer());
  const [customerBusy, setCustomerBusy] = useState(false);
  const [customerError, setCustomerError] = useState('');

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusAction, setStatusAction] = useState(''); // 'markPaid' or 'cancel'
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [paymentDetails, setPaymentDetails] = useState({
    amount: 0,
    paidDate: new Date().toISOString().split('T')[0],
    method: '3',
    info: ''
  });

  // Service search state
  const [services, setServices] = useState([]);
  const [showServiceSearch, setShowServiceSearch] = useState({ index: null, show: false });
  const [showCreateService, setShowCreateService] = useState(false);
  const [serviceBusy, setServiceBusy] = useState(false);
  const [serviceError, setServiceError] = useState('');
  const [newService, setNewService] = useState({
    name: '',
    description: '',
    basePrice: 0,
    unit: 'hrs',
    vatCategory: '1'
  });

  // In-flight guards: a double click must never submit twice
  const inFlight = useRef({ save: false, status: false, customer: false, service: false, preview: false });
  const errorRef = useRef(null);

  const [invoice, setInvoice] = useState({
    invoiceNumber: '',
    series: 'A',
    invoiceType: '2.1', // Service invoice default
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +30 days
    currency: 'EUR',
    exchangeRate: 1,
    customerId: '',
    status: 'draft',
    vatRegulation: 'standard',
    issuer: {
      vatNumber: '',
      country: 'GR',
      branch: 0,
      name: '',
      legalForm: '',
      address: {
        street: '',
        number: '',
        postalCode: '',
        city: '',
        prefecture: '',
        country: 'GR'
      },
      taxInfo: {
        afm: '',
        doy: { code: '', name: '' },
        gemi: ''
      }
    },
    counterpart: emptyCounterpart(),
    invoiceDetails: [{
      lineNumber: 1,
      description: '',
      itemDescription: '',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 0,
      netValue: 0,
      vatCategory: '1', // 24% VAT
      vatAmount: 0,
      incomeClassification: [{
        classificationType: 'E3_561_001', // B2B professional services
        categoryId: 'category1_3', // Income from provision of services
        amount: 0
      }]
    }],
    notes: '',
    footerText: 'Vielen Dank für Ihren Auftrag!\nBei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen',
    payment: {
      method: '3', // Bank transfer default
      amount: 0,
      info: ''
    },
    hideBankDetails: false
  });

  const vatRates = {
    '1': 0.24, // 24% Standard
    '2': 0.13, // 13% Reduced
    '3': 0.06, // 6% Super-reduced
    '7': 0,    // 0% Zero rate
    '8': 0     // VAT exempt
  };

  const vatOptions = [
    { value: '1', short: '24%', label: t('editor.vatOptions.standard') },
    { value: '2', short: '13%', label: t('editor.vatOptions.reduced') },
    { value: '3', short: '6%', label: t('editor.vatOptions.superReduced') },
    { value: '7', short: '0%', label: t('editor.vatOptions.zero') },
    { value: '8', short: t('editor.exempt'), label: t('editor.vatOptions.exempt') }
  ];

  const invoiceTypes = [
    { value: '1.1', label: t('invoice.invoiceTypes.salesInvoice') },
    { value: '2.1', label: t('invoice.invoiceTypes.serviceInvoice') },
    { value: '2.2', label: t('invoice.invoiceTypes.serviceInvoiceEU') },
    { value: '5.1', label: t('invoice.invoiceTypes.creditNoteAssoc') },
    { value: '5.2', label: t('invoice.invoiceTypes.creditNoteNonAssoc') }
  ];

  const paymentMethods = [
    { value: '1', label: t('invoice.paymentMethods.cash') },
    { value: '2', label: t('invoice.paymentMethods.check') },
    { value: '3', label: t('invoice.paymentMethods.bankTransfer') },
    { value: '4', label: t('invoice.paymentMethods.creditCard') },
    { value: '5', label: t('invoice.paymentMethods.webBanking') },
    { value: '6', label: t('invoice.paymentMethods.pos') },
    { value: '7', label: t('invoice.paymentMethods.iris') }
  ];

  const unitTypes = [
    { value: 'pcs', short: t('editor.unitShort.pcs'), label: t('invoice.unitTypes.pieces') },
    { value: 'hrs', short: t('editor.unitShort.hrs'), label: t('invoice.unitTypes.hours') },
    { value: 'days', short: t('editor.unitShort.days'), label: t('invoice.unitTypes.days') },
    { value: 'kg', short: t('editor.unitShort.kg'), label: t('invoice.unitTypes.kg') },
    { value: 'm', short: t('editor.unitShort.m'), label: t('invoice.unitTypes.meters') },
    { value: 'm2', short: t('editor.unitShort.m2'), label: t('invoice.unitTypes.sqMeters') },
    { value: 'liters', short: t('editor.unitShort.liters'), label: t('invoice.unitTypes.liters') },
    { value: 'months', short: t('editor.unitShort.months'), label: t('invoice.unitTypes.months') }
  ];

  const vatRegulations = [
    { value: 'standard', label: t('invoice.vatRegulationTypes.standard') },
    { value: 'taxFree', label: t('invoice.vatRegulationTypes.taxFree') },
    { value: 'reverseChargeDE', label: t('invoice.vatRegulationTypes.reverseCharge') },
    { value: 'reverseChargeEU', label: t('invoice.vatRegulationTypes.euReverseCharge') },
    { value: 'intraCommunity', label: t('invoice.vatRegulationTypes.intraCommunity') },
    { value: 'export', label: t('invoice.vatRegulationTypes.exportNonEU') }
  ];

  const money = (value) => formatMoney(value, locale, invoice.currency || 'EUR');

  const showError = (message, title) => setError({ title, message });

  useEffect(() => {
    if (invoiceId) {
      fetchInvoice();
    }
    fetchCustomers();
    // Fetch settings to get business information
    dispatch(fetchSettings());
  }, [invoiceId, dispatch]);

  // Handle initialData (duplicate mode)
  useEffect(() => {
    if (initialData && !invoiceId) {
      setInvoice(prev => ({
        ...prev,
        ...initialData,
        // Ensure new dates for duplicate
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }));
    }
  }, [initialData, invoiceId]);

  // Tell the parent dialog when something is in flight so it can't be closed mid-request
  useEffect(() => {
    onBusyChange?.(saving || statusBusy);
  }, [saving, statusBusy]);
  useEffect(() => () => onBusyChange?.(false), []);

  // Bring a new error into view (the dialog body scrolls)
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [error]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const response = await invoiceAPI.getInvoice(invoiceId);
      if (response.data.success) {
        const invoiceData = response.data.invoice;
        // Convert ISO dates to yyyy-MM-dd format for date inputs
        if (invoiceData.issueDate) {
          invoiceData.issueDate = invoiceData.issueDate.split('T')[0];
        }
        if (invoiceData.dueDate) {
          invoiceData.dueDate = invoiceData.dueDate.split('T')[0];
        }
        // Ensure hideBankDetails has a default value to avoid controlled/uncontrolled warning
        if (invoiceData.hideBankDetails === undefined) {
          invoiceData.hideBankDetails = false;
        }
        setInvoice(invoiceData);
      }
    } catch (err) {
      showError(apiErrorText(err, t('errors.generic')), t('editor.errors.fetchInvoice'));
      console.error('Fetch invoice error:', err);
    } finally {
      setLoading(false);
    }
  };

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

  // Service search functions
  const fetchRecentServices = async () => {
    try {
      const response = await serviceAPI.getRecentServices();
      if (response.data.success) {
        setServices(response.data.services);
      }
    } catch (error) {
      console.error('Fetch recent services error:', error);
    }
  };

  const searchServices = async (query) => {
    if (!query || query.length < 2) {
      fetchRecentServices();
      return;
    }
    try {
      const response = await serviceAPI.searchServices({ q: query });
      if (response.data.success) {
        setServices(response.data.services);
      }
    } catch (error) {
      console.error('Service search error:', error);
    }
  };

  const selectService = (service, lineIndex) => {
    const newDetails = [...invoice.invoiceDetails];
    const quantity = newDetails[lineIndex].quantity || 1;
    const netValue = quantity * service.basePrice;
    const vatRate = vatRates[service.vatCategory] || 0;
    const vatAmount = netValue * vatRate;

    newDetails[lineIndex] = {
      ...newDetails[lineIndex],
      description: service.name,
      itemDescription: service.description || '',
      unitPrice: service.basePrice,
      unit: service.unit,
      vatCategory: service.vatCategory,
      netValue,
      vatAmount,
      incomeClassification: [{
        classificationType: service.incomeClassification?.classificationType || 'E3_561_001',
        categoryId: service.incomeClassification?.categoryId || 'category1_3',
        amount: netValue
      }]
    };

    setInvoice(prev => ({ ...prev, invoiceDetails: newDetails }));
    setShowServiceSearch({ index: null, show: false });

    // Track usage (fire and forget)
    serviceAPI.trackUsage(service._id).catch(() => {});
  };

  const handleCreateService = async () => {
    if (inFlight.current.service) return;
    inFlight.current.service = true;
    setServiceBusy(true);
    try {
      setServiceError('');
      const response = await serviceAPI.createService(newService);
      if (response.data.success) {
        // If a line was active, apply the new service
        if (showServiceSearch.index !== null) {
          selectService(response.data.service, showServiceSearch.index);
        }
        setShowCreateService(false);
        setNewService({ name: '', description: '', basePrice: 0, unit: 'hrs', vatCategory: '1' });
      }
    } catch (error) {
      setServiceError(apiErrorText(error, t('editor.errors.createService')));
    } finally {
      inFlight.current.service = false;
      setServiceBusy(false);
    }
  };

  // Update issuer data when settings change
  useEffect(() => {
    if (settings) {
      setInvoice(prev => ({
        ...prev,
        issuer: {
          vatNumber: settings.tax?.afm || '',
          country: 'GR',
          branch: 0,
          name: settings.business?.legalName || settings.business?.tradingName || '',
          legalForm: settings.business?.legalForm || '',
          address: {
            street: settings.address?.street || '',
            number: settings.address?.number || '',
            postalCode: settings.address?.postalCode || '',
            city: settings.address?.city || '',
            prefecture: settings.address?.prefecture || '',
            country: 'GR'
          },
          taxInfo: {
            afm: settings.tax?.afm || '',
            doy: {
              code: settings.tax?.doy?.code || '',
              name: settings.tax?.doy?.name || ''
            },
            gemi: settings.tax?.gemi || ''
          }
        }
      }));
    }
  }, [settings]);

  const searchCustomers = async (query) => {
    if (!query) {
      fetchCustomers();
      return;
    }
    try {
      const response = await customerAPI.searchCustomers({ q: query });
      if (response.data.success) {
        setCustomers(response.data.customers);
      }
    } catch (error) {
      console.error('Failed to search customers:', error);
    }
  };

  const selectCustomer = (customer) => {
    setInvoice(prev => ({
      ...prev,
      customerId: customer._id,
      counterpart: {
        name: customer.displayName || customer.name,
        vatNumber: customer.taxInfo?.afm || '',
        country: 'GR',
        branch: 0,
        address: {
          street: customer.address?.street || '',
          number: customer.address?.number || '',
          postalCode: customer.address?.postalCode || '',
          city: customer.address?.city || '',
          prefecture: customer.address?.prefecture || '',
          country: customer.address?.country || 'GR'
        },
        taxInfo: {
          afm: customer.taxInfo?.afm || '',
          doy: customer.taxInfo?.doy || { code: '', name: '' }
        }
      }
    }));
    setShowCustomerSearch(false);
    setSearchQuery('');
    setActiveCustomer(-1);
  };

  const createCustomer = async () => {
    if (inFlight.current.customer) return;
    inFlight.current.customer = true;
    setCustomerBusy(true);
    try {
      setCustomerError('');
      const response = await customerAPI.createCustomer(newCustomer);
      if (response.data.success) {
        setCustomers(prev => [...prev, response.data.customer]);
        selectCustomer(response.data.customer);
        setShowCreateCustomer(false);
        setNewCustomer(emptyNewCustomer());
      }
    } catch (error) {
      setCustomerError(apiErrorText(error, t('editor.errors.createCustomer')));
    } finally {
      inFlight.current.customer = false;
      setCustomerBusy(false);
    }
  };

  const updateCustomer = async () => {
    if (inFlight.current.customer) return;
    inFlight.current.customer = true;
    setCustomerBusy(true);
    try {
      setCustomerError('');
      const response = await customerAPI.updateCustomer(editingCustomer._id, editingCustomer);
      if (response.data.success) {
        setCustomers(prev => prev.map(c => c._id === editingCustomer._id ? response.data.customer : c));
        selectCustomer(response.data.customer);
        setShowEditCustomer(false);
        setEditingCustomer(null);
      }
    } catch (error) {
      setCustomerError(apiErrorText(error, t('editor.errors.updateCustomer')));
    } finally {
      inFlight.current.customer = false;
      setCustomerBusy(false);
    }
  };

  const addInvoiceLine = () => {
    const newLine = {
      lineNumber: invoice.invoiceDetails.length + 1,
      description: '',
      itemDescription: '',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 0,
      netValue: 0,
      vatCategory: '1',
      vatAmount: 0,
      incomeClassification: [{
        classificationType: 'E3_561_001', // B2B professional services
        categoryId: 'category1_3', // Income from provision of services
        amount: 0
      }]
    };
    setInvoice(prev => ({
      ...prev,
      invoiceDetails: [...prev.invoiceDetails, newLine]
    }));
  };

  const removeInvoiceLine = (index) => {
    if (invoice.invoiceDetails.length === 1) return; // Keep at least one line

    const newDetails = invoice.invoiceDetails.filter((_, i) => i !== index);
    // Update line numbers
    newDetails.forEach((line, i) => {
      line.lineNumber = i + 1;
    });

    setInvoice(prev => ({ ...prev, invoiceDetails: newDetails }));
  };

  const calculateTotals = () => {
    const totals = invoice.invoiceDetails.reduce((acc, line) => {
      acc.netValue += line.netValue || 0;
      acc.vatAmount += line.vatAmount || 0;
      return acc;
    }, { netValue: 0, vatAmount: 0 });

    totals.totalAmount = totals.netValue + totals.vatAmount;
    return totals;
  };

  const handleSave = async (status = 'draft') => {
    if (inFlight.current.save) return;
    inFlight.current.save = true;
    try {
      setSaving(true);
      setSavingAs(status);
      setError(null);

      const invoiceData = {
        ...invoice,
        status,
        totals: {
          totalNetValue: calculateTotals().netValue,
          totalVatAmount: calculateTotals().vatAmount,
          totalWithheldAmount: 0,
          totalFeesAmount: 0,
          totalOtherTaxesAmount: 0,
          totalDeductionsAmount: 0,
          totalGrossValue: calculateTotals().netValue + calculateTotals().vatAmount,
          totalAmount: calculateTotals().totalAmount
        }
      };

      let response;
      if (invoiceId) {
        response = await invoiceAPI.updateInvoice(invoiceId, invoiceData);
      } else {
        response = await invoiceAPI.createInvoice(invoiceData);
      }

      if (response.data.success) {
        toast.success(status === 'sent' ? t('editor.toastSent') : t('editor.toastSaved'));
        if (onSave) onSave(response.data.invoice);
      } else {
        showError(response.data.message || t('errors.generic'), t('editor.errors.saveInvoice'));
      }
    } catch (err) {
      const errorData = err.response?.data;

      // AADE validation errors come back as a list
      if (errorData?.errors && Array.isArray(errorData.errors)) {
        const aadeErrors = errorData.errors
          .map(e => (typeof e === 'string' ? e : `[${e.code}] ${e.message}`))
          .join('\n');

        showError(`${aadeErrors}\n\n${t('editor.aadeValidationHint')}`, t('editor.aadeValidationTitle'));
      } else {
        showError(apiErrorText(err, t('errors.generic')), t('editor.errors.saveInvoice'));
      }

      console.error('Save invoice error:', err);
    } finally {
      inFlight.current.save = false;
      setSaving(false);
      setSavingAs(null);
    }
  };

  const handleMarkAsPaid = async () => {
    if (inFlight.current.status) return;
    inFlight.current.status = true;
    setStatusBusy(true);
    try {
      setStatusError('');
      const response = await invoiceAPI.markInvoicePaid(invoiceId, paymentDetails);
      if (response.data.success) {
        setInvoice(response.data.invoice);
        setShowStatusModal(false);
        toast.success(t('editor.toastPaid'));
        if (onSave) onSave(response.data.invoice);
      }
    } catch (err) {
      setStatusError(apiErrorText(err, t('editor.errors.markPaid')));
    } finally {
      inFlight.current.status = false;
      setStatusBusy(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (inFlight.current.status) return;
    inFlight.current.status = true;
    setStatusBusy(true);
    try {
      setStatusError('');

      // Check if invoice is transmitted to AADE
      const isTransmitted = invoice.aadeStatus === 'transmitted';

      let response;
      if (isTransmitted) {
        // Call AADE cancellation endpoint
        response = await invoiceAPI.cancelAADEInvoice(invoiceId);

        if (response.data.success) {
          setShowStatusModal(false);
          toast.success(t('editor.toastCancelled'));
          if (onSave) onSave(response.data.invoice); // Update invoice in parent
          if (onClose) onClose();
        }
      } else {
        // Regular local cancellation for non-transmitted invoices
        response = await invoiceAPI.deleteInvoice(invoiceId);

        if (response.data.success) {
          setShowStatusModal(false);
          toast.success(t('editor.toastCancelled'));
          if (onClose) onClose();
        }
      }
    } catch (err) {
      const errors = err.response?.data?.errors;

      if (errors && errors.length > 0) {
        const formattedErrors = errors.map(e => (typeof e === 'string' ? e : `[${e.code}] ${e.message}`)).join('\n');
        setStatusError(`${t('editor.aadeCancelFailed')}\n\n${formattedErrors}`);
      } else {
        setStatusError(apiErrorText(err, t('editor.errors.cancel')));
      }
    } finally {
      inFlight.current.status = false;
      setStatusBusy(false);
    }
  };

  const handlePreview = async () => {
    if (inFlight.current.preview) return;
    inFlight.current.preview = true;
    setPreviewing(true);
    try {
      setError(null);

      const totals = calculateTotals();

      // Fetch next invoice number if not already set (for new invoices)
      let previewInvoiceNumber = invoice.invoiceNumber;
      if (!previewInvoiceNumber && !invoiceId) {
        try {
          const nextNumResponse = await invoiceAPI.getNextInvoiceNumber({ series: invoice.series || 'A' });
          if (nextNumResponse.data.success) {
            previewInvoiceNumber = nextNumResponse.data.nextNumber;
          }
        } catch (e) {
          previewInvoiceNumber = 'DRAFT';
        }
      }

      const invoiceData = {
        ...invoice,
        invoiceNumber: previewInvoiceNumber || invoice.invoiceNumber || 'DRAFT',
        totals: {
          totalNetValue: totals.netValue,
          totalVatAmount: totals.vatAmount,
          totalWithheldAmount: 0,
          totalFeesAmount: 0,
          totalOtherTaxesAmount: 0,
          totalDeductionsAmount: 0,
          totalGrossValue: totals.netValue + totals.vatAmount,
          totalAmount: totals.totalAmount
        }
      };

      const response = await invoiceAPI.previewInvoice(invoiceData, 'light', locale);

      if (!response || !response.data) {
        throw new Error(t('editor.errors.previewEmpty'));
      }

      if (response.status && response.status !== 200) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const pdfBlob = response.data;

      if (pdfBlob.size === 0) {
        throw new Error(t('editor.errors.previewEmpty'));
      }

      const pdfUrl = window.URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');

      setTimeout(() => {
        window.URL.revokeObjectURL(pdfUrl);
      }, 1000);
    } catch (err) {
      console.error('Preview invoice error:', err);
      const message = await readApiError(err, t('editor.errors.preview'));
      showError(message, t('editor.errors.preview'));
    } finally {
      inFlight.current.preview = false;
      setPreviewing(false);
    }
  };

  const totals = calculateTotals();

  if (loading || settingsLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label={t('common.loading')}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton h-5 w-56" />
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-4 w-48" />
          </div>
          <div className="space-y-2">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton h-10 w-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-10" />)}
        </div>
        <div className="skeleton h-40 w-full" />
      </div>
    );
  }

  const isBusy = saving || statusBusy;
  const aadeMark = invoice.aadeInfo?.mark;
  const aadeUid = invoice.aadeInfo?.uid;
  const showCombo = showCustomerSearch && (customers.length > 0 || searchQuery.length > 0);

  const onCustomerKeyDown = (e) => {
    if (!showCombo) {
      if (e.key === 'ArrowDown') setShowCustomerSearch(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveCustomer(i => Math.min(customers.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveCustomer(i => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      if (activeCustomer >= 0 && customers[activeCustomer]) {
        e.preventDefault();
        selectCustomer(customers[activeCustomer]);
      }
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setShowCustomerSearch(false);
    }
  };

  // Shared fields for the create / edit customer dialogs
  const renderCustomerFields = (value, setValue, prefix) => (
    <div className="space-y-4">
      {customerError && <Alert tone="danger">{customerError}</Alert>}
      <div>
        <label htmlFor={`${prefix}-name`} className="label">
          {t('customer.name')}<span className="ml-0.5 text-danger" aria-hidden="true">*</span>
        </label>
        <input
          id={`${prefix}-name`}
          type="text"
          required
          data-autofocus
          value={value.name || ''}
          onChange={(e) => setValue(prev => ({ ...prev, name: e.target.value }))}
          placeholder={t('editor.customerNamePlaceholder')}
          className="input"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${prefix}-email`} className="label">{t('email')}</label>
          <input
            id={`${prefix}-email`}
            type="email"
            value={value.email || ''}
            onChange={(e) => setValue(prev => ({ ...prev, email: e.target.value }))}
            placeholder="customer@example.com"
            className="input"
          />
        </div>
        <div>
          <label htmlFor={`${prefix}-afm`} className="label">
            {t('customer.afm')}<span className="ml-1.5 font-normal text-muted">{t('common.optional')}</span>
          </label>
          <input
            id={`${prefix}-afm`}
            type="text"
            inputMode="numeric"
            value={value.taxInfo?.afm || ''}
            onChange={(e) => setValue(prev => ({ ...prev, taxInfo: { ...prev.taxInfo, afm: e.target.value } }))}
            placeholder="123456789"
            maxLength={9}
            className="input num"
          />
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-4">
        <div>
          <label htmlFor={`${prefix}-street`} className="label">{t('street')}</label>
          <input
            id={`${prefix}-street`}
            type="text"
            value={value.address?.street || ''}
            onChange={(e) => setValue(prev => ({ ...prev, address: { ...prev.address, street: e.target.value } }))}
            placeholder={t('placeholders.streetName')}
            className="input"
          />
        </div>
        <div>
          <label htmlFor={`${prefix}-number`} className="label">{t('number')}</label>
          <input
            id={`${prefix}-number`}
            type="text"
            value={value.address?.number || ''}
            onChange={(e) => setValue(prev => ({ ...prev, address: { ...prev.address, number: e.target.value } }))}
            placeholder="12"
            className="input"
          />
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-4">
        <div>
          <label htmlFor={`${prefix}-city`} className="label">{t('city')}</label>
          <input
            id={`${prefix}-city`}
            type="text"
            value={value.address?.city || ''}
            onChange={(e) => setValue(prev => ({ ...prev, address: { ...prev.address, city: e.target.value } }))}
            placeholder={t('editor.cityPlaceholder')}
            className="input"
          />
        </div>
        <div>
          <label htmlFor={`${prefix}-postal`} className="label">{t('postalCode')}</label>
          <input
            id={`${prefix}-postal`}
            type="text"
            inputMode="numeric"
            value={value.address?.postalCode || ''}
            onChange={(e) => setValue(prev => ({ ...prev, address: { ...prev.address, postalCode: e.target.value } }))}
            placeholder="10431"
            className="input num"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${prefix}-prefecture`} className="label">{t('prefecture')}</label>
          <input
            id={`${prefix}-prefecture`}
            type="text"
            value={value.address?.prefecture || ''}
            onChange={(e) => setValue(prev => ({ ...prev, address: { ...prev.address, prefecture: e.target.value } }))}
            placeholder={t('editor.prefecturePlaceholder')}
            className="input"
          />
        </div>
        <div>
          <label htmlFor={`${prefix}-phone`} className="label">{t('phone')}</label>
          <input
            id={`${prefix}-phone`}
            type="tel"
            value={value.phone || ''}
            onChange={(e) => setValue(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="+30 210 1234567"
            className="input"
          />
        </div>
      </div>
    </div>
  );

  const issuerName = settings?.business?.legalName || settings?.business?.tradingName;
  const issuerStreet = [settings?.address?.street, settings?.address?.number].filter(Boolean).join(' ');
  const issuerCity = [settings?.address?.postalCode, settings?.address?.city].filter(Boolean).join(' ');
  const cp = invoice.counterpart || emptyCounterpart();
  const cpStreet = [cp.address?.street, cp.address?.number].filter(Boolean).join(' ');
  const cpCity = [cp.address?.postalCode, cp.address?.city].filter(Boolean).join(' ');

  return (
    <div>
      {error && (
        <div ref={errorRef} className="mb-5 scroll-mt-4">
          <Alert
            tone="danger"
            title={error.title}
            onDismiss={() => setError(null)}
            dismissLabel={t('common.dismiss')}
          >
            {error.message}
          </Alert>
        </div>
      )}

      {/* Status bar for existing invoices */}
      {invoiceId && invoice.status && (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-line bg-sunken/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {invoice.invoiceNumber && (
              <span className="num font-semibold text-ink">
                {invoice.series && !String(invoice.invoiceNumber).startsWith(invoice.series) ? `${invoice.series}-` : ''}
                {invoice.invoiceNumber}
              </span>
            )}
            <span className="flex items-center gap-2">
              <span className="text-muted">{t('editor.status')}</span>
              <StatusBadge status={invoice.status} />
            </span>
            {invoice.aadeStatus && (
              <span className="flex items-center gap-2">
                <span className="text-muted">{t('editor.aade')}</span>
                <StatusBadge kind="aade" status={invoice.aadeStatus} />
              </span>
            )}
            {invoice.aadeStatus === 'transmitted' && aadeMark && (
              <span className="flex items-center gap-1.5 text-muted">
                {t('editor.mark')}
                <span className="num select-all font-medium text-ink-2">{aadeMark}</span>
              </span>
            )}
            {invoice.aadeStatus === 'transmitted' && aadeUid && (
              <span className="flex min-w-0 items-center gap-1.5 text-muted">
                {t('editor.uid')}
                <span className="num max-w-[14rem] select-all truncate font-medium text-ink-2" title={aadeUid}>{aadeUid}</span>
              </span>
            )}
          </div>
          {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
            <div className="flex flex-wrap gap-2">
              {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                <Button
                  variant="success"
                  size="sm"
                  icon="check"
                  disabled={isBusy}
                  onClick={() => {
                    setStatusAction('markPaid');
                    setStatusError('');
                    setPaymentDetails(prev => ({ ...prev, amount: calculateTotals().totalAmount }));
                    setShowStatusModal(true);
                  }}
                >
                  {t('editor.markAsPaid')}
                </Button>
              )}
              <Button
                variant="danger-ghost"
                size="sm"
                icon="ban"
                disabled={isBusy}
                onClick={() => {
                  setStatusAction('cancel');
                  setStatusError('');
                  setShowStatusModal(true);
                }}
              >
                {t('editor.cancelInvoice')}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-8">
        {/* 1. From / To */}
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
          <section aria-labelledby="inv-from">
            <h3 id="inv-from" className="mb-2 text-xs font-medium text-muted">{t('invoice.from')}</h3>
            <div className="space-y-0.5 text-sm text-ink-2">
              <p className="text-[0.9375rem] font-semibold text-ink">{issuerName || t('business')}</p>
              <p>
                <span className="text-muted">{t('editor.afmShort')}</span>{' '}
                <span className="num">{settings?.tax?.afm || t('common.notSet')}</span>
                {settings?.tax?.doy?.name && <span className="text-muted"> · {settings.tax.doy.name}</span>}
              </p>
              {issuerStreet && <p>{issuerStreet}</p>}
              {issuerCity && <p>{issuerCity}</p>}
            </div>
            {!settings?.business?.legalName && (
              <p className="badge badge-warning mt-3">
                <Icon name="alert" size={13} />
                {t('invoice.updateBusinessInfo')}
              </p>
            )}
          </section>

          <section aria-labelledby="inv-to">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 id="inv-to" className="text-xs font-medium text-muted">{t('invoice.to')}</h3>
              {!invoice.customerId && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon="plus"
                  className="-my-1"
                  onClick={() => {
                    setCustomerError('');
                    setShowCreateCustomer(true);
                  }}
                >
                  {t('editor.newCustomer')}
                </Button>
              )}
            </div>

            {!invoice.customerId ? (
              <div className="relative">
                <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  role="combobox"
                  aria-expanded={showCombo}
                  aria-controls={`${comboId}-list`}
                  aria-autocomplete="list"
                  aria-activedescendant={activeCustomer >= 0 ? `${comboId}-opt-${activeCustomer}` : undefined}
                  aria-label={t('invoice.searchCustomer')}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchCustomers(e.target.value);
                    setShowCustomerSearch(true);
                    setActiveCustomer(-1);
                  }}
                  onFocus={() => setShowCustomerSearch(true)}
                  onBlur={() => setTimeout(() => setShowCustomerSearch(false), 150)}
                  onKeyDown={onCustomerKeyDown}
                  placeholder={t('invoice.searchCustomer')}
                  className="input pl-9"
                />

                {showCombo && (
                  <div className="popover absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto p-1">
                    {customers.length > 0 ? (
                      <ul id={`${comboId}-list`} role="listbox" aria-label={t('customers')}>
                        {customers.map((customer, i) => (
                          <li
                            key={customer._id}
                            id={`${comboId}-opt-${i}`}
                            role="option"
                            aria-selected={i === activeCustomer}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectCustomer(customer);
                            }}
                            onMouseEnter={() => setActiveCustomer(i)}
                            className={`cursor-pointer rounded px-2.5 py-2 transition-colors ${
                              i === activeCustomer ? 'bg-sunken' : ''
                            }`}
                          >
                            <div className="truncate text-sm font-medium text-ink">{customer.displayName || customer.name}</div>
                            {customer.taxInfo?.afm && (
                              <div className="num text-xs text-muted">{t('editor.afmShort')} {customer.taxInfo.afm}</div>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div id={`${comboId}-list`} className="px-3 py-3 text-center">
                        <p className="text-sm text-muted">{t('editor.noCustomersFound')}</p>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setNewCustomer(prev => ({ ...prev, name: searchQuery }));
                            setCustomerError('');
                            setShowCreateCustomer(true);
                            setShowCustomerSearch(false);
                          }}
                          className="mt-1.5 text-sm font-medium text-accent hover:underline"
                        >
                          {t('editor.createCustomerNamed', { name: searchQuery })}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3 rounded-lg border border-line px-3.5 py-3">
                <div className="min-w-0 space-y-0.5 text-sm text-ink-2">
                  <p className="text-[0.9375rem] font-semibold text-ink">{cp.name}</p>
                  {cp.taxInfo?.afm && (
                    <p>
                      <span className="text-muted">{t('editor.afmShort')}</span> <span className="num">{cp.taxInfo.afm}</span>
                    </p>
                  )}
                  {cpStreet && <p>{cpStreet}</p>}
                  {cpCity && <p>{cpCity}</p>}
                </div>
                <div className="-mr-1 -mt-1 flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon="pencil"
                    title={t('editor.editCustomer')}
                    aria-label={t('editor.editCustomer')}
                    onClick={() => {
                      const customer = customers.find(c => c._id === invoice.customerId);
                      if (customer) {
                        setCustomerError('');
                        setEditingCustomer(customer);
                        setShowEditCustomer(true);
                      }
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setInvoice(prev => ({ ...prev, customerId: '', counterpart: emptyCounterpart() }));
                    }}
                  >
                    {t('invoice.change')}
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* 2. Invoice meta */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="inv-type" className="label">{t('invoice.type')}</label>
            <select
              id="inv-type"
              value={invoice.invoiceType}
              onChange={(e) => setInvoice(prev => ({ ...prev, invoiceType: e.target.value }))}
              className="input"
            >
              {invoiceTypes.map(type => (
                <option key={type.value} value={type.value}>{type.value} · {type.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="inv-issue" className="label">{t('invoice.issueDate')}</label>
            <input
              id="inv-issue"
              type="date"
              value={invoice.issueDate}
              onChange={(e) => setInvoice(prev => ({ ...prev, issueDate: e.target.value }))}
              className="input num"
            />
          </div>
          <div>
            <label htmlFor="inv-due" className="label">{t('invoice.dueDate')}</label>
            <input
              id="inv-due"
              type="date"
              value={invoice.dueDate}
              onChange={(e) => setInvoice(prev => ({ ...prev, dueDate: e.target.value }))}
              className="input num"
            />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="inv-currency" className="label">{t('invoice.currency')}</label>
            <select
              id="inv-currency"
              value={invoice.currency}
              onChange={(e) => setInvoice(prev => ({ ...prev, currency: e.target.value }))}
              className="input"
            >
              <option value="EUR">EUR · €</option>
              <option value="USD">USD · $</option>
              <option value="GBP">GBP · £</option>
            </select>
          </div>
        </div>

        {/* 3. Line items */}
        <section aria-labelledby="inv-items">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 id="inv-items" className="section-title">{t('invoice.items')}</h3>
            <Button variant="secondary" size="sm" icon="plus" onClick={addInvoiceLine}>
              {t('invoice.addItem')}
            </Button>
          </div>

          <div className="lg:overflow-visible lg:rounded-lg lg:border lg:border-line lg:bg-surface">
            {/* Desktop header */}
            <div
              className={`hidden gap-3 rounded-t-lg border-b border-line bg-sunken/60 px-4 py-2.5 text-xs font-medium text-muted lg:grid ${LINE_GRID}`}
              aria-hidden="true"
            >
              <div>{t('invoice.description')}</div>
              <div className="text-right">{t('invoice.qty')}</div>
              <div>{t('invoice.unit')}</div>
              <div className="text-right">{t('invoice.price')}</div>
              <div>{t('invoice.vat')}</div>
              <div className="text-right">{t('invoice.total')}</div>
              <div />
            </div>

            <div className="space-y-3 lg:space-y-0">
              {invoice.invoiceDetails.map((line, index) => {
                const n = index + 1;
                const lineTotal = (line.netValue || 0) + (line.vatAmount || 0);
                return (
                  <div
                    key={index}
                    className="rounded-lg border border-line bg-surface p-3 lg:rounded-none lg:border-0 lg:border-b lg:bg-transparent lg:px-4 lg:py-3 lg:last:border-b-0"
                  >
                    <div className="mb-2 flex items-center justify-between lg:hidden">
                      <span className="text-xs font-medium text-muted">{t('editor.lineItem', { n })}</span>
                    </div>
                    <div className={`flex flex-col lg:grid lg:items-start lg:gap-x-3 lg:gap-y-2 ${LINE_GRID}`}>
                      {/* Description with service search */}
                      <div className="relative">
                        <label htmlFor={`line-${index}-desc`} className="label lg:sr-only">{t('invoice.description')}</label>
                        <input
                          id={`line-${index}-desc`}
                          type="text"
                          autoComplete="off"
                          value={line.description}
                          onChange={(e) => {
                            const newDetails = [...invoice.invoiceDetails];
                            newDetails[index].description = e.target.value;
                            setInvoice(prev => ({ ...prev, invoiceDetails: newDetails }));
                            searchServices(e.target.value);
                            setShowServiceSearch({ index, show: true });
                          }}
                          onFocus={() => {
                            fetchRecentServices();
                            setShowServiceSearch({ index, show: true });
                          }}
                          onBlur={() => {
                            setTimeout(() => setShowServiceSearch({ index: null, show: false }), 200);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape' && showServiceSearch.show) {
                              e.stopPropagation();
                              setShowServiceSearch({ index: null, show: false });
                            }
                          }}
                          placeholder={t('editor.servicePlaceholder')}
                          className="input"
                        />

                        {showServiceSearch.show && showServiceSearch.index === index && (
                          <div className="popover absolute left-0 top-full z-30 mt-1 max-h-64 w-full min-w-[16rem] max-w-[calc(100vw-3rem)] overflow-y-auto p-1 lg:w-[22rem]">
                            {services.length > 0 ? (
                              services.map(service => (
                                <div
                                  key={service._id}
                                  role="option"
                                  aria-selected="false"
                                  onMouseDown={() => selectService(service, index)}
                                  className="cursor-pointer rounded px-2.5 py-2 transition-colors hover:bg-sunken"
                                >
                                  <div className="flex items-baseline justify-between gap-3">
                                    <span className="truncate text-sm font-medium text-ink">{service.name}</span>
                                    <span className="num shrink-0 text-xs text-muted">
                                      {formatMoney(service.basePrice, locale)}/{service.unit}
                                    </span>
                                  </div>
                                  {service.description && (
                                    <div className="mt-0.5 truncate text-xs text-muted">{service.description}</div>
                                  )}
                                </div>
                              ))
                            ) : line.description?.length >= 2 ? (
                              <div className="px-3 py-3 text-center">
                                <p className="text-sm text-muted">{t('editor.noServicesFound')}</p>
                                <button
                                  type="button"
                                  onMouseDown={() => {
                                    setNewService(prev => ({ ...prev, name: line.description }));
                                    setServiceError('');
                                    setShowCreateService(true);
                                  }}
                                  className="mt-1.5 text-sm font-medium text-accent hover:underline"
                                >
                                  {t('editor.createServiceNamed', { name: line.description })}
                                </button>
                              </div>
                            ) : (
                              <div className="px-3 py-3 text-center text-sm text-muted">
                                {t('editor.typeToSearchServices')}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Qty / unit / price / VAT */}
                      <div className="order-2 mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:contents">
                        <div>
                          <label htmlFor={`line-${index}-qty`} className="label lg:sr-only">{t('invoice.qty')}</label>
                          <input
                            id={`line-${index}-qty`}
                            type="number"
                            inputMode="decimal"
                            value={line.quantity}
                            onChange={(e) => {
                              const newDetails = [...invoice.invoiceDetails];
                              const quantity = parseFloat(e.target.value) || 0;
                              newDetails[index].quantity = quantity;
                              newDetails[index].netValue = quantity * newDetails[index].unitPrice;
                              newDetails[index].vatAmount = newDetails[index].netValue * vatRates[newDetails[index].vatCategory];
                              setInvoice(prev => ({ ...prev, invoiceDetails: newDetails }));
                            }}
                            className="input text-right"
                          />
                        </div>
                        <div>
                          <label htmlFor={`line-${index}-unit`} className="label lg:sr-only">{t('invoice.unit')}</label>
                          <select
                            id={`line-${index}-unit`}
                            value={line.unit || 'pcs'}
                            onChange={(e) => {
                              const newDetails = [...invoice.invoiceDetails];
                              newDetails[index].unit = e.target.value;
                              setInvoice(prev => ({ ...prev, invoiceDetails: newDetails }));
                            }}
                            className="input"
                          >
                            {unitTypes.map(u => (
                              <option key={u.value} value={u.value}>{u.short}</option>
                            ))}
                            {line.unit && !unitTypes.some(u => u.value === line.unit) && (
                              <option value={line.unit}>{line.unit}</option>
                            )}
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`line-${index}-price`} className="label lg:sr-only">{t('invoice.price')}</label>
                          <input
                            id={`line-${index}-price`}
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={line.unitPrice}
                            onChange={(e) => {
                              const newDetails = [...invoice.invoiceDetails];
                              const price = parseFloat(e.target.value) || 0;
                              newDetails[index].unitPrice = price;
                              newDetails[index].netValue = newDetails[index].quantity * price;
                              newDetails[index].vatAmount = newDetails[index].netValue * vatRates[newDetails[index].vatCategory];
                              setInvoice(prev => ({ ...prev, invoiceDetails: newDetails }));
                            }}
                            className="input text-right"
                          />
                        </div>
                        <div>
                          <label htmlFor={`line-${index}-vat`} className="label lg:sr-only">{t('invoice.vat')}</label>
                          <select
                            id={`line-${index}-vat`}
                            value={line.vatCategory}
                            onChange={(e) => {
                              const newDetails = [...invoice.invoiceDetails];
                              const value = e.target.value;
                              newDetails[index].vatCategory = value;
                              newDetails[index].vatAmount = newDetails[index].netValue * vatRates[value];
                              setInvoice(prev => ({ ...prev, invoiceDetails: newDetails }));
                            }}
                            className="input"
                          >
                            {vatOptions.map(v => (
                              <option key={v.value} value={v.value}>{v.short}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Total + remove */}
                      <div className="order-3 mt-3 flex items-center justify-between border-t border-line pt-3 lg:contents">
                        <div className="flex items-baseline gap-2 lg:flex lg:h-10 lg:items-center lg:justify-end">
                          <span className="text-sm text-muted lg:hidden">{t('invoice.total')}</span>
                          <span className="num text-[0.9375rem] font-semibold text-ink">{money(lineTotal)}</span>
                        </div>
                        <div className="lg:flex lg:h-10 lg:items-center lg:justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            icon="trash"
                            onClick={() => removeInvoiceLine(index)}
                            disabled={invoice.invoiceDetails.length === 1}
                            className="hover:text-danger"
                            aria-label={t('editor.removeLine', { n })}
                            title={t('editor.removeLine', { n })}
                          />
                        </div>
                      </div>
                      {/* Additional description */}
                      <div className="order-1 mt-2 lg:order-none lg:col-span-5 lg:mt-0">
                        <label htmlFor={`line-${index}-extra`} className="sr-only">{t('invoice.additionalDesc')}</label>
                        <textarea
                          id={`line-${index}-extra`}
                          value={line.itemDescription || ''}
                          onChange={(e) => {
                            const newDetails = [...invoice.invoiceDetails];
                            newDetails[index].itemDescription = e.target.value;
                            setInvoice(prev => ({ ...prev, invoiceDetails: newDetails }));
                          }}
                          placeholder={t('editor.additionalDescPlaceholder')}
                          rows={2}
                          className="input resize-y bg-sunken/50 text-ink-2"
                        />
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals */}
          <dl className="ml-auto mt-4 w-full space-y-2 text-sm sm:w-80 lg:pr-4">
            <div className="flex justify-between gap-4 text-ink-2">
              <dt>{t('invoice.netTotal')}</dt>
              <dd className="num">{money(totals.netValue)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-ink-2">
              <dt>{t('invoice.vatTotal')}</dt>
              <dd className="num">{money(totals.vatAmount)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-line pt-2.5 text-ink">
              <dt className="font-semibold">{t('invoice.totalAmount')}</dt>
              <dd className="num text-lg font-semibold tracking-[-0.01em]">{money(totals.totalAmount)}</dd>
            </div>
          </dl>
        </section>

        {/* 4. VAT regulation */}
        <fieldset>
          <legend className="label">{t('invoice.vatRegulation')}</legend>
          <div className="flex flex-wrap gap-2">
            {vatRegulations.map(reg => (
              <button
                key={reg.value}
                type="button"
                aria-pressed={invoice.vatRegulation === reg.value}
                onClick={() => setInvoice(prev => ({ ...prev, vatRegulation: reg.value }))}
                className="chip h-auto min-h-8 py-1 text-left"
              >
                {invoice.vatRegulation === reg.value && <Icon name="check" size={14} />}
                {reg.label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* 5. Notes + footer */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <label htmlFor="inv-notes" className="label">{t('invoice.notes')}</label>
            <textarea
              id="inv-notes"
              value={invoice.notes}
              onChange={(e) => setInvoice(prev => ({ ...prev, notes: e.target.value }))}
              rows={5}
              placeholder={t('invoice.notesPlaceholder')}
              className="input resize-y"
            />
          </div>
          <div>
            <label htmlFor="inv-footer" className="label">{t('editor.footerText')}</label>
            <textarea
              id="inv-footer"
              value={invoice.footerText}
              onChange={(e) => setInvoice(prev => ({ ...prev, footerText: e.target.value }))}
              rows={5}
              aria-describedby="inv-footer-hint"
              className="input resize-y"
            />
            <p id="inv-footer-hint" className="hint">{t('editor.footerHint')}</p>
          </div>
        </div>

        {/* Hide bank details */}
        <label htmlFor="hideBankDetails" className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3.5 py-3 transition-colors hover:bg-sunken/50">
          <input
            type="checkbox"
            id="hideBankDetails"
            checked={invoice.hideBankDetails || false}
            onChange={(e) => setInvoice(prev => ({ ...prev, hideBankDetails: e.target.checked }))}
            className="checkbox mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium text-ink">{t('editor.hideBankDetails')}</span>
            <span className="block text-xs text-muted">{t('editor.hideBankDetailsHint')}</span>
          </span>
        </label>
      </div>

      {/* Actions (sticky to the bottom of the dialog body) */}
      <div className="sticky bottom-0 z-20 -mx-4 -mb-4 mt-6 flex flex-wrap justify-end gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:-mb-5 sm:px-6">
        <Button variant="ghost" onClick={() => onClose && onClose()} disabled={isBusy} className="sm:mr-auto">
          {t('invoice.cancel')}
        </Button>
        <Button variant="secondary" icon="eye" loading={previewing} onClick={() => handlePreview()}>
          {t('invoice.preview')}
        </Button>
        <Button
          variant="secondary"
          loading={saving && savingAs === 'draft'}
          disabled={saving}
          onClick={() => handleSave('draft')}
        >
          {saving && savingAs === 'draft' ? t('invoice.saving') : t('invoice.saveDraft')}
        </Button>
        <Button
          variant="primary"
          icon="send"
          loading={saving && savingAs === 'sent'}
          disabled={saving || !invoice.customerId}
          title={!invoice.customerId ? t('editor.chooseCustomerFirst') : undefined}
          onClick={() => handleSave('sent')}
        >
          {saving && savingAs === 'sent' ? t('invoice.saving') : t('invoice.saveAndSend')}
        </Button>
      </div>

      {/* Create customer */}
      <Modal
        open={showCreateCustomer}
        onClose={() => setShowCreateCustomer(false)}
        title={t('customer.createNew')}
        size="md"
        busy={customerBusy}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateCustomer(false)} disabled={customerBusy}>
              {t('customer.cancel')}
            </Button>
            <Button
              variant="primary"
              loading={customerBusy}
              onClick={createCustomer}
              disabled={!newCustomer.name.trim()}
            >
              {t('customer.create')}
            </Button>
          </>
        }
      >
        {renderCustomerFields(newCustomer, setNewCustomer, 'nc')}
      </Modal>

      {/* Edit customer */}
      <Modal
        open={showEditCustomer && !!editingCustomer}
        onClose={() => setShowEditCustomer(false)}
        title={t('editor.editCustomer')}
        size="md"
        busy={customerBusy}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowEditCustomer(false)} disabled={customerBusy}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              loading={customerBusy}
              onClick={updateCustomer}
              disabled={!editingCustomer?.name?.trim()}
            >
              {t('editor.updateCustomer')}
            </Button>
          </>
        }
      >
        {editingCustomer && renderCustomerFields(editingCustomer, setEditingCustomer, 'ec')}
      </Modal>

      {/* Mark as paid / cancel */}
      <Modal
        open={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title={statusAction === 'markPaid' ? t('editor.markPaidTitle') : t('editor.cancelConfirmTitle')}
        size="sm"
        busy={statusBusy}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowStatusModal(false)} disabled={statusBusy}>
              {statusAction === 'markPaid' ? t('common.cancel') : t('editor.keepInvoice')}
            </Button>
            <Button
              variant={statusAction === 'markPaid' ? 'success' : 'danger'}
              loading={statusBusy}
              onClick={statusAction === 'markPaid' ? handleMarkAsPaid : handleCancelInvoice}
            >
              {statusAction === 'markPaid' ? t('editor.confirmPayment') : t('editor.confirmCancellation')}
            </Button>
          </>
        }
      >
        {statusError && <Alert tone="danger" className="mb-4">{statusError}</Alert>}
        {statusAction === 'markPaid' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="pay-amount" className="label">{t('editor.paymentAmount')}</label>
                <input
                  id="pay-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  data-autofocus
                  value={paymentDetails.amount}
                  onChange={(e) => setPaymentDetails(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  className="input text-right"
                />
              </div>
              <div>
                <label htmlFor="pay-date" className="label">{t('editor.paymentDate')}</label>
                <input
                  id="pay-date"
                  type="date"
                  value={paymentDetails.paidDate}
                  onChange={(e) => setPaymentDetails(prev => ({ ...prev, paidDate: e.target.value }))}
                  className="input num"
                />
              </div>
            </div>
            <div>
              <label htmlFor="pay-method" className="label">{t('editor.paymentMethod')}</label>
              <select
                id="pay-method"
                value={paymentDetails.method}
                onChange={(e) => setPaymentDetails(prev => ({ ...prev, method: e.target.value }))}
                className="input"
              >
                {paymentMethods.map(method => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pay-info" className="label">
                {t('invoice.notes')}<span className="ml-1.5 font-normal text-muted">{t('common.optional')}</span>
              </label>
              <textarea
                id="pay-info"
                value={paymentDetails.info}
                onChange={(e) => setPaymentDetails(prev => ({ ...prev, info: e.target.value }))}
                rows={3}
                className="input resize-y"
                placeholder={t('editor.paymentNotesPlaceholder')}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-2">
            {invoice.aadeStatus === 'transmitted' ? t('editor.cancelConfirmTransmitted') : t('editor.cancelConfirmBody')}
          </p>
        )}
      </Modal>

      {/* Create service */}
      <Modal
        open={showCreateService}
        onClose={() => setShowCreateService(false)}
        title={t('editor.newService')}
        size="sm"
        busy={serviceBusy}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateService(false)} disabled={serviceBusy}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              loading={serviceBusy}
              onClick={handleCreateService}
              disabled={!newService.name.trim()}
            >
              {t('editor.createService')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {serviceError && <Alert tone="danger">{serviceError}</Alert>}
          <div>
            <label htmlFor="svc-name" className="label">
              {t('editor.serviceName')}<span className="ml-0.5 text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="svc-name"
              type="text"
              required
              data-autofocus
              value={newService.name}
              onChange={(e) => setNewService(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('editor.serviceNamePlaceholder')}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="svc-desc" className="label">
              {t('invoice.description')}<span className="ml-1.5 font-normal text-muted">{t('common.optional')}</span>
            </label>
            <textarea
              id="svc-desc"
              value={newService.description}
              onChange={(e) => setNewService(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t('editor.serviceDescriptionPlaceholder')}
              rows={2}
              className="input resize-y"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="svc-price" className="label">
                {t('editor.basePrice')}<span className="ml-0.5 text-danger" aria-hidden="true">*</span>
              </label>
              <input
                id="svc-price"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={newService.basePrice}
                onChange={(e) => setNewService(prev => ({ ...prev, basePrice: parseFloat(e.target.value) || 0 }))}
                className="input text-right"
              />
            </div>
            <div>
              <label htmlFor="svc-unit" className="label">{t('invoice.unit')}</label>
              <select
                id="svc-unit"
                value={newService.unit}
                onChange={(e) => setNewService(prev => ({ ...prev, unit: e.target.value }))}
                className="input"
              >
                {unitTypes.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="svc-vat" className="label">{t('editor.vatRate')}</label>
            <select
              id="svc-vat"
              value={newService.vatCategory}
              onChange={(e) => setNewService(prev => ({ ...prev, vatCategory: e.target.value }))}
              className="input"
            >
              {vatOptions.map(v => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default InvoiceEdit;
