const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const { redisUtils } = require('../config/redis');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  try {
    let token;

    // console.log('Auth middleware - Cookies received:', req.cookies);
    // console.log('Auth middleware - Headers auth:', req.headers.authorization);

    // Check for token in cookies first (preferred method)
    if (req.cookies?.accounty_access_token) {
      token = req.cookies.accounty_access_token;
      // console.log('Auth middleware - Token found in cookies');
    }
    // Fallback to Authorization header for backward compatibility
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      // console.log('Auth middleware - Token found in header');
    }

    if (!token) {
      // console.log('Auth middleware - No token found');
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify access token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'accounty-secret-key');
    
    // Try to get user from Redis cache first
    let user = await redisUtils.getUserCache(decoded.userId);
    
    if (!user) {
      // If not in cache, get from database
      const dbUser = await User.findById(decoded.userId);
      if (!dbUser) {
        return res.status(401).json({
          success: false,
          message: 'Token is no longer valid. User not found.'
        });
      }
      
      user = dbUser.toObject();
      delete user.password;
      
      // Cache the user for future requests
      await redisUtils.setUserCache(decoded.userId, user, 3600); // Cache for 1 hour
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    // Add user to request
    req.user = { userId: user._id, user };
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    // If access token is expired, return specific error for frontend to handle
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Access token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: error.message
    });
  }
};

// Check if user has active subscription
const requireActiveSubscription = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user.hasActiveSubscription() && user.subscription.plan !== 'free') {
      return res.status(403).json({
        success: false,
        message: 'Active subscription required for this feature',
        subscriptionStatus: user.subscription.status
      });
    }

    next();
  } catch (error) {
    console.error('Subscription check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error checking subscription',
      error: error.message
    });
  }
};

module.exports = {
  protect,
  requireActiveSubscription
};