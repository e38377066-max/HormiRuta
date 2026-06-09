/**
 * @fileoverview Servicio de API de Respond.io.
 * Servicio centralizado para todas las interacciones con la API de Respond.io.
 * Soporta uso multi-inquilino con tokens por usuario.
 */

import axios from 'axios';
import MessagingSettings from '../models/MessagingSettings.js';

const API_BASE_URL = 'https://api.respond.io/v2';
const REQUEST_DELAY_MS = 1200;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 3000;

/**
 * Pausa la ejecución durante un tiempo determinado.
 * @description Función de utilidad para esperar una cantidad de milisegundos.
 * @param {number} ms - Milisegundos a esperar.
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class RespondApiService {
  constructor() {
    /**
     * Caché de tokens de usuario para evitar consultas constantes a la base de datos.
     * @type {Map<number, {token: string, timestamp: number}>}
     */
    this.tokenCache = new Map();

    /**
     * Tiempo de vida de la caché del token (5 minutos).
     * @type {number}
     */
    this.CACHE_TTL = 5 * 60 * 1000;

    /**
     * ID del usuario actual en el contexto del servicio.
     * @type {number|null}
     */
    this.currentUserId = null;

    /**
     * Token de API del usuario actual.
     * @type {string|null}
     */
    this.currentToken = null;

    /**
     * Marca de tiempo de la última solicitud realizada para control de flujo (throttling).
     * @type {number}
     */
    this.lastRequestTime = 0;
  }

  /**
   * Establece el contexto del usuario actual.
   * @description Configura el ID de usuario y opcionalmente el token para las siguientes llamadas.
   * @param {number} userId - ID del usuario.
   * @param {string} [token=null] - Token de API (opcional, se buscará si no se proporciona).
   */
  setContext(userId, token = null) {
    this.currentUserId = userId;
    this.currentToken = token;
  }

  /**
   * Obtiene el token de API para un usuario específico.
   * @description Busca el token en el contexto actual, la caché o la base de datos.
   * @param {number} [userId=null] - ID del usuario (opcional, usa currentUserId si no se proporciona).
   * @returns {Promise<string>} El token de API de Respond.io.
   * @throws {Error} Si el token no está configurado.
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
   * Limpia la caché de tokens de un usuario o de todos.
   * @description Elimina el token almacenado en memoria para forzar una nueva consulta.
   * @param {number} [userId=null] - ID del usuario a limpiar. Si es null, limpia el actual o todos.
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
   * Controla el ritmo de las solicitudes a la API.
   * @description Implementa un retardo mínimo entre solicitudes para cumplir con los límites de la API.
   * @returns {Promise<void>}
   */
  async throttle() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < REQUEST_DELAY_MS) {
      await sleep(REQUEST_DELAY_MS - elapsed);
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Realiza una solicitud autenticada a la API de Respond.io.
   * @description Maneja la autenticación, reintentos en caso de límite de tasa y errores.
   * @param {string} method - Método HTTP (GET, POST, PUT, DELETE).
   * @param {string} endpoint - Endpoint de la API (relativo a la base).
   * @param {Object} [data=null] - Cuerpo de la solicitud.
   * @param {Object} [params=null] - Parámetros de consulta (query params).
   * @param {number} [userId=null] - ID de usuario para obtener el token.
   * @returns {Promise<Object>} Datos de la respuesta de la API.
   * @throws {Error} Si la solicitud falla después de los reintentos.
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

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.throttle();
        const response = await axios(config);
        return response.data;
      } catch (error) {
        const status = error.response?.status;
        if ((status === 403 || status === 429) && attempt < MAX_RETRIES) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          console.log(`[Respond.io API] Rate limited (${status}) on ${method} ${endpoint}, reintentando en ${delay/1000}s (intento ${attempt + 1}/${MAX_RETRIES})...`);
          await sleep(delay);
          continue;
        }
        console.error(`Respond.io API Error [${method} ${endpoint}]:`, error.response?.data || error.message);
        throw error;
      }
    }
  }

  // ==========================================
  // MESSAGING ENDPOINTS
  // ==========================================

  /**
   * Envía un mensaje a un contacto.
   * @param {string} identifier - Identificador del contacto (id:123, email:x@y.com, phone:+1234).
   * @param {string} text - Texto del mensaje.
   * @param {number|null} [channelId=null] - ID del canal (opcional, usa el último interactuado).
   * @param {string|null} [messageTag=null] - Etiqueta de mensaje (necesaria para FB/IG fuera de la ventana de 24h).
   * @returns {Promise<Object>} Resultado del envío.
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
   * Obtiene un mensaje específico por su ID.
   * @param {string} identifier - Identificador del contacto.
   * @param {string} messageId - ID del mensaje.
   * @returns {Promise<Object>} Datos del mensaje.
   */
  async getMessage(identifier, messageId) {
    return this.request('GET', `/contact/${identifier}/message/${messageId}`);
  }

  /**
   * Lista los mensajes de un contacto.
   * @param {string} identifier - Identificador del contacto.
   * @param {number} [limit=10] - Límite de mensajes a recuperar.
   * @param {string|null} [cursorId=null] - ID del cursor para paginación.
   * @returns {Promise<Object>} Lista de mensajes y metadatos de paginación.
   */
  async listMessages(identifier, limit = 10, cursorId = null) {
    const params = { limit };
    if (cursorId) params.cursorId = cursorId;
    return this.request('GET', `/contact/${identifier}/message/list`, null, params);
  }

  /**
   * Envía un archivo adjunto (imagen, video, audio, archivo) a un contacto.
   * @param {string} identifier - Identificador del contacto.
   * @param {string} attachmentType - Tipo: image, video, audio, file.
   * @param {string} url - URL pública del archivo adjunto.
   * @param {number|null} [channelId=null] - ID del canal (opcional).
   * @returns {Promise<Object>} Resultado del envío.
   */
  async sendAttachment(identifier, attachmentType, url, channelId = null) {
    const data = {
      message: {
        type: 'attachment',
        attachment: {
          type: attachmentType,
          url: url
        }
      }
    };

    if (channelId) data.channelId = channelId;

    return this.request('POST', `/contact/${identifier}/message`, data);
  }

  /**
   * Envía botones de respuesta rápida a un contacto.
   * @param {string} identifier - Identificador del contacto.
   * @param {string} title - Título del mensaje.
   * @param {string[]} replies - Array de opciones de respuesta.
   * @param {number|null} [channelId=null] - ID del canal (opcional).
   * @returns {Promise<Object>} Resultado del envío.
   */
  async sendQuickReply(identifier, title, replies, channelId = null) {
    const data = {
      message: {
        type: 'quick_reply',
        title: title,
        replies: replies
      }
    };

    if (channelId) data.channelId = channelId;

    return this.request('POST', `/contact/${identifier}/message`, data);
  }

  /**
   * Envía un mensaje con carga útil personalizada (custom payload).
   * @param {string} identifier - Identificador del contacto.
   * @param {Object} payload - Carga útil específica del canal.
   * @param {number|null} [channelId=null] - ID del canal (opcional).
   * @returns {Promise<Object>} Resultado del envío.
   */
  async sendCustomPayload(identifier, payload, channelId = null) {
    const data = {
      message: {
        type: 'custom_payload',
        payload: payload
      }
    };

    if (channelId) data.channelId = channelId;

    return this.request('POST', `/contact/${identifier}/message`, data);
  }

  /**
   * Envía un mensaje de plantilla de WhatsApp.
   * @param {string} identifier - Identificador del contacto.
   * @param {string} templateName - Nombre de la plantilla.
   * @param {string} languageCode - Código de idioma (ISO 639-1).
   * @param {Array} [components=[]] - Componentes de la plantilla (header, body, footer, buttons).
   * @param {number|null} [channelId=null] - ID del canal (opcional).
   * @returns {Promise<Object>} Resultado del envío.
   */
  async sendWhatsAppTemplate(identifier, templateName, languageCode, components = [], channelId = null) {
    const data = {
      message: {
        type: 'whatsapp_template',
        template: {
          name: templateName,
          languageCode: languageCode,
          components: components
        }
      }
    };

    if (channelId) data.channelId = channelId;

    return this.request('POST', `/contact/${identifier}/message`, data);
  }

  /**
   * Envía un mensaje de correo electrónico.
   * @param {string} identifier - Identificador del contacto.
   * @param {Object} emailData - Datos del correo: text, subject, cc, bcc, replyToMessageId, attachments.
   * @param {number|null} [channelId=null] - ID del canal (opcional).
   * @returns {Promise<Object>} Resultado del envío.
   */
  async sendEmail(identifier, emailData, channelId = null) {
    const message = {
      type: 'email',
      ...emailData
    };

    const data = { message };
    if (channelId) data.channelId = channelId;

    return this.request('POST', `/contact/${identifier}/message`, data);
  }

  /**
   * Envía cualquier tipo de mensaje (método genérico).
   * @param {string} identifier - Identificador del contacto.
   * @param {Object} message - Objeto de mensaje completo con tipo.
   * @param {number|null} [channelId=null] - ID del canal (opcional).
   * @returns {Promise<Object>} Resultado del envío.
   */
  async sendRawMessage(identifier, message, channelId = null) {
    const data = { message };
    if (channelId) data.channelId = channelId;

    return this.request('POST', `/contact/${identifier}/message`, data);
  }

  // ==========================================
  // CONTACT ENDPOINTS
  // ==========================================

  /**
   * Crea un nuevo contacto.
   * @param {string} identifier - Identificador del contacto.
   * @param {Object} contactData - Datos del contacto a crear.
   * @returns {Promise<Object>} Datos del contacto creado.
   */
  async createContact(identifier, contactData) {
    return this.request('POST', `/contact/${identifier}`, contactData);
  }

  /**
   * Actualiza un contacto existente.
   * @param {string} identifier - Identificador del contacto.
   * @param {Object} contactData - Datos a actualizar en el contacto.
   * @returns {Promise<Object>} Datos del contacto actualizado.
   */
  async updateContact(identifier, contactData) {
    return this.request('PUT', `/contact/${identifier}`, contactData);
  }

  /**
   * Crea o actualiza un contacto (Upsert).
   * @param {string} identifier - Identificador del contacto.
   * @param {Object} contactData - Datos del contacto.
   * @returns {Promise<Object>} Datos del contacto.
   */
  async createOrUpdateContact(identifier, contactData) {
    return this.request('POST', `/contact/create_or_update/${identifier}`, contactData);
  }

  /**
   * Elimina un contacto.
   * @param {string} identifier - Identificador del contacto.
   * @returns {Promise<Object>} Resultado de la eliminación.
   */
  async deleteContact(identifier) {
    return this.request('DELETE', `/contact/${identifier}`);
  }

  /**
   * Obtiene un contacto por su identificador.
   * @param {string} identifier - Identificador del contacto.
   * @returns {Promise<Object>} Datos del contacto.
   */
  async getContact(identifier) {
    return this.request('GET', `/contact/${identifier}`);
  }

  /**
   * Lista los contactos que coinciden con los filtros.
   * @param {Object} [filters={}] - Filtros de búsqueda.
   * @returns {Promise<Object>} Lista de contactos y metadatos.
   */
  async listContacts(filters = {}) {
    return this.request('POST', '/contact/list', filters);
  }

  /**
   * Fusiona dos contactos en uno solo.
   * @param {string[]} contactIds - Array de IDs de los contactos a fusionar.
   * @param {Object} mergedData - Datos resultantes de la fusión.
   * @returns {Promise<Object>} Contacto fusionado.
   */
  async mergeContacts(contactIds, mergedData) {
    return this.request('POST', '/contact/merge', {
      contactIds,
      ...mergedData
    });
  }

  /**
   * Lista los canales vinculados a un contacto.
   * @param {string} identifier - Identificador del contacto.
   * @param {number} [limit=10] - Límite de resultados.
   * @param {string|null} [cursorId=null] - Cursor para paginación.
   * @returns {Promise<Object>} Lista de canales.
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
   * Añade etiquetas a un contacto.
   * @param {string} identifier - Identificador del contacto.
   * @param {string[]} tags - Array de nombres de etiquetas (1-10 etiquetas).
   * @returns {Promise<Object>} Resultado de la operación.
   */
  async addTags(identifier, tags) {
    return this.request('POST', `/contact/${identifier}/tag`, tags);
  }

  /**
   * Elimina etiquetas de un contacto.
   * @param {string} identifier - Identificador del contacto.
   * @param {string[]} tags - Array de nombres de etiquetas a eliminar.
   * @returns {Promise<Object>} Resultado de la operación.
   */
  async removeTags(identifier, tags) {
    return this.request('DELETE', `/contact/${identifier}/tag`, tags);
  }

  // ==========================================
  // CONVERSATION ENDPOINTS
  // ==========================================

  /**
   * Asigna o desasigna una conversación.
   * @param {string} identifier - Identificador del contacto.
   * @param {string|null} assignee - ID de usuario o email, o null para desasignar.
   * @returns {Promise<Object>} Resultado de la operación.
   */
  async assignConversation(identifier, assignee) {
    const formattedId = String(identifier).includes(':') ? identifier : `id:${identifier}`;
    return this.request('POST', `/contact/${formattedId}/conversation/assignee`, {
      assignee: assignee
    });
  }

  /**
   * Desasigna una conversación.
   * @param {string} identifier - Identificador del contacto.
   * @returns {Promise<Object>} Resultado de la operación.
   */
  async unassignConversation(identifier) {
    return this.assignConversation(identifier, null);
  }

  /**
   * Abre o cierra una conversación.
   * @param {string} identifier - Identificador del contacto.
   * @param {string} status - 'open' o 'close'.
   * @param {string|null} [category=null] - Nombre de la nota de cierre (solo para close).
   * @param {string|null} [summary=null] - Resumen (solo si se especifica categoría).
   * @returns {Promise<Object>} Resultado de la operación.
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
   * Abre una conversación.
   * @param {string} identifier - Identificador del contacto.
   * @returns {Promise<Object>} Resultado de la operación.
   */
  async openConversation(identifier) {
    return this.setConversationStatus(identifier, 'open');
  }

  /**
   * Cierra una conversación.
   * @param {string} identifier - Identificador del contacto.
   * @param {string|null} [category=null] - Categoría de cierre.
   * @param {string|null} [summary=null] - Resumen.
   * @returns {Promise<Object>} Resultado de la operación.
   */
  async closeConversation(identifier, category = null, summary = null) {
    return this.setConversationStatus(identifier, 'close', category, summary);
  }

  // ==========================================
  // LIFECYCLE ENDPOINTS
  // ==========================================

  /**
   * Actualiza la etapa del ciclo de vida del contacto.
   * @param {string} identifier - Identificador del contacto.
   * @param {string|null} name - Nombre de la etapa del ciclo de vida, o null para eliminar.
   * @returns {Promise<Object>} Resultado de la operación.
   */
  async updateLifecycle(identifier, name) {
    const formattedId = identifier.includes(':') ? identifier : `id:${identifier}`;
    return this.request('POST', `/contact/${formattedId}/lifecycle/update`, { name });
  }

  // ==========================================
  // COMMENT ENDPOINTS
  // ==========================================

  /**
   * Añade un comentario interno a un contacto.
   * @param {string} identifier - Identificador del contacto.
   * @param {string} text - Texto del comentario (máx 1000 caracteres). Usa {{@user.ID}} para menciones.
   * @returns {Promise<Object>} Resultado de la operación.
   */
  async addComment(identifier, text) {
    return this.request('POST', `/contact/${identifier}/comment`, { text });
  }

  // ==========================================
  // SPACE ENDPOINTS
  // ==========================================

  /**
   * Lista los usuarios en el espacio de trabajo.
   * @param {number} [limit=100] - Límite de resultados.
   * @param {string|null} [cursorId=null] - Cursor para paginación.
   * @returns {Promise<Object>} Lista de usuarios.
   */
  async listUsers(limit = 100, cursorId = null) {
    const params = { limit };
    if (cursorId) params.cursorId = cursorId;
    return this.request('GET', '/space/user', null, params);
  }

  /**
   * Obtiene un usuario específico.
   * @param {string} userId - ID del usuario.
   * @returns {Promise<Object>} Datos del usuario.
   */
  async getUser(userId) {
    return this.request('GET', `/space/user/${userId}`);
  }

  /**
   * Lista los canales en el espacio de trabajo.
   * @param {number} [limit=10] - Límite de resultados.
   * @param {string|null} [cursorId=null] - Cursor para paginación.
   * @returns {Promise<Object>} Lista de canales.
   */
  async listChannels(limit = 10, cursorId = null) {
    const params = { limit };
    if (cursorId) params.cursorId = cursorId;
    return this.request('GET', '/space/channel', null, params);
  }

  /**
   * Lista los campos personalizados (custom fields) definidos.
   * @param {number} [limit=10] - Límite de resultados.
   * @param {string|null} [cursorId=null] - Cursor para paginación.
   * @returns {Promise<Object>} Lista de campos personalizados.
   */
  async listCustomFields(limit = 10, cursorId = null) {
    const params = { limit };
    if (cursorId) params.cursorId = cursorId;
    return this.request('GET', '/space/custom_field', null, params);
  }

  /**
   * Obtiene un campo personalizado por su ID.
   * @param {string} fieldId - ID del campo personalizado.
   * @returns {Promise<Object>} Datos del campo personalizado.
   */
  async getCustomField(fieldId) {
    return this.request('GET', `/space/custom_field/${fieldId}`);
  }

  /**
   * Crea un nuevo campo personalizado.
   * @param {string} name - Nombre del campo (máx 50 caracteres).
   * @param {string} dataType - Tipo: text, list, checkbox, email, number, url, datetime.
   * @param {Object} [options={}] - Opciones adicionales: slug, description, allowedValues.
   * @returns {Promise<Object>} Campo personalizado creado.
   */
  async createCustomField(name, dataType, options = {}) {
    const data = { name, dataType };
    if (options.slug) data.slug = options.slug;
    if (options.description) data.description = options.description;
    if (options.allowedValues) data.allowedValues = options.allowedValues;
    return this.request('POST', '/space/custom_field', data);
  }

  /**
   * Lista las notas de cierre definidas en el espacio de trabajo.
   * @param {number} [limit=10] - Límite de resultados.
   * @param {string|null} [cursorId=null] - Cursor para paginación.
   * @returns {Promise<Object>} Lista de notas de cierre.
   */
  async listClosingNotes(limit = 10, cursorId = null) {
    const params = { limit };
    if (cursorId) params.cursorId = cursorId;
    return this.request('GET', '/space/closing_notes', null, params);
  }

  /**
   * Lista las plantillas de mensaje para un canal específico.
   * @param {number} channelId - ID del canal.
   * @param {number} [limit=10] - Límite de resultados.
   * @param {string|null} [cursorId=null] - Cursor para paginación.
   * @returns {Promise<Object>} Lista de plantillas.
   */
  async listMessageTemplates(channelId, limit = 10, cursorId = null) {
    const params = { limit };
    if (cursorId) params.cursorId = cursorId;
    return this.request('GET', `/space/channel/${channelId}/template`, null, params);
  }

  /**
   * Crea una nueva etiqueta de espacio (space tag).
   * @param {string} name - Nombre de la etiqueta.
   * @param {Object} [options={}] - Opciones: description, colorCode, emoji.
   * @returns {Promise<Object>} Etiqueta creada.
   */
  async createSpaceTag(name, options = {}) {
    const data = { name };
    if (options.description) data.description = options.description;
    if (options.colorCode) data.colorCode = options.colorCode;
    if (options.emoji) data.emoji = options.emoji;
    return this.request('POST', '/space/tag', data);
  }

  /**
   * Actualiza una etiqueta de espacio existente.
   * @param {string} currentName - Nombre actual de la etiqueta.
   * @param {Object} [updates={}] - Campos a actualizar: name, description, colorCode, emoji.
   * @returns {Promise<Object>} Etiqueta actualizada.
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
   * Elimina una etiqueta de espacio por su nombre.
   * @param {string} name - Nombre de la etiqueta a eliminar.
   * @returns {Promise<Object>} Resultado de la eliminación.
   */
  async deleteSpaceTag(name) {
    return this.request('DELETE', '/space/tag', { name });
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Prueba la conexión con la API.
   * @returns {Promise<Object>} Éxito o error con mensaje explicativo.
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
   * Busca un usuario por su correo electrónico.
   * @description Paginación automática hasta encontrar el usuario o agotar la lista.
   * @param {string} email - Email a buscar.
   * @returns {Promise<Object|undefined>} Usuario encontrado o undefined.
   */
  async findUserByEmail(email) {
    if (!email) return undefined;
    const target = email.toLowerCase();
    let cursorId = null;
    for (let page = 0; page < 50; page++) {
      const result = await this.listUsers(100, cursorId);
      const items = result?.items || [];
      const match = items.find(user => user.email?.toLowerCase() === target);
      if (match) return match;
      cursorId = result?.pagination?.next || result?.cursorId || null;
      if (!cursorId || items.length === 0) break;
    }
    return undefined;
  }

  /**
   * Busca un usuario por su nombre.
   * @param {string} firstName - Nombre del usuario.
   * @param {string|null} [lastName=null] - Apellido del usuario (opcional).
   * @returns {Promise<Object|undefined>} Usuario encontrado o undefined.
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
