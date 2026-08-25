const { Redis } = require('@upstash/redis');

// Credentials come from the environment only - no hardcoded fallback, so a
// missing or rotated database degrades to the in-memory store below instead of
// hammering a dead hostname on every request.
const REDIS_URL = process.env.REDIS_URL;
const REDIS_TOKEN = process.env.REDIS_TOKEN;
const redisConfigured = Boolean(REDIS_URL && REDIS_TOKEN);

if (!redisConfigured) {
  console.warn('⚠️  REDIS_URL / REDIS_TOKEN not set - running with the in-memory store only.');
}

// `retry` makes the client itself ride out short DNS/network blips (the
// `getaddrinfo ENOTFOUND ...upstash.io` failures) before we ever see an error.
const redis = redisConfigured
  ? new Redis({
      url: REDIS_URL,
      token: REDIS_TOKEN,
      retry: {
        retries: 3,
        backoff: (attempt) => Math.min(600, 2 ** attempt * 75),
      },
    })
  : null;

// When Upstash is unreachable, auth must not break. Every failed call falls back
// to this in-process store so logins, refreshes and sessions keep working.
const memory = new Map(); // key -> { value, expiresAt }

const memStore = {
  set(key, value, ttl) {
    memory.set(key, { value, expiresAt: ttl ? Date.now() + ttl * 1000 : null });
  },
  get(key) {
    const entry = memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      memory.delete(key);
      return null;
    }
    return entry.value;
  },
  del(key) {
    memory.delete(key);
  },
  delByPrefix(prefix) {
    for (const key of memory.keys()) {
      if (key.startsWith(prefix)) memory.delete(key);
    }
  },
};

// Drop expired entries periodically so the map cannot grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memory) {
    if (entry.expiresAt && entry.expiresAt < now) memory.delete(key);
  }
}, 10 * 60 * 1000).unref();

// Circuit breaker: after repeated failures, stop calling Upstash for a short
// while. Without this every request pays the full retry timeout while the
// network is down, which is what makes login "hang then fail".
const OUTAGE_COOLDOWN_MS = 15000;
const FAILURES_BEFORE_TRIP = 2;
let consecutiveFailures = 0;
let skipRedisUntil = 0;

const redisAvailable = () => redisConfigured && Date.now() >= skipRedisUntil;

// Runs a Redis operation, never throws. Returns { ok, value }:
// ok === false means Redis could not answer and the caller should fall back.
const exec = async (label, operation) => {
  if (!redisAvailable()) return { ok: false };

  try {
    const value = await operation();
    if (consecutiveFailures > 0) {
      console.log('✅ Upstash Redis reachable again');
      consecutiveFailures = 0;
    }
    return { ok: true, value };
  } catch (error) {
    consecutiveFailures += 1;
    if (consecutiveFailures >= FAILURES_BEFORE_TRIP) {
      skipRedisUntil = Date.now() + OUTAGE_COOLDOWN_MS;
    }
    console.error(
      `Redis ${label} failed (${consecutiveFailures}x): ${error.message} - serving from in-memory fallback`
    );
    return { ok: false };
  }
};

// Test Redis connection on startup
const testRedisConnection = async () => {
  if (!redisConfigured) return false;
  try {
    await redis.ping();
    console.log('✅ Upstash Redis connection successful');
    return true;
  } catch (error) {
    console.error('❌ Upstash Redis connection failed:', error.message);
    console.error('   Continuing with in-memory fallback - auth and caching still work.');
    return false;
  }
};

// Redis utility functions
const redisUtils = {
  // Session management
  async setSession(sessionId, data, ttl = 604800) { // 7 days default
    const key = `session:${sessionId}`;
    memStore.set(key, data, ttl);
    const result = await exec('setSession', () => redis.set(key, data, { ex: ttl }));
    return result.ok;
  },

  async getSession(sessionId) {
    const key = `session:${sessionId}`;
    const result = await exec('getSession', () => redis.get(key));
    if (result.ok && result.value) {
      // Upstash auto-deserializes JSON; older entries may still be strings.
      if (typeof result.value !== 'string') return result.value;
      try {
        return JSON.parse(result.value);
      } catch {
        return result.value;
      }
    }
    return memStore.get(key);
  },

  async deleteSession(sessionId) {
    const key = `session:${sessionId}`;
    memStore.del(key);
    const result = await exec('deleteSession', () => redis.del(key));
    return result.ok;
  },

  // Refresh token management
  async setRefreshToken(userId, tokenId, ttl = 604800) { // 7 days
    const key = `refresh_token:${userId}:${tokenId}`;
    // Always mirror locally: if the Upstash write is lost, the very next
    // /refresh from this process still recognises the token.
    memStore.set(key, 'valid', ttl);
    const result = await exec('setRefreshToken', () => redis.set(key, 'valid', { ex: ttl }));
    return result.ok;
  },

  async isRefreshTokenValid(userId, tokenId) {
    const key = `refresh_token:${userId}:${tokenId}`;

    // A logout recorded by this process wins, even if Redis never got the delete.
    if (memStore.get(key) === 'revoked') return false;

    const result = await exec('isRefreshTokenValid', () => redis.exists(key));

    if (result.ok) {
      if (result.value === 1) return true;
      // Redis answered "missing" - the token may simply never have been written
      // because the login happened during an outage. Trust the local mirror.
      return memStore.get(key) === 'valid';
    }

    // Redis could not answer at all. The refresh JWT's signature and expiry are
    // already verified by the caller, so treat the revocation list as unknown
    // rather than as "revoked" - otherwise a DNS blip logs everyone out.
    if (memStore.get(key) === 'valid') return true;

    if (process.env.AUTH_FAIL_OPEN === 'false') return false;

    console.warn('Redis unavailable - accepting a verified refresh token without a revocation check');
    return true;
  },

  async revokeRefreshToken(userId, tokenId) {
    const key = `refresh_token:${userId}:${tokenId}`;
    // Tombstone rather than delete, so the fail-open path above still refuses
    // this token if the Redis delete never lands.
    memStore.set(key, 'revoked', 604800);
    const result = await exec('revokeRefreshToken', () => redis.del(key));
    return result.ok;
  },

  async revokeAllUserTokens(userId) {
    const pattern = `refresh_token:${userId}:*`;
    memStore.delByPrefix(`refresh_token:${userId}:`);
    const result = await exec('revokeAllUserTokens', async () => {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(...keys);
      return true;
    });
    return result.ok;
  },

  // User data caching
  async setUserCache(userId, userData, ttl = 3600) { // 1 hour default
    const key = `user:${userId}`;
    const result = await exec('setUserCache', () => redis.set(key, userData, { ex: ttl }));
    if (!result.ok) {
      // Short TTL only: a local copy must not outlive an outage and go stale
      // against writes made by another instance.
      memStore.set(key, userData, 60);
    }
    return result.ok;
  },

  async getUserCache(userId) {
    const key = `user:${userId}`;
    const result = await exec('getUserCache', () => redis.get(key));
    // Upstash Redis auto-deserializes JSON, so data is already an object
    if (result.ok) return result.value || null;
    return memStore.get(key);
  },

  async deleteUserCache(userId) {
    const key = `user:${userId}`;
    memStore.del(key);
    const result = await exec('deleteUserCache', () => redis.del(key));
    return result.ok;
  },

  // Settings caching
  async setSettingsCache(userId, settings, ttl = 1800) { // 30 minutes default
    const key = `settings:${userId}`;
    const result = await exec('setSettingsCache', () => redis.set(key, settings, { ex: ttl }));
    if (!result.ok) memStore.set(key, settings, 60);
    return result.ok;
  },

  async getSettingsCache(userId) {
    const key = `settings:${userId}`;
    const result = await exec('getSettingsCache', () => redis.get(key));
    if (result.ok) return result.value || null;
    return memStore.get(key);
  },

  async deleteSettingsCache(userId) {
    const key = `settings:${userId}`;
    memStore.del(key);
    const result = await exec('deleteSettingsCache', () => redis.del(key));
    return result.ok;
  },

  // Rate limiting
  async checkRateLimit(key, limit = 100, window = 3600) { // 100 requests per hour default
    const result = await exec('checkRateLimit', async () => {
      const current = await redis.incr(key);
      if (current === 1) await redis.expire(key, window);
      return {
        current,
        limit,
        remaining: Math.max(0, limit - current),
        reset: await redis.ttl(key),
      };
    });
    // Without Redis we cannot count reliably - let the request through.
    return result.ok ? result.value : { current: 0, limit, remaining: limit, reset: window };
  },

  // General cache operations
  async set(key, value, ttl = 3600) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const result = await exec('set', () =>
      ttl ? redis.set(key, stringValue, { ex: ttl }) : redis.set(key, stringValue)
    );
    if (!result.ok) memStore.set(key, value, ttl || 60);
    return result.ok;
  },

  async get(key) {
    const result = await exec('get', () => redis.get(key));
    if (!result.ok) return memStore.get(key);
    if (!result.value) return null;
    if (typeof result.value !== 'string') return result.value;
    try {
      return JSON.parse(result.value);
    } catch {
      return result.value; // Return as string if not JSON
    }
  },

  async del(key) {
    memStore.del(key);
    const result = await exec('del', () => redis.del(key));
    return result.ok;
  },

  async exists(key) {
    const result = await exec('exists', () => redis.exists(key));
    if (result.ok) return result.value === 1;
    return memStore.get(key) !== null;
  },
};

module.exports = {
  redis,
  redisUtils,
  testRedisConnection
};
