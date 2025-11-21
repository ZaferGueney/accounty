const Invoice = require('../models/invoiceModel');
const Customer = require('../models/customerModel');
const Client = require('../models/clientModel');
const Settings = require('../models/settingsModel');
const Banking = require('../models/bankingModel');
const pdfService = require('../services/pdfService');
const aadeService = require('../services/aadeService');
const aadeTransformer = require('../services/aadeTransformer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Decrypt AADE subscription key from Settings
const ENCRYPTION_KEY = process.env.AADE_ENCRYPTION_KEY || 'accounty-aade-encryption-key-2024-change-in-prod';
const ALGORITHM = 'aes-256-cbc';

const decryptKey = (encryptedText) => {
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
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
const createInvoice = async (req, res) => {
  try {
    const userId = req.user.userId;
    const invoiceData = req.body;

    // Get user settings for issuer info
    const settings = await Settings.findOne({ userId });
    if (!settings?.tax?.afm) {
      return res.status(400).json({
        success: false,
        message: 'Please complete your tax settings before creating invoices'
      });
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

    // Generate invoice number
    const invoiceNumber = await Invoice.generateInvoiceNumber(
      userId,
      invoiceData.series || 'A'
    );

    // Get all active banking information
    const userBanks = await Banking.getUserBanks(userId);
    const bankingInfo = userBanks.map(bank => ({
      accountName: bank.accountName,
      bankName: bank.bankName,
      iban: bank.iban,
      swift: bank.swift,
      isDefault: bank.isDefault
    }));

    // Build issuer info from settings
    const issuer = {
      vatNumber: settings.tax.afm, // Business AFM (E.E.)
      country: 'GR',
      branch: 0,
      name: settings.business?.legalName || settings.business?.tradingName || `${req.user.firstName} ${req.user.lastName}`,
      legalForm: settings.business?.legalForm || '',
      address: {
        street: settings.address?.street,
        number: settings.address?.number,
        postalCode: settings.address?.postalCode,
        city: settings.address?.city,
        prefecture: settings.address?.prefecture,
        country: 'GR'
      },
      taxInfo: {
        afm: settings.tax.afm, // Business AFM (E.E.)
        doy: settings.tax.doy,
        gemi: settings.tax.gemi
      },
      activityCodes: settings.tax?.activityCodes || [],
      banking: bankingInfo
    };

    console.log('📋 Invoice will be issued FROM:', {
      businessName: issuer.name,
      businessAFM: issuer.vatNumber,
      note: 'This is the ISSUER of the invoice (from Settings)'
    });

    // For drafts, ensure line items have default values
    if (invoiceData.status === 'draft' || !invoiceData.status) {
      invoiceData.invoiceDetails = (invoiceData.invoiceDetails || []).map(detail => ({
        ...detail,
        description: detail.description || '',
        unitPrice: detail.unitPrice || 0,
        netValue: detail.netValue || 0,
        vatAmount: detail.vatAmount || 0
      }));
      
      // Ensure counterpart has at least empty values for draft
      if (!invoiceData.counterpart?.name) {
        invoiceData.counterpart = {
          ...invoiceData.counterpart,
          name: ''
        };
      }
    }


    // Create invoice
    const invoice = await Invoice.create({
      ...invoiceData,
      userId,
      invoiceNumber,
      issuer,
      status: invoiceData.status || 'draft'
    });

    // If status is 'sent', submit to AADE
    if (invoiceData.status === 'sent') {
      try {
        console.log('📤 Submitting invoice to AADE...', invoice.invoiceNumber);

        // Check for AADE credentials in Settings OR .env
        const hasSettingsCredentials = settings?.aadeCredentials?.isConfigured &&
                                       settings.aadeCredentials?.username &&
                                       settings.aadeCredentials?.subscriptionKey;

        const hasEnvCredentials = process.env.NODE_ENV === 'production'
          ? (process.env.AADE_PROD_USER_ID && process.env.AADE_PROD_KEY)
          : (process.env.AADE_DEV_USER_ID && process.env.AADE_DEV_KEY);

        // Return error only if NEITHER Settings NOR .env has credentials
        if (!hasSettingsCredentials && !hasEnvCredentials) {
          invoice.status = 'draft';
          await invoice.save();

          return res.status(400).json({
            success: false,
            message: 'AADE credentials not configured. Please configure your myDATA credentials in Settings or .env file.',
            invoice
          });
        }

        // 1. Transform invoice to AADE XML format
        const aadeXML = aadeTransformer.invoiceToXML(invoice.toObject());

        // 2. Build credentials from Settings (priority) or .env (fallback)
        const userCredentials = hasSettingsCredentials
          ? {
              username: settings.aadeCredentials.username,
              subscriptionKey: decryptKey(settings.aadeCredentials.subscriptionKey),
              environment: settings.aadeCredentials.environment || 'development'
            }
          : {
              username: process.env.NODE_ENV === 'production'
                ? process.env.AADE_PROD_USER_ID
                : process.env.AADE_DEV_USER_ID,
              subscriptionKey: process.env.NODE_ENV === 'production'
                ? process.env.AADE_PROD_KEY
                : process.env.AADE_DEV_KEY,
              environment: process.env.NODE_ENV || 'development'
            };

        console.log(`🔑 Using AADE credentials from: ${hasSettingsCredentials ? 'Settings' : '.env file'}`);

        // 3. Submit to AADE API with user's credentials
        const aadeResponse = await aadeService.sendInvoices(aadeXML, userCredentials);

        // 3. Handle AADE response
        if (aadeResponse.success) {
          console.log('✅ AADE submission successful:', aadeResponse.mark);

          // Generate QR code from AADE data
          const qrCode = await aadeService.generateQRCode(
            aadeResponse.mark,
            aadeResponse.uid,
            aadeResponse.authenticationCode
          );

          // NOW set status to sent since AADE succeeded
          invoice.status = 'sent';

          // Update invoice with AADE data
          await invoice.markTransmitted({
            mark: aadeResponse.mark,
            uid: aadeResponse.uid,
            authenticationCode: aadeResponse.authenticationCode,
            qrUrl: qrCode
          });

        } else {
          // AADE rejected the invoice - keep as draft
          console.error('❌ AADE rejected invoice:', aadeResponse.errors);

          invoice.status = 'draft';
          invoice.aadeStatus = 'failed';
          invoice.aadeInfo.transmissionFailure = 'validation';
          await invoice.save();

          // Populate before returning error
          await invoice.populate(['customerId', 'clientId']);

          return res.status(400).json({
            success: false,
            message: 'AADE rejected invoice. Invoice saved as draft - fix errors and try again.',
            errors: aadeResponse.errors,
            invoice
          });
        }

      } catch (aadeError) {
        console.error('💥 AADE submission error:', aadeError);

        invoice.status = 'draft';
        invoice.aadeStatus = 'failed';
        invoice.aadeInfo.transmissionFailure = 'network';
        await invoice.save();

        // Populate before returning error
        await invoice.populate(['customerId', 'clientId']);

        return res.status(500).json({
          success: false,
          message: `AADE submission failed: ${aadeError.message}. Invoice saved as draft - try again.`,
          invoice
        });
      }
    }

    // Populate references
    await invoice.populate(['customerId', 'clientId']);

    res.status(201).json({
      success: true,
      invoice
    });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to create invoice',
      error: error.message
    });
  }
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

    // Check if invoice can be edited
    if (invoice.aadeStatus === 'transmitted') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit invoice that has been transmitted to AADE'
      });
    }

    // Update fields
    const allowedUpdates = [
      'counterpart', 'invoiceDetails', 'dueDate', 'notes', 'footerText',
      'currency', 'exchangeRate', 'payment', 'vatRegulation', 'invoiceType',
      'series', 'issueDate', 'totals', 'hideBankDetails'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        invoice[field] = req.body[field];
      }
    });

    // Always refresh issuer data from settings to ensure legalForm and gemi are current
    const settings = await Settings.findOne({ userId: req.user.userId });
    if (settings) {
      // Get banking info
      const userBanks = await Banking.getUserBanks(req.user.userId);
      const bankingInfo = userBanks.map(bank => ({
        accountName: bank.accountName,
        bankName: bank.bankName,
        iban: bank.iban,
        swift: bank.swift,
        isDefault: bank.isDefault
      }));

      // Update issuer with current settings (ensures legalForm and gemi are always present)
      invoice.issuer = {
        vatNumber: settings.tax?.afm || invoice.issuer?.vatNumber,
        country: 'GR',
        branch: 0,
        name: settings.business?.legalName || settings.business?.tradingName || invoice.issuer?.name,
        legalForm: settings.business?.legalForm || '',
        address: {
          street: settings.address?.street || invoice.issuer?.address?.street,
          number: settings.address?.number || invoice.issuer?.address?.number,
          postalCode: settings.address?.postalCode || invoice.issuer?.address?.postalCode,
          city: settings.address?.city || invoice.issuer?.address?.city,
          prefecture: settings.address?.prefecture || invoice.issuer?.address?.prefecture,
          country: 'GR'
        },
        taxInfo: {
          afm: settings.tax?.afm || invoice.issuer?.taxInfo?.afm,
          doy: settings.tax?.doy || invoice.issuer?.taxInfo?.doy,
          gemi: settings.tax?.gemi || ''
        },
        activityCodes: settings.tax?.activityCodes || [],
        banking: bankingInfo
      };
    }

    // If changing status to sent, validate invoice is complete
    if (req.body.status === 'sent' && invoice.status === 'draft') {
      if (!invoice.counterpart?.name || invoice.invoiceDetails.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invoice must have recipient and line items before sending'
        });
      }
      
      // Validate all line items have descriptions and prices
      const invalidLines = invoice.invoiceDetails.filter(line => !line.description || line.unitPrice === 0);
      if (invalidLines.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'All invoice lines must have descriptions and prices before sending'
        });
      }
    }

    // Handle status change and AADE submission
    const wantsToSend = req.body.status === 'sent';
    const shouldTryAADE = wantsToSend && (invoice.status !== 'sent' || invoice.aadeStatus === 'failed');

    // Update other fields first
    if (req.body.status && req.body.status !== 'sent') {
      invoice.status = req.body.status;
    }

    await invoice.save();

    // If user wants to send, try AADE submission
    if (shouldTryAADE) {
      try {
        console.log('📤 Submitting updated invoice to AADE...', invoice.invoiceNumber);

        // Get user settings for AADE credentials
        const settings = await Settings.findOne({ userId: req.user.userId });

        // Check for AADE credentials in Settings OR .env
        const hasSettingsCredentials = settings?.aadeCredentials?.isConfigured &&
                                       settings.aadeCredentials?.username &&
                                       settings.aadeCredentials?.subscriptionKey;

        const hasEnvCredentials = process.env.NODE_ENV === 'production'
          ? (process.env.AADE_PROD_USER_ID && process.env.AADE_PROD_KEY)
          : (process.env.AADE_DEV_USER_ID && process.env.AADE_DEV_KEY);

        // Return error only if NEITHER Settings NOR .env has credentials
        if (!hasSettingsCredentials && !hasEnvCredentials) {
          invoice.status = 'draft';
          await invoice.save();
          await invoice.populate(['customerId', 'clientId']);

          return res.status(400).json({
            success: false,
            message: 'AADE credentials not configured. Please configure your myDATA credentials in Settings or .env file.',
            invoice
          });
        }

        // 1. Transform invoice to AADE XML format
        const aadeXML = aadeTransformer.invoiceToXML(invoice.toObject());
        console.log('📝 Generated XML (first 500 chars):', aadeXML.substring(0, 500));

        // 2. Build credentials from Settings (priority) or .env (fallback)
        const userCredentials = hasSettingsCredentials
          ? {
              username: settings.aadeCredentials.username,
              subscriptionKey: decryptKey(settings.aadeCredentials.subscriptionKey),
              environment: settings.aadeCredentials.environment || 'development'
            }
          : {
              username: process.env.NODE_ENV === 'production'
                ? process.env.AADE_PROD_USER_ID
                : process.env.AADE_DEV_USER_ID,
              subscriptionKey: process.env.NODE_ENV === 'production'
                ? process.env.AADE_PROD_KEY
                : process.env.AADE_DEV_KEY,
              environment: process.env.NODE_ENV || 'development'
            };

        console.log(`🔑 Using AADE credentials from: ${hasSettingsCredentials ? 'Settings' : '.env file'}`);

        // 3. Submit to AADE API with user's credentials
        const aadeResponse = await aadeService.sendInvoices(aadeXML, userCredentials);

        // 3. Handle AADE response
        if (aadeResponse.success) {
          console.log('✅ AADE submission successful:', aadeResponse.mark);

          // Generate QR code from AADE data
          const qrCode = await aadeService.generateQRCode(
            aadeResponse.mark,
            aadeResponse.uid,
            aadeResponse.authenticationCode
          );

          // NOW set status to sent since AADE succeeded
          invoice.status = 'sent';

          // Update invoice with AADE data
          await invoice.markTransmitted({
            mark: aadeResponse.mark,
            uid: aadeResponse.uid,
            authenticationCode: aadeResponse.authenticationCode,
            qrUrl: qrCode
          });

        } else {
          // AADE rejected the invoice - keep as draft
          console.error('❌ AADE rejected invoice:', aadeResponse.errors);

          invoice.status = 'draft';
          invoice.aadeStatus = 'failed';
          invoice.aadeInfo.transmissionFailure = 'validation';
          await invoice.save();

          // Populate before returning error
          await invoice.populate(['customerId', 'clientId']);

          return res.status(400).json({
            success: false,
            message: 'AADE rejected invoice. Invoice saved as draft - fix errors and try again.',
            errors: aadeResponse.errors,
            invoice
          });
        }

      } catch (aadeError) {
        console.error('💥 AADE submission error:', aadeError);

        invoice.status = 'draft';
        invoice.aadeStatus = 'failed';
        invoice.aadeInfo.transmissionFailure = 'network';
        await invoice.save();

        // Populate before returning error
        await invoice.populate(['customerId', 'clientId']);

        return res.status(500).json({
          success: false,
          message: `AADE submission failed: ${aadeError.message}. Invoice saved as draft - try again.`,
          invoice
        });
      }
    }

    await invoice.populate(['customerId', 'clientId']);

    res.json({
      success: true,
      invoice
    });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(400).json({
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
    console.log('📄 Starting PDF preview generation...');
    const userId = req.user.userId;
    const invoiceData = req.body;
    const theme = req.query.theme || 'light';

    console.log('📋 Invoice data received:', {
      userId,
      theme,
      hasInvoiceData: !!invoiceData,
      invoiceNumber: invoiceData?.invoiceNumber,
      counterpartName: invoiceData?.counterpart?.name,
      itemsCount: invoiceData?.invoiceDetails?.length || 0,
      totalsPresent: !!invoiceData?.totals
    });

    // ALWAYS fetch banking information (needed for PDF)
    const userBanks = await Banking.getUserBanks(userId);
    const bankingInfo = userBanks.map(bank => ({
      accountName: bank.accountName,
      bankName: bank.bankName,
      iban: bank.iban,
      swift: bank.swift,
      isDefault: bank.isDefault
    }));

    // Get user settings for issuer info if not provided
    if (!invoiceData.issuer) {
      const settings = await Settings.findOne({ userId });
      if (!settings?.tax?.afm) {
        return res.status(400).json({
          success: false,
          message: 'Please complete your tax settings before previewing invoices'
        });
      }

      invoiceData.issuer = {
        vatNumber: settings.tax.afm,
        country: 'GR',
        branch: 0,
        name: settings.business?.legalName || settings.business?.tradingName || `${req.user.firstName} ${req.user.lastName}`,
        legalForm: settings.business?.legalForm || '',
        address: {
          street: settings.address?.street,
          number: settings.address?.number,
          postalCode: settings.address?.postalCode,
          city: settings.address?.city,
          prefecture: settings.address?.prefecture,
          country: 'GR'
        },
        taxInfo: {
          afm: settings.tax.afm,
          doy: settings.tax.doy,
          gemi: settings.tax.gemi
        },
        activityCodes: settings.tax?.activityCodes || [],
        banking: bankingInfo
      };
    } else {
      // Issuer exists from frontend, just attach banking
      invoiceData.issuer.banking = bankingInfo;
    }

    // Generate temporary invoice number for preview
    if (!invoiceData.invoiceNumber) {
      invoiceData.invoiceNumber = 'DRAFT-' + Date.now();
      console.log('🔢 Generated temporary invoice number:', invoiceData.invoiceNumber);
    }

    console.log('🔄 Calling PDF service to generate PDF...');
    // Get language from query params or user preferences
    const language = req.query.lang || req.user?.preferences?.language || 'en';
    console.log('🌐 Using language:', language);

    // Only show watermark for draft invoices, not for sent/transmitted ones
    const isPreview = !(invoiceData.status === 'sent' || invoiceData.aadeStatus === 'transmitted');
    console.log('📄 Preview mode:', isPreview, '(status:', invoiceData.status, ', aadeStatus:', invoiceData.aadeStatus + ')');

    // Generate PDF using the PDF service
    const pdfBuffer = await pdfService.generateInvoicePDF(invoiceData, theme, isPreview, language);

    console.log('✅ PDF generated successfully:', {
      bufferSize: pdfBuffer.length,
      sizeInKB: Math.round(pdfBuffer.length / 1024)
    });
    
    // Set headers for PDF response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${invoiceData.invoiceNumber || 'draft'}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    // Send PDF buffer
    res.send(pdfBuffer);
    console.log('📨 PDF sent to client successfully');
  } catch (error) {
    console.error('💥 Preview invoice error:', {
      message: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      invoiceNumber: req.body?.invoiceNumber
    });
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

    // Check if invoice is transmitted to AADE
    if (invoice.aadeStatus !== 'transmitted') {
      return res.status(400).json({
        success: false,
        message: 'Only invoices transmitted to AADE can be cancelled via this endpoint. Use regular delete for non-transmitted invoices.'
      });
    }

    // Check if already cancelled
    if (invoice.aadeStatus === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Invoice is already cancelled in AADE'
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

    // Get user settings for AADE credentials
    const settings = await Settings.findOne({ userId: req.user.userId });

    // Check for AADE credentials in Settings OR .env
    const hasSettingsCredentials = settings?.aadeCredentials?.isConfigured &&
                                   settings.aadeCredentials?.username &&
                                   settings.aadeCredentials?.subscriptionKey;

    const hasEnvCredentials = process.env.AADE_USER_ID &&
                             (process.env.AADE_KEY || process.env.AADE);

    if (!hasSettingsCredentials && !hasEnvCredentials) {
      return res.status(400).json({
        success: false,
        message: 'AADE credentials not configured. Cannot cancel invoice in AADE.'
      });
    }

    // Build credentials from Settings (priority) or .env (fallback)
    const userCredentials = hasSettingsCredentials
      ? {
          username: settings.aadeCredentials.username,
          subscriptionKey: decryptKey(settings.aadeCredentials.subscriptionKey),
          environment: settings.aadeCredentials.environment || 'development'
        }
      : {
          username: process.env.AADE_USER_ID,
          subscriptionKey: process.env.AADE_KEY || process.env.AADE,
          environment: process.env.NODE_ENV || 'development'
        };

    console.log(`🔑 Using AADE credentials from: ${hasSettingsCredentials ? 'Settings' : '.env file'}`);

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
  cancelAADEInvoice
};