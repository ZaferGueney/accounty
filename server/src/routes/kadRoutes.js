const express = require('express');
const {
  getKADs,
  getKAD,
  createKAD,
  updateKAD,
  deleteKAD,
  bulkUploadKADs,
  getSections,
  searchKADs,
  getPopularKADs
} = require('../controllers/kadController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/', getKADs);
router.get('/popular', getPopularKADs);
router.get('/sections', getSections);
router.get('/search/:query', searchKADs);
router.get('/:code', getKAD);

// Protected routes (require authentication)
router.post('/', protect, createKAD);
router.put('/:code', protect, updateKAD);
router.delete('/:code', protect, deleteKAD);
router.post('/bulk-upload', protect, bulkUploadKADs);

module.exports = router;