const axios = require('axios');

class AADEService {
  constructor() {
    // Service initialization (silent)
    
    this.baseURL = process.env.NODE_ENV === 'production' 
      ? process.env.AADE_PROD_URL || 'https://mydatapi.aade.gr'
      : process.env.AADE_BASE_URL || 'https://mydataapidev.aade.gr';
    
    this.subscriptionKey = process.env.AADE || process.env.AADE_KEY;
    // Note: myDATA API uses only subscription key authentication
    // Username/Password are for POS Registry API, not myDATA
    
    // Create axios instance with default headers
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 seconds timeout
    });
  }

  /**
   * Test AADE API connection on server startup
   * Makes a simple API call to verify connectivity and credentials
   */
  async testConnection() {
    console.log('🔍 Testing AADE myDATA API connection...');
    
    try {
      // Check if required environment variables are present
      if (!this.subscriptionKey) {
        throw new Error('AADE subscription key environment variable is missing');
      }

      // Test with RequestTransmittedDocs endpoint which is a simple query endpoint
      // This endpoint returns transmitted documents for a date range
      const today = new Date().toISOString().split('T')[0];
      const testPayload = {
        dateFrom: today,
        dateTo: today
      };

      // myDATA API uses only the subscription key in header, not basic auth
      const response = await this.client.post('/RequestTransmittedDocs', testPayload);

      // Even if we get an error response, if we receive a structured response,
      // it means the API is reachable and credentials are working
      console.log('✅ AADE myDATA API connection successful!');
      console.log(`📡 Connected to: ${this.baseURL}`);
      
      return {
        success: true,
        endpoint: this.baseURL,
        message: 'AADE myDATA API is reachable and subscription key is valid'
      };

    } catch (error) {
      // Handle different types of errors
      if (error.response) {
        // API responded with error status
        const { status, data } = error.response;
        
        if (status === 401) {
          console.error('🔐 Authentication failed - Check AADE subscription key');
          return {
            success: false,
            error: 'Authentication failed',
            message: 'Invalid or missing AADE subscription key in Ocp-Apim-Subscription-Key header',
            status: status
          };
        } else if (status === 403) {
          console.error('🚫 Forbidden - Subscription key lacks permissions');
          return {
            success: false,
            error: 'Forbidden access',
            message: 'AADE subscription key is valid but lacks required permissions',
            status: status
          };
        } else if (status === 404) {
          // This is expected if no documents are found for the date range
          // It still means the API is working
          console.log('✅ AADE myDATA API connection successful!');
          console.log(`📡 Connected to: ${this.baseURL}`);
          console.log('ℹ️  No documents found for today (this is normal)');
          
          return {
            success: true,
            endpoint: this.baseURL,
            message: 'AADE myDATA API is reachable (no documents found for today)'
          };
        } else {
          console.error(`📡 API Error (${status}):`, data?.message || 'Unknown error');
          return {
            success: false,
            error: 'API Error',
            message: data?.message || `HTTP ${status} error`,
            status: status
          };
        }
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        // Network connectivity issues
        console.error('🌐 Network error - AADE API unreachable');
        console.error(`   Endpoint: ${this.baseURL}`);
        console.error(`   Error: ${error.message}`);
        return {
          success: false,
          error: 'Network error',
          message: 'Cannot reach AADE API - check internet connection',
          endpoint: this.baseURL
        };
      } else if (error.code === 'ECONNABORTED') {
        // Timeout
        console.error('⏱️  Connection timeout - AADE API not responding');
        return {
          success: false,
          error: 'Timeout',
          message: 'AADE API connection timeout',
          endpoint: this.baseURL
        };
      } else {
        // Other errors (missing env vars, etc.)
        console.error('⚠️  Configuration error:', error.message);
        return {
          success: false,
          error: 'Configuration error',
          message: error.message
        };
      }
    }
  }

  /**
   * Check if AADE service is properly configured
   */
  isConfigured() {
    return !!this.subscriptionKey;
  }

  /**
   * Get current configuration status
   */
  getStatus() {
    return {
      configured: this.isConfigured(),
      endpoint: this.baseURL,
      environment: process.env.NODE_ENV || 'development',
      hasSubscriptionKey: !!this.subscriptionKey,
      apiType: 'myDATA',
      note: 'Using myDATA API for invoice submission'
    };
  }

  /**
   * Send invoices to AADE (placeholder for future implementation)
   */
  async sendInvoices(invoices) {
    if (!this.isConfigured()) {
      throw new Error('AADE service is not properly configured');
    }
    
    // TODO: Implement invoice submission
    throw new Error('sendInvoices method not yet implemented');
  }

  /**
   * Cancel invoice in AADE (placeholder for future implementation)
   */
  async cancelInvoice(mark) {
    if (!this.isConfigured()) {
      throw new Error('AADE service is not properly configured');
    }
    
    // TODO: Implement invoice cancellation
    throw new Error('cancelInvoice method not yet implemented');
  }

  /**
   * Get transmission status from AADE (placeholder for future implementation)
   */
  async getTransmissionStatus(marks) {
    if (!this.isConfigured()) {
      throw new Error('AADE service is not properly configured');
    }
    
    // TODO: Implement status checking
    throw new Error('getTransmissionStatus method not yet implemented');
  }
}

module.exports = new AADEService();