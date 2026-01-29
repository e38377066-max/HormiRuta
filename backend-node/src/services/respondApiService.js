/**
 * Respond.io API Service
 * Centralized service for all Respond.io API interactions
 * Supports multi-tenant usage with per-user tokens
 */

import axios from 'axios';
import MessagingSettings from '../models/MessagingSettings.js';

const API_BASE_URL = 'https://api.respond.io/v2';

class RespondApiService {
  constructor() {
    // Per-user token cache: Map<userId, {token, timestamp}>
    this.tokenCache = new Map();
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL
    // Current context for singleton usage
    this.currentUserId = null;
    this.currentToken = null;
  }

  /**
   * Set current user context (for singleton usage pattern)
   * @param {number} userId - User ID
   * @param {string} token - API token (optional, will be fetched if not provided)
   */
  setContext(userId, token = null) {
    this.currentUserId = userId;
    this.currentToken = token;
  }

  /**
   * Get API token for a specific user
   * @param {number} userId - User ID (optional, uses currentUserId if not provided)
   */
  async getToken(userId = null) {
    const uid = userId || this.currentUserId;
    
    // If token was set directly via setContext, use it
    if (this.currentToken && uid === this.currentUserId) {
      return this.currentToken;
    }
    
    // Check cache
    if (uid && this.tokenCache.has(uid)) {
      const cached = this.tokenCache.get(uid);
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.token;
      }
    }
    
    // Fetch from database
    const whereClause = uid ? { user_id: uid } : {};
    const settings = await MessagingSettings.findOne({ where: whereClause });
    
    if (!settings || !settings.respond_api_token) {
      throw new Error('Respond.io API token not configured');
    }
    
    // Cache the token
    if (uid) {
      this.tokenCache.set(uid, { 
        token: settings.respond_api_token, 
        timestamp: Date.now() 
      });
    }
    
    return settings.respond_api_token;
  }

  /**
   * Clear cached token for a user (call when settings are updated)
   */
  clearTokenCache(userId = null) {
    if (userId) {
      this.tokenCache.delete(userId);
    } else if (this.currentUserId) {
      this.tokenCache.delete(this.currentUserId);
    } else {
      this.tokenCache.clear();
    }
    this.currentToken = null;
  }

  /**
   * Make authenticated API request
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {object} data - Request body
   * @param {object} params - Query parameters
   * @param {number} userId - User ID for token lookup
   */
  async request(method, endpoint, data = null, params = null, userId = null) {
    const token = await this.getToken(userId);
    
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    if (data) config.data = data;
    if (params) config.params = params;

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`Respond.io API Error [${method} ${endpoint}]:`, error.response?.data || error.message);
      throw error;
    }
  }

  // ==========================================
  // MESSAGING ENDPOINTS
  // ==========================================

  /**
   * Send a message to a contact
   * @param {string} identifier - Contact identifier (id:123, email:x@y.com, phone:+1234)
   * @param {string} text - Message text
   * @param {number|null} channelId - Optional channel ID (uses last interacted if not specified)
   * @param {string|null} messageTag - Required for FB/IG outside 24h window
   */
  async sendMessage(identifier, text, channelId = null, messageTag = null) {
    const data = {
      message: {
        type: 'text',
        text: text
      }
    };

    if (channelId) data.channelId = channelId;
    if (messageTag) data.message.messageTag = messageTag;

    return this.request('POST', `/contact/${identifier}/message`, data);
  }

  /**
   * Get a specific message by ID
   */
  async getMessage(identifier, messageId) {
    return this.request('GET', `/contact/${identifier}/message/${messageId}`);
  }

  /**
   * List messages for a contact
   */
  async listMessages(identifier, limit = 10, cursorId = null) {
    const params = { limit };
    if (cursorId) params.cursorId = cursorId;
    return this.request('GET', `/contact/${identifier}/message`, null, params);
  }

  // ==========================================
  // CONTACT ENDPOINTS
  // ==========================================

  /**
   * Create a new contact
   */
  async createContact(identifier, contactData) {
    return this.request('POST', `/contact/${identifier}`, contactData);
  }

  /**
   * Update an existing contact
   */
  async updateContact(identifier, contactData) {
    return this.request('PUT', `/contact/${identifier}`, contactData);
  }

  /**
   * Create or update a contact
   */
  async createOrUpdateContact(identifier, contactData) {
    return this.request('POST', `/contact/create_or_update/${identifier}`, contactData);
  }

  /**
   * Delete a contact
   */
  async deleteContact(identifier) {
    return this.request('DELETE', `/contact/${identifier}`);
  }

  /**
   * Get a contact by identifier
   */
  async getContact(identifier) {
    return this.request('GET', `/contact/${identifier}`);
  }

  /**
   * List contacts
   */
  async listContacts(filters = {}) {
    return this.request('POST', '/contact/list', filters);
  }

  /**
   * Merge two contacts
   */
  async mergeContacts(contactIds, mergedData) {
    return this.request('POST', '/contact/merge', {
      contactIds,
      ...mergedData
    });
  }

  /**
   * List contact channels
   */
  async listContactChannels(identifier, limit = 10, cursorId = null) {
    const params = { limit };
    if (cursorId) params.cursorId = cursorId;
    return this.request('GET', `/contact/${identifier}/channels`, null, params);
  }

  // ==========================================
  // TAGS ENDPOINTS
  // ==========================================

  /**
   * Add tags to a contact
   * @param {string} identifier - Contact identifier
   * @param {string[]} tags - Array of tag names (1-10 tags)
   */
  async addTags(identifier, tags) {
    return this.request('POST', `/contact/${identifier}/tag`, tags);
  }

  /**
   * Remove tags from a contact
   * @param {string} identifier - Contact identifier
   * @param {string[]} tags - Array of tag names to remove
   */
  async removeTags(identifier, tags) {
    return this.request('DELETE', `/contact/${identifier}/tag`, tags);
  }

  // ==========================================
  // CONVERSATION ENDPOINTS
  // ==========================================

  /**
   * Assign or unassign a conversation
   * @param {string} identifier - Contact identifier
   * @param {string|null} assignee - User ID or email, or null to unassign
   */
  async assignConversation(identifier, assignee) {
    return this.request('POST', `/contact/${identifier}/conversation/assignee`, {
      assignee: assignee
    });
  }

  /**
   * Unassign a conversation
   */
  async unassignConversation(identifier) {
    return this.assignConversation(identifier, null);
  }

  /**
   * Open or close a conversation
   * @param {string} identifier - Contact identifier
   * @param {string} status - 'open' or 'close'
   * @param {string|null} category - Closing note name (only for close)
   * @param {string|null} summary - Summary (only if category specified)
   */
  async setConversationStatus(identifier, status, category = null, summary = null) {
    const data = { status };
    if (status === 'close' && category) {
      data.category = category;
      if (summary) data.summary = summary;
    }
    return this.request('POST', `/contact/${identifier}/conversation/status`, data);
  }

  /**
   * Open a conversation
   */
  async openConversation(identifier) {
    return this.setConversationStatus(identifier, 'open');
  }

  /**
   * Close a conversation
   */
  async closeConversation(identifier, category = null, summary = null) {
    return this.setConversationStatus(identifier, 'close', category, summary);
  }

  // ==========================================
  // LIFECYCLE ENDPOINTS
  // ==========================================

  /**
   * Update contact lifecycle stage
   * @param {string} identifier - Contact identifier
   * @param {string|null} name - Lifecycle stage name, or null to remove
   */
  async updateLifecycle(identifier, name) {
    return this.request('POST', `/contact/${identifier}/lifecycle/update`, { name });
  }

  // ==========================================
  // COMMENT ENDPOINTS
  // ==========================================

  /**
   * Add a comment to a contact
   * @param {string} identifier - Contact identifier
   * @param {string} text - Comment text (max 1000 chars). Use {{@user.ID}} to mention users
   */
  async addComment(identifier, text) {
    return this.request('POST', `/contact/${identifier}/comment`, { text });
  }

  // ==========================================
  // SPACE ENDPOINTS
  // ==========================================

  /**
   * List users in workspace
   */
  async listUsers(limit = 100, cursorId = null) {
    const params = { limit };
    if (cursorId) params.cursorId = cursorId;
    return this.request('GET', '/space/user', null, params);
  }

  /**
   * Get a specific user
   */
  async getUser(userId) {
    return this.request('GET', `/space/user/${userId}`);
  }

  /**
   * List channels in workspace
   */
  async listChannels(limit = 10, cursorId = null) {
    const params = { limit };
    if (cursorId) params.cursorId = cursorId;
    return this.request('GET', '/space/channel', null, params);
  }

  /**
   * List custom fields
   */
  async listCustomFields(limit = 10, cursorId = null) {
    const params = { limit };
    if (cursorId) params.cursorId = cursorId;
    return this.request('GET', '/space/custom_field', null, params);
  }

  /**
   * Get a custom field by ID
   */
  async getCustomField(fieldId) {
    return this.request('GET', `/space/custom_field/${fieldId}`);
  }

  /**
   * Create a custom field
   * @param {string} name - Field name (max 50 chars)
   * @param {string} dataType - Type: text, list, checkbox, email, number, url, datetime
   * @param {object} options - Optional: slug, description, allowedValues (for list type)
   */
  async createCustomField(name, dataType, options = {}) {
    const data = { name, dataType };
    if (options.slug) data.slug = options.slug;
    if (options.description) data.description = options.description;
    if (options.allowedValues) data.allowedValues = options.allowedValues;
    return this.request('POST', '/space/custom_field', data);
  }

  /**
   * List closing notes in workspace
   */
  async listClosingNotes(limit = 10, cursorId = null) {
    const params = { limit };
    if (cursorId) params.cursorId = cursorId;
    return this.request('GET', '/space/closing_notes', null, params);
  }

  /**
   * List message templates for a channel
   * @param {number} channelId - The channel ID
   */
  async listMessageTemplates(channelId, limit = 10, cursorId = null) {
    const params = { limit };
    if (cursorId) params.cursorId = cursorId;
    return this.request('GET', `/space/channel/${channelId}/template`, null, params);
  }

  /**
   * Create a space tag
   * @param {string} name - Tag name (required)
   * @param {object} options - Optional: description, colorCode, emoji
   */
  async createSpaceTag(name, options = {}) {
    const data = { name };
    if (options.description) data.description = options.description;
    if (options.colorCode) data.colorCode = options.colorCode;
    if (options.emoji) data.emoji = options.emoji;
    return this.request('POST', '/space/tag', data);
  }

  /**
   * Update a space tag
   * @param {string} currentName - Current tag name (required)
   * @param {object} updates - Fields to update: name, description, colorCode, emoji
   */
  async updateSpaceTag(currentName, updates = {}) {
    const data = { currentName };
    if (updates.name) data.name = updates.name;
    if (updates.description) data.description = updates.description;
    if (updates.colorCode) data.colorCode = updates.colorCode;
    if (updates.emoji) data.emoji = updates.emoji;
    return this.request('PUT', '/space/tag', data);
  }

  /**
   * Delete a space tag by name
   * @param {string} name - Tag name to delete
   */
  async deleteSpaceTag(name) {
    return this.request('DELETE', '/space/tag', { name });
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      await this.listUsers(1);
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || error.message 
      };
    }
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email) {
    const result = await this.listUsers(100);
    return result.items?.find(user => user.email === email);
  }

  /**
   * Find user by name
   */
  async findUserByName(firstName, lastName = null) {
    const result = await this.listUsers(100);
    return result.items?.find(user => {
      if (lastName) {
        return user.firstName === firstName && user.lastName === lastName;
      }
      return user.firstName === firstName || 
             `${user.firstName} ${user.lastName}`.toLowerCase().includes(firstName.toLowerCase());
    });
  }
}

// Export singleton instance
export default new RespondApiService();
