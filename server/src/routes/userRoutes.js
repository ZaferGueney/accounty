const express = require('express');
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  getSubscriptionStatus,
  changePassword,
  updateEmail,
  updateNames,
  deleteAccount,
  refreshToken,
  logoutUser,
  getCurrentUser
} = require('../controllers/userController');
const { protect, requireActiveSubscription } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/refresh', refreshToken); // Public route for token refresh

// Protected routes (require authentication)
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.get('/subscription', protect, getSubscriptionStatus);
router.get('/me', protect, getCurrentUser); // Current user endpoint
router.post('/logout', protect, logoutUser); // Logout endpoint

// Account management routes
router.put('/password', protect, changePassword);
router.put('/email', protect, updateEmail);
router.put('/names', protect, updateNames);
router.delete('/account', protect, deleteAccount);

// Example of premium feature route (requires active subscription)
// router.get('/premium-feature', protect, requireActiveSubscription, someController);

module.exports = router;