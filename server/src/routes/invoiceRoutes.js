const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
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
} = require('../controllers/invoiceController');

// Protect all routes
router.use(protect);

// Special routes (before /:id)
router.get('/stats', getInvoiceStats);
router.get('/next-number', getNextInvoiceNumber);
router.post('/preview', previewInvoice);

// Main routes
router.route('/')
  .get(getInvoices)
  .post(createInvoice);

router.route('/:id')
  .get(getInvoice)
  .put(updateInvoice)
  .delete(deleteInvoice);

// Action routes
router.post('/:id/pay', markInvoicePaid);
router.post('/:id/cancel-aade', cancelAADEInvoice);

module.exports = router;