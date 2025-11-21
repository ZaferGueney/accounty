const axios = require('axios');
const xml2js = require('xml2js');
const QRCode = require('qrcode');

class AADEService {
  constructor() {
    // Service initialization (silent)

    // Determine environment and select appropriate credentials
    const isProduction = process.env.NODE_ENV === 'production';

    // Debug: Log available environment variables
    console.log(`\n🔍 AADE Environment Variables Debug:`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`   isProduction: ${isProduction}`);
    console.log(`   AADE_PROD_URL: ${process.env.AADE_PROD_URL || 'NOT SET'}`);
    console.log(`   AADE_DEV_URL: ${process.env.AADE_DEV_URL || 'NOT SET'}`);
    console.log(`   AADE_PROD_USER_ID: ${process.env.AADE_PROD_USER_ID || 'NOT SET'}`);
    console.log(`   AADE_DEV_USER_ID: ${process.env.AADE_DEV_USER_ID || 'NOT SET'}`);
    console.log(`   AADE_PROD_KEY: ${process.env.AADE_PROD_KEY ? process.env.AADE_PROD_KEY.substring(0, 8) + '...' : 'NOT SET'}`);
    console.log(`   AADE_DEV_KEY: ${process.env.AADE_DEV_KEY ? process.env.AADE_DEV_KEY.substring(0, 8) + '...' : 'NOT SET'}`);

    // Select URL based on environment
    this.baseURL = isProduction
      ? process.env.AADE_PROD_URL || 'https://mydatapi.aade.gr'
      : process.env.AADE_DEV_URL || process.env.AADE_BASE_URL || 'https://mydataapidev.aade.gr';

    // Select credentials based on environment
    this.subscriptionKey = isProduction
      ? (process.env.AADE_PROD_KEY || process.env.AADE_KEY)
      : (process.env.AADE_DEV_KEY || process.env.AADE_KEY);

    this.aadeUserId = isProduction
      ? (process.env.AADE_PROD_USER_ID || process.env.AADE_USER_ID)
      : (process.env.AADE_DEV_USER_ID || process.env.AADE_USER_ID);

    // Log which environment and credentials are being used
    console.log(`\n🔧 AADE Service initialized:`);
    console.log(`   Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT (TEST)'}`);
    console.log(`   Endpoint: ${this.baseURL}`);
    console.log(`   User ID: ${this.aadeUserId}`);
    console.log(`   Subscription Key: ${this.subscriptionKey ? this.subscriptionKey.substring(0, 8) + '...' : 'NOT SET'}`);

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
    return !!(this.subscriptionKey && this.aadeUserId);
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
   * Send invoice XML to AADE myDATA API
   * @param {String} invoiceXML - XML string in AADE format
   * @param {Object} userCredentials - Optional user-specific credentials {username, subscriptionKey, environment}
   * @returns {Object} Parsed response with mark, uid, authCode
   */
  async sendInvoices(invoiceXML, userCredentials = null) {
    const credentials = userCredentials || {
      username: this.aadeUserId,
      subscriptionKey: this.subscriptionKey,
      environment: process.env.NODE_ENV
    };

    if (!credentials.username || !credentials.subscriptionKey) {
      throw new Error('AADE credentials not provided - missing username or subscription key');
    }

    console.log('📤 Sending invoice to AADE...');
    console.log('🔑 AADE Authentication Config:', {
      baseURL: this.baseURL,
      authenticatingUser: credentials.username,
      userAFM: process.env.AADE_USER_AFM || 'Not specified',
      hasKey: !!credentials.subscriptionKey,
      keyPreview: credentials.subscriptionKey ? `${credentials.subscriptionKey.substring(0, 8)}...` : 'missing',
      environment: credentials.environment || process.env.NODE_ENV
    });

    // Extract business AFM from XML to show who the invoice is FROM
    const businessAFMMatch = invoiceXML.match(/<vatNumber>(\d+)<\/vatNumber>/);
    const businessAFM = businessAFMMatch ? businessAFMMatch[1] : 'Unknown';

    console.log('📊 Invoice Issuer Info:', {
      businessAFM: businessAFM,
      note: `User ${process.env.AADE_USER_AFM || credentials.username} submitting invoice FOR business ${businessAFM}`
    });

    console.log('📝 Generated XML (first 500 chars):', invoiceXML.substring(0, 500));
    console.log('📄 FULL XML:');
    console.log(invoiceXML);
    console.log('📄 END OF XML\n');

    const requestHeaders = {
      'aade-user-id': credentials.username,
      'Ocp-Apim-Subscription-Key': credentials.subscriptionKey,
      'Content-Type': 'application/xml',
      'Accept': 'application/xml'
    };

    console.log('📨 Request Details:');
    console.log('   URL:', `${this.baseURL}/SendInvoices`);
    console.log('   Headers:', JSON.stringify(requestHeaders, null, 2));
    console.log('   Body length:', invoiceXML.length, 'bytes');

    try {
      // Create a new axios instance with request/response interceptors for debugging
      const debugAxios = axios.create();

      debugAxios.interceptors.request.use(request => {
        console.log('🔍 AXIOS REQUEST INTERCEPTOR:');
        console.log('   Method:', request.method?.toUpperCase());
        console.log('   URL:', request.url);
        console.log('   Headers:', JSON.stringify(request.headers, null, 2));
        console.log('   Data type:', typeof request.data);
        console.log('   Data length:', request.data?.length || 0);
        return request;
      });

      debugAxios.interceptors.response.use(
        response => {
          console.log('🔍 AXIOS RESPONSE INTERCEPTOR (SUCCESS):');
          console.log('   Status:', response.status);
          console.log('   Headers:', JSON.stringify(response.headers, null, 2));
          return response;
        },
        error => {
          console.log('🔍 AXIOS RESPONSE INTERCEPTOR (ERROR):');
          if (error.request) {
            console.log('   Request was made but no response received');
            console.log('   Request headers:', JSON.stringify(error.config?.headers, null, 2));
          }
          if (error.response) {
            console.log('   Response status:', error.response.status);
            console.log('   Response headers:', JSON.stringify(error.response.headers, null, 2));
            console.log('   Response data:', error.response.data);
          }
          return Promise.reject(error);
        }
      );

      const response = await debugAxios.post(
        `${this.baseURL}/SendInvoices`,
        invoiceXML,
        {
          headers: requestHeaders,
          timeout: 15000 // 15 seconds for invoice submission
        }
      );

      console.log('✅ AADE response received (status:', response.status, ')');
      console.log('📄 AADE RESPONSE XML:');
      console.log(response.data);
      console.log('📄 END OF AADE RESPONSE XML\n');

      // Parse XML response
      const result = await this.parseResponseXML(response.data);
      return result;

    } catch (error) {
      console.error('❌ AADE submission error:', error.message);

      if (error.response) {
        console.error('📊 Response status:', error.response.status);
        console.error('📋 Response headers:', JSON.stringify(error.response.headers, null, 2));
        console.error('📄 Response data:', typeof error.response.data === 'string' ? error.response.data.substring(0, 500) : JSON.stringify(error.response.data));

        // AADE returned error response - try to parse it
        try {
          const errorResult = await this.parseResponseXML(error.response.data);
          return errorResult;
        } catch (parseError) {
          throw new Error(`AADE error (${error.response.status}): ${error.response.data}`);
        }
      }

      // Network or other error
      throw new Error(`AADE network error: ${error.message}`);
    }
  }

  /**
   * Cancel invoice in AADE
   * @param {String} mark - The MARK of the invoice to cancel
   * @param {Object} credentials - User credentials (optional, uses instance config if not provided)
   * @returns {Object} Cancellation response with cancellation MARK
   */
  async cancelInvoice(mark, credentials = null) {
    console.log('🚫 Cancelling invoice in AADE...', mark);

    if (!mark) {
      throw new Error('Invoice MARK is required for cancellation');
    }

    try {
      // Use provided credentials or fall back to instance config
      const config = credentials ? {
        baseURL: credentials.environment === 'production'
          ? process.env.AADE_PROD_URL
          : process.env.AADE_DEV_URL,
        headers: {
          'aade-user-id': credentials.username,
          'Ocp-Apim-Subscription-Key': credentials.subscriptionKey,
          'Content-Type': 'application/xml',
          'Accept': 'application/xml'
        }
      } : {};

      const client = credentials ? axios.create(config) : this.client;

      console.log('📨 Calling AADE CancelInvoice endpoint...');
      console.log('   URL:', `${config.baseURL || this.baseURL}/CancelInvoice?mark=${mark}`);

      // Call AADE CancelInvoice endpoint
      const response = await client.post(`/CancelInvoice?mark=${mark}`);

      console.log('✅ AADE cancellation response received (status:', response.status, ')');

      // Parse XML response
      const parser = new xml2js.Parser({
        explicitArray: false,
        mergeAttrs: true,
        trim: true
      });

      let result = await parser.parseStringPromise(response.data);
      console.log('📋 Parsed cancellation response:', JSON.stringify(result, null, 2));

      // Check if response is wrapped in a <string> element (same as sendInvoices)
      if (result.string && result.string._) {
        console.log('🔍 Detected wrapped XML response in <string> element, parsing inner XML...');
        const innerXmlString = result.string._;
        // Parse the inner XML string
        result = await parser.parseStringPromise(innerXmlString);
        console.log('🔍 Re-parsed inner XML structure:', JSON.stringify(result, null, 2));
      }

      // Extract cancellation info
      let responseData = result.ResponseDoc?.response || result.response || result;

      if (responseData.statusCode === 'Success') {
        return {
          success: true,
          cancellationMark: responseData.cancellationMark,
          statusCode: responseData.statusCode,
          index: responseData.index
        };
      } else {
        // Handle errors
        const errors = this.parseErrors(responseData.errors);
        return {
          success: false,
          errors,
          statusCode: responseData.statusCode
        };
      }

    } catch (error) {
      console.error('❌ AADE cancellation error:', error.response?.data || error.message);

      if (error.response?.status === 401) {
        throw new Error('AADE authentication failed - check credentials');
      }

      throw new Error(`Failed to cancel invoice in AADE: ${error.message}`);
    }
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

  /**
   * Parse AADE XML response
   * @param {String} xmlString - XML response from AADE
   * @returns {Object} Structured response object
   */
  async parseResponseXML(xmlString) {
    const parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
      trim: true
    });

    try {
      let result = await parser.parseStringPromise(xmlString);

      console.log('🔍 Parsed XML structure:', JSON.stringify(result, null, 2));

      // Check if response is wrapped in a <string> element (common with some SOAP/WCF services)
      if (result.string && result.string._) {
        console.log('🔍 Detected wrapped XML response in <string> element, parsing inner XML...');
        const innerXmlString = result.string._;
        // Parse the inner XML string
        result = await parser.parseStringPromise(innerXmlString);
        console.log('🔍 Re-parsed inner XML structure:', JSON.stringify(result, null, 2));
      }

      // Try different possible XML structures
      let response = null;

      // Try: ResponseDoc > response (expected structure)
      if (result.ResponseDoc && result.ResponseDoc.response) {
        response = result.ResponseDoc.response;
        console.log('✅ Found response in ResponseDoc.response');
      }
      // Try: root > response
      else if (result.response) {
        response = result.response;
        console.log('✅ Found response in root.response');
      }
      // Try: ResponseDoc is the response itself
      else if (result.ResponseDoc) {
        response = result.ResponseDoc;
        console.log('✅ Using ResponseDoc as response');
      }
      // Try: root is the response
      else {
        response = result;
        console.log('✅ Using root as response');
      }

      if (!response) {
        console.error('❌ Could not find response in XML structure');
        throw new Error('Invalid AADE response format - no response element found');
      }

      const statusCode = response.statusCode;
      const success = statusCode === 'Success';

      // Parse errors if present
      const errors = this.parseErrors(response.errors);

      console.log(`📋 AADE Response: ${statusCode}${errors.length > 0 ? ` (${errors.length} errors)` : ''}`);

      return {
        success,
        statusCode,
        index: response.index || 0,
        mark: response.invoiceMark || null,
        uid: response.invoiceUid || null,
        authenticationCode: response.authenticationCode || null,
        errors
      };

    } catch (error) {
      console.error('❌ Failed to parse AADE XML response:', error.message);
      throw new Error(`Failed to parse AADE response: ${error.message}`);
    }
  }

  /**
   * Parse error elements from AADE response
   * @param {Object} errors - Errors object from XML
   * @returns {Array} Array of error objects
   */
  parseErrors(errors) {
    if (!errors || !errors.error) return [];

    // Handle both single error and array of errors
    const errorArray = Array.isArray(errors.error) ? errors.error : [errors.error];

    return errorArray.map(err => ({
      code: err.code || 'UNKNOWN',
      message: err.message || err
    }));
  }

  /**
   * Generate QR code from AADE response data
   * @param {String} mark - Invoice mark from AADE
   * @param {String} uid - Invoice UID from AADE
   * @param {String} authCode - Authentication code from AADE
   * @returns {String} Base64 data URL of QR code image
   */
  async generateQRCode(mark, uid, authCode) {
    // Build AADE verification URL
    const qrUrl = `https://www1.aade.gr/taxisnet/invoice/check?mark=${mark}&iuid=${uid}&ac=${authCode}`;

    console.log('🔲 Generating QR code for invoice verification...');

    try {
      // Generate QR code as base64 PNG data URL
      const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });

      console.log('✅ QR code generated');
      return qrCodeDataUrl; // Returns: "data:image/png;base64,iVBORw0KG..."

    } catch (error) {
      console.error('❌ QR code generation failed:', error);
      return null;
    }
  }
}

module.exports = new AADEService();