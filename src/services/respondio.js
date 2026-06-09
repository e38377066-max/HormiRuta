/**
 * @fileoverview Servicio para la integración con la API v2 de Respond.io.
 * Proporciona métodos para enviar mensajes, gestionar contactos, listar conversaciones
 * y actualizar campos personalizados, incluyendo manejo de límites de tasa y reintentos.
 */

import axios from 'axios';

const RESPOND_API_BASE = 'https://api.respond.io/v2';
const REQUEST_DELAY_MS = 2000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 5000;
let cloudFrontCooldown = 0;

/**
 * Función de utilidad para pausar la ejecución.
 * @param {number} ms - Milisegundos a esperar.
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clase RespondioService para interactuar con la API de Respond.io.
 */
class RespondioService {
  /**
   * Crea una instancia de RespondioService.
   * @param {string} apiToken - Token de API para autenticación.
   */
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

  /**
   * Implementa un retraso entre peticiones para evitar límites de tasa.
   * @description Respeta tanto un retraso fijo entre peticiones como un cooldown si se detecta un bloqueo de CloudFront.
   * @returns {Promise<void>}
   * @private
   */
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

  /**
   * Verifica si el error es un bloqueo de CloudFront.
   * @param {Error} error - El error de axios.
   * @returns {boolean} True si es un bloqueo de CloudFront.
   * @private
   */
  isCloudFrontBlock(error) {
    const responseData = error.response?.data;
    if (typeof responseData === 'string' && responseData.includes('cloudfront')) {
      return true;
    }
    return false;
  }

  /**
   * Realiza una petición HTTP con lógica de reintentos y control de tasa.
   * @param {string} method - Método HTTP (get, post, patch, put, delete).
   * @param {string} url - URL relativa del endpoint.
   * @param {Object} [data=null] - Cuerpo de la petición.
   * @param {Object} [config={}] - Configuración adicional de axios.
   * @returns {Promise<Object>} Respuesta de la petición.
   * @throws {Error} Si la petición falla después de los reintentos o por bloqueo de CloudFront.
   * @private
   */
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

  /**
   * Envía un mensaje de texto a un contacto.
   * @param {number|string} contactIdentifier - ID o identificador del contacto.
   * @param {string} text - Texto del mensaje.
   * @param {string|number} [channelId=null] - ID del canal (opcional).
   * @returns {Promise<Object>} Resultado del envío.
   */
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

  /**
   * Lista contactos con opciones de filtrado y búsqueda.
   * @param {Object} [options={}] - Opciones de listado.
   * @param {number} [options.limit=50] - Límite de resultados.
   * @param {string} [options.cursorId] - Cursor para paginación.
   * @param {string} [options.status] - Filtrar por estado de contacto (ej. 'open', 'closed').
   * @param {string} [options.search] - Texto de búsqueda.
   * @param {string} [options.timezone] - Zona horaria.
   * @returns {Promise<Object>} Lista de contactos y datos de paginación.
   */
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

  /**
   * Lista contactos con conversaciones abiertas.
   * @param {Object} [options={}] - Opciones de listado.
   * @returns {Promise<Object>} Lista de contactos con conversaciones abiertas.
   */
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

  /**
   * Lista contactos con conversaciones cerradas.
   * @param {Object} [options={}] - Opciones de listado.
   * @returns {Promise<Object>} Lista de contactos con conversaciones cerradas.
   */
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

  /**
   * Lista contactos filtrando por etapa de ciclo de vida.
   * @description Prueba varios formatos de filtro debido a la variabilidad de la API de Respond.io.
   * @param {Object} [options={}] - Opciones de filtrado.
   * @param {string} [options.lifecycleStage='Pending'] - Etapa a filtrar.
   * @returns {Promise<Object>} Resultado del listado.
   */
  async listContactsByLifecycle(options = {}) {
    const { lifecycleStage = 'Pending', limit = 50, cursorId = null, timezone = 'America/Mexico_City' } = options;

    const params = {};
    if (limit) params.limit = Math.min(limit, 99);
    if (cursorId) params.cursorId = cursorId;

    // El endpoint /contact/list de Respond.io es exigente con el formato del
    // filtro por lifecycle. Probamos varios formatos hasta que uno funcione.
    const filterCandidates = [
      { category: 'lifecycle', name: 'lifecycle', operator: 'isEqualTo', value: lifecycleStage },
      { category: 'lifecycle', operator: 'isEqualTo', name: 'lifecycleStage', value: lifecycleStage },
      { category: 'systemField', field: 'lifecycle', operator: 'isEqualTo', value: lifecycleStage },
      { category: 'systemField', field: 'lifecycleStage', operator: 'isEqualTo', value: lifecycleStage },
      { category: 'contactField', field: 'lifecycle', operator: 'isEqualTo', value: lifecycleStage },
      { category: 'contactField', field: 'lifecycleStage', operator: 'isEqualTo', value: lifecycleStage }
    ];

    let lastError = null;
    for (const filter of filterCandidates) {
      try {
        const body = {
          search: '',
          timezone: timezone,
          filter: { $and: [filter] }
        };
        const response = await this.requestWithRetry('post', '/contact/list', body, { params });
        return {
          success: true,
          items: response.data?.items || [],
          pagination: response.data?.pagination || null
        };
      } catch (error) {
        lastError = error;
        const status = error.response?.status;
        if (status !== 400 && status !== 422) break;
      }
    }

    console.error(`Respond.io list contacts by lifecycle (${lifecycleStage}) error:`, lastError?.response?.data || lastError?.message);
    return {
      success: false,
      items: [],
      error: lastError?.response?.data?.message || lastError?.message || 'Unknown error'
    };
  }

  /**
   * Lista contactos por valor de ciclo de vida (formato específico).
   * @param {Object} [options={}] - Opciones de filtrado.
   * @returns {Promise<Object>} Resultado del listado.
   */
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

  /**
   * Obtiene los detalles de un contacto específico.
   * @param {string|number} contactIdentifier - ID o identificador del contacto.
   * @returns {Promise<Object>} Datos del contacto.
   */
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
      const errMsg = error.response?.data?.message || error.message || '';
      // Respond.io puede devolver HTTP 400 o HTTP 200/4xx con code:400 en el body
      const httpStatus = error.response?.status;
      const bodyCode = error.response?.data?.code;
      const isInvalidId = (httpStatus === 400 || bodyCode === 400) &&
        (errMsg.includes('is invalid') || errMsg.includes('Invalid identifier'));
      if (!isInvalidId) {
        console.error('Respond.io get contact error:', error.response?.data || error.message);
      }
      return {
        success: false,
        notFound: isInvalidId,
        error: errMsg
      };
    }
  }

  /**
   * Actualiza los campos personalizados de un contacto.
   * @description Intenta actualización por lotes primero; si falla por campos inexistentes, actualiza uno por uno omitiendo los fallidos.
   * @param {string|number} contactIdentifier - ID o identificador del contacto.
   * @param {Object} customFields - Objeto con los campos personalizados a actualizar {nombre: valor}.
   * @returns {Promise<Object>} Resultado de la actualización.
   */
  async updateContactCustomFields(contactIdentifier, customFields) {
    const idStr = String(contactIdentifier);
    const identifier = (typeof contactIdentifier === 'number' || /^\d+$/.test(idStr))
      ? `id:${idStr}`
      : idStr;

    const isFieldNotFound = (err) => {
      const msg = err?.response?.data?.message || err?.message || '';
      return err?.response?.status === 400 && /not found in the workspace/i.test(msg);
    };

    const custom_fields = Object.entries(customFields).map(([name, value]) => ({
      name,
      value: value != null ? String(value) : null
    }));

    // Try batch update first
    try {
      const response = await this.requestWithRetry('put', `/contact/${identifier}`, { custom_fields });
      return { success: true, data: response.data };
    } catch (batchError) {
      if (!isFieldNotFound(batchError) || custom_fields.length <= 1) {
        console.error('Respond.io update custom fields error:', batchError.response?.data || batchError.message);
        return { success: false, error: batchError.response?.data?.message || batchError.message };
      }
    }

    // Batch failed due to missing field(s) — update one by one, skip missing fields
    const skipped = [];
    let lastSuccess = null;
    for (const cf of custom_fields) {
      try {
        const r = await this.requestWithRetry('put', `/contact/${identifier}`, { custom_fields: [cf] });
        lastSuccess = r.data;
      } catch (fieldError) {
        if (isFieldNotFound(fieldError)) {
          skipped.push(cf.name);
          console.warn(`[Respond.io] Campo personalizado no encontrado en workspace, omitido: "${cf.name}"`);
        } else {
          console.error(`[Respond.io] Error actualizando campo "${cf.name}":`, fieldError.response?.data || fieldError.message);
        }
      }
    }

    const updated = custom_fields.length - skipped.length;
    return {
      success: updated > 0,
      skippedFields: skipped.length > 0 ? skipped : undefined,
      data: lastSuccess
    };
  }

  /**
   * Lista los mensajes de una conversación específica.
   * @param {string|number} contactIdentifier - ID o identificador del contacto.
   * @param {Object} [options={}] - Opciones de listado (limit, cursorId).
   * @returns {Promise<Object>} Lista de mensajes.
   */
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

  /**
   * Obtiene un mensaje específico por su ID.
   * @param {string|number} contactIdentifier - ID o identificador del contacto.
   * @param {string} messageId - ID del mensaje.
   * @returns {Promise<Object>} Detalles del mensaje.
   */
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

  /**
   * Prueba la conexión con la API de Respond.io.
   * @returns {Promise<Object>} Resultado de la prueba.
   */
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

  /**
   * Lista todos los usuarios (miembros) del workspace.
   * @description Realiza paginación automática para obtener la lista completa de usuarios.
   * @returns {Promise<Object>} Lista de usuarios.
   */
  async listUsers() {
    try {
      let allUsers = [];
      let cursorId = null;
      let hasMore = true;

      while (hasMore) {
        const params = { limit: 100 };
        if (cursorId) params.cursorId = cursorId;

        const response = await this.requestWithRetry('get', '/space/user', null, { params });
        const items = response.data?.items || [];
        allUsers = allUsers.concat(items);

        const nextUrl = response.data?.pagination?.next;
        if (nextUrl && items.length > 0) {
          const match = nextUrl.match(/cursorId=(-?\d+)/);
          cursorId = match ? parseInt(match[1]) : null;
          hasMore = !!cursorId;
        } else {
          hasMore = false;
        }
      }

      return {
        success: true,
        users: allUsers
      };
    } catch (error) {
      console.error('Respond.io list users error:', error.response?.status, error.response?.data || error.message);
      return {
        success: false,
        users: [],
        error: error.response?.data?.message || error.message
      };
    }
  }
}

export default RespondioService;

