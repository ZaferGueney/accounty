const Invoice = require('../models/invoiceModel');
const Settings = require('../models/settingsModel');
const Banking = require('../models/bankingModel');
const aadeService = require('../services/aadeService');
const aadeTransformer = require('../services/aadeTransformer');
const pdfService = require('../services/pdfService');

/**
 * Create a receipt from external app (GuestCode)
 * POST /api/external/receipts
 */
const createReceipt = async (req, res) => {
  try {
    const userId = req.user.userId;
    const source = req.apiSource || 'api';

    const {
      customer,
      items,
      payment,
      eventName,
      eventDate,
      orderId
    } = req.body;

    // Validate required fields
    if (!customer || !items || !items.length || !payment) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: customer, items, payment'
      });
    }

    // Check for duplicate (idempotency)
    if (payment.stripeSessionId) {
      const existing = await Invoice.findOne({
        userId,
        externalId: payment.stripeSessionId
      });
      if (existing) {
        return res.status(200).json({
          success: true,
          message: 'Receipt already exists',
          receipt: {
            id: existing._id,
            receiptNumber: existing.invoiceNumber,
            mark: existing.aadeInfo?.mark,
            qrCode: existing.aadeInfo?.qrUrl,
            status: existing.aadeStatus
          }
        });
      }
    }

    // Get user settings for issuer data
    const settings = await Settings.findOne({ userId });
    if (!settings || !settings.tax?.afm) {
      return res.status(400).json({
        success: false,
        message: 'User tax settings not configured'
      });
    }

    // Get banking info
    const userBanks = await Banking.getUserBanks(userId);
    const bankingInfo = userBanks.map(bank => ({
      accountName: bank.accountName,
      bankName: bank.bankName,
      iban: bank.iban,
      swift: bank.swift,
      isDefault: bank.isDefault
    }));

    // Generate receipt number (R series for receipts from external sources)
    const receiptNumber = await Invoice.generateInvoiceNumber(userId, 'R');

    // Build issuer from settings
    const issuer = {
      vatNumber: settings.tax.afm,
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
        afm: settings.tax.afm,
        doy: settings.tax.doy || { code: '', name: '' },
        gemi: settings.tax.gemi || ''
      },
      activityCodes: settings.tax?.activityCodes || [],
      banking: bankingInfo
    };

    // Build counterpart from customer data (simplified for B2C)
    const counterpart = {
      name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email,
      vatNumber: customer.afm || '', // Usually empty for B2C
      country: customer.address?.country || 'GR',
      branch: 0,
      address: {
        street: customer.address?.street || customer.address?.line1 || '',
        number: customer.address?.number || '',
        postalCode: customer.address?.postalCode || customer.address?.postal_code || '',
        city: customer.address?.city || '',
        prefecture: customer.address?.state || '',
        country: customer.address?.country || 'GR'
      },
      taxInfo: {
        afm: customer.afm || '',
        doy: { code: '', name: '' }
      },
      email: customer.email
    };

    // Build invoice details from items
    const invoiceDetails = items.map((item, index) => {
      const netValue = item.quantity * item.unitPrice;
      const vatRate = getVatRate(item.vatCategory || '1');
      const vatAmount = netValue * vatRate;

      return {
        lineNumber: index + 1,
        description: item.description || `${eventName || 'Event'} Ticket`,
        itemDescription: item.itemDescription || (eventDate ? `Event Date: ${eventDate}` : ''),
        quantity: item.quantity || 1,
        unit: item.unit || 'pcs',
        unitPrice: item.unitPrice || 0,
        netValue: netValue,
        vatCategory: item.vatCategory || '1', // 24% default
        vatAmount: vatAmount,
        incomeClassification: [{
          classificationType: 'E3_561_001', // Revenue from sales
          categoryId: 'category1_1', // Product sales
          amount: netValue
        }]
      };
    });

    // Calculate totals
    const totalNetValue = invoiceDetails.reduce((sum, item) => sum + item.netValue, 0);
    const totalVatAmount = invoiceDetails.reduce((sum, item) => sum + item.vatAmount, 0);
    const totalAmount = totalNetValue + totalVatAmount;

    // Create the receipt invoice
    const receipt = await Invoice.create({
      userId,
      invoiceNumber: receiptNumber,
      series: 'R',
      invoiceType: '11.2', // Retail Service Receipt
      source,
      externalId: payment.stripeSessionId || null,
      externalOrderId: orderId || null,
      issueDate: new Date(),
      dueDate: new Date(), // Receipts are paid immediately
      issuer,
      counterpart,
      invoiceDetails,
      totals: {
        totalNetValue,
        totalVatAmount,
        totalWithheldAmount: 0,
        totalFeesAmount: 0,
        totalOtherTaxesAmount: 0,
        totalDeductionsAmount: 0,
        totalGrossValue: totalNetValue + totalVatAmount,
        totalAmount
      },
      payment: {
        method: payment.method || '4', // Credit card default for Stripe
        amount: totalAmount,
        paidDate: new Date()
      },
      status: 'paid', // Receipts are already paid
      aadeStatus: 'pending',
      currency: 'EUR',
      notes: eventName ? `Event: ${eventName}` : ''
    });

    // Submit to AADE
    let aadeResult = null;
    try {
      // Get AADE credentials
      const aadeCredentials = {
        username: settings.aade?.userId || process.env.AADE_PROD_USER_ID || process.env.AADE_DEV_USER_ID,
        subscriptionKey: settings.aade?.subscriptionKey || process.env.AADE_PROD_KEY || process.env.AADE_DEV_KEY
      };

      if (!aadeCredentials.username || !aadeCredentials.subscriptionKey) {
        console.error('AADE credentials not configured');
      } else {
        // Transform to AADE XML
        const invoiceXML = aadeTransformer.transformInvoice(receipt);

        // Send to AADE
        aadeResult = await aadeService.sendInvoices(invoiceXML, aadeCredentials);

        if (aadeResult.success) {
          // Generate QR code
          const qrCode = await aadeService.generateQRCode(
            aadeResult.mark,
            aadeResult.uid,
            aadeResult.authenticationCode
          );

          // Update receipt with AADE info
          receipt.aadeStatus = 'transmitted';
          receipt.aadeInfo = {
            mark: aadeResult.mark,
            uid: aadeResult.uid,
            authenticationCode: aadeResult.authenticationCode,
            qrUrl: qrCode
          };
          receipt.transmissionDate = new Date();
          await receipt.save();

          console.log(`✅ Receipt ${receiptNumber} transmitted to AADE with MARK: ${aadeResult.mark}`);
        } else {
          // Log error but don't fail - receipt is created
          console.error('AADE transmission failed:', aadeResult.errors);
          receipt.aadeStatus = 'failed';
          receipt.aadeInfo = {
            transmissionFailure: 'validation'
          };
          await receipt.save();
        }
      }
    } catch (aadeError) {
      console.error('AADE submission error:', aadeError);
      receipt.aadeStatus = 'failed';
      await receipt.save();
    }

    // Return response
    res.status(201).json({
      success: true,
      receipt: {
        id: receipt._id,
        receiptNumber: receipt.invoiceNumber,
        mark: receipt.aadeInfo?.mark || null,
        qrCode: receipt.aadeInfo?.qrUrl || null,
        status: receipt.aadeStatus,
        totalAmount: receipt.totals.totalAmount,
        errors: aadeResult?.errors || null
      }
    });

  } catch (error) {
    console.error('Create receipt error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create receipt'
    });
  }
};

/**
 * Get receipt by ID
 * GET /api/external/receipts/:id
 */
const getReceipt = async (req, res) => {
  try {
    const userId = req.user.userId;
    const receiptId = req.params.id;

    const receipt = await Invoice.findOne({
      _id: receiptId,
      userId
    });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    res.json({
      success: true,
      receipt: {
        id: receipt._id,
        receiptNumber: receipt.invoiceNumber,
        mark: receipt.aadeInfo?.mark || null,
        qrCode: receipt.aadeInfo?.qrUrl || null,
        status: receipt.aadeStatus,
        totalAmount: receipt.totals.totalAmount,
        issueDate: receipt.issueDate,
        customer: {
          name: receipt.counterpart.name,
          email: receipt.counterpart.email
        }
      }
    });
  } catch (error) {
    console.error('Get receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get receipt'
    });
  }
};

/**
 * Get receipt by external ID (Stripe session ID)
 * GET /api/external/receipts/by-external/:externalId
 */
const getReceiptByExternalId = async (req, res) => {
  try {
    const userId = req.user.userId;
    const externalId = req.params.externalId;

    const receipt = await Invoice.findOne({
      userId,
      externalId
    });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found for this external ID'
      });
    }

    res.json({
      success: true,
      receipt: {
        id: receipt._id,
        receiptNumber: receipt.invoiceNumber,
        mark: receipt.aadeInfo?.mark || null,
        qrCode: receipt.aadeInfo?.qrUrl || null,
        status: receipt.aadeStatus,
        totalAmount: receipt.totals.totalAmount
      }
    });
  } catch (error) {
    console.error('Get receipt by external ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get receipt'
    });
  }
};

/**
 * Download receipt PDF
 * GET /api/external/receipts/:id/pdf
 */
const getReceiptPDF = async (req, res) => {
  try {
    const userId = req.user.userId;
    const receiptId = req.params.id;

    const receipt = await Invoice.findOne({
      _id: receiptId,
      userId
    });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    // Generate PDF using simplified receipt template
    const pdf = await pdfService.generateReceiptPDF(receipt, 'en');

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${receipt.invoiceNumber}.pdf"`);
    res.setHeader('Content-Length', pdf.length);

    res.send(pdf);
  } catch (error) {
    console.error('Get receipt PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate receipt PDF'
    });
  }
};

/**
 * Create a B2B invoice from external app (GuestCode commission invoices)
 * POST /api/external/invoices
 */
const createInvoice = async (req, res) => {
  try {
    const userId = req.user.userId;
    const source = req.apiSource || 'api';

    const {
      counterpart,
      items,
      payment,
      invoiceType,
      hostId,
      reference,
      notes
    } = req.body;

    // Validate required fields
    if (!counterpart || !items || !items.length) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: counterpart, items'
      });
    }

    // Counterpart must have VAT number for B2B
    if (!counterpart.vatNumber && counterpart.country === 'GR') {
      return res.status(400).json({
        success: false,
        message: 'Greek counterpart must have AFM (vatNumber)'
      });
    }

    // Check for duplicate by reference (idempotency)
    if (reference) {
      const existing = await Invoice.findOne({
        userId,
        externalId: reference
      });
      if (existing) {
        return res.status(200).json({
          success: true,
          message: 'Invoice already exists',
          invoice: {
            id: existing._id,
            invoiceNumber: existing.invoiceNumber,
            mark: existing.aadeInfo?.mark,
            qrCode: existing.aadeInfo?.qrUrl,
            status: existing.aadeStatus
          }
        });
      }
    }

    // Get user settings for issuer data
    const settings = await Settings.findOne({ userId });
    if (!settings || !settings.tax?.afm) {
      return res.status(400).json({
        success: false,
        message: 'User tax settings not configured'
      });
    }

    // Get banking info
    const userBanks = await Banking.getUserBanks(userId);
    const bankingInfo = userBanks.map(bank => ({
      accountName: bank.accountName,
      bankName: bank.bankName,
      iban: bank.iban,
      swift: bank.swift,
      isDefault: bank.isDefault
    }));

    // Generate invoice number (A series for B2B invoices)
    const invoiceNumber = await Invoice.generateInvoiceNumber(userId, 'A');

    // Determine invoice type based on counterpart country
    let finalInvoiceType = invoiceType || '2.1';
    const counterpartCountry = counterpart.country || 'GR';

    if (!invoiceType) {
      if (counterpartCountry === 'GR') {
        finalInvoiceType = '2.1'; // Service Invoice
      } else if (['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'].includes(counterpartCountry)) {
        finalInvoiceType = '2.2'; // EU Intra-Community Service
      } else {
        finalInvoiceType = '2.3'; // Third Country Service
      }
    }

    // Build issuer from settings
    const issuer = {
      vatNumber: settings.tax.afm,
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
        afm: settings.tax.afm,
        doy: settings.tax.doy || { code: '', name: '' },
        gemi: settings.tax.gemi || ''
      },
      activityCodes: settings.tax?.activityCodes || [],
      banking: bankingInfo
    };

    // Build counterpart for B2B
    const invoiceCounterpart = {
      name: counterpart.name || counterpart.businessName,
      vatNumber: counterpart.vatNumber || counterpart.afm || '',
      country: counterpartCountry,
      branch: 0,
      address: {
        street: counterpart.address?.street || '',
        number: counterpart.address?.number || '',
        postalCode: counterpart.address?.postalCode || '',
        city: counterpart.address?.city || '',
        prefecture: counterpart.address?.state || '',
        country: counterpartCountry
      },
      taxInfo: {
        afm: counterpart.vatNumber || counterpart.afm || '',
        doy: counterpart.doy || { code: '', name: '' }
      }
    };

    // Build invoice details from items
    const invoiceDetails = items.map((item, index) => {
      const netValue = (item.quantity || 1) * item.unitPrice;

      // Determine VAT category based on invoice type
      let vatCategory = item.vatCategory || '1';
      let vatRate = getVatRate(vatCategory);

      // EU/Third country = reverse charge (no VAT)
      if (finalInvoiceType === '2.2' || finalInvoiceType === '2.3') {
        vatCategory = '7'; // 0% (reverse charge)
        vatRate = 0;
      }

      const vatAmount = netValue * vatRate;

      return {
        lineNumber: index + 1,
        description: item.description || 'Commission',
        itemDescription: item.itemDescription || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'pcs',
        unitPrice: item.unitPrice || 0,
        netValue: netValue,
        vatCategory: vatCategory,
        vatAmount: vatAmount,
        incomeClassification: [{
          classificationType: 'E3_561_001', // Revenue from sales
          categoryId: 'category1_3', // Service revenue
          amount: netValue
        }]
      };
    });

    // Calculate totals
    const totalNetValue = invoiceDetails.reduce((sum, item) => sum + item.netValue, 0);
    const totalVatAmount = invoiceDetails.reduce((sum, item) => sum + item.vatAmount, 0);
    const totalAmount = totalNetValue + totalVatAmount;

    // Create the invoice
    const invoice = await Invoice.create({
      userId,
      invoiceNumber,
      series: 'A',
      invoiceType: finalInvoiceType,
      source,
      externalId: reference || null,
      externalOrderId: hostId || null,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days
      issuer,
      counterpart: invoiceCounterpart,
      invoiceDetails,
      totals: {
        totalNetValue,
        totalVatAmount,
        totalWithheldAmount: 0,
        totalFeesAmount: 0,
        totalOtherTaxesAmount: 0,
        totalDeductionsAmount: 0,
        totalGrossValue: totalNetValue + totalVatAmount,
        totalAmount
      },
      payment: {
        method: payment?.method || '3', // Bank transfer default
        amount: 0, // Not paid yet
        paidDate: null
      },
      status: 'sent',
      aadeStatus: 'pending',
      currency: 'EUR',
      notes: notes || ''
    });

    // Submit to AADE
    let aadeResult = null;
    try {
      const aadeCredentials = {
        username: settings.aade?.userId || process.env.AADE_PROD_USER_ID || process.env.AADE_DEV_USER_ID,
        subscriptionKey: settings.aade?.subscriptionKey || process.env.AADE_PROD_KEY || process.env.AADE_DEV_KEY
      };

      if (aadeCredentials.username && aadeCredentials.subscriptionKey) {
        const invoiceXML = aadeTransformer.invoiceToXML(invoice);
        aadeResult = await aadeService.sendInvoices(invoiceXML, aadeCredentials);

        if (aadeResult.success) {
          const qrCode = await aadeService.generateQRCode(
            aadeResult.mark,
            aadeResult.uid,
            aadeResult.authenticationCode
          );

          invoice.aadeStatus = 'transmitted';
          invoice.aadeInfo = {
            mark: aadeResult.mark,
            uid: aadeResult.uid,
            authenticationCode: aadeResult.authenticationCode,
            qrUrl: qrCode
          };
          invoice.transmissionDate = new Date();
          await invoice.save();

          console.log(`✅ Invoice ${invoiceNumber} transmitted to AADE with MARK: ${aadeResult.mark}`);
        } else {
          console.error('AADE transmission failed:', aadeResult.errors);
          invoice.aadeStatus = 'failed';
          await invoice.save();
        }
      }
    } catch (aadeError) {
      console.error('AADE submission error:', aadeError);
      invoice.aadeStatus = 'failed';
      await invoice.save();
    }

    res.status(201).json({
      success: true,
      invoice: {
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceType: invoice.invoiceType,
        mark: invoice.aadeInfo?.mark || null,
        qrCode: invoice.aadeInfo?.qrUrl || null,
        status: invoice.aadeStatus,
        totalAmount: invoice.totals.totalAmount,
        errors: aadeResult?.errors || null
      }
    });

  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create invoice'
    });
  }
};

/**
 * Download invoice PDF
 * GET /api/external/invoices/:id/pdf
 */
const getInvoicePDF = async (req, res) => {
  try {
    const userId = req.user.userId;
    const invoiceId = req.params.id;

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      userId
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Generate PDF using full invoice template
    const pdf = await pdfService.generateInvoicePDF(invoice, 'light', false, 'en');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
    res.setHeader('Content-Length', pdf.length);

    res.send(pdf);
  } catch (error) {
    console.error('Get invoice PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice PDF'
    });
  }
};

// Helper function to get VAT rate from category
function getVatRate(category) {
  const rates = {
    '1': 0.24, // 24% Standard
    '2': 0.13, // 13% Reduced
    '3': 0.06, // 6% Super-reduced
    '7': 0,    // 0% Zero rate
    '8': 0     // VAT exempt
  };
  return rates[category] || 0.24;
}

module.exports = {
  createReceipt,
  getReceipt,
  getReceiptByExternalId,
  getReceiptPDF,
  createInvoice,
  getInvoicePDF
};
