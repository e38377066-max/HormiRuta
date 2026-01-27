import axios from 'axios';

const RESPOND_API_BASE = 'https://api.respond.io/v2';

class RespondioService {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.client = axios.create({
      baseURL: RESPOND_API_BASE,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async sendMessage(contactId, text, channelId = null) {
    try {
      const payload = {
        contactId,
        message: {
          type: 'text',
          text
        }
      };
      
      if (channelId) {
        payload.channelId = channelId;
      }

      const response = await this.client.post('/message', payload);
      return {
        success: true,
        messageId: response.data?.id,
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

  async getMessage(messageId) {
    try {
      const response = await this.client.get(`/message/${messageId}`);
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

  async getContacts(limit = 100, cursorId = null, filter = null) {
    try {
      const params = { limit };
      if (cursorId) params.cursorId = cursorId;
      if (filter) params.filter = JSON.stringify(filter);

      const response = await this.client.get('/contact', { params });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Respond.io get contacts error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  async getContact(contactId) {
    try {
      const response = await this.client.get(`/contact/${contactId}`);
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

  async createContact(contactData) {
    try {
      const response = await this.client.post('/contact', contactData);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Respond.io create contact error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  async updateContact(contactId, contactData) {
    try {
      const response = await this.client.put(`/contact/${contactId}`, contactData);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Respond.io update contact error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  async findContactByPhone(phone) {
    try {
      const filter = {
        field: 'phone',
        operator: 'isEqualTo',
        value: phone
      };
      const result = await this.getContacts(1, null, filter);
      if (result.success && result.data?.data?.length > 0) {
        return {
          success: true,
          data: result.data.data[0]
        };
      }
      return {
        success: true,
        data: null
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async testConnection() {
    try {
      const response = await this.client.get('/contact', { params: { limit: 1 } });
      return {
        success: true,
        message: 'Conexion exitosa con Respond.io'
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
