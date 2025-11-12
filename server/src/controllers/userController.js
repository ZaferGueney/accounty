const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/userModel');
const { redisUtils } = require('../config/redis');

// Generate JWT tokens
const generateAccessToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'accounty-secret-key', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d' // Use environment variable or default to 7 days
  });
};

const generateRefreshToken = (userId) => {
  const tokenId = crypto.randomUUID();
  const token = jwt.sign({ userId, tokenId }, process.env.JWT_REFRESH_SECRET || 'accounty-refresh-secret-key', {
    expiresIn: '7d' // Long-lived refresh token
  });
  return { token, tokenId };
};

// Send response with user data and tokens
const sendTokenResponse = async (user, statusCode, res, req) => {
  const accessToken = generateAccessToken(user._id);
  const { token: refreshToken, tokenId } = generateRefreshToken(user._id);
  
  // Store refresh token in Redis
  await redisUtils.setRefreshToken(user._id.toString(), tokenId, 604800); // 7 days
  
  // Cache user data in Redis
  const userObject = user.toObject();
  delete userObject.password;
  await redisUtils.setUserCache(user._id.toString(), userObject, 3600); // 1 hour
  
  // Set httpOnly cookies for tokens
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    domain: process.env.NODE_ENV === 'production' ? undefined : undefined // Allow for localhost
  };

  // Set refresh token cookie (long-lived)
  res.cookie('accounty_refresh_token', refreshToken, cookieOptions);
  console.log('Setting refresh token cookie:', refreshToken.substring(0, 20) + '...');
  
  // Set access token cookie (same duration as JWT)
  res.cookie('accounty_access_token', accessToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days to match JWT expiration
  });
  console.log('Setting access token cookie:', accessToken.substring(0, 20) + '...');
  
  // Store session data in Redis (manual session management)
  if (req) {
    await redisUtils.setSession(`session:${user._id}`, {
      userId: user._id.toString(),
      lastActivity: new Date(),
      userAgent: req.headers['user-agent'] || 'unknown'
    }, 604800); // 7 days
  }
  
  res.status(statusCode).json({
    success: true,
    user: userObject,
    // Also send tokens in response for frontend compatibility
    accessToken,
    token: accessToken // Keep for backward compatibility
  });
};

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName, company } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      company
    });

    await sendTokenResponse(user, 201, res, req);
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
};

// @desc    Login user
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Check subscription status for premium features
    const hasActiveSubscription = user.hasActiveSubscription();
    if (!hasActiveSubscription && user.subscription.plan !== 'free') {
      // Allow login but with limited access
      console.log(`User ${user.email} logged in with expired subscription`);
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    await sendTokenResponse(user, 200, res, req);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Try to get user from Redis cache first
    let userObject = await redisUtils.getUserCache(userId);
    
    if (!userObject) {
      // If not in cache, get from database
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Remove password from response and cache the user
      userObject = user.toObject();
      delete userObject.password;
      await redisUtils.setUserCache(userId, userObject, 3600); // Cache for 1 hour
    }

    res.json({
      success: true,
      user: userObject
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const { firstName, lastName, company, preferences, taxSettings } = req.body;
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (company !== undefined) user.company = company;
    if (preferences) user.preferences = { ...user.preferences, ...preferences };
    if (taxSettings) user.taxSettings = { ...user.taxSettings, ...taxSettings };

    await user.save();

    // Remove password from response
    const userObject = user.toObject();
    delete userObject.password;

    res.json({
      success: true,
      user: userObject
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Check subscription status
// @route   GET /api/users/subscription
// @access  Private
const getSubscriptionStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const hasActiveSubscription = user.hasActiveSubscription();
    
    res.json({
      success: true,
      subscription: user.subscription,
      isActive: hasActiveSubscription,
      daysRemaining: user.subscription.endDate ? 
        Math.ceil((user.subscription.endDate - new Date()) / (1000 * 60 * 60 * 24)) : 0
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Change user password
// @route   PUT /api/users/password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password (will be hashed by pre-save middleware)
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update user email
// @route   PUT /api/users/email
// @access  Private
const updateEmail = async (req, res) => {
  try {
    const { newEmail, password } = req.body;

    if (!newEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'New email and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Password is incorrect'
      });
    }

    // Check if email is already taken
    const existingUser = await User.findOne({ 
      email: newEmail.toLowerCase(),
      _id: { $ne: user._id }
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email is already registered'
      });
    }

    // Update email
    user.email = newEmail.toLowerCase();
    user.isEmailVerified = false; // Reset verification status
    await user.save();

    // Clear user cache to force refresh
    await redisUtils.deleteUserCache(req.user.userId);

    // Get fresh user data
    const updatedUser = user.toJSON();
    delete updatedUser.password;

    // Cache the updated user
    await redisUtils.setUserCache(req.user.userId, updatedUser, 3600);

    res.json({
      success: true,
      message: 'Email updated successfully. Please verify your new email.',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update email error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update user names
// @route   PUT /api/users/names
// @access  Private
const updateNames = async (req, res) => {
  try {
    const { firstName, lastName } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'First name and last name are required'
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update names
    user.firstName = firstName.trim();
    user.lastName = lastName.trim();
    await user.save();

    // Clear user cache to force refresh
    await redisUtils.deleteUserCache(req.user.userId);

    // Get fresh user data with virtual fields
    const updatedUser = user.toJSON();
    delete updatedUser.password;

    // Cache the updated user
    await redisUtils.setUserCache(req.user.userId, updatedUser, 3600);

    res.json({
      success: true,
      message: 'Names updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update names error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Delete user account
// @route   DELETE /api/users/account
// @access  Private
const deleteAccount = async (req, res) => {
  try {
    const { password, confirmText } = req.body;

    if (!password || confirmText !== 'DELETE') {
      return res.status(400).json({
        success: false,
        message: 'Password and confirmation text "DELETE" are required'
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Password is incorrect'
      });
    }

    // Prevent admin deletion (optional safety check)
    if (user.isAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin accounts cannot be deleted'
      });
    }

    // Soft delete - deactivate account instead of permanent deletion
    user.isActive = false;
    user.email = `deleted_${Date.now()}_${user.email}`;
    await user.save();

    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Refresh access token using refresh token
// @route   POST /api/users/refresh
// @access  Public (uses refresh token)
const refreshToken = async (req, res) => {
  try {
    // Get refresh token from cookie or header
    let refreshToken = req.cookies?.accounty_refresh_token;
    
    if (!refreshToken && req.headers.authorization) {
      refreshToken = req.headers.authorization.replace('Bearer ', '');
    }

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'No refresh token provided'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'accounty-refresh-secret-key');
    
    // Check if refresh token exists in Redis
    const isValidToken = await redisUtils.isRefreshTokenValid(decoded.userId, decoded.tokenId);
    if (!isValidToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token has been revoked'
      });
    }

    // Try to get user from cache first
    let userObject = await redisUtils.getUserCache(decoded.userId);
    
    if (!userObject) {
      // If not in cache, get from database
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User not found or account deactivated'
        });
      }
      
      userObject = user.toObject();
      delete userObject.password;
      await redisUtils.setUserCache(decoded.userId, userObject, 3600); // Cache for 1 hour
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(decoded.userId);
    
    // Set new access token cookie
    res.cookie('accounty_access_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.json({
      success: true,
      accessToken: newAccessToken,
      token: newAccessToken, // For compatibility
      user: userObject
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
};

// @desc    Logout user and clear cookies
// @route   POST /api/users/logout
// @access  Private
const logoutUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get and decode refresh token to revoke it
    const refreshToken = req.cookies?.accounty_refresh_token;
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'accounty-refresh-secret-key');
        // Revoke the specific refresh token
        await redisUtils.revokeRefreshToken(decoded.userId, decoded.tokenId);
      } catch (error) {
        console.log('Could not decode refresh token for revocation:', error.message);
      }
    }
    
    // Clear user cache and session
    await redisUtils.deleteUserCache(userId);
    await redisUtils.deleteSession(`session:${userId}`);
    
    // Clear both cookies
    res.clearCookie('accounty_access_token');
    res.clearCookie('accounty_refresh_token');

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
};

// @desc    Get current user (me endpoint)
// @route   GET /api/users/me
// @access  Private
const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Try to get user from Redis cache first
    let userObject = await redisUtils.getUserCache(userId);
    
    if (!userObject) {
      // If not in cache, get from database
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Remove password from response and cache the user
      userObject = user.toObject();
      delete userObject.password;
      await redisUtils.setUserCache(userId, userObject, 3600); // Cache for 1 hour
    }

    res.json({
      success: true,
      user: userObject,
      token: 'cookie-auth' // Indicate that auth is cookie-based
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Update account type (accountant mode)
// @route   PUT /api/users/account-type
// @access  Private
const updateAccountType = async (req, res) => {
  try {
    const { isAccountant } = req.body;

    if (typeof isAccountant !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isAccountant must be a boolean value'
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update account type
    user.isAccountant = isAccountant;
    await user.save();

    // Clear user cache to force refresh
    await redisUtils.deleteUserCache(req.user.userId);

    // Get fresh user data with virtual fields
    const updatedUser = user.toJSON();
    delete updatedUser.password;

    res.json({
      success: true,
      message: 'Account type updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update account type error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  getSubscriptionStatus,
  changePassword,
  updateEmail,
  updateNames,
  updateAccountType,
  deleteAccount,
  refreshToken,
  logoutUser,
  getCurrentUser
};