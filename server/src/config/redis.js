const { Redis } = require('@upstash/redis');

// Create Upstash Redis client
const redis = new Redis({
  url: process.env.REDIS_URL || 'https://apt-redfish-34071.upstash.io',
  token: process.env.REDIS_TOKEN || 'AYUXAAIncDJkZmI0OGU4MGNjYTQ0OWI4OGI4MmRiMDJkMDNmNDVkZnAyMzQwNzE',
});

// Test Redis connection on startup
const testRedisConnection = async () => {
  try {
    await redis.ping();
    console.log('✅ Upstash Redis connection successful');
    return true;
  } catch (error) {
    console.error('❌ Upstash Redis connection failed:', error.message);
    return false;
  }
};

// Redis utility functions
const redisUtils = {
  // Session management
  async setSession(sessionId, data, ttl = 604800) { // 7 days default
    try {
      const key = `session:${sessionId}`;
      await redis.set(key, JSON.stringify(data), { ex: ttl });
      return true;
    } catch (error) {
      console.error('Redis setSession error:', error);
      return false;
    }
  },

  async getSession(sessionId) {
    try {
      const key = `session:${sessionId}`;
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis getSession error:', error);
      return null;
    }
  },

  async deleteSession(sessionId) {
    try {
      const key = `session:${sessionId}`;
      await redis.del(key);
      return true;
    } catch (error) {
      console.error('Redis deleteSession error:', error);
      return false;
    }
  },

  // Refresh token management
  async setRefreshToken(userId, tokenId, ttl = 604800) { // 7 days
    try {
      const key = `refresh_token:${userId}:${tokenId}`;
      await redis.set(key, 'valid', { ex: ttl });
      return true;
    } catch (error) {
      console.error('Redis setRefreshToken error:', error);
      return false;
    }
  },

  async isRefreshTokenValid(userId, tokenId) {
    try {
      const key = `refresh_token:${userId}:${tokenId}`;
      const exists = await redis.exists(key);
      return exists === 1;
    } catch (error) {
      console.error('Redis isRefreshTokenValid error:', error);
      return false;
    }
  },

  async revokeRefreshToken(userId, tokenId) {
    try {
      const key = `refresh_token:${userId}:${tokenId}`;
      await redis.del(key);
      return true;
    } catch (error) {
      console.error('Redis revokeRefreshToken error:', error);
      return false;
    }
  },

  async revokeAllUserTokens(userId) {
    try {
      const pattern = `refresh_token:${userId}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('Redis revokeAllUserTokens error:', error);
      return false;
    }
  },

  // User data caching
  async setUserCache(userId, userData, ttl = 3600) { // 1 hour default
    try {
      const key = `user:${userId}`;
      // Upstash Redis handles JSON serialization automatically
      await redis.set(key, userData, { ex: ttl });
      return true;
    } catch (error) {
      console.error('Redis setUserCache error:', error);
      return false;
    }
  },

  async getUserCache(userId) {
    try {
      const key = `user:${userId}`;
      const data = await redis.get(key);
      
      if (!data) return null;
      
      // Upstash Redis auto-deserializes JSON, so data should already be an object
      return data;
    } catch (error) {
      console.error('Redis getUserCache error:', error);
      return null;
    }
  },

  async deleteUserCache(userId) {
    try {
      const key = `user:${userId}`;
      await redis.del(key);
      return true;
    } catch (error) {
      console.error('Redis deleteUserCache error:', error);
      return false;
    }
  },

  // Settings caching
  async setSettingsCache(userId, settings, ttl = 1800) { // 30 minutes default
    try {
      const key = `settings:${userId}`;
      // Upstash Redis handles JSON serialization automatically
      await redis.set(key, settings, { ex: ttl });
      return true;
    } catch (error) {
      console.error('Redis setSettingsCache error:', error);
      return false;
    }
  },

  async getSettingsCache(userId) {
    try {
      const key = `settings:${userId}`;
      const data = await redis.get(key);
      
      if (!data) return null;
      
      // Upstash Redis auto-deserializes JSON, so data should already be an object
      return data;
    } catch (error) {
      console.error('Redis getSettingsCache error:', error);
      return null;
    }
  },

  async deleteSettingsCache(userId) {
    try {
      const key = `settings:${userId}`;
      await redis.del(key);
      return true;
    } catch (error) {
      console.error('Redis deleteSettingsCache error:', error);
      return false;
    }
  },

  // Rate limiting
  async checkRateLimit(key, limit = 100, window = 3600) { // 100 requests per hour default
    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, window);
      }
      return {
        current,
        limit,
        remaining: Math.max(0, limit - current),
        reset: await redis.ttl(key)
      };
    } catch (error) {
      console.error('Redis checkRateLimit error:', error);
      return { current: 0, limit, remaining: limit, reset: window };
    }
  },

  // General cache operations
  async set(key, value, ttl = 3600) {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttl) {
        await redis.set(key, stringValue, { ex: ttl });
      } else {
        await redis.set(key, stringValue);
      }
      return true;
    } catch (error) {
      console.error('Redis set error:', error);
      return false;
    }
  },

  async get(key) {
    try {
      const data = await redis.get(key);
      if (!data) return null;
      
      try {
        return JSON.parse(data);
      } catch {
        return data; // Return as string if not JSON
      }
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  },

  async del(key) {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error('Redis del error:', error);
      return false;
    }
  },

  async exists(key) {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }
};

module.exports = {
  redis,
  redisUtils,
  testRedisConnection
};