// src/services/apiConnectorService.js
const axios = require('axios');
const verificationApiLogRepo = require('../../features/doctor/repositories/verificationApiLogRepository');
const { getSetting } = require('./adminSettingsService');

// Resolved once per process and cached; updated by admin settings cache TTL
let _timeoutMs = null;
async function getApiTimeoutMs() {
    if (_timeoutMs !== null) return _timeoutMs;
    const s = await getSetting('limits', 'timeout_threshold', { enabled: true, value: 30000 });
    _timeoutMs = (s?.enabled !== false && s?.value) ? s.value : 30000;
    // Reset cache after 5 min so admin changes propagate
    setTimeout(() => { _timeoutMs = null; }, 5 * 60 * 1000);
    return _timeoutMs;
}

class ApiConnectorService {

  /**
   * Main entry point for doctor verification via APIs
   */
  async verifyDoctor(verificationRequest, countryConfig) {
    const startTime = Date.now();
    let apiResult = null;
    let success = false;
    let errorMessage = null;

    try {
      // Route to appropriate API handler based on country
      switch (countryConfig.apiProvider) {
        case 'hpcsa_south_africa':
          apiResult = await this.verifyHPCSA(verificationRequest);
          break;
        case 'kmpdc_kenya':
          apiResult = await this.verifyKMPDC(verificationRequest);
          break;
        case 'mdcn_nigeria':
          apiResult = await this.verifyMDCN(verificationRequest);
          break;
        case 'mdc_ghana':
          apiResult = await this.verifyGhanaMDC(verificationRequest);
          break;
        case 'surepass':
          apiResult = await this.verifySurePass(verificationRequest);
          break;
        case 'idfy':
          apiResult = await this.verifyIdfy(verificationRequest);
          break;
        default:
          throw new Error(`No API handler for provider: ${countryConfig.apiProvider}`);
      }

      success = apiResult && apiResult.success;

    } catch (error) {
      console.error(`API verification error for ${countryConfig.apiProvider}:`, error);
      errorMessage = error.message;
      apiResult = {
        success: false,
        error: error.message,
        confidence: 0
      };
    } finally {
      const responseTime = Date.now() - startTime;

      // Log API call
      await verificationApiLogRepo.logApiCall(
        verificationRequest.id,
        countryConfig.apiProvider,
        countryConfig.apiEndpoint || 'unknown',
        'POST',
        this.sanitizeRequestData(verificationRequest),
        this.sanitizeResponseData(apiResult),
        success ? 200 : 500,
        responseTime,
        success,
        errorMessage,
        null
      );
    }

    return apiResult;
  }

  /**
   * South Africa HPCSA API verification
   */
  async verifyHPCSA(verificationRequest) {
    const endpoint = process.env.HPCSA_API_ENDPOINT || 'https://api.hpcsa.co.za/verify';
    const apiKey = process.env.HPCSA_API_KEY;

    if (!apiKey) {
      throw new Error('HPCSA API key not configured');
    }

    const requestData = {
      registration_number: verificationRequest.licenseNumber,
      practitioner_name: verificationRequest.doctor?.fullName,
      profession: 'medical'
    };

    const timeout = await getApiTimeoutMs();
    const response = await axios.post(endpoint, requestData, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout,
    });

    return this.parseHPCSAResponse(response.data);
  }

  /**
   * Kenya KMPDC API verification
   */
  async verifyKMPDC(verificationRequest) {
    const endpoint = process.env.KMPDC_API_ENDPOINT || 'https://api.kmpdc.go.ke/verify';
    const apiKey = process.env.KMPDC_API_KEY;

    if (!apiKey) {
      throw new Error('KMPDC API key not configured');
    }

    const requestData = {
      license_number: verificationRequest.licenseNumber,
      doctor_name: verificationRequest.doctor?.fullName
    };

    const timeout = await getApiTimeoutMs();
    const response = await axios.post(endpoint, requestData, {
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      timeout,
    });

    return this.parseKMPDCResponse(response.data);
  }

  /**
   * Nigeria MDCN API verification (if available)
   */
  async verifyMDCN(verificationRequest) {
    const endpoint = process.env.MDCN_API_ENDPOINT;

    if (!endpoint) {
      throw new Error('MDCN API not available - fallback to manual verification');
    }

    const requestData = {
      license_number: verificationRequest.licenseNumber,
      doctor_name: verificationRequest.doctor?.fullName
    };

    const timeout = await getApiTimeoutMs();
    const response = await axios.post(endpoint, requestData, { timeout });

    return this.parseMDCNResponse(response.data);
  }

  /**
   * Ghana Medical and Dental Council verification
   */
  async verifyGhanaMDC(verificationRequest) {
    throw new Error('Ghana MDC API not available - fallback to manual verification');
  }

  /**
   * SurePass API (Third-party verification service)
   */
  async verifySurePass(verificationRequest) {
    const endpoint = process.env.SUREPASS_API_ENDPOINT || 'https://api.surepass.io/doctor-verification';
    const apiKey = process.env.SUREPASS_API_KEY;

    if (!apiKey) {
      throw new Error('SurePass API key not configured');
    }

    const requestData = {
      registration_number: verificationRequest.licenseNumber,
      council_name: verificationRequest.issuingAuthority,
      year_of_registration: verificationRequest.issueDate ? new Date(verificationRequest.issueDate).getFullYear() : null
    };

    const timeout = await getApiTimeoutMs();
    const response = await axios.post(endpoint, requestData, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout,
    });

    return this.parseSurePassResponse(response.data);
  }

  /**
   * IDfy API verification
   */
  async verifyIdfy(verificationRequest) {
    const endpoint = process.env.IDFY_API_ENDPOINT || 'https://api.idfy.com/doctor-verification';
    const apiKey = process.env.IDFY_API_KEY;

    if (!apiKey) {
      throw new Error('IDfy API key not configured');
    }

    const requestData = {
      registration_number: verificationRequest.licenseNumber,
      council_name: verificationRequest.issuingAuthority,
      year_of_registration: verificationRequest.issueDate ? new Date(verificationRequest.issueDate).getFullYear() : null
    };

    const timeout = await getApiTimeoutMs();
    const response = await axios.post(endpoint, requestData, {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout,
    });

    return this.parseIdfyResponse(response.data);
  }

  // Response parsers for each API
  parseHPCSAResponse(data) {
    return {
      success: data.status === 'verified',
      verified: data.status === 'verified',
      confidence: data.status === 'verified' ? 95 : 0,
      licenseStatus: data.registration_status,
      expiryDate: data.expiry_date,
      specializations: data.specializations || [],
      rawResponse: data
    };
  }

  parseKMPDCResponse(data) {
    return {
      success: data.verified === true,
      verified: data.verified === true,
      confidence: data.verified ? 90 : 0,
      licenseStatus: data.status,
      expiryDate: data.expiry_date,
      rawResponse: data
    };
  }

  parseMDCNResponse(data) {
    return {
      success: data.verified === true,
      verified: data.verified === true,
      confidence: data.verified ? 85 : 0,
      licenseStatus: data.status,
      rawResponse: data
    };
  }

  parseSurePassResponse(data) {
    return {
      success: data.success === true && data.data?.verified === true,
      verified: data.data?.verified === true,
      confidence: data.data?.verified ? 80 : 0,
      licenseStatus: data.data?.status,
      doctorName: data.data?.doctor_name,
      rawResponse: data
    };
  }

  parseIdfyResponse(data) {
    return {
      success: data.result?.verified === true,
      verified: data.result?.verified === true,
      confidence: data.result?.verified ? 80 : 0,
      licenseStatus: data.result?.status,
      doctorDetails: data.result?.doctor_details,
      rawResponse: data
    };
  }

  // Utility methods
  sanitizeRequestData(verificationRequest) {
    return {
      licenseNumber: verificationRequest.licenseNumber,
      countryCode: verificationRequest.countryCode,
      issuingAuthority: verificationRequest.issuingAuthority
      // Exclude sensitive data like full doctor details
    };
  }

  sanitizeResponseData(apiResult) {
    if (!apiResult) return null;

    return {
      success: apiResult.success,
      verified: apiResult.verified,
      confidence: apiResult.confidence,
      licenseStatus: apiResult.licenseStatus
      // Exclude full raw response for privacy
    };
  }

  /**
   * Test API connectivity
   */
  async testApiConnectivity(provider) {
    try {
      const testRequest = {
        id: 'test',
        licenseNumber: 'TEST123',
        countryCode: 'ZA',
        doctor: { fullName: 'Test Doctor' }
      };

      const countryConfig = { apiProvider: provider };

      await this.verifyDoctor(testRequest, countryConfig);
      return { success: true, message: 'API connectivity test passed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ApiConnectorService();
