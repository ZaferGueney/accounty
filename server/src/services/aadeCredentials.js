/**
 * One place that decides which myDATA credentials an invoice is sent /
 * cancelled with. Order:
 *
 *   1. Settings > AADE credentials (per user, subscription key stored
 *      encrypted with AADE_ENCRYPTION_KEY)
 *   2. Server environment:
 *        NODE_ENV=production : AADE_PROD_USER_ID + AADE_PROD_KEY
 *        otherwise           : AADE_DEV_USER_ID  + AADE_DEV_KEY
 *      each falling back to the generic AADE_USER_ID + AADE_KEY (the same
 *      fallback aadeService already used for its own client).
 *
 * The endpoint is NOT chosen here: aadeService sends to the URL picked by
 * NODE_ENV (AADE_PROD_URL / AADE_DEV_URL). Settings' "environment" value is
 * informational only - unchanged from the previous behaviour.
 */
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.AADE_ENCRYPTION_KEY || 'accounty-aade-encryption-key-2024-change-in-prod';
const ALGORITHM = 'aes-256-cbc';

const decryptKey = (encryptedText) => {
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const parts = String(encryptedText).split(':');
  if (parts.length !== 2) throw new Error('stored key has an unexpected format');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

const envNames = (env = process.env) => {
  const prod = env.NODE_ENV === 'production';
  // `AADE` is a legacy key name the cancel endpoint used to read.
  return prod
    ? { user: ['AADE_PROD_USER_ID', 'AADE_USER_ID'], key: ['AADE_PROD_KEY', 'AADE_KEY', 'AADE'] }
    : { user: ['AADE_DEV_USER_ID', 'AADE_USER_ID'], key: ['AADE_DEV_KEY', 'AADE_KEY', 'AADE'] };
};

const firstSet = (names, env) => {
  for (const n of names) if (env[n]) return env[n];
  return null;
};

/**
 * @returns {{ ok: true, source: 'settings'|'env', credentials: {username, subscriptionKey, environment} }
 *         | { ok: false, message: string }}
 */
function resolveAadeCredentials(settings, env = process.env) {
  const sc = settings?.aadeCredentials;
  if (sc?.isConfigured && sc.username && sc.subscriptionKey) {
    try {
      return {
        ok: true,
        source: 'settings',
        credentials: {
          username: sc.username,
          subscriptionKey: decryptKey(sc.subscriptionKey),
          environment: sc.environment || 'development'
        }
      };
    } catch (err) {
      return {
        ok: false,
        message: 'The myDATA subscription key saved in Settings cannot be decrypted (was AADE_ENCRYPTION_KEY changed?). Please enter it again in Settings > AADE.'
      };
    }
  }

  const names = envNames(env);
  const username = firstSet(names.user, env);
  const subscriptionKey = firstSet(names.key, env);
  if (username && subscriptionKey) {
    return {
      ok: true,
      source: 'env',
      credentials: { username, subscriptionKey, environment: env.NODE_ENV || 'development' }
    };
  }

  const missing = [!username && names.user.join(' or '), !subscriptionKey && names.key.join(' or ')].filter(Boolean);
  return {
    ok: false,
    message: `AADE myDATA credentials are not configured. Add your myDATA user and subscription key in Settings > AADE, or set ${missing.join(' and ')} on the server.`
  };
}

module.exports = { resolveAadeCredentials, decryptKey, envNames };
