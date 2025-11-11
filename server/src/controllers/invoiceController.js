const Invoice = require('../models/invoiceModel');
const Customer = require('../models/customerModel');
const Settings = require('../models/settingsModel');
const pdfService = require('../services/pdfService');
const path = require('path');
const fs = require('fs').promises;

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
      aadeStatus 
    } = req.query;
    
    const userId = req.user.userId;
    let query = { userId };

    // Apply filters
    if (status) query.status = status;
    if (clientId) query.clientId = clientId;
    if (customerId) query.customerId = customerId;
    if (aadeStatus) query.aadeStatus = aadeStatus;
    
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
    if (!settings?.taxSettings?.afm) {
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

    // Build issuer info from settings
    const issuer = {
      vatNumber: settings.taxSettings.afm,
      country: 'GR',
      branch: 0,
      name: settings.businessSettings?.name || `${req.user.firstName} ${req.user.lastName}`,
      address: {
        street: settings.businessSettings?.address?.street,
        number: settings.businessSettings?.address?.number,
        postalCode: settings.businessSettings?.address?.postalCode,
        city: settings.businessSettings?.address?.city,
        prefecture: settings.businessSettings?.address?.prefecture,
        country: 'GR'
      },
      taxInfo: {
        afm: settings.taxSettings.afm,
        doy: settings.taxSettings.doy
      }
    };

    // Create invoice
    const invoice = await Invoice.create({
      ...invoiceData,
      userId,
      invoiceNumber,
      issuer,
      status: 'draft'
    });

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
      'counterpart', 'invoiceDetails', 'dueDate', 'notes',
      'currency', 'exchangeRate', 'payment'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        invoice[field] = req.body[field];
      }
    });

    // If changing status to sent, validate invoice is complete
    if (req.body.status === 'sent' && invoice.status === 'draft') {
      if (!invoice.counterpart || invoice.invoiceDetails.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invoice must have recipient and line items before sending'
        });
      }
    }

    if (req.body.status) {
      invoice.status = req.body.status;
    }

    await invoice.save();
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
    const userId = req.user.userId;
    const invoiceData = req.body;
    const theme = req.query.theme || 'light';

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
          doy: settings.tax.taxOffice
        }
      };
    }

    // Generate temporary invoice number for preview
    if (!invoiceData.invoiceNumber) {
      invoiceData.invoiceNumber = 'DRAFT-' + Date.now();
    }

    // Generate PDF
    const pdf = await pdfService.generateInvoicePDF(invoiceData, theme);

    // Set response headers
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-preview-${invoiceData.invoiceNumber}.pdf"`,
      'Content-Length': pdf.length
    });

    // Send PDF
    res.send(pdf);
  } catch (error) {
    console.error('Preview invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to preview invoice',
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
  previewInvoice
};