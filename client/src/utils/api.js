import axios from 'axios';

// Get API base URL dynamically
export const getApiBaseUrl = () => {
  // Always prefer environment variable if set
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window === 'undefined') {
    // Server-side: use localhost as fallback
    return 'http://localhost:7842';
  }

  // Client-side fallback for local development
  const { protocol, hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:7842`;
  }

  // Production: NEXT_PUBLIC_API_URL must be set
  // This will cause an error if not configured, which is intentional
  console.error('NEXT_PUBLIC_API_URL environment variable is not set for production');
  return '';
};

// Timeouts. Sending an invoice talks to myDATA (or Parochos, which is polled)
// and a PDF needs Chrome; the first call after a server start or a Render
// wake-up easily takes longer than 10s. A client-side timeout does NOT stop
// the server, so a too-short one showed an error for an invoice that was
// actually saved/sent - and a retry could create a second one.
export const TIMEOUTS = {
  default: 30000,
  heavy: 120000 // create/update/send, preview PDF, cancel in AADE
};

// Create axios instance
const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: TIMEOUTS.default,
  withCredentials: true, // Important: Include cookies in requests
  headers: {
    'Content-Type': 'application/json',
  },
});

const AUTH_URLS = ['/login', '/register', '/health', '/refresh'];
const isAuthUrl = (url = '') => AUTH_URLS.some((u) => url.includes(u));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ------------------------------------------------------------ token refresh

// One refresh at a time, shared by everybody who needs it. (Two concurrent
// refreshes used to race, and a request that got a 401 while the proactive
// refresh was running was queued and never released.)
let refreshPromise = null;

export const refreshAccessToken = () => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${getApiBaseUrl()}/api/users/refresh`, {}, { withCredentials: true, timeout: TIMEOUTS.default })
      .then((response) => {
        // The server answers { success, accessToken, token, user }
        const newToken = response.data?.accessToken || response.data?.token || response.data?.data?.accessToken;
        if (newToken && typeof window !== 'undefined') {
          localStorage.setItem('accounty_token', newToken);
        }
        return response;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

// Helper function to check if token is about to expire (within 2 minutes)
const isTokenNearExpiry = (token) => {
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = payload.exp - currentTime;

    // Return true if token expires within 2 minutes (120 seconds)
    return timeUntilExpiry < 120;
  } catch {
    return false;
  }
};

const redirectToLogin = () => {
  if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
    localStorage.removeItem('accounty_token');
    localStorage.removeItem('accounty_user');
    window.location.href = '/login';
  }
};

// Request interceptor - proactively refresh tokens and include auth headers
api.interceptors.request.use(
  async (config) => {
    const isBrowser = typeof window !== 'undefined';

    if (isBrowser && !isAuthUrl(config.url)) {
      const token = localStorage.getItem('accounty_token');
      if (token && isTokenNearExpiry(token)) {
        try {
          await refreshAccessToken();
        } catch (refreshError) {
          // Continue with the original request; a 401 will be handled below
          console.warn('Proactive token refresh failed:', refreshError?.message);
        }
      }
    }

    // Cookies are automatically included due to withCredentials: true
    // But also add Authorization header as fallback for compatibility
    const token = isBrowser ? localStorage.getItem('accounty_token') : null;
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ------------------------------------------------------------ retries

// The server answers 503 with one of these codes before doing any work, so a
// retry is always safe (it is starting up, or the DB/cache hiccuped).
const RETRYABLE_CODES = ['STARTING_UP', 'AUTH_UNAVAILABLE'];
const MAX_RETRIES = 3;

const shouldRetry = (error) => {
  const config = error.config;
  if (!config || config._noRetry) return false;
  if ((config._retryCount || 0) >= MAX_RETRIES) return false;

  const status = error.response?.status;
  if (status === 503 && RETRYABLE_CODES.includes(error.response?.data?.code)) return true;

  const method = (config.method || 'get').toLowerCase();
  const isRead = method === 'get' || method === 'head';
  // No response at all (server restarting, connection reset): repeat reads,
  // and writes that are explicitly safe to repeat (idempotent on the server).
  if (!error.response && error.code !== 'ECONNABORTED' && error.code !== 'ERR_CANCELED') {
    return isRead || config._safeRetry === true;
  }
  // Gateway errors while Render wakes the service up
  if (isRead && (status === 502 || status === 503 || status === 504)) return true;
  return false;
};

// Friendlier messages for errors that never reached the app's own handlers.
// Components show error.response?.data?.message || error.message.
const describeTransportError = (error) => {
  if (error.response || error.code === 'ERR_CANCELED') return;
  const method = (error.config?.method || 'get').toLowerCase();
  if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
    error.message = method === 'get'
      ? 'The server is taking too long to answer. Please try again.'
      : 'The server is taking longer than expected. Your change may still have been saved - refresh before trying again.';
  } else {
    error.message = 'Cannot reach the Accounty server. Check your connection (or that the server is running) and try again.';
  }
};

// Response interceptor with retries and automatic token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (shouldRetry(error)) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      const retryAfter = Number(error.response?.headers?.['retry-after']);
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 8000)
        : 1000 * 2 ** (originalRequest._retryCount - 1);
      await sleep(delay);
      return api(originalRequest);
    }

    // Handle token expiration - check for TOKEN_EXPIRED code or general 401 on protected routes
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isAuthUrl(originalRequest.url)) {
        return Promise.reject(error);
      }

      // Check if we're on login page
      const isOnLoginPage = typeof window !== 'undefined' && window.location.pathname.includes('/login');
      if (isOnLoginPage) {
        return Promise.reject(error);
      }

      // Check if we have a token in localStorage or cookies
      const hasToken = localStorage.getItem('accounty_token') ||
        (typeof document !== 'undefined' && document.cookie.includes('accounty_access_token'));

      // If no token exists, don't attempt refresh
      if (!hasToken) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        await refreshAccessToken();
      } catch (refreshError) {
        // Only a definite "your session is gone" logs the user out; a network
        // problem or a server hiccup during the refresh must not.
        const refreshStatus = refreshError?.response?.status;
        if (refreshStatus === 401 || refreshStatus === 403) {
          redirectToLogin();
        }
        describeTransportError(refreshError);
        return Promise.reject(refreshError);
      }

      // Retry the original request with the fresh token
      const freshToken = localStorage.getItem('accounty_token');
      if (freshToken) originalRequest.headers.Authorization = `Bearer ${freshToken}`;
      return api(originalRequest);
    }

    describeTransportError(error);
    return Promise.reject(error);
  }
);

// ------------------------------------------------------------ idempotent create

// Every "create invoice" attempt carries an Idempotency-Key. Retrying the same
// content (after a timeout, an error such as missing AADE credentials, or a
// double click) reuses the key, so the server continues with the invoice the
// first attempt created instead of creating - and sending - a second one.
// After a successful create the next identical submit is a new invoice.
const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
};

const hashString = (str) => {
  // FNV-1a, enough to recognise "the same form content again"
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
};

const newKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

let pendingCreate = null; // { hash, key } of the last create that did not succeed

const createInvoiceIdempotent = async (data, config = {}) => {
  // status/totals do not identify the invoice: "Save draft" -> timeout ->
  // "Save & Send" must continue with the same invoice.
  const identity = { ...(data || {}) };
  delete identity.status;
  delete identity.totals;
  const hash = hashString(stableStringify(identity));
  const key = config.idempotencyKey ||
    (pendingCreate && pendingCreate.hash === hash ? pendingCreate.key : newKey());
  pendingCreate = { hash, key };

  try {
    const response = await api.post('/api/invoices', data, {
      timeout: TIMEOUTS.heavy,
      _safeRetry: true,
      ...config,
      headers: { ...(config.headers || {}), 'Idempotency-Key': key },
    });
    pendingCreate = null;
    return response;
  } catch (error) {
    // Keep the key: the invoice may exist already (saved as draft, still being
    // sent, or the answer was lost). Only a request that certainly created
    // nothing (validation before saving) may start fresh next time.
    const created = error.response?.data?.invoice?._id;
    const status = error.response?.status;
    if (!created && status && status >= 400 && status < 500 && status !== 409) {
      pendingCreate = null;
    }
    throw error;
  }
};

// API endpoints
export const authAPI = {
  login: (credentials) => api.post('/api/users/login', credentials),
  register: (userData) => api.post('/api/users/register', userData),
  me: () => api.get('/api/users/me'), // Updated endpoint
  getProfile: () => api.get('/api/users/profile'),
  updateProfile: (data) => api.put('/api/users/profile', data),
  getSubscription: () => api.get('/api/users/subscription'),
  logout: () => api.post('/api/users/logout'), // Server-side logout
  refresh: () => refreshAccessToken(), // Token refresh (shared, never runs twice at once)
};

// Customer API
export const customerAPI = {
  getCustomers: (params = {}) => api.get('/api/customers', { params }),
  getCustomer: (id) => api.get(`/api/customers/${id}`),
  createCustomer: (data) => api.post('/api/customers', data),
  updateCustomer: (id, data) => api.put(`/api/customers/${id}`, data),
  deleteCustomer: (id) => api.delete(`/api/customers/${id}`),
  searchCustomers: (params = {}) => api.get('/api/customers/search', { params })
};

// Invoice API
export const invoiceAPI = {
  getInvoices: (params = {}) => api.get('/api/invoices', { params }),
  getInvoice: (id) => api.get(`/api/invoices/${id}`),
  createInvoice: (data, config) => createInvoiceIdempotent(data, config),
  // Safe to repeat: the server never transmits an invoice twice
  updateInvoice: (id, data) => api.put(`/api/invoices/${id}`, data, { timeout: TIMEOUTS.heavy, _safeRetry: true }),
  deleteInvoice: (id) => api.delete(`/api/invoices/${id}`),
  cancelAADEInvoice: (id) => api.post(`/api/invoices/${id}/cancel-aade`, {}, { timeout: TIMEOUTS.heavy }),
  refreshProviderStatus: (id) => api.post(`/api/invoices/${id}/provider-status`, {}, { timeout: TIMEOUTS.heavy }),
  markInvoicePaid: (id, data) => api.post(`/api/invoices/${id}/pay`, data),
  getInvoiceStats: (params = {}) => api.get('/api/invoices/stats', { params }),
  // Accepts { series } or just the series string
  getNextInvoiceNumber: (params = {}) => api.get('/api/invoices/next-number', {
    params: typeof params === 'string' ? { series: params } : params
  }),
  previewInvoice: async (data, theme = 'light', language = 'en') => {
    // Request PDF as blob (first PDF after a server start launches Chrome)
    const response = await api.post(`/api/invoices/preview?theme=${theme}&lang=${language}`, data, {
      responseType: 'blob',
      timeout: TIMEOUTS.heavy,
      _safeRetry: true
    });

    return response;
  }
};

// Banking API
export const bankingAPI = {
  getBanks: () => api.get('/api/banking'),
  getBank: (id) => api.get(`/api/banking/${id}`),
  getDefaultBank: () => api.get('/api/banking/default'),
  createBank: (data) => api.post('/api/banking', data),
  updateBank: (id, data) => api.put(`/api/banking/${id}`, data),
  deleteBank: (id) => api.delete(`/api/banking/${id}`),
  setDefaultBank: (id) => api.put(`/api/banking/${id}/set-default`)
};

// Service API (reusable positions/products)
export const serviceAPI = {
  getServices: (params = {}) => api.get('/api/services', { params }),
  getService: (id) => api.get(`/api/services/${id}`),
  createService: (data) => api.post('/api/services', data),
  updateService: (id, data) => api.put(`/api/services/${id}`, data),
  deleteService: (id) => api.delete(`/api/services/${id}`),
  searchServices: (params = {}) => api.get('/api/services/search', { params }),
  getRecentServices: () => api.get('/api/services/recent'),
  trackUsage: (id) => api.post(`/api/services/${id}/track`)
};

// Settings API
export const settingsAPI = {
  getSettings: () => api.get('/api/settings'),
  createSettings: (data) => api.post('/api/settings', data),
  updateSettings: (data) => api.put('/api/settings', data),
  updateSection: (section, data) => api.put(`/api/settings/section/${section}`, data),
  getCompletionStatus: () => api.get('/api/settings/completion'),
  validateAFM: (afm) => api.get(`/api/settings/validate/afm/${afm}`),
  getTaxOffices: () => api.get('/api/settings/tax-offices'),
  getActivityCodes: () => api.get('/api/settings/activity-codes'),
  testAADEConnection: () => api.post('/api/settings/test-aade-connection', {}, { timeout: TIMEOUTS.heavy })
};

// Health check (waits through a server start-up instead of reporting "down")
export const healthCheck = () => api.get('/api/health');

export default api;
