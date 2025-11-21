const express = require('express');
const {
  getBanks,
  getBank,
  getDefaultBank,
  createBank,
  updateBank,
  deleteBank,
  setDefaultBank
} = require('../controllers/bankingController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Banking CRUD
router.route('/')
  .get(getBanks)
  .post(createBank);

// Get default bank
router.get('/default', getDefaultBank);

// Single bank operations
router.route('/:id')
  .get(getBank)
  .put(updateBank)
  .delete(deleteBank);

// Set default bank
router.put('/:id/set-default', setDefaultBank);

module.exports = router;
