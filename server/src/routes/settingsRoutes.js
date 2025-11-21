const express = require('express');
const {
  getSettings,
  createSettings,
  updateSettings,
  updateSection,
  getCompletionStatus,
  validateAFM,
  getTaxOffices,
  getActivityCodes,
  testAADEConnection
} = require('../controllers/settingsController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Settings CRUD
router.route('/')
  .get(getSettings)
  .post(createSettings)
  .put(updateSettings);

// Update specific section
router.put('/section/:section', updateSection);

// Completion status
router.get('/completion', getCompletionStatus);

// Validation endpoints
router.get('/validate/afm/:afm', validateAFM);

// Helper data endpoints
router.get('/tax-offices', getTaxOffices);
router.get('/activity-codes', getActivityCodes);

// AADE myDATA connection test
router.post('/test-aade-connection', testAADEConnection);

module.exports = router;