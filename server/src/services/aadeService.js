const axios = require('axios');
const xml2js = require('xml2js');
const QRCode = require('qrcode');

class AADEService {
  constructor() {
    // Service initialization (silent)

    // Determine environment and select appropriate credentials
    const isProduction = process.env.NODE_ENV === 'production';

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

    // Never log keys or user ids - only whether they are present.
    console.log(`🔧 AADE myDATA: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT (TEST)'} endpoint ${this.baseURL}, process-level credentials ${this.isConfigured() ? 'set' : 'not set'}`);

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

    const debug = process.env.AADE_DEBUG === '1' || process.env.AADE_DEBUG === 'true';
    console.log(`📤 Sending invoice to AADE (${this.baseURL}, ${invoiceXML.length} bytes)`);
    if (debug) console.log('📄 AADE request XML:', invoiceXML);

    const requestHeaders = {
      'aade-user-id': credentials.username,
      'Ocp-Apim-Subscription-Key': credentials.subscriptionKey,
      'Content-Type': 'application/xml',
      'Accept': 'application/xml'
    };

    try {
      const response = await axios.post(
        `${this.baseURL}/SendInvoices`,
        invoiceXML,
        {
          headers: requestHeaders,
          // myDATA can be slow; a too-short timeout turns an accepted invoice
          // into a "network error" and invites a duplicate resubmission.
          timeout: Number(process.env.AADE_SEND_TIMEOUT_MS || 60000)
        }
      );

      console.log('✅ AADE response received (status:', response.status, ')');
      if (debug) console.log('📄 AADE response XML:', response.data);

      // Parse XML response
      const result = await this.parseResponseXML(response.data);
      return result;

    } catch (error) {
      console.error('❌ AADE submission error:', error.message);

      if (error.response) {
        console.error('📊 Response status:', error.response.status);
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
      const creds = credentials || { username: this.aadeUserId, subscriptionKey: this.subscriptionKey };
      if (!creds.username || !creds.subscriptionKey) {
        throw new Error('AADE credentials not provided - missing username or subscription key');
      }

      // Cancel at the same endpoint sendInvoices() transmits to (chosen by
      // NODE_ENV / AADE_PROD_URL / AADE_DEV_URL). Previously this used
      // credentials.environment and AADE_*_URL without defaults, so with an
      // unset URL the request had no host at all, and a MARK issued in
      // production could be cancelled against the test endpoint.
      console.log('📨 Calling AADE CancelInvoice endpoint:', `${this.baseURL}/CancelInvoice`);

      const response = await axios.post(`${this.baseURL}/CancelInvoice?mark=${encodeURIComponent(mark)}`, undefined, {
        headers: {
          'aade-user-id': creds.username,
          'Ocp-Apim-Subscription-Key': creds.subscriptionKey,
          'Content-Type': 'application/xml',
          'Accept': 'application/xml'
        },
        timeout: Number(process.env.AADE_SEND_TIMEOUT_MS || 60000)
      });

      console.log('✅ AADE cancellation response received (status:', response.status, ')');

      // Parse XML response
      const parser = new xml2js.Parser({
        explicitArray: false,
        mergeAttrs: true,
        trim: true
      });

      let result = await parser.parseStringPromise(response.data);
      if (process.env.AADE_DEBUG) console.log('📋 Parsed cancellation response:', JSON.stringify(result, null, 2));

      // Check if response is wrapped in a <string> element (same as sendInvoices)
      if (result.string && result.string._) {
        if (process.env.AADE_DEBUG) console.log('🔍 Detected wrapped XML response in <string> element, parsing inner XML...');
        const innerXmlString = result.string._;
        // Parse the inner XML string
        result = await parser.parseStringPromise(innerXmlString);
        if (process.env.AADE_DEBUG) console.log('🔍 Re-parsed inner XML structure:', JSON.stringify(result, null, 2));
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

      if (process.env.AADE_DEBUG) console.log('🔍 Parsed XML structure:', JSON.stringify(result, null, 2));

      // Check if response is wrapped in a <string> element (common with some SOAP/WCF services)
      if (result.string && result.string._) {
        if (process.env.AADE_DEBUG) console.log('🔍 Detected wrapped XML response in <string> element, parsing inner XML...');
        const innerXmlString = result.string._;
        // Parse the inner XML string
        result = await parser.parseStringPromise(innerXmlString);
        if (process.env.AADE_DEBUG) console.log('🔍 Re-parsed inner XML structure:', JSON.stringify(result, null, 2));
      }

      // Try different possible XML structures
      let response = null;

      // Try: ResponseDoc > response (expected structure)
      if (result.ResponseDoc && result.ResponseDoc.response) {
        response = result.ResponseDoc.response;
        if (process.env.AADE_DEBUG) console.log('✅ Found response in ResponseDoc.response');
      }
      // Try: root > response
      else if (result.response) {
        response = result.response;
        if (process.env.AADE_DEBUG) console.log('✅ Found response in root.response');
      }
      // Try: ResponseDoc is the response itself
      else if (result.ResponseDoc) {
        response = result.ResponseDoc;
        if (process.env.AADE_DEBUG) console.log('✅ Using ResponseDoc as response');
      }
      // Try: root is the response
      else {
        response = result;
        if (process.env.AADE_DEBUG) console.log('✅ Using root as response');
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