const axios = require("axios");

/**
 * Smartflo API Client
 * Handles authentication, token management, and all Smartflo API interactions
 * Reference: https://docs.smartflo.tatatelebusiness.com/docs/customer-connector-crm
 */

class SmartfloClient {
  constructor() {
    this.baseURL = process.env.SMARTFLO_API_BASE_URL || "https://api.smartflo.tatatelebusiness.com";
    this.email = process.env.SMARTFLO_EMAIL;
    this.password = process.env.SMARTFLO_PASSWORD;
    this.token = null;
    this.tokenExpiry = null;
    this.isRefreshing = false;
    this.refreshPromise = null;
  }

  /**
   * Login to Smartflo and get access token
   */
  async login() {
    try {
      const response = await axios.post(`${this.baseURL}/v1/auth/login`, {
        email: this.email,
        password: this.password,
      });

      if (response.data && response.data.access_token) {
        this.token = response.data.access_token;
        // Set expiry to 5 minutes before actual expiry for safety
        const expiresIn = response.data.expires_in || 3600;
        this.tokenExpiry = Date.now() + (expiresIn - 300) * 1000;
        
        console.log("Smartflo: Successfully authenticated");
        return this.token;
      } else {
        throw new Error("Invalid response from Smartflo login");
      }
    } catch (error) {
      console.error("Smartflo login error:", error.response?.data || error.message);
      throw new Error(`Smartflo authentication failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Ensure valid token exists, refresh if needed
   */
  async ensureValidToken() {
    // If token doesn't exist or is expired
    if (!this.token || !this.tokenExpiry || Date.now() >= this.tokenExpiry) {
      // If already refreshing, wait for that promise
      if (this.isRefreshing && this.refreshPromise) {
        return this.refreshPromise;
      }

      // Start refresh
      this.isRefreshing = true;
      this.refreshPromise = this.login()
        .then((token) => {
          this.isRefreshing = false;
          this.refreshPromise = null;
          return token;
        })
        .catch((error) => {
          this.isRefreshing = false;
          this.refreshPromise = null;
          throw error;
        });

      return this.refreshPromise;
    }

    return this.token;
  }

  /**
   * Make authenticated API request
   */
  async makeRequest(method, endpoint, data = null, params = null) {
    await this.ensureValidToken();

    const config = {
      method,
      url: `${this.baseURL}${endpoint}`,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    };

    if (data) config.data = data;
    if (params) config.params = params;

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`Smartflo API error [${method} ${endpoint}]:`, error.response?.data || error.message);
      
      // If unauthorized, try refreshing token once
      if (error.response?.status === 401) {
        this.token = null;
        this.tokenExpiry = null;
        await this.ensureValidToken();
        
        // Retry request
        config.headers.Authorization = `Bearer ${this.token}`;
        const retryResponse = await axios(config);
        return retryResponse.data;
      }
      
      throw error;
    }
  }

  /**
   * Click-to-Call: Initiate outbound call
   * @param {Object} params - Call parameters
   * @param {string} params.agentNumber - Agent's phone number
   * @param {string} params.destinationNumber - Customer's phone number
   * @param {string} params.callerId - Caller ID to display
   * @param {string} params.customIdentifier - Custom tracking ID
   */
  async clickToCall({ agentNumber, destinationNumber, callerId, customIdentifier }) {
    const payload = {
      agent_number: agentNumber,
      destination_number: destinationNumber,
      async: 1, // Async mode for immediate response
      caller_id: callerId || process.env.SMARTFLO_DEFAULT_CALLER_ID,
      custom_identifier: customIdentifier,
    };

    return await this.makeRequest("POST", "/v1/click_to_call", payload);
  }

  /**
   * Schedule a callback
   * @param {Object} params - Callback parameters
   */
  async scheduleCallback({ agentNumber, destinationNumber, callbackTime, remarks }) {
    const payload = {
      agent_number: agentNumber,
      destination_number: destinationNumber,
      callback_time: callbackTime, // ISO format or Unix timestamp
      remarks: remarks || "",
    };

    return await this.makeRequest("POST", "/v1/schedule_callback", payload);
  }

  /**
   * Fetch Call Detail Records (CDR)
   * @param {string} fromDate - Start date (YYYY-MM-DD)
   * @param {string} toDate - End date (YYYY-MM-DD)
   */
  async fetchCDR(fromDate, toDate) {
    const params = {
      from_date: fromDate,
      to_date: toDate,
    };

    return await this.makeRequest("GET", "/v1/cdr", null, params);
  }

  /**
   * Create a new lead list in Smartflo
   * @param {string} name - Lead list name
   * @param {string} description - Lead list description
   */
  async createLeadList(name, description = "") {
    const payload = {
      name,
      description,
    };

    return await this.makeRequest("POST", "/v1/lead_list", payload);
  }

  /**
   * Add lead to existing lead list
   * @param {string} leadListId - Smartflo lead list ID
   * @param {Object} leadData - Lead information
   */
  async addLeadToList(leadListId, leadData) {
    const payload = {
      first_name: leadData.firstName || leadData.contactName || "",
      last_name: leadData.lastName || "",
      phone_number: leadData.phoneNumber || leadData.mobileNumber,
      email: leadData.email || "",
      company: leadData.company || leadData.organization || "",
      custom_fields: leadData.customFields || {},
    };

    return await this.makeRequest("POST", `/v1/lead_list/${leadListId}/lead`, payload);
  }

  /**
   * Create a dialer campaign
   * @param {Object} params - Campaign parameters
   */
  async createCampaign({
    name,
    leadListId,
    campaignType = "progressive",
    agentNumbers = [],
    callerId,
    startTime,
    endTime,
  }) {
    const payload = {
      name,
      lead_list_id: leadListId,
      campaign_type: campaignType, // progressive, predictive, preview
      agent_numbers: agentNumbers,
      caller_id: callerId || process.env.SMARTFLO_DEFAULT_CALLER_ID,
      start_time: startTime,
      end_time: endTime,
    };

    return await this.makeRequest("POST", "/v1/campaign", payload);
  }

  /**
   * Get list of dispositions
   */
  async getDispositions() {
    return await this.makeRequest("GET", "/v1/disposition_list");
  }

  /**
   * Get list of agents
   */
  async getAgents() {
    return await this.makeRequest("GET", "/v1/agent");
  }

  /**
   * Get campaign details
   * @param {string} campaignId - Campaign ID
   */
  async getCampaign(campaignId) {
    return await this.makeRequest("GET", `/v1/campaign/${campaignId}`);
  }

  /**
   * Update campaign status
   * @param {string} campaignId - Campaign ID
   * @param {string} status - Status (active, paused, stopped)
   */
  async updateCampaignStatus(campaignId, status) {
    const payload = { status };
    return await this.makeRequest("PUT", `/v1/campaign/${campaignId}/status`, payload);
  }

  /**
   * Test connection to Smartflo API
   */
  async testConnection() {
    try {
      await this.login();
      const agents = await this.getAgents();
      return {
        success: true,
        message: "Successfully connected to Smartflo",
        agentCount: agents?.data?.length || 0,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

// Export singleton instance
module.exports = new SmartfloClient();
