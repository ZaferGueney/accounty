const User = require('../models/userModel');
const Settings = require('../models/settingsModel');

/**
 * API Key Authentication Middleware
 *
 * Validates X-API-Key header and attaches user context to request.
 * Used for external app integrations like GuestCode.
 *
 * API keys are stored in environment variables with format:
 * {APP_NAME}_API_KEY=key:userId
 *
 * Example: GUESTCODE_API_KEY=your-secret-key:507f1f77bcf86cd799439011
 */
const apiKeyAuth = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];

    console.log('🔑 [API Key Auth] Request received');
    console.log('🔑 [API Key Auth] Received key:', apiKey ? `${apiKey.substring(0, 8)}...` : 'NONE');

    if (!apiKey) {
      console.log('🔑 [API Key Auth] REJECTED: No API key in header');
      return res.status(401).json({
        success: false,
        message: 'API key required. Include X-API-Key header.'
      });
    }

    // Check against configured API keys
    // Format: APP_API_KEY=secretkey:userId
    const guestCodeKey = process.env.GUESTCODE_API_KEY;

    console.log('🔑 [API Key Auth] GUESTCODE_API_KEY env:', guestCodeKey ? 'SET' : 'NOT SET');

    let userId = null;
    let appSource = null;

    if (guestCodeKey) {
      const [key, configuredUserId] = guestCodeKey.split(':');
      console.log('🔑 [API Key Auth] Expected key:', key ? `${key.substring(0, 8)}...` : 'NONE');
      console.log('🔑 [API Key Auth] Configured userId:', configuredUserId || 'NONE');
      console.log('🔑 [API Key Auth] Key match:', apiKey === key);

      if (apiKey === key && configuredUserId) {
        userId = configuredUserId;
        appSource = 'guestcode';
        console.log('🔑 [API Key Auth] ✅ Key validated successfully');
      }
    }

    // Add support for generic API keys in the future
    // const genericKey = process.env.EXTERNAL_API_KEY;
    // ...

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key'
      });
    }

    // Verify user exists and has required settings
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'API key is associated with invalid user'
      });
    }

    // Check user has tax settings configured
    const settings = await Settings.findOne({ userId });
    if (!settings || !settings.tax?.afm) {
      return res.status(400).json({
        success: false,
        message: 'User must have tax settings configured (AFM required)'
      });
    }

    // Attach user and source to request
    req.user = {
      userId: user._id,
      user: user
    };
    req.apiSource = appSource;

    next();
  } catch (error) {
    console.error('API Key Auth Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

module.exports = { apiKeyAuth };
