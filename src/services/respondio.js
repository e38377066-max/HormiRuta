import axios from 'axios';

const RESPOND_API_BASE = 'https://api.respond.io/v2';
const REQUEST_DELAY_MS = 2000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 5000;
let cloudFrontCooldown = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class RespondioService {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.lastRequestTime = 0;
    this.client = axios.create({
      baseURL: RESPOND_API_BASE,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  async throttle() {
    const now = Date.now();
    if (cloudFrontCooldown > now) {
      const cooldownWait = cloudFrontCooldown - now;
      console.log(`[Respond.io] CloudFront cooldown activo, esperando ${Math.round(cooldownWait/1000)}s...`);
      await sleep(cooldownWait);
    }
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < REQUEST_DELAY_MS) {
      await sleep(REQUEST_DELAY_MS - elapsed);
    }
    this.lastRequestTime = Date.now();
  }

  isCloudFrontBlock(error) {
    const responseData = error.response?.data;
    if (typeof responseData === 'string' && responseData.includes('cloudfront')) {
      return true;
    }
    return false;
  }

  async requestWithRetry(method, url, data = null, config = {}) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.throttle();
        let response;
        if (method === 'get') {
          response = await this.client.get(url, config);
        } else if (method === 'post') {
          response = await this.client.post(url, data, config);
        } else if (method === 'patch') {
          response = await this.client.patch(url, data, config);
        } else if (method === 'put') {
          response = await this.client.put(url, data, config);
        } else if (method === 'delete') {
          response = await this.client.delete(url, config);
        }
        return response;
      } catch (error) {
        const status = error.response?.status;

        if (this.isCloudFrontBlock(error)) {
          cloudFrontCooldown = Date.now() + 30000;
          console.log(`[Respond.io] CloudFront bloqueó la petición (${method} ${url}). Cooldown 30s, sin reintentos.`);
          throw error;
        }

        if ((status === 429) && attempt < MAX_RETRIES) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          console.log(`[Respond.io] Rate limited (${status}), reintentando en ${delay/1000}s (intento ${attempt + 1}/${MAX_RETRIES})...`);
          await sleep(delay);
          continue;
        }
        throw error;
      }
    }
  }

  async sendMessage(contactIdentifier, text, channelId = null) {
    try {
      let identifier = contactIdentifier;
      if (typeof contactIdentifier === 'number') {
        identifier = `id:${contactIdentifier}`;
      } else if (typeof contactIdentifier === 'string' && /^\d+$/.test(contactIdentifier)) {
        identifier = `id:${contactIdentifier}`;
      }
      
      const payload = {
        message: {
          type: 'text',
          text
        }
      };
      
      if (channelId) {
        payload.channelId = channelId;
      }

      const response = await this.requestWithRetry('post', `/contact/${identifier}/message`, payload);
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
        timezone: timezone,
        filter: {
          $and: []
        }
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

      const response = await this.requestWithRetry('post', '/contact/list', body, { params });
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

  async listOpenConversations(options = {}) {
    try {
      const { limit = 50, cursorId = null, timezone = 'America/Mexico_City' } = options;
      
      const params = {};
      if (limit) params.limit = Math.min(limit, 99);
      if (cursorId) params.cursorId = cursorId;

      const body = {
        search: '',
        timezone: timezone,
        filter: {
          $and: [{
            category: 'contactField',
            field: 'status',
            operator: 'isEqualTo',
            value: 'open'
          }]
        }
      };

      console.log('[Respond.io] Buscando conversaciones abiertas...');
      const response = await this.requestWithRetry('post', '/contact/list', body, { params });
      console.log(`[Respond.io] Encontradas ${response.data?.items?.length || 0} conversaciones abiertas`);
      
      return {
        success: true,
        items: response.data?.items || [],
        pagination: response.data?.pagination || null
      };
    } catch (error) {
      console.error('Respond.io list open conversations error:', error.response?.data || error.message);
      return {
        success: false,
        items: [],
        error: error.response?.data?.message || error.message
      };
    }
  }

  async listClosedConversations(options = {}) {
    try {
      const { limit = 50, cursorId = null, timezone = 'America/Mexico_City' } = options;
      
      const params = {};
      if (limit) params.limit = Math.min(limit, 99);
      if (cursorId) params.cursorId = cursorId;

      const body = {
        search: '',
        timezone: timezone,
        filter: {
          $and: [{
            category: 'contactField',
            field: 'status',
            operator: 'isEqualTo',
            value: 'closed'
          }]
        }
      };

      const response = await this.requestWithRetry('post', '/contact/list', body, { params });
      
      return {
        success: true,
        items: response.data?.items || [],
        pagination: response.data?.pagination || null
      };
    } catch (error) {
      console.error('Respond.io list closed conversations error:', error.response?.data || error.message);
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

      const response = await this.requestWithRetry('post', '/contact/list', body, { params });
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

  async listContactsByLifecycleValue(options = {}) {
    const { lifecycle = 'New Lead', limit = 50, cursorId = null, timezone = 'America/Mexico_City' } = options;
    
    try {
      const params = {};
      if (limit) params.limit = Math.min(limit, 99);
      if (cursorId) params.cursorId = cursorId;

      const body = {
        search: '',
        timezone: timezone,
        filter: {
          $and: [{
            category: 'lifecycle',
            operator: 'isEqualTo',
            value: lifecycle
          }]
        }
      };

      const response = await this.requestWithRetry('post', '/contact/list', body, { params });
      return {
        success: true,
        items: response.data?.items || [],
        pagination: response.data?.pagination || null
      };
    } catch (error) {
      console.error(`Respond.io list contacts by lifecycle (${lifecycle}) error:`, error.response?.data || error.message);
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

      const response = await this.requestWithRetry('get', `/contact/${identifier}`);
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

  async updateContactCustomFields(contactIdentifier, customFields) {
    try {
      const identifier = typeof contactIdentifier === 'number' 
        ? `id:${contactIdentifier}` 
        : contactIdentifier;

      const custom_fields = Object.entries(customFields).map(([name, value]) => ({
        name,
        value: value != null ? String(value) : null
      }));

      const response = await this.requestWithRetry('put', `/contact/${identifier}`, {
        custom_fields
      });
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Respond.io update custom fields error:', error.response?.data || error.message);
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

      const response = await this.requestWithRetry('get', `/contact/${identifier}/message/list`, null, { params });
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

      const response = await this.requestWithRetry('get', `/contact/${identifier}/message/${messageId}`);
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
      const response = await this.requestWithRetry('post', '/contact/list', {
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
  async listUsers() {
    try {
      const response = await this.requestWithRetry('get', '/user');
      const users = response.data?.data || response.data || [];
      return {
        success: true,
        users: Array.isArray(users) ? users : [users]
      };
    } catch (error) {
      if (error.response?.status === 404) {
        try {
          const response2 = await this.requestWithRetry('get', '/users');
          const users2 = response2.data?.data || response2.data || [];
          return {
            success: true,
            users: Array.isArray(users2) ? users2 : [users2]
          };
        } catch (error2) {
          console.error('Respond.io list users fallback error:', error2.response?.data || error2.message);
        }
      }
      console.error('Respond.io list users error:', error.response?.status, error.response?.data || error.message);
      const statusCode = error.response?.status;
      let errorMsg = error.response?.data?.message || error.message;
      if (statusCode === 404) {
        errorMsg = 'El endpoint de usuarios no esta disponible. Verifica que tu plan de Respond.io soporte la API de usuarios.';
      } else if (statusCode === 403) {
        errorMsg = 'Tu token de API no tiene permisos para listar usuarios.';
      }
      return {
        success: false,
        users: [],
        error: errorMsg
      };
    }
  }
}

export default RespondioService;
