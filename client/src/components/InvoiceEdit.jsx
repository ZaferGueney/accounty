import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { invoiceAPI, customerAPI } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSelector, useDispatch } from 'react-redux';
import { fetchSettings, selectSettings, selectSettingsLoading } from '@/store/slices/settingsSlice';

const InvoiceEdit = ({ invoiceId, onClose, onSave }) => {
  const router = useRouter();
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const dispatch = useDispatch();
  
  // Redux state
  const settings = useSelector(selectSettings);
  const settingsLoading = useSelector(selectSettingsLoading);
  
  // Component state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [showEditCustomer, setShowEditCustomer] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    address: {
      street: '',
      number: '',
      city: '',
      postalCode: '',
      prefecture: ''
    },
    taxInfo: {
      afm: '',
      businessName: ''
    }
  });
  
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusAction, setStatusAction] = useState(''); // 'markPaid' or 'cancel'
  const [paymentDetails, setPaymentDetails] = useState({
    amount: 0,
    paidDate: new Date().toISOString().split('T')[0],
    method: '3',
    info: ''
  });

  const [invoice, setInvoice] = useState({
    invoiceNumber: '',
    series: 'A',
    invoiceType: '2.1', // Service invoice default
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +30 days
    currency: 'EUR',
    exchangeRate: 1,
    customerId: '',
    status: 'draft', // Add status field
    vatRegulation: 'standard', // VAT regulation type
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
    counterpart: {
      name: '',
      vatNumber: '',
      country: 'GR',
      branch: 0,
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
        doy: { code: '', name: '' }
      }
    },
    invoiceDetails: [{
      lineNumber: 1,
      description: '',
      itemDescription: '', // Additional description line
      quantity: 1,
      unit: 'pcs', // Unit type
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

  const invoiceTypes = [
    { value: '1.1', label: t('invoice.invoiceTypes.salesInvoice') },
    { value: '2.1', label: t('invoice.invoiceTypes.serviceInvoice') },
    { value: '2.2', label: t('invoice.invoiceTypes.serviceInvoiceEU') },
    { value: '5.1', label: t('invoice.invoiceTypes.creditNoteAssoc') },
    { value: '5.2', label: t('invoice.invoiceTypes.creditNoteNonAssoc') }
  ];

  const paymentMethods = [
    { value: '1', label: 'Cash' },
    { value: '2', label: 'Check' },
    { value: '3', label: 'Bank Transfer' },
    { value: '4', label: 'Credit Card' },
    { value: '5', label: 'Web Banking' },
    { value: '6', label: 'POS' },
    { value: '7', label: 'IRIS' }
  ];

  const incomeClassifications = [
    { value: 'E3_561_001', label: 'Revenue from sales of goods' },
    { value: 'E3_562_001', label: 'Revenue from provision of services' },
    { value: 'E3_563_001', label: 'Other revenue' },
    { value: 'E3_881_001', label: 'Revenue from professional activities' }
  ];

  const unitTypes = [
    { value: 'pcs', label: t('invoice.unitTypes.pieces') },
    { value: 'hrs', label: t('invoice.unitTypes.hours') },
    { value: 'days', label: t('invoice.unitTypes.days') },
    { value: 'kg', label: t('invoice.unitTypes.kg') },
    { value: 'm', label: t('invoice.unitTypes.meters') },
    { value: 'm2', label: t('invoice.unitTypes.sqMeters') },
    { value: 'liters', label: t('invoice.unitTypes.liters') },
    { value: 'months', label: t('invoice.unitTypes.months') }
  ];

  useEffect(() => {
    if (invoiceId) {
      fetchInvoice();
    }
    fetchCustomers();
    // Fetch settings to get business information
    dispatch(fetchSettings());
  }, [invoiceId, dispatch]);

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
      setError('Failed to fetch invoice');
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
  };

  const updateInvoiceLine = (index, field, value) => {
    const newDetails = [...invoice.invoiceDetails];
    newDetails[index] = { ...newDetails[index], [field]: value };

    // Recalculate amounts
    if (field === 'quantity' || field === 'unitPrice' || field === 'vatCategory') {
      const quantity = field === 'quantity' ? parseFloat(value) || 0 : parseFloat(newDetails[index].quantity) || 0;
      const unitPrice = field === 'unitPrice' ? parseFloat(value) || 0 : parseFloat(newDetails[index].unitPrice) || 0;
      const vatCategory = field === 'vatCategory' ? value : newDetails[index].vatCategory;
      
      const netValue = quantity * unitPrice;
      const vatRate = vatRates[vatCategory] || 0;
      const vatAmount = netValue * vatRate;
      
      newDetails[index].netValue = netValue;
      newDetails[index].vatAmount = vatAmount;
      
      // Update income classification amount
      if (newDetails[index].incomeClassification?.[0]) {
        newDetails[index].incomeClassification[0].amount = netValue;
      }
    }

    setInvoice(prev => ({ ...prev, invoiceDetails: newDetails }));
  };

  const createCustomer = async () => {
    try {
      setError('');
      const response = await customerAPI.createCustomer(newCustomer);
      if (response.data.success) {
        setCustomers(prev => [...prev, response.data.customer]);
        selectCustomer(response.data.customer);
        setShowCreateCustomer(false);
        setNewCustomer({
          name: '',
          email: '',
          phone: '',
          address: {
            street: '',
            number: '',
            city: '',
            postalCode: '',
            prefecture: ''
          },
          taxInfo: {
            afm: '',
            businessName: ''
          }
        });
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create customer');
    }
  };

  const updateCustomer = async () => {
    try {
      setError('');
      const response = await customerAPI.updateCustomer(editingCustomer._id, editingCustomer);
      if (response.data.success) {
        setCustomers(prev => prev.map(c => c._id === editingCustomer._id ? response.data.customer : c));
        selectCustomer(response.data.customer);
        setShowEditCustomer(false);
        setEditingCustomer(null);
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to update customer');
    }
  };

  // Update currency symbol in totals and items
  const getCurrencySymbol = (currency) => {
    const symbols = {
      'EUR': '€',
      'USD': '$',
      'GBP': '£'
    };
    return symbols[currency] || '€';
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
    try {
      setSaving(true);
      setError('');

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
        if (onSave) onSave(response.data.invoice);
      }
    } catch (err) {
      const errorData = err.response?.data;

      // Check if it's an AADE error with detailed error messages
      if (errorData?.errors && Array.isArray(errorData.errors)) {
        const aadeErrors = errorData.errors
          .map(e => `[${e.code}] ${e.message}`)
          .join('\n');

        setError(`AADE Validation Errors:\n\n${aadeErrors}\n\nInvoice saved as pending. Fix the errors and click "Save & Send" to retry.`);
      } else {
        setError(errorData?.message || err.message || 'Failed to save invoice');
      }

      console.error('Save invoice error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAsPaid = async () => {
    try {
      setError('');
      const response = await invoiceAPI.markInvoicePaid(invoiceId, paymentDetails);
      if (response.data.success) {
        setInvoice(response.data.invoice);
        setShowStatusModal(false);
        if (onSave) onSave(response.data.invoice);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark invoice as paid');
    }
  };

  const handleCancelInvoice = async () => {
    try {
      setError('');

      // Check if invoice is transmitted to AADE
      const isTransmitted = invoice.aadeStatus === 'transmitted';

      let response;
      if (isTransmitted) {
        // Call AADE cancellation endpoint
        console.log('Cancelling transmitted invoice via AADE...');
        response = await invoiceAPI.cancelAADEInvoice(invoiceId);

        if (response.data.success) {
          console.log('✅ Invoice cancelled in AADE:', response.data.cancellationMark);
          setShowStatusModal(false);
          if (onSave) onSave(response.data.invoice); // Update invoice in parent
          if (onClose) onClose();
        }
      } else {
        // Regular local cancellation for non-transmitted invoices
        console.log('Cancelling local invoice...');
        response = await invoiceAPI.deleteInvoice(invoiceId);

        if (response.data.success) {
          setShowStatusModal(false);
          if (onClose) onClose();
        }
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to cancel invoice';
      const errors = err.response?.data?.errors;

      if (errors && errors.length > 0) {
        // Format AADE errors
        const formattedErrors = errors.map(e => `[${e.code}] ${e.message}`).join('\n');
        setError(`AADE Cancellation Failed:\n\n${formattedErrors}`);
      } else {
        setError(errorMessage);
      }
    }
  };

  const handlePreview = async () => {
    try {
      setError('');

      const totals = calculateTotals();

      // Fetch next invoice number if not already set (for new invoices)
      let previewInvoiceNumber = invoice.invoiceNumber;
      if (!previewInvoiceNumber && !invoiceId) {
        try {
          const nextNumResponse = await invoiceAPI.getNextInvoiceNumber(invoice.series || 'A');
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

      const currentLanguage = router.locale || 'en';
      const response = await invoiceAPI.previewInvoice(invoiceData, 'light', currentLanguage);

      if (!response || !response.data) {
        throw new Error('No response data received from server');
      }

      if (response.status && response.status !== 200) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const pdfBlob = response.data;

      if (pdfBlob.size === 0) {
        throw new Error('Received empty PDF file');
      }

      const pdfUrl = window.URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');

      setTimeout(() => {
        window.URL.revokeObjectURL(pdfUrl);
      }, 1000);
    } catch (err) {
      console.error('Preview invoice error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to preview invoice');
    }
  };

  const totals = calculateTotals();

  if (loading || settingsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    const badges = {
      draft: { color: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300', label: 'Draft' },
      sent: { color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300', label: 'Sent' },
      paid: { color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300', label: 'Paid' },
      overdue: { color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300', label: 'Overdue' },
      cancelled: { color: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 line-through', label: 'Cancelled' }
    };
    const badge = badges[status] || badges.draft;
    return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.color}`}>{badge.label}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white dark:bg-slate-900 min-h-screen">
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 text-sm rounded-r-lg">
          {error}
        </div>
      )}

      {/* Status Badge for Existing Invoices */}
      {invoiceId && invoice.status && (
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
            {getStatusBadge(invoice.status)}
          </div>
          {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
            <div className="flex gap-2">
              {invoice.status === 'sent' || invoice.status === 'overdue' ? (
                <button
                  onClick={() => {
                    setStatusAction('markPaid');
                    setPaymentDetails(prev => ({ ...prev, amount: calculateTotals().totalAmount }));
                    setShowStatusModal(true);
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-xl transition-colors"
                >
                  Mark as Paid
                </button>
              ) : null}
              <button
                onClick={() => {
                  setStatusAction('cancel');
                  setShowStatusModal(true);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-xl transition-colors"
              >
                Cancel Invoice
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modern Invoice Layout */}
      <div className="space-y-8">
        
        {/* 1. Header Section - Business & Customer Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Business Info - Left */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('invoice.from')}</h3>
            <div className="space-y-2">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {settings?.business?.legalName || settings?.business?.tradingName || t('business')}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {t('afm')}: {settings?.tax?.afm || 'Not set'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {t('taxOffice')}: {settings?.tax?.doy?.name || 'Not set'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {settings?.address?.street || 'Address'} {settings?.address?.number || ''}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {settings?.address?.city || 'City'}, {settings?.address?.postalCode || 'Postal Code'}
              </div>
              {!settings?.business?.legalName && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs rounded-lg border border-amber-200 dark:border-amber-700">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {t('invoice.updateBusinessInfo')}
                </div>
              )}
            </div>
          </div>

          {/* Customer Info - Right */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('invoice.to')}</h3>
              {!invoice.customerId && (
                <button
                  onClick={() => setShowCreateCustomer(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New
                </button>
              )}
            </div>
            
            {!invoice.customerId ? (
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchCustomers(e.target.value);
                    setShowCustomerSearch(true);
                  }}
                  onFocus={() => setShowCustomerSearch(true)}
                  placeholder={t('invoice.searchCustomer')}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                
                {showCustomerSearch && customers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl shadow-gray-200/50 dark:shadow-slate-900/50 max-h-48 overflow-y-auto">
                    {customers.map(customer => (
                      <div
                        key={customer._id}
                        onClick={() => {
                          selectCustomer(customer);
                          setShowCustomerSearch(false);
                          setSearchQuery('');
                        }}
                        className="p-3 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer border-b border-gray-100 dark:border-slate-600 last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-sm text-gray-900 dark:text-white">{customer.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{t('afm')}: {customer.taxInfo?.afm}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">{invoice.counterpart.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{t('afm')}: {invoice.counterpart.taxInfo?.afm}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{invoice.counterpart.address.street} {invoice.counterpart.address.number}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{invoice.counterpart.address.city}, {invoice.counterpart.address.postalCode}</div>
                  </div>
                  <div className="ml-4 flex gap-2">
                    <button
                      onClick={() => {
                        const customer = customers.find(c => c._id === invoice.customerId);
                        if (customer) {
                          setEditingCustomer(customer);
                          setShowEditCustomer(true);
                        }
                      }}
                      className="px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Edit customer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        setInvoice(prev => ({ ...prev, customerId: '', counterpart: { name: '', vatNumber: '', country: 'GR', branch: 0, address: { street: '', number: '', postalCode: '', city: '', prefecture: '', country: 'GR' }, taxInfo: { afm: '', doy: { code: '', name: '' } } } }));
                      }}
                      className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      {t('invoice.change')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. Invoice Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">{t('invoice.type')}</label>
            <select
              value={invoice.invoiceType}
              onChange={(e) => setInvoice(prev => ({ ...prev, invoiceType: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              {invoiceTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">{t('invoice.issueDate')}</label>
            <input
              type="date"
              value={invoice.issueDate}
              onChange={(e) => setInvoice(prev => ({ ...prev, issueDate: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">{t('invoice.dueDate')}</label>
            <input
              type="date"
              value={invoice.dueDate}
              onChange={(e) => setInvoice(prev => ({ ...prev, dueDate: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">{t('invoice.currency')}</label>
            <select
              value={invoice.currency}
              onChange={(e) => setInvoice(prev => ({ ...prev, currency: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>

        {/* 3. Line Items */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('invoice.items')}</h3>
            <button
              onClick={addInvoiceLine}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl transition-colors shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('invoice.addItem')}
            </button>
          </div>

          {/* Items Table - Better iPad spacing */}
          <div className="border border-gray-200 dark:border-slate-600 rounded-2xl overflow-hidden bg-white dark:bg-slate-800 shadow-xl shadow-gray-200/50 dark:shadow-slate-900/50">
            {/* Table Header */}
            <div className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
              <div className="grid grid-cols-12 gap-2 md:gap-4 p-3 md:p-4 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                <div className="col-span-3 md:col-span-3">Description</div>
                <div className="col-span-1">Qty</div>
                <div className="col-span-1.5">Unit</div>
                <div className="col-span-2">Price</div>
                <div className="col-span-1.5">VAT</div>
                <div className="col-span-2">Total</div>
                <div className="col-span-1"></div>
              </div>
            </div>

            {/* Items */}
            {invoice.invoiceDetails.map((line, index) => (
              <div key={index} className="bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-600 last:border-b-0">
                
                {/* Main Row - Better mobile spacing */}
                <div className="grid grid-cols-12 gap-2 md:gap-4 p-3 md:p-4 items-center">
                  
                  {/* Description */}
                  <div className="col-span-3 md:col-span-3">
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => {
                        const newDetails = [...invoice.invoiceDetails];
                        newDetails[index].description = e.target.value;
                        setInvoice(prev => ({ ...prev, invoiceDetails: newDetails }));
                      }}
                      placeholder="Service/Product name"
                      className="w-full px-2 md:px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Quantity */}
                  <div className="col-span-1">
                    <input
                      type="number"
                      value={line.quantity}
                      onChange={(e) => {
                        const newDetails = [...invoice.invoiceDetails];
                        const quantity = parseFloat(e.target.value) || 0;
                        newDetails[index].quantity = quantity;
                        newDetails[index].netValue = quantity * newDetails[index].unitPrice;
                        newDetails[index].vatAmount = newDetails[index].netValue * vatRates[newDetails[index].vatCategory];
                        setInvoice(prev => ({ ...prev, invoiceDetails: newDetails }));
                      }}
                      className="w-full px-1 md:px-2 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Unit - Click-through button with more width */}
                  <div className="col-span-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const newDetails = [...invoice.invoiceDetails];
                        const currentIndex = unitTypes.findIndex(u => u.value === line.unit);
                        const nextIndex = (currentIndex + 1) % unitTypes.length;
                        newDetails[index].unit = unitTypes[nextIndex].value;
                        setInvoice(prev => ({ ...prev, invoiceDetails: newDetails }));
                      }}
                      className="w-full px-2 md:px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer text-center"
                    >
                      {line.unit || 'pcs'}
                    </button>
                  </div>

                  {/* Price */}
                  <div className="col-span-2">
                    <input
                      type="number"
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
                      className="w-full px-2 md:px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>

                  {/* VAT - Click-through button with more width */}
                  <div className="col-span-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const newDetails = [...invoice.invoiceDetails];
                        const vatOptions = [{ value: '1', label: '24%' }, { value: '2', label: '13%' }, { value: '3', label: '6%' }, { value: '7', label: '0%' }, { value: '8', label: 'Exempt' }];
                        const currentIndex = vatOptions.findIndex(v => v.value === line.vatCategory);
                        const nextIndex = (currentIndex + 1) % vatOptions.length;
                        newDetails[index].vatCategory = vatOptions[nextIndex].value;
                        newDetails[index].vatAmount = newDetails[index].netValue * vatRates[vatOptions[nextIndex].value];
                        setInvoice(prev => ({ ...prev, invoiceDetails: newDetails }));
                      }}
                      className="w-full px-2 md:px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer text-center"
                    >
                      {line.vatCategory === '8' ? 'Exempt' : `${(vatRates[line.vatCategory] * 100).toFixed(0)}%`}
                    </button>
                  </div>

                  {/* Total */}
                  <div className="col-span-2">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {getCurrencySymbol(invoice.currency)}{((line.netValue || 0) + (line.vatAmount || 0)).toFixed(2)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="col-span-1">
                    <button
                      onClick={() => removeInvoiceLine(index)}
                      disabled={invoice.invoiceDetails.length === 1}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Additional Description */}
                <div className="px-3 md:px-4 pb-3 md:pb-4">
                  <textarea
                    value={line.itemDescription || ''}
                    onChange={(e) => {
                      const newDetails = [...invoice.invoiceDetails];
                      newDetails[index].itemDescription = e.target.value;
                      setInvoice(prev => ({ ...prev, invoiceDetails: newDetails }));
                    }}
                    placeholder={`${t('invoice.additionalDesc')}\nDate range, venue details...\nMultiple lines supported`}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-100 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-300 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent italic transition-all resize-none"
                  />
                </div>
              </div>
            ))}

            {/* Totals */}
            <div className="bg-gray-50 dark:bg-slate-700 border-t border-gray-200 dark:border-slate-600 p-6">
              <div className="flex justify-end">
                <div className="space-y-3 text-sm w-72">
                  <div className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span>{t('invoice.netTotal')}:</span>
                    <span className="font-medium">{getCurrencySymbol(invoice.currency)}{totals.netValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span>{t('invoice.vatTotal')}:</span>
                    <span className="font-medium">{getCurrencySymbol(invoice.currency)}{totals.vatAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-3 border-t border-gray-300 dark:border-slate-500">
                    <span>{t('invoice.totalAmount')}:</span>
                    <span>{getCurrencySymbol(invoice.currency)}{totals.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Notes Section */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-900 dark:text-white">
            {t('invoice.notes')}
          </label>
          <textarea
            value={invoice.notes}
            onChange={(e) => setInvoice(prev => ({ ...prev, notes: e.target.value }))}
            rows={4}
            placeholder={t('invoice.notesPlaceholder')}
            className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
          />
        </div>

        {/* 5. Footer Text Section */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-900 dark:text-white">
            Footer Text
          </label>
          <textarea
            value={invoice.footerText}
            onChange={(e) => setInvoice(prev => ({ ...prev, footerText: e.target.value }))}
            rows={6}
            placeholder="Vielen Dank für Ihren Auftrag!\nBei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen"
            className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 rounded-xl text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all font-mono"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Custom footer text for your invoices
          </p>
        </div>

        {/* VAT Regulation Section - Minimalistic */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-900 dark:text-white">
            {t('invoice.vatRegulation') || 'VAT Regulation'}
          </label>
          <div className="inline-flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setInvoice(prev => ({ ...prev, vatRegulation: 'standard' }))}
              className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                invoice.vatRegulation === 'standard' 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              {t('invoice.vatRegulationTypes.standard')}
            </button>
            <button
              type="button"
              onClick={() => setInvoice(prev => ({ ...prev, vatRegulation: 'taxFree' }))}
              className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                invoice.vatRegulation === 'taxFree' 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              {t('invoice.vatRegulationTypes.taxFree')}
            </button>
            <button
              type="button"
              onClick={() => setInvoice(prev => ({ ...prev, vatRegulation: 'reverseChargeDE' }))}
              className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                invoice.vatRegulation === 'reverseChargeDE' 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              {t('invoice.vatRegulationTypes.reverseCharge')}
            </button>
            <button
              type="button"
              onClick={() => setInvoice(prev => ({ ...prev, vatRegulation: 'reverseChargeEU' }))}
              className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                invoice.vatRegulation === 'reverseChargeEU' 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              {t('invoice.vatRegulationTypes.euReverseCharge')}
            </button>
            <button
              type="button"
              onClick={() => setInvoice(prev => ({ ...prev, vatRegulation: 'intraCommunity' }))}
              className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                invoice.vatRegulation === 'intraCommunity' 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              {t('invoice.vatRegulationTypes.intraCommunity')}
            </button>
            <button
              type="button"
              onClick={() => setInvoice(prev => ({ ...prev, vatRegulation: 'export' }))}
              className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                invoice.vatRegulation === 'export' 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              {t('invoice.vatRegulationTypes.exportNonEU')}
            </button>
          </div>
        </div>

        {/* Hide Bank Details Option */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="hideBankDetails"
            checked={invoice.hideBankDetails || false}
            onChange={(e) => setInvoice(prev => ({ ...prev, hideBankDetails: e.target.checked }))}
            className="w-4 h-4 text-blue-600 bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 rounded focus:ring-blue-500"
          />
          <label htmlFor="hideBankDetails" className="text-sm text-gray-700 dark:text-gray-300">
            Hide bank details on invoice
          </label>
        </div>

        {/* 6. Actions */}
        <div className="flex justify-end gap-3 pt-8 border-t border-gray-200 dark:border-slate-600">
          <button
            onClick={() => onClose && onClose()}
            className="px-6 py-2.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl transition-colors"
          >
            {t('invoice.cancel')}
          </button>
          <button
            onClick={() => handlePreview()}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:-translate-y-0.5"
          >
            <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {t('invoice.preview') || 'Preview'}
          </button>
          <button
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="px-6 py-2.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-800 dark:text-white rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? t('invoice.saving') : t('invoice.saveDraft')}
          </button>
          <button
            onClick={() => handleSave('sent')}
            disabled={saving || !invoice.customerId}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
          >
            {saving ? t('invoice.saving') : t('invoice.saveAndSend')}
          </button>
        </div>
      </div>

      {/* Create Customer Modal */}
      {showCreateCustomer && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowCreateCustomer(false)}></div>
            
            <div className="relative inline-block align-bottom bg-white dark:bg-slate-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-slate-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {t('customer.createNew')}
                  </h3>
                  <button
                    onClick={() => setShowCreateCustomer(false)}
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
                      Name *
                    </label>
                    <input
                      type="text"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Customer name"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="customer@example.com"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      AFM (Optional)
                    </label>
                    <input
                      type="text"
                      value={newCustomer.taxInfo.afm}
                      onChange={(e) => setNewCustomer(prev => ({ 
                        ...prev, 
                        taxInfo: { ...prev.taxInfo, afm: e.target.value }
                      }))}
                      placeholder="123456789"
                      maxLength={9}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Street
                      </label>
                      <input
                        type="text"
                        value={newCustomer.address.street}
                        onChange={(e) => setNewCustomer(prev => ({ 
                          ...prev, 
                          address: { ...prev.address, street: e.target.value }
                        }))}
                        placeholder="Street name"
                        className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Number
                      </label>
                      <input
                        type="text"
                        value={newCustomer.address.number}
                        onChange={(e) => setNewCustomer(prev => ({ 
                          ...prev, 
                          address: { ...prev.address, number: e.target.value }
                        }))}
                        placeholder="123"
                        className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        value={newCustomer.address.city}
                        onChange={(e) => setNewCustomer(prev => ({ 
                          ...prev, 
                          address: { ...prev.address, city: e.target.value }
                        }))}
                        placeholder="Athens"
                        className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Postal Code
                      </label>
                      <input
                        type="text"
                        value={newCustomer.address.postalCode}
                        onChange={(e) => setNewCustomer(prev => ({ 
                          ...prev, 
                          address: { ...prev.address, postalCode: e.target.value }
                        }))}
                        placeholder="12345"
                        className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Prefecture
                    </label>
                    <input
                      type="text"
                      value={newCustomer.address.prefecture}
                      onChange={(e) => setNewCustomer(prev => ({ 
                        ...prev, 
                        address: { ...prev.address, prefecture: e.target.value }
                      }))}
                      placeholder="Attica"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Phone
                    </label>
                    <input
                      type="text"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+30 210 1234567"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowCreateCustomer(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg transition-colors"
                  >
                    {t('customer.cancel')}
                  </button>
                  <button
                    onClick={createCustomer}
                    disabled={!newCustomer.name.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('customer.create')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Action Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowStatusModal(false)}></div>

            <div className="relative inline-block align-bottom bg-white dark:bg-slate-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-slate-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {statusAction === 'markPaid' ? 'Mark Invoice as Paid' : 'Cancel Invoice'}
                  </h3>
                  <button
                    onClick={() => setShowStatusModal(false)}
                    className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg p-2 transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {statusAction === 'markPaid' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Payment Amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={paymentDetails.amount}
                        onChange={(e) => setPaymentDetails(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Payment Date
                      </label>
                      <input
                        type="date"
                        value={paymentDetails.paidDate}
                        onChange={(e) => setPaymentDetails(prev => ({ ...prev, paidDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={paymentDetails.method}
                        onChange={(e) => setPaymentDetails(prev => ({ ...prev, method: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      >
                        {paymentMethods.map(method => (
                          <option key={method.value} value={method.value}>{method.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Notes (Optional)
                      </label>
                      <textarea
                        value={paymentDetails.info}
                        onChange={(e) => setPaymentDetails(prev => ({ ...prev, info: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
                        placeholder="Payment reference, transaction ID, etc."
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Are you sure you want to cancel this invoice? This action cannot be undone.
                    </p>
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowStatusModal(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={statusAction === 'markPaid' ? handleMarkAsPaid : handleCancelInvoice}
                    className={`px-4 py-2 text-white rounded-lg transition-colors ${
                      statusAction === 'markPaid'
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {statusAction === 'markPaid' ? 'Confirm Payment' : 'Confirm Cancellation'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEditCustomer && editingCustomer && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowEditCustomer(false)}></div>

            <div className="relative inline-block align-bottom bg-white dark:bg-slate-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-slate-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Edit Customer
                  </h3>
                  <button
                    onClick={() => setShowEditCustomer(false)}
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
                      Name *
                    </label>
                    <input
                      type="text"
                      value={editingCustomer.name}
                      onChange={(e) => setEditingCustomer(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Customer name"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editingCustomer.email || ''}
                      onChange={(e) => setEditingCustomer(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="customer@example.com"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      AFM (Optional)
                    </label>
                    <input
                      type="text"
                      value={editingCustomer.taxInfo?.afm || ''}
                      onChange={(e) => setEditingCustomer(prev => ({
                        ...prev,
                        taxInfo: { ...prev.taxInfo, afm: e.target.value }
                      }))}
                      placeholder="123456789"
                      maxLength={9}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Street
                      </label>
                      <input
                        type="text"
                        value={editingCustomer.address?.street || ''}
                        onChange={(e) => setEditingCustomer(prev => ({
                          ...prev,
                          address: { ...prev.address, street: e.target.value }
                        }))}
                        placeholder="Street name"
                        className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Number
                      </label>
                      <input
                        type="text"
                        value={editingCustomer.address?.number || ''}
                        onChange={(e) => setEditingCustomer(prev => ({
                          ...prev,
                          address: { ...prev.address, number: e.target.value }
                        }))}
                        placeholder="123"
                        className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        value={editingCustomer.address?.city || ''}
                        onChange={(e) => setEditingCustomer(prev => ({
                          ...prev,
                          address: { ...prev.address, city: e.target.value }
                        }))}
                        placeholder="Athens"
                        className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Postal Code
                      </label>
                      <input
                        type="text"
                        value={editingCustomer.address?.postalCode || ''}
                        onChange={(e) => setEditingCustomer(prev => ({
                          ...prev,
                          address: { ...prev.address, postalCode: e.target.value }
                        }))}
                        placeholder="12345"
                        className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Prefecture
                    </label>
                    <input
                      type="text"
                      value={editingCustomer.address?.prefecture || ''}
                      onChange={(e) => setEditingCustomer(prev => ({
                        ...prev,
                        address: { ...prev.address, prefecture: e.target.value }
                      }))}
                      placeholder="Attica"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Phone
                    </label>
                    <input
                      type="text"
                      value={editingCustomer.phone || ''}
                      onChange={(e) => setEditingCustomer(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+30 210 1234567"
                      className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowEditCustomer(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={updateCustomer}
                    disabled={!editingCustomer.name?.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Update Customer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceEdit;
