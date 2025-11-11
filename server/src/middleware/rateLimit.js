const { redisUtils } = require('../config/redis');

// Rate limiting middleware using Redis
const createRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes default
    max = 100, // 100 requests per window default
    message = 'Too many requests, please try again later.',
    keyGenerator = (req) => req.ip,
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return async (req, res, next) => {
    try {
      const key = `rate_limit:${keyGenerator(req)}`;
      const window = Math.floor(windowMs / 1000); // Convert to seconds for Redis TTL
      
      const result = await redisUtils.checkRateLimit(key, max, window);
      
      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': max,
        'X-RateLimit-Remaining': result.remaining,
        'X-RateLimit-Reset': new Date(Date.now() + (result.reset * 1000)).toISOString()
      });
      
      if (result.current > max) {
        return res.status(429).json({
          success: false,
          message,
          retryAfter: result.reset
        });
      }
      
      next();
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      // On Redis error, allow the request to continue
      next();
    }
  };
};

// Predefined rate limiters
const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many authentication attempts, please try again later.',
  keyGenerator: (req) => `auth:${req.ip}`
});

const apiRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  keyGenerator: (req) => `api:${req.ip}`
});

const settingsRateLimit = createRateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 requests per window
  message: 'Too many settings requests, please try again later.',
  keyGenerator: (req) => `settings:${req.user?.userId || req.ip}`
});

module.exports = {
  createRateLimit,
  authRateLimit,
  apiRateLimit,
  settingsRateLimit
};