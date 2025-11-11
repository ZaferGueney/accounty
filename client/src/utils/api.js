import axios from 'axios';

// Get API base URL dynamically
export const getApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    // Server-side: use localhost
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7842';
  }
  
  // Client-side: use environment variable or construct from current domain
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // For production, use same domain with different port or subdomain
  const { protocol, hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:7842`;
  }
  
  // For production deployment
  return `${protocol}//api.${hostname}`;
};

// Create axios instance
const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
  withCredentials: true, // Important: Include cookies in requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Variable to track if we're currently refreshing the token
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
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
  } catch (error) {
    return false;
  }
};

// Request interceptor - proactively refresh tokens and include auth headers
api.interceptors.request.use(
  async (config) => {
    // Skip token refresh for auth endpoints
    const skipRefreshUrls = ['/login', '/register', '/health', '/refresh'];
    const shouldSkipUrl = skipRefreshUrls.some(url => config.url.includes(url));
    
    if (!shouldSkipUrl) {
      const token = localStorage.getItem('accounty_token');
      
      // Check if token is about to expire and refresh it proactively
      if (token && isTokenNearExpiry(token) && !isRefreshing) {
        try {
          isRefreshing = true;
          console.log('Proactively refreshing token before request...');
          
          const refreshResponse = await axios.post(`${getApiBaseUrl()}/api/users/refresh`, {}, {
            withCredentials: true,
            timeout: 10000
          });
          
          if (refreshResponse.data?.data?.accessToken) {
            localStorage.setItem('accounty_token', refreshResponse.data.data.accessToken);
            console.log('Proactive token refresh successful');
          }
        } catch (refreshError) {
          console.error('Proactive token refresh failed:', refreshError);
          // Continue with original request even if refresh fails
        } finally {
          isRefreshing = false;
        }
      }
    }
    
    // Cookies are automatically included due to withCredentials: true
    // But also add Authorization header as fallback for compatibility
    const token = localStorage.getItem('accounty_token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor with automatic token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle token expiration - check for TOKEN_EXPIRED code or general 401 on protected routes
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Skip refresh for auth endpoints
      const skipRefreshUrls = ['/login', '/register', '/health', '/refresh'];
      const shouldSkipUrl = skipRefreshUrls.some(url => originalRequest.url.includes(url));
      
      if (shouldSkipUrl) {
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
        console.log('No token found, skipping refresh');
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // If we're already refreshing, queue the request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try to refresh the token
        console.log('Attempting token refresh...');
        const refreshResponse = await api.post('/api/users/refresh');
        
        // If refresh response includes a new token in headers, update localStorage
        if (refreshResponse.data?.data?.accessToken) {
          localStorage.setItem('accounty_token', refreshResponse.data.data.accessToken);
        }
        
        console.log('Token refresh successful');
        processQueue(null);
        
        // Retry the original request
        return api(originalRequest);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        processQueue(refreshError);
        
        // Clear tokens and redirect to login only if refresh completely failed
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          localStorage.removeItem('accounty_token');
          localStorage.removeItem('accounty_user');
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// API endpoints
export const authAPI = {
  login: (credentials) => api.post('/api/users/login', credentials),
  register: (userData) => api.post('/api/users/register', userData),
  me: () => api.get('/api/users/me'), // Updated endpoint
  getProfile: () => api.get('/api/users/profile'),
  updateProfile: (data) => api.put('/api/users/profile', data),
  getSubscription: () => api.get('/api/users/subscription'),
  logout: () => api.post('/api/users/logout'), // Server-side logout
  refresh: () => api.post('/api/users/refresh'), // Token refresh
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
  createInvoice: (data) => api.post('/api/invoices', data),
  updateInvoice: (id, data) => api.put(`/api/invoices/${id}`, data),
  deleteInvoice: (id) => api.delete(`/api/invoices/${id}`),
  markInvoicePaid: (id, data) => api.post(`/api/invoices/${id}/pay`, data),
  getInvoiceStats: (params = {}) => api.get('/api/invoices/stats', { params }),
  getNextInvoiceNumber: (params = {}) => api.get('/api/invoices/next-number', { params }),
  previewInvoice: async (data, theme = 'light') => {
    const response = await api.post('/api/invoices/preview?theme=' + theme, data, {
      responseType: 'blob'
    });
    
    // Create blob URL for the PDF
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const pdfUrl = window.URL.createObjectURL(blob);
    
    return { data: { success: true, pdfUrl } };
  }
};

// Health check
export const healthCheck = () => api.get('/api/health');

export default api;