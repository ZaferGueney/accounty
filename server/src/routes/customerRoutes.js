const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  searchCustomers
} = require('../controllers/customerController');

// Protect all routes
router.use(protect);

// Search route (must be before /:id)
router.get('/search', searchCustomers);

// CRUD routes
router.route('/')
  .get(getCustomers)
  .post(createCustomer);

router.route('/:id')
  .get(getCustomer)
  .put(updateCustomer)
  .delete(deleteCustomer);

module.exports = router;