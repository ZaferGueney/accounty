/**
 * Parochos (Timologic) e-invoicing provider client.
 *
 * Docs: Parochos_API_Documentation_3.0.29.pdf + swagger at {url1}/swagger (v3).
 *  - Auth: POST {account}/api/account/loginToSubscription {subscriptionKey,email,password}
 *          -> { jwt, jwtExpiration, jwtRefreshToken, jwtRefreshTokenExpiration, url1 }
 *          POST {account}/api/token/Refresh { token, refreshToken }
 *  - API (base = url1 from login, never hardcoded), header X-Version: 3.0, Bearer JWT:
 *          POST /api/Send   { externalSystemId, identifier: "Parochos", transmissionType, source }
 *          POST /api/Get    { processId | externalSystemId }   (polling)
 *          POST /api/Cancel { mark | externalSystemId }        (delivery/receipt notes only)
 *          POST /api/GetFiles { externalSystemId, fileIdentifiers }
 *  - Response status: 0 in progress, 1 completed, 2 failed. Operational errors come back
 *    as HTTP 200 with errorCode/errorCategory/errorMessage.
 *
 * Environments: test = https://beta-account.parochos.gr, prod = https://account.parochos.gr
 */
const axios = require('axios');
const QRCode = require('qrcode');
const parochosTransformer = require('./parochosTransformer');

const ACCOUNT_URLS = {
  test: 'https://beta-account.parochos.gr',
  prod: 'https://account.parochos.gr'
};

const STATUS = { IN_PROGRESS: 0, COMPLETED: 1, FAILED: 2 };

// Invoice types the provider Cancel endpoint accepts (delivery / receipt notes).
const CANCELLABLE_TYPES = ['9.1', '9.2', '9.3', '10.1', '10.2'];

class ParochosError extends Error {
  constructor(message, { code, category, httpStatus, network } = {}) {
    super(message);
    this.name = 'ParochosError';
    this.code = code;
    this.category = category;
    this.httpStatus = httpStatus;
    this.network = !!network;
  }
}

const normalizeEnv = (env) => {
  const e = String(env || 'test').toLowerCase();
  return ['prod', 'production', 'live'].includes(e) ? 'prod' : 'test';
};

const trimSlash = (u) => String(u || '').replace(/\/+$/, '');

class ParochosService {
  /**
   * @param {Object} opts
   * @param {String} [opts.username]        API user (email or API user name)
   * @param {String} [opts.password]
   * @param {String} [opts.subscriptionKey] subscription secret key
   * @param {String} [opts.env]             'test' | 'prod'
   * @param {String} [opts.accountUrl]      override identity server URL
   * @param {Object} [opts.http]            axios-like client ({ post, get }); injected in tests
   * @param {Function} [opts.now]           clock, for tests
   * @param {Number} [opts.pollAttempts]    polls of /api/Get while status is in progress
   * @param {Number} [opts.pollIntervalMs]
   * @param {Number} [opts.transmissionType] 0 | 1 | 3 | 5 (default 5, see docs)
   */
  constructor(opts = {}) {
    const env = process.env;
    this.username = opts.username ?? env.PAROCHOS_USERNAME;
    this.password = opts.password ?? env.PAROCHOS_PASSWORD;
    this.subscriptionKey = opts.subscriptionKey ?? env.PAROCHOS_SUBSCRIPTION_KEY;
    this.env = normalizeEnv(opts.env ?? env.PAROCHOS_ENV);
    this.accountUrl = trimSlash(opts.accountUrl ?? env.PAROCHOS_ACCOUNT_URL ?? ACCOUNT_URLS[this.env]);
    this.http = opts.http || axios.create({ timeout: 30000 });
    this.now = opts.now || (() => Date.now());
    this.sleep = opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.pollAttempts = Number(opts.pollAttempts ?? env.PAROCHOS_POLL_ATTEMPTS ?? 5);
    this.pollIntervalMs = Number(opts.pollIntervalMs ?? env.PAROCHOS_POLL_INTERVAL_MS ?? 2000);
    this.transmissionType = Number(opts.transmissionType ?? env.PAROCHOS_TRANSMISSION_TYPE ?? 5);
    this.apiVersion = opts.apiVersion || '3.0';
    this.session = null; // { jwt, jwtExpiresAt, refreshToken, refreshExpiresAt, baseUrl }
  }

  isConfigured() {
    return !!(this.username && this.password && this.subscriptionKey);
  }

  getStatus() {
    return {
      provider: 'parochos',
      configured: this.isConfigured(),
      environment: this.env,
      accountUrl: this.accountUrl,
      apiUrl: this.session?.baseUrl || null,
      loggedIn: !!this.session?.jwt
    };
  }

  // ---------------------------------------------------------------- auth

  _storeSession(data, keepBaseUrl) {
    if (!data || !data.jwt) {
      throw new ParochosError('Parochos login returned no JWT', { code: 'AUTH' });
    }
    const parse = (d, fallbackMs) => {
      const t = d ? Date.parse(d) : NaN;
      return isNaN(t) ? this.now() + fallbackMs : t;
    };
    const baseUrl = trimSlash(data.url1 || keepBaseUrl);
    if (!baseUrl) throw new ParochosError('Parochos login returned no API url (url1)', { code: 'AUTH' });
    this.session = {
      jwt: data.jwt,
      jwtExpiresAt: parse(data.jwtExpiration, 30 * 60 * 1000),
      refreshToken: data.jwtRefreshToken || null,
      refreshExpiresAt: parse(data.jwtRefreshTokenExpiration, 0),
      baseUrl
    };
    return this.session;
  }

  async login() {
    if (!this.isConfigured()) {
      throw new ParochosError(
        'Parochos credentials missing (PAROCHOS_USERNAME, PAROCHOS_PASSWORD, PAROCHOS_SUBSCRIPTION_KEY)',
        { code: 'CONFIG' }
      );
    }
    try {
      const res = await this.http.post(
        `${this.accountUrl}/api/account/loginToSubscription`,
        { subscriptionKey: this.subscriptionKey, email: this.username, password: this.password },
        { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
      );
      return this._storeSession(res.data);
    } catch (err) {
      if (err instanceof ParochosError) throw err;
      const status = err.response?.status;
      if (status === 400 || status === 401 || status === 403) {
        throw new ParochosError(`Parochos login rejected (HTTP ${status}) - check username, password and subscription key`, {
          code: 'AUTH',
          httpStatus: status
        });
      }
      throw new ParochosError(`Parochos login failed: ${err.message}`, { network: !err.response, httpStatus: status });
    }
  }

  async refresh() {
    const s = this.session;
    if (!s?.refreshToken || s.refreshExpiresAt <= this.now()) return this.login();
    try {
      const res = await this.http.post(
        `${this.accountUrl}/api/token/Refresh`,
        { token: s.jwt, refreshToken: s.refreshToken },
        { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
      );
      return this._storeSession(res.data, s.baseUrl);
    } catch (_) {
      // Docs: if refresh fails, log in again.
      return this.login();
    }
  }

  /** Cached JWT; refreshes 60s before expiry. */
  async getSession() {
    const s = this.session;
    if (s?.jwt && s.jwtExpiresAt - 60 * 1000 > this.now()) return s;
    if (s?.jwt) return this.refresh();
    return this.login();
  }

  // ---------------------------------------------------------------- api

  async _call(method, path, body, retried = false) {
    const session = await this.getSession();
    const config = {
      headers: {
        Authorization: `Bearer ${session.jwt}`,
        'X-Version': this.apiVersion,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }
    };
    const url = `${session.baseUrl}${path}`;
    try {
      const res = method === 'get' ? await this.http.get(url, config) : await this.http.post(url, body, config);
      return res.data;
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 && !retried) {
        this.session = null; // force a fresh login and retry once
        return this._call(method, path, body, true);
      }
      if (err.response) {
        const d = err.response.data || {};
        throw new ParochosError(
          `Parochos ${path} failed (HTTP ${status})${d.errorMessage || d.title ? `: ${d.errorMessage || d.title}` : ''}`,
          { code: d.errorCode || (status === 401 ? 'AUTH' : 'HTTP'), category: d.errorCategory, httpStatus: status }
        );
      }
      throw new ParochosError(`Parochos ${path} network error: ${err.message}`, { network: true });
    }
  }

  /**
   * Turn a Send/Get response into the shape the invoice flow uses.
   */
  normalize(data = {}) {
    const signing = data.signing || {};
    const status = typeof data.status === 'number' ? data.status : null;
    const mark = signing.mark != null && signing.mark !== '' ? String(signing.mark) : null;
    const errors = [];
    if (data.errorCode || data.errorMessage) {
      errors.push({
        code: data.errorCode || 'PAROCHOS',
        category: data.errorCategory || null,
        severity: data.errorSeverity ?? null,
        message: data.errorMessage || 'Parochos reported an error'
      });
    }
    const success = status === STATUS.COMPLETED && !!mark;
    const inProgress = status === STATUS.IN_PROGRESS;
    if (!success && !inProgress && !errors.length) {
      errors.push({
        code: 'NO_MARK',
        category: null,
        severity: null,
        message: `Parochos returned status ${status} without a MARK`
      });
    }
    return {
      provider: 'parochos',
      success,
      inProgress,
      status,
      processId: data.processId || null,
      externalSystemId: data.externalSystemId || null,
      mark,
      uid: signing.uid && String(signing.uid).trim() !== 'null' ? String(signing.uid).trim() : null,
      authenticationCode: signing.authenticationCode || null,
      qrCodeUrl: signing.qrCode || null,
      qrUrlAADE: signing.qrUrlAADE || null,
      pdfFileUrl: signing.pdfFileUrl || null,
      publishStatus: signing.publishStatus ?? null,
      cancellationMark: signing.cancellationMark != null ? String(signing.cancellationMark) : null,
      timeStamp: data.timeStamp || null,
      errors
    };
  }

  /** POST /api/Get by processId or externalSystemId. */
  async get({ processId, externalSystemId } = {}) {
    if (!processId && !externalSystemId) throw new ParochosError('processId or externalSystemId required', { code: 'INPUT' });
    const body = processId ? { processId } : { externalSystemId };
    return this.normalize(await this._call('post', '/api/Get', body));
  }

  /** POST /api/Send, then poll /api/Get while in progress. */
  async send({ externalSystemId, source, transmissionType } = {}) {
    if (!externalSystemId) throw new ParochosError('externalSystemId required', { code: 'INPUT' });
    if (!source) throw new ParochosError('source required', { code: 'INPUT' });
    const data = await this._call('post', '/api/Send', {
      externalSystemId,
      identifier: 'Parochos',
      transmissionType: transmissionType ?? this.transmissionType,
      source
    });
    let result = this.normalize(data);
    if (!result.externalSystemId) result.externalSystemId = externalSystemId;
    for (let i = 0; result.inProgress && i < this.pollAttempts; i++) {
      await this.sleep(this.pollIntervalMs);
      const polled = await this.get(result.processId ? { processId: result.processId } : { externalSystemId });
      result = { ...polled, externalSystemId: polled.externalSystemId || externalSystemId };
    }
    return result;
  }

  /**
   * Transmit an BillMou invoice. If the invoice was already sent to Parochos
   * (providerInfo.externalSystemId present) we first ask for its state so a
   * lost response never causes a duplicate transmission.
   */
  async transmitInvoice(invoice, options = {}) {
    const externalSystemId = parochosTransformer.externalSystemIdFor(invoice);
    if (invoice.providerInfo?.externalSystemId) {
      try {
        const existing = await this.get({ externalSystemId });
        if (existing.success || existing.inProgress) return { ...existing, externalSystemId };
      } catch (err) {
        // Unknown id / previous failure -> safe to send; a dead connection is not.
        if (err.network) throw err;
      }
    }
    const source = parochosTransformer.invoiceToSource(invoice, options);
    const result = await this.send({ externalSystemId, source, transmissionType: options.transmissionType });
    return { ...result, externalSystemId };
  }

  /**
   * POST /api/Cancel. Per docs only Delivery Notes (9.1-9.3) and Receipt Notes
   * (10.1, 10.2) can be cancelled; sales invoices need a credit note (5.x).
   */
  async cancel({ mark, externalSystemId, invoiceType } = {}) {
    if (invoiceType && !CANCELLABLE_TYPES.includes(String(invoiceType))) {
      throw new ParochosError(
        `Parochos cannot cancel invoice type ${invoiceType}; issue a credit note (5.1) instead`,
        { code: 'NOT_CANCELLABLE' }
      );
    }
    if (!mark && !externalSystemId) throw new ParochosError('mark or externalSystemId required', { code: 'INPUT' });
    const body = mark ? { mark: Number(mark) } : { externalSystemId };
    const data = await this._call('post', '/api/Cancel', body);
    const ok = data.status === STATUS.COMPLETED || data.success === true || data.success === 'true';
    return {
      success: ok && data.cancellationMark != null,
      cancellationMark: data.cancellationMark != null ? String(data.cancellationMark) : null,
      errors: data.errorCode || data.errorMessage
        ? [{ code: data.errorCode || 'PAROCHOS', category: data.errorCategory || null, message: data.errorMessage }]
        : []
    };
  }

  /** POST /api/GetFiles - download URLs (PDF, MydataXML, eInvoiceXML). */
  async getFiles({ processId, externalSystemId, fileIdentifiers = [] } = {}) {
    const body = { fileIdentifiers };
    if (processId) body.processId = processId;
    if (externalSystemId) body.externalSystemId = externalSystemId;
    return this._call('post', '/api/GetFiles', body);
  }

  /** PNG data URL of the provider QR link, for the BillMou PDF. */
  async qrDataUrl(url) {
    if (!url) return null;
    try {
      return await QRCode.toDataURL(url, { width: 200, margin: 1, errorCorrectionLevel: 'M' });
    } catch (_) {
      return null;
    }
  }
}

let singleton = null;
const getParochosService = () => {
  if (!singleton) singleton = new ParochosService();
  return singleton;
};

module.exports = {
  ParochosService,
  ParochosError,
  getParochosService,
  ACCOUNT_URLS,
  STATUS,
  CANCELLABLE_TYPES
};
