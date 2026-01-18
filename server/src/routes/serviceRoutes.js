const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getServices,
  getService,
  createService,
  updateService,
  deleteService,
  searchServices,
  getRecentServices,
  trackServiceUsage
} = require('../controllers/serviceController');

// Protect all routes
router.use(protect);

// Special routes (before /:id to avoid conflicts)
router.get('/search', searchServices);
router.get('/recent', getRecentServices);

// Main CRUD routes
router.route('/')
  .get(getServices)
  .post(createService);

router.route('/:id')
  .get(getService)
  .put(updateService)
  .delete(deleteService);

// Action routes
router.post('/:id/track', trackServiceUsage);

module.exports = router;
