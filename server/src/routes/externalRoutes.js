const express = require('express');
const router = express.Router();
const { apiKeyAuth } = require('../middleware/apiKeyAuth');
const {
  createReceipt,
  getReceipt,
  getReceiptByExternalId,
  getReceiptPDF,
  createInvoice,
  getInvoicePDF
} = require('../controllers/externalController');

// All external routes require API key authentication
router.use(apiKeyAuth);

// Receipt routes (B2C - ticket purchases)
router.post('/receipts', createReceipt);
router.get('/receipts/by-external/:externalId', getReceiptByExternalId);
router.get('/receipts/:id/pdf', getReceiptPDF);
router.get('/receipts/:id', getReceipt);

// Invoice routes (B2B - commission invoices for host payouts)
router.post('/invoices', createInvoice);
router.get('/invoices/:id/pdf', getInvoicePDF);

module.exports = router;
