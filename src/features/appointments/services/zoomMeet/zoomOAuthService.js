// ===================================
// src/services/ZoomOAuthService.js
// ===================================


const axios = require('axios');

class ZoomOAuthService {
  constructor() {
    this.accountId = process.env.ZOOM_ACCOUNT_ID;
    this.clientId = process.env.ZOOM_CLIENT_ID;
    this.clientSecret = process.env.ZOOM_CLIENT_SECRET;
    this.baseURL = 'https://api.zoom.us/v2';
    this.authURL = 'https://zoom.us/oauth/token';

    
    // Cache for access token
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get Server-to-Server OAuth access token
   */
  async getAccessToken() {
    try {
      // Check if we have a valid cached token
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      // Prepare OAuth request
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await axios.post(
        this.authURL,
        'grant_type=account_credentials&account_id=' + this.accountId,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      // Cache the token
      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000; // Subtract 5 minutes for safety

      console.log('✅ Zoom OAuth token obtained successfully');
      return this.accessToken;

    } catch (error) {
      console.error('❌ Error getting Zoom OAuth token:', error.response?.data || error.message);
      throw new Error(`Failed to get Zoom access token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Get Zoom API headers with OAuth token
   */
  async getZoomHeaders() {
    const accessToken = await this.getAccessToken();
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Validate OAuth credentials
   */
  async validateCredentials() {
    try {
      const headers = await this.getZoomHeaders();
      const response = await axios.get(`${this.baseURL}/users/me`, { headers });
      
      return {
        valid: true,
        user: response.data,
        message: 'Zoom OAuth credentials are valid'
      };
    } catch (error) {
      return {
        valid: false,
        error: error.response?.data?.message || error.message,
        needsReauth: error.response?.status === 401
      };
    }
  }
}

module.exports = ZoomOAuthService;