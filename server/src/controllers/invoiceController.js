const Invoice = require('../models/invoiceModel');
const Customer = require('../models/customerModel');
const Client = require('../models/clientModel');
const Settings = require('../models/settingsModel');
const Banking = require('../models/bankingModel');
const Service = require('../models/serviceModel');
const pdfService = require('../services/pdfService');
const aadeService = require('../services/aadeService');
const aadeTransformer = require('../services/aadeTransformer');
const einvoiceService = require('../services/einvoiceService');
const { resolveAadeCredentials } = require('../services/aadeCredentials');
const { getParochosService, ParochosError } = require('../services/parochosService');

// ---------------------------------------------------------------- helpers

const idOf = (v) => (v && typeof v === 'object' && v._id ? v._id : v) || null;

// Fields a client may never set directly on create/update.
const SERVER_OWNED_FIELDS = [
  '_id', 'id', '__v', 'userId', 'invoiceNumber', 'issuer', 'aadeInfo', 'aadeStatus', 'providerInfo',
  'transmissionDate', 'modifications', 'createdAt', 'updatedAt', 'idempotencyKey', 'sendLockedAt',
  'daysOverdue', 'amountDue', 'documentBrand', 'source', 'externalId', 'externalOrderId'
];

const sanitizeInvoiceInput = (body = {}) => {
  const data = { ...body };
  SERVER_OWNED_FIELDS.forEach((f) => delete data[f]);
  // A duplicated invoice arrives with populated objects instead of ids.
  if ('customerId' in data) data.customerId = idOf(data.customerId);
  if ('clientId' in data) data.clientId = idOf(data.clientId);
  return data;
};

const buildBankingInfo = async (userId) => {
  const userBanks = await Banking.getUserBanks(userId);
  return userBanks.map((bank) => ({
    accountName: bank.accountName,
    bankName: bank.bankName,
    iban: bank.iban,
    swift: bank.swift,
    isDefault: bank.isDefault
  }));
};

// req.user is { userId, user }; the profile fields live on req.user.user.
const userDisplayName = (req) => {
  const u = req.user?.user || {};
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || '';
};

const buildIssuer = (settings, bankingInfo, fallback = {}, fallbackName = '') => ({
  vatNumber: settings.tax?.afm || fallback.vatNumber,
  country: 'GR',
  branch: 0,
  name: settings.business?.legalName || settings.business?.tradingName || fallback.name || fallbackName,
  legalForm: settings.business?.legalForm || '',
  address: {
    street: settings.address?.street || fallback.address?.street,
    number: settings.address?.number || fallback.address?.number,
    postalCode: settings.address?.postalCode || fallback.address?.postalCode,
    city: settings.address?.city || fallback.address?.city,
    prefecture: settings.address?.prefecture || fallback.address?.prefecture,
    country: 'GR'
  },
  taxInfo: {
    afm: settings.tax?.afm || fallback.taxInfo?.afm,
    doy: settings.tax?.doy || fallback.taxInfo?.doy,
    gemi: settings.tax?.gemi || ''
  },
  activityCodes: settings.tax?.activityCodes || [],
  banking: bankingInfo
});

// Problems that would make myDATA reject the invoice; checked before sending.
const validateForSending = (invoice) => {
  if (!invoice.counterpart?.name || !invoice.invoiceDetails || invoice.invoiceDetails.length === 0) {
    return 'Invoice must have recipient and line items before sending';
  }
  const invalidLines = invoice.invoiceDetails.filter((line) => !line.description || !line.unitPrice);
  if (invalidLines.length > 0) {
    return 'All invoice lines must have descriptions and prices before sending';
  }
  return null;
};

const errorResult = (status, body) => ({ status, body: { success: false, ...body } });

// Cross-request lock: only one transmission per invoice at a time, so a
// double click or a client retry can never submit the same invoice twice.
const SEND_LOCK_MS = 3 * 60 * 1000;
const acquireSendLock = async (invoiceId) => {
  const staleBefore = new Date(Date.now() - SEND_LOCK_MS);
  const r = await Invoice.updateOne(
    { _id: invoiceId, $or: [{ sendLockedAt: null }, { sendLockedAt: { $lt: staleBefore } }] },
    { $set: { sendLockedAt: new Date() } }
  );
  return r.modifiedCount === 1;
};
const releaseSendLock = (invoiceId) =>
  Invoice.updateOne({ _id: invoiceId }, { $unset: { sendLockedAt: 1 } }).catch((err) =>
    console.error('Could not release send lock for', String(invoiceId), err.message)
  );

/**
 * Transmit a saved invoice to myDATA, directly or through the configured
 * provider. Never transmits twice: already transmitted -> success, a
 * transmission already running -> 409.
 * @returns {Promise<{status:number, body:object}>}
 */
const transmitInvoice = async (invoice, settings) => {
  if (invoice.aadeStatus === 'transmitted') {
    return { status: 200, body: { success: true, alreadyTransmitted: true } };
  }

  if (!(await acquireSendLock(invoice._id))) {
    return errorResult(409, {
      code: 'SEND_IN_PROGRESS',
      message: 'This invoice is being sent to myDATA right now. Please wait a moment and refresh.'
    });
  }

  try {
    if (einvoiceService.usesProvider()) {
      const r = await einvoiceService.submitViaProvider(invoice);
      if (r.outcome === 'transmitted') return { status: 200, body: { success: true } };
      return {
        status: r.httpStatus || 400,
        body: { success: r.outcome === 'pending', pending: r.outcome === 'pending', message: r.message, errors: r.errors }
      };
    }

    const creds = resolveAadeCredentials(settings);
    if (!creds.ok) {
      invoice.status = 'draft';
      await invoice.save();
      return errorResult(400, { code: 'AADE_NOT_CONFIGURED', message: `${creds.message} The invoice was saved as a draft.` });
    }

    let aadeResponse;
    try {
      const aadeXML = aadeTransformer.invoiceToXML(invoice.toObject());
      console.log(`📤 Submitting ${invoice.invoiceNumber} to AADE (credentials from ${creds.source === 'settings' ? 'Settings' : 'server environment'})`);
      aadeResponse = await aadeService.sendInvoices(aadeXML, creds.credentials);
    } catch (aadeError) {
      console.error('💥 AADE submission error:', aadeError.message);
      invoice.status = 'draft';
      invoice.aadeStatus = 'failed';
      invoice.aadeInfo.transmissionFailure = 'network';
      await invoice.save();
      return errorResult(502, {
        code: 'AADE_UNREACHABLE',
        message: `AADE submission failed: ${aadeError.message}. Invoice saved as draft - try again.`
      });
    }

    if (!aadeResponse.success) {
      console.error('❌ AADE rejected invoice', invoice.invoiceNumber, aadeResponse.errors);
      invoice.status = 'draft';
      invoice.aadeStatus = 'failed';
      invoice.aadeInfo.transmissionFailure = 'validation';
      await invoice.save();
      return errorResult(400, {
        code: 'AADE_REJECTED',
        message: 'AADE rejected invoice. Invoice saved as draft - fix errors and try again.',
        errors: aadeResponse.errors
      });
    }

    console.log('✅ AADE submission successful:', aadeResponse.mark);
    const qrCode = await aadeService.generateQRCode(aadeResponse.mark, aadeResponse.uid, aadeResponse.authenticationCode);
    invoice.status = 'sent';
    const aadeData = {
      mark: aadeResponse.mark,
      uid: aadeResponse.uid,
      authenticationCode: aadeResponse.authenticationCode,
      qrUrl: qrCode
    };
    try {
      await invoice.markTransmitted(aadeData);
    } catch (saveError) {
      // AADE has the invoice; losing that fact would invite a duplicate send.
      console.error(`‼️ ${invoice.invoiceNumber} accepted by AADE (MARK ${aadeData.mark}) but saving failed: ${saveError.message} - retrying with a direct update`);
      await Invoice.updateOne({ _id: invoice._id }, {
        $set: {
          status: 'sent',
          aadeStatus: 'transmitted',
          transmissionDate: new Date(),
          'aadeInfo.mark': aadeData.mark,
          'aadeInfo.uid': aadeData.uid,
          'aadeInfo.authenticationCode': aadeData.authenticationCode,
          'aadeInfo.qrUrl': aadeData.qrUrl,
          'aadeInfo.transmissionFailure': null
        }
      });
    }
    return { status: 200, body: { success: true } };
  } finally {
    await releaseSendLock(invoice._id);
  }
};

// Reload with references populated and send the final create/update answer.
const respondWithInvoice = async (res, invoiceId, { status, body }) => {
  const invoice = await Invoice.findById(invoiceId).populate(['customerId', 'clientId']);
  return res.status(status).json({ ...body, invoice });
};

const autoCreateServicesLater = (userId, invoiceDetails) => {
  autoCreateServicesFromInvoice(userId, invoiceDetails).catch((err) => {
    console.warn('Auto-create services warning:', err.message);
  });
};

// Helper: Auto-create services from invoice line items
const autoCreateServicesFromInvoice = async (userId, invoiceDetails) => {
  for (const line of invoiceDetails) {
    if (line.description && line.description.trim()) {
      const name = line.description.trim();

      // Check if service with this exact name exists
      const existingService = await Service.findOne({
        userId,
        name,
        isActive: true
      });

      if (!existingService) {
        // Auto-create new service
        await Service.create({
          userId,
          name,
          description: line.itemDescription || '',
          basePrice: line.unitPrice || 0,
          unit: line.unit || 'pcs',
          vatCategory: line.vatCategory || '1',
          stats: { timesUsed: 1, lastUsed: new Date() }
        });
      } else {
        // Update usage stats
        existingService.stats.timesUsed += 1;
        existingService.stats.lastUsed = new Date();
        await existingService.save();
      }
    }
  }
};

// @desc    Get all invoices for a user
// @route   GET /api/invoices
// @access  Private
const getInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      clientId,
      customerId,
      startDate,
      endDate,
      aadeStatus,
      series
    } = req.query;

    const userId = req.user.userId;
    let query = { userId };

    // The stored status only turns 'overdue' when a document is saved; bring
    // past-due invoices up to date so the list and the status filter match.
    await Invoice.updateMany(
      { userId, status: 'sent', dueDate: { $lt: new Date() } },
      { $set: { status: 'overdue' } }
    );

    // Apply filters
    if (status) query.status = status;
    if (clientId) query.clientId = clientId;
    if (customerId) query.customerId = customerId;
    if (aadeStatus) query.aadeStatus = aadeStatus;
    if (series) query.series = series;
    
    // Date range filter
    if (startDate || endDate) {
      query.issueDate = {};
      if (startDate) query.issueDate.$gte = new Date(startDate);
      if (endDate) query.issueDate.$lte = new Date(endDate);
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { issueDate: -1 }
    };

    const skip = (options.page - 1) * options.limit;
    
    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate('customerId', 'name displayName taxInfo')
        .populate('clientId', 'companyName')
        .skip(skip)
        .limit(options.limit)
        .sort(options.sort),
      Invoice.countDocuments(query)
    ]);

    res.json({
      success: true,
      invoices,
      pagination: {
        total,
        page: options.page,
        pages: Math.ceil(total / options.limit),
        limit: options.limit
      }
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices',
      error: error.message
    });
  }
};

// @desc    Get a single invoice
// @route   GET /api/invoices/:id
// @access  Private
const getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      userId: req.user.userId
    })
    .populate('customerId')
    .populate('clientId');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // If customerId is populated and counterpart address is missing, sync from customer
    if (invoice.customerId && invoice.customerId.address) {
      const customer = invoice.customerId;
      if (!invoice.counterpart.address?.street || !invoice.counterpart.address?.number) {
        invoice.counterpart.address = {
          street: customer.address?.street || invoice.counterpart.address?.street || '',
          number: customer.address?.number || invoice.counterpart.address?.number || '',
          postalCode: customer.address?.postalCode || invoice.counterpart.address?.postalCode || '',
          city: customer.address?.city || invoice.counterpart.address?.city || '',
          prefecture: customer.address?.prefecture || invoice.counterpart.address?.prefecture || '',
          country: customer.address?.country || invoice.counterpart.address?.country || 'GR'
        };
      }
    }

    res.json({
      success: true,
      invoice
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice',
      error: error.message
    });
  }
};

// @desc    Create a new invoice
// @route   POST /api/invoices
// @access  Private
// Header Idempotency-Key (optional): a retry of the same create (timeout,
// double click, "Save & Send" again after an error) reuses the invoice the
// first attempt created instead of creating - and sending - a second one.
const createInvoice = async (req, res) => {
  try {
    const userId = req.user.userId;
    const invoiceData = sanitizeInvoiceInput(req.body);
    const wantsToSend = invoiceData.status === 'sent';
    const rawKey = req.get('Idempotency-Key');
    const idempotencyKey = rawKey && rawKey.length <= 128 ? rawKey : undefined;

    // Get user settings for issuer info
    const settings = await Settings.findOne({ userId });
    if (!settings?.tax?.afm) {
      return res.status(400).json({
        success: false,
        message: 'Please complete your tax settings before creating invoices'
      });
    }

    // Retry of an earlier create: continue with that invoice.
    if (idempotencyKey) {
      const existing = await Invoice.findOne({ userId, idempotencyKey });
      if (existing) {
        return continueExistingInvoice(req, res, existing, invoiceData, settings, { replay: true });
      }
    }

    // Validate customer exists
    if (invoiceData.customerId) {
      const customer = await Customer.findOne({
        _id: invoiceData.customerId,
        userId
      });

      if (!customer) {
        return res.status(400).json({
          success: false,
          message: 'Customer not found'
        });
      }
    }

    if (wantsToSend) {
      const problem = validateForSending(invoiceData);
      if (problem) return res.status(400).json({ success: false, message: problem });
    }

    const bankingInfo = await buildBankingInfo(userId);
    const issuer = buildIssuer(settings, bankingInfo, {}, userDisplayName(req));

    // Line items always get usable defaults (drafts may be incomplete)
    invoiceData.invoiceDetails = (invoiceData.invoiceDetails || []).map((detail, index) => ({
      ...detail,
      lineNumber: detail.lineNumber || index + 1,
      description: detail.description || '',
      unitPrice: detail.unitPrice || 0,
      netValue: detail.netValue || 0,
      vatAmount: detail.vatAmount || 0
    }));
    if (!invoiceData.counterpart?.name) {
      invoiceData.counterpart = { ...invoiceData.counterpart, name: '' };
    }

    // A new invoice is never already paid: duplicating a paid invoice copied
    // its payment amount, and the save hook then marked the copy 'paid'.
    if (invoiceData.payment && invoiceData.status !== 'paid') {
      invoiceData.payment = { method: invoiceData.payment.method, info: invoiceData.payment.info };
    }

    if (!invoiceData.dueDate) {
      const days = Number(settings.invoicing?.paymentTerms ?? 30);
      const base = invoiceData.issueDate ? new Date(invoiceData.issueDate) : new Date();
      invoiceData.dueDate = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    }

    // Always stored as a draft first; it only becomes 'sent' once myDATA (or
    // the provider) has accepted it.
    const requestedStatus = invoiceData.status;
    const invoice = await Invoice.createWithNextNumber({
      ...invoiceData,
      userId,
      series: invoiceData.series || 'A',
      issuer,
      idempotencyKey,
      status: requestedStatus && requestedStatus !== 'sent' ? requestedStatus : 'draft'
    });

    let result = { status: 201, body: { success: true } };
    if (wantsToSend) {
      result = await transmitInvoice(invoice, settings);
      if (result.status === 200) result.status = 201;
    }

    autoCreateServicesLater(userId, invoice.invoiceDetails);
    return respondWithInvoice(res, invoice._id, result);
  } catch (error) {
    // A concurrent duplicate of the same request (same Idempotency-Key): the
    // other request created the invoice a moment ago - continue with it.
    if (error.code === 11000 && error.keyPattern?.idempotencyKey) {
      try {
        const key = req.get('Idempotency-Key');
        const existing = await Invoice.findOne({ userId: req.user.userId, idempotencyKey: key });
        if (existing) {
          const settings = await Settings.findOne({ userId: req.user.userId });
          return await continueExistingInvoice(req, res, existing, sanitizeInvoiceInput(req.body), settings, { replay: true });
        }
      } catch (retryError) {
        console.error('Create invoice (duplicate request) error:', retryError.message);
      }
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_REQUEST',
        message: 'This invoice is already being saved. Please wait a moment and refresh.'
      });
    }
    console.error('Create invoice error:', error);
    res.status(error.name === 'ValidationError' || error.name === 'CastError' ? 400 : 500).json({
      success: false,
      message: 'Failed to create invoice',
      error: error.message
    });
  }
};

// Apply the editable fields of a create/update request to an invoice that is
// not transmitted yet, then send it if asked to.
const continueExistingInvoice = async (req, res, invoice, data, settings, { replay = false } = {}) => {
  const wantsToSend = data.status === 'sent';

  if (invoice.aadeStatus === 'transmitted' || (replay && ['cancelled', 'paid'].includes(invoice.status))) {
    // Nothing left to do: report the stored state (idempotent replay).
    return respondWithInvoice(res, invoice._id, {
      status: 200,
      body: { success: true, alreadyTransmitted: invoice.aadeStatus === 'transmitted', replayed: true }
    });
  }

  const allowedUpdates = [
    'counterpart', 'invoiceDetails', 'dueDate', 'notes', 'footerText',
    'currency', 'exchangeRate', 'payment', 'vatRegulation', 'invoiceType',
    'series', 'issueDate', 'totals', 'hideBankDetails'
  ];
  allowedUpdates.forEach((field) => {
    if (data[field] !== undefined) invoice[field] = data[field];
  });

  // Always refresh issuer data from settings to ensure legalForm and gemi are current
  if (settings) {
    const bankingInfo = await buildBankingInfo(req.user.userId);
    invoice.issuer = buildIssuer(settings, bankingInfo, invoice.issuer || {}, userDisplayName(req));
  }

  if (wantsToSend) {
    const problem = validateForSending(invoice);
    if (problem) return res.status(400).json({ success: false, message: problem });
  }

  if (data.status && data.status !== 'sent') {
    invoice.status = data.status;
  }
  await invoice.save();

  let result = { status: 200, body: { success: true } };
  if (wantsToSend) {
    result = await transmitInvoice(invoice, settings);
  }

  autoCreateServicesLater(req.user.userId, invoice.invoiceDetails);
  return respondWithInvoice(res, invoice._id, result);
};

// @desc    Update an invoice
// @route   PUT /api/invoices/:id
// @access  Private
const updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const data = sanitizeInvoiceInput(req.body);

    // Check if invoice can be edited
    if (invoice.aadeStatus === 'transmitted') {
      if (data.status === 'sent') {
        // "Send" again after a timeout although the first attempt went
        // through: that is success, not an error.
        return respondWithInvoice(res, invoice._id, {
          status: 200,
          body: { success: true, alreadyTransmitted: true }
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Cannot edit invoice that has been transmitted to AADE'
      });
    }

    const settings = await Settings.findOne({ userId: req.user.userId });
    return await continueExistingInvoice(req, res, invoice, data, settings);
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(error.name === 'ValidationError' || error.name === 'CastError' ? 400 : 500).json({
      success: false,
      message: 'Failed to update invoice',
      error: error.message
    });
  }
};

// @desc    Delete an invoice
// @route   DELETE /api/invoices/:id
// @access  Private
const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Check if invoice can be deleted
    if (invoice.aadeStatus === 'transmitted') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete invoice that has been transmitted to AADE. Cancel it instead.'
      });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete paid invoices'
      });
    }

    await invoice.cancel(req.user.userId, 'Invoice deleted by user');

    res.json({
      success: true,
      message: 'Invoice cancelled successfully'
    });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete invoice',
      error: error.message
    });
  }
};

// @desc    Mark invoice as paid
// @route   POST /api/invoices/:id/pay
// @access  Private
const markInvoicePaid = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Invoice is already paid'
      });
    }

    const paymentData = {
      amount: req.body.amount || invoice.totals.totalAmount,
      paidDate: req.body.paidDate || new Date(),
      method: req.body.method || '3', // Bank transfer default
      info: req.body.info
    };

    await invoice.markAsPaid(paymentData, req.user.userId);
    await invoice.populate(['customerId', 'clientId']);

    res.json({
      success: true,
      invoice
    });
  } catch (error) {
    console.error('Mark paid error:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to mark invoice as paid',
      error: error.message
    });
  }
};

// @desc    Get invoice statistics
// @route   GET /api/invoices/stats
// @access  Private
const getInvoiceStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : new Date();

    const stats = await Invoice.getRevenueStats(userId, start, end);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
};

// @desc    Generate next invoice number
// @route   GET /api/invoices/next-number
// @access  Private
const getNextInvoiceNumber = async (req, res) => {
  try {
    const { series = 'A' } = req.query;
    const nextNumber = await Invoice.generateInvoiceNumber(req.user.userId, series);

    res.json({
      success: true,
      nextNumber,
      series
    });
  } catch (error) {
    console.error('Get next number error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice number',
      error: error.message
    });
  }
};

// @desc    Preview invoice as PDF
// @route   POST /api/invoices/preview
// @access  Private
const previewInvoice = async (req, res) => {
  try {
    const userId = req.user.userId;
    const invoiceData = { ...req.body };
    const theme = req.query.theme || 'light';

    // ALWAYS fetch banking information (needed for PDF)
    const bankingInfo = await buildBankingInfo(userId);

    // Get user settings for issuer info if not provided
    if (!invoiceData.issuer) {
      const settings = await Settings.findOne({ userId });
      if (!settings?.tax?.afm) {
        return res.status(400).json({
          success: false,
          message: 'Please complete your tax settings before previewing invoices'
        });
      }
      invoiceData.issuer = buildIssuer(settings, bankingInfo, {}, userDisplayName(req));
    } else {
      // Issuer exists from frontend, just attach banking
      invoiceData.issuer = { ...invoiceData.issuer, banking: bankingInfo };
    }

    // Generate temporary invoice number for preview
    if (!invoiceData.invoiceNumber) {
      invoiceData.invoiceNumber = 'DRAFT-' + Date.now();
    }

    // Get language from query params or user preferences
    const language = req.query.lang || req.user?.user?.preferences?.language || 'en';

    // Only show watermark for draft invoices, not for sent/transmitted ones
    const isPreview = !(invoiceData.status === 'sent' || invoiceData.aadeStatus === 'transmitted');

    const pdfBuffer = await pdfService.generateInvoicePDF(invoiceData, theme, isPreview, language);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${invoiceData.invoiceNumber || 'draft'}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('💥 Preview invoice error:', error.stack || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to preview invoice',
      error: error.message
    });
  }
};

// @desc    Cancel invoice in AADE
// @route   POST /api/invoices/:id/cancel-aade
// @access  Private
const cancelAADEInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Already cancelled (e.g. a retried request after a timeout): report success
    if (invoice.aadeStatus === 'cancelled') {
      await invoice.populate(['customerId', 'clientId']);
      return res.json({
        success: true,
        alreadyCancelled: true,
        message: 'Invoice is already cancelled in AADE',
        cancellationMark: invoice.aadeInfo?.cancelledByMark,
        invoice
      });
    }

    // Check if invoice is transmitted to AADE
    if (invoice.aadeStatus !== 'transmitted') {
      return res.status(400).json({
        success: false,
        message: 'Only invoices transmitted to AADE can be cancelled via this endpoint. Use regular delete for non-transmitted invoices.'
      });
    }

    // Get MARK for cancellation
    if (!invoice.aadeInfo?.mark) {
      return res.status(400).json({
        success: false,
        message: 'Invoice does not have an AADE MARK - cannot cancel'
      });
    }

    console.log('🚫 Cancelling AADE invoice:', invoice.invoiceNumber, 'MARK:', invoice.aadeInfo.mark);

    // Invoices issued through a provider are cancelled through that provider
    if (invoice.providerInfo?.provider === 'parochos') {
      try {
        const result = await getParochosService().cancel({
          mark: invoice.aadeInfo.mark,
          invoiceType: invoice.invoiceType
        });
        if (!result.success) {
          return res.status(400).json({ success: false, message: 'Parochos rejected invoice cancellation', errors: result.errors });
        }
        invoice.aadeStatus = 'cancelled';
        invoice.status = 'cancelled';
        invoice.aadeInfo.cancelledByMark = result.cancellationMark;
        invoice.modifications.push({
          action: 'cancelled',
          userId: req.user.userId,
          description: `Cancelled via Parochos with cancellation MARK: ${result.cancellationMark}`
        });
        await invoice.save();
        await invoice.populate(['customerId', 'clientId']);
        return res.json({ success: true, message: 'Invoice cancelled via Parochos', cancellationMark: result.cancellationMark, invoice });
      } catch (err) {
        const notCancellable = err instanceof ParochosError && err.code === 'NOT_CANCELLABLE';
        return res.status(notCancellable ? 400 : 502).json({ success: false, message: err.message });
      }
    }

    // Get user settings for AADE credentials
    const settings = await Settings.findOne({ userId: req.user.userId });

    // Same credential resolution as sending (Settings first, then server env)
    const creds = resolveAadeCredentials(settings);
    if (!creds.ok) {
      return res.status(400).json({
        success: false,
        code: 'AADE_NOT_CONFIGURED',
        message: `${creds.message} Cannot cancel the invoice in AADE.`
      });
    }
    const userCredentials = creds.credentials;
    console.log(`🔑 Using AADE credentials from: ${creds.source === 'settings' ? 'Settings' : 'server environment'}`);

    // Call AADE cancellation
    const cancellationResult = await aadeService.cancelInvoice(
      invoice.aadeInfo.mark,
      userCredentials
    );

    if (cancellationResult.success) {
      console.log('✅ AADE cancellation successful:', cancellationResult.cancellationMark);

      // Update invoice with cancellation info
      invoice.aadeStatus = 'cancelled';
      invoice.status = 'cancelled';
      invoice.aadeInfo.cancelledByMark = cancellationResult.cancellationMark;

      invoice.modifications.push({
        action: 'cancelled',
        userId: req.user.userId,
        description: `Cancelled in AADE with cancellation MARK: ${cancellationResult.cancellationMark}`
      });

      await invoice.save();

      await invoice.populate(['customerId', 'clientId']);

      return res.json({
        success: true,
        message: 'Invoice successfully cancelled in AADE',
        cancellationMark: cancellationResult.cancellationMark,
        invoice
      });

    } else {
      // AADE rejected cancellation
      console.error('❌ AADE rejected cancellation:', cancellationResult.errors);

      return res.status(400).json({
        success: false,
        message: 'AADE rejected invoice cancellation',
        errors: cancellationResult.errors
      });
    }

  } catch (error) {
    console.error('💥 Cancel AADE invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel invoice in AADE',
      error: error.message
    });
  }
};

// @desc    Refresh e-invoicing provider status (e.g. invoice still processing at Parochos)
// @route   POST /api/invoices/:id/provider-status
// @access  Private
const refreshInvoiceProviderStatus = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    const r = await einvoiceService.refreshProviderStatus(invoice);
    if (r.outcome === 'error') {
      return res.status(r.httpStatus || 400).json({ success: false, message: r.message });
    }
    await invoice.populate(['customerId', 'clientId']);
    res.json({ success: r.outcome === 'transmitted', outcome: r.outcome, errors: r.errors, invoice });
  } catch (error) {
    console.error('Provider status error:', error.message);
    res.status(502).json({ success: false, message: `Failed to refresh provider status: ${error.message}` });
  }
};

module.exports = {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  markInvoicePaid,
  getInvoiceStats,
  getNextInvoiceNumber,
  previewInvoice,
  cancelAADEInvoice,
  refreshInvoiceProviderStatus
};