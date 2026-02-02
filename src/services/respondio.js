import axios from 'axios';

const RESPOND_API_BASE = 'https://api.respond.io/v2';

class RespondioService {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.client = axios.create({
      baseURL: RESPOND_API_BASE,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  async sendMessage(contactIdentifier, text, channelId = null) {
    try {
      const identifier = typeof contactIdentifier === 'number' 
        ? `id:${contactIdentifier}` 
        : contactIdentifier;
      
      const payload = {
        message: {
          type: 'text',
          text
        }
      };
      
      if (channelId) {
        payload.channelId = channelId;
      }

      const response = await this.client.post(`/contact/${identifier}/message`, payload);
      return {
        success: true,
        messageId: response.data?.messageId,
        data: response.data
      };
    } catch (error) {
      console.error('Respond.io send message error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  async listContacts(options = {}) {
    try {
      const { limit = 50, cursorId = null, status = null, search = '', timezone = 'America/Mexico_City' } = options;
      
      const params = {};
      if (limit) params.limit = Math.min(limit, 99);
      if (cursorId) params.cursorId = cursorId;

      const body = {
        search: search || '',
        timezone: timezone
      };

      if (status) {
        body.filter = {
          $and: [{
            category: 'contactField',
            field: 'status',
            operator: 'isEqualTo',
            value: status
          }]
        };
      }

      const response = await this.client.post('/contact/list', body, { params });
      return {
        success: true,
        items: response.data?.items || [],
        pagination: response.data?.pagination || null
      };
    } catch (error) {
      console.error('Respond.io list contacts error:', error.response?.data || error.message);
      return {
        success: false,
        items: [],
        error: error.response?.data?.message || error.message
      };
    }
  }

  async listContactsByLifecycle(options = {}) {
    const { lifecycleStage = 'Pending', limit = 50, cursorId = null, timezone = 'America/Mexico_City' } = options;
    
    try {
      const params = {};
      if (limit) params.limit = Math.min(limit, 99);
      if (cursorId) params.cursorId = cursorId;

      const body = {
        search: '',
        timezone: timezone,
        filter: {
          $and: [{
            category: 'contactField',
            field: 'lifecycleStage',
            operator: 'isEqualTo',
            value: lifecycleStage
          }]
        }
      };

      const response = await this.client.post('/contact/list', body, { params });
      return {
        success: true,
        items: response.data?.items || [],
        pagination: response.data?.pagination || null
      };
    } catch (error) {
      console.error(`Respond.io list contacts by lifecycle (${lifecycleStage}) error:`, error.response?.data || error.message);
      return {
        success: false,
        items: [],
        error: error.response?.data?.message || error.message
      };
    }
  }

  async listContactsByTag(options = {}) {
    const { tag = 'New Lead', limit = 50, cursorId = null, timezone = 'America/Mexico_City' } = options;
    
    try {
      const params = {};
      if (limit) params.limit = Math.min(limit, 99);
      if (cursorId) params.cursorId = cursorId;

      const body = {
        search: '',
        timezone: timezone,
        filter: {
          $and: [{
            category: 'tag',
            operator: 'hasAny',
            value: [tag]
          }]
        }
      };

      const response = await this.client.post('/contact/list', body, { params });
      return {
        success: true,
        items: response.data?.items || [],
        pagination: response.data?.pagination || null
      };
    } catch (error) {
      console.error(`Respond.io list contacts by tag (${tag}) error:`, error.response?.data || error.message);
      return {
        success: false,
        items: [],
        error: error.response?.data?.message || error.message
      };
    }
  }

  async getContact(contactIdentifier) {
    try {
      const identifier = typeof contactIdentifier === 'number' 
        ? `id:${contactIdentifier}` 
        : contactIdentifier;

      const response = await this.client.get(`/contact/${identifier}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Respond.io get contact error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  async listMessages(contactIdentifier, options = {}) {
    try {
      const identifier = typeof contactIdentifier === 'number' 
        ? `id:${contactIdentifier}` 
        : contactIdentifier;
      
      const { limit = 50, cursorId = null } = options;
      
      const params = {};
      if (limit) params.limit = Math.min(limit, 50);
      if (cursorId) params.cursorId = cursorId;

      const response = await this.client.get(`/contact/${identifier}/message/list`, { params });
      return {
        success: true,
        items: response.data?.items || [],
        pagination: response.data?.pagination || null
      };
    } catch (error) {
      console.error('Respond.io list messages error:', error.response?.data || error.message);
      return {
        success: false,
        items: [],
        error: error.response?.data?.message || error.message
      };
    }
  }

  async getMessage(contactIdentifier, messageId) {
    try {
      const identifier = typeof contactIdentifier === 'number' 
        ? `id:${contactIdentifier}` 
        : contactIdentifier;

      const response = await this.client.get(`/contact/${identifier}/message/${messageId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Respond.io get message error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  async testConnection() {
    try {
      const response = await this.client.post('/contact/list', {
        search: '',
        filter: { $and: [] },
        timezone: 'America/Mexico_City'
      }, { params: { limit: 1 } });
      
      return {
        success: true,
        message: 'Conexión exitosa con Respond.io'
      };
    } catch (error) {
      console.error('Respond.io connection test error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }
}

export default RespondioService;
