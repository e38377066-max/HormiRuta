import ConversationState from '../models/ConversationState.js';
import MessagingSettings from '../models/MessagingSettings.js';
import MessagingOrder from '../models/MessagingOrder.js';
import ServiceAgent from '../models/ServiceAgent.js';
import AddressValidationService from './addressValidation.js';
import respondApiService from './respondApiService.js';
import AIService from './aiService.js';

class ChatbotService {
  constructor(userId, settings, isTestMode = false) {
    this.userId = userId;
    this.settings = settings;
    this.isTestMode = isTestMode;
    this.api = respondApiService;
    this.addressValidation = new AddressValidationService(userId);
    this.api.setContext(userId, settings.respond_api_token);
    
    // Tiempo de abandono en minutos (configurable)
    this.abandonmentMinutes = settings.abandonment_minutes || 30;

    // Cerebro de IA — usa key de settings o del entorno (OPENAI_API_KEY)
    const envKey = process.env.OPENAI_API_KEY || null;
    const dbKey = settings.openai_api_key || null;
    const aiKey = dbKey || envKey;
    const aiActive = settings.ai_enabled || !!envKey;
    this.ai = new AIService(aiActive ? aiKey : null, settings, userId);
    if (aiActive && aiKey) {
      console.log(`[Bot] Cerebro IA activado con OpenAI (fuente: ${dbKey ? 'base de datos' : 'entorno'})`);
    }
  }

  // ==================== UTILIDADES DE ENVÍO ====================

  async sendMessage(contactId, text) {
    try {
      const result = await this.api.sendMessage(`id:${contactId}`, text);
      console.log(`[Bot] Mensaje enviado a ${contactId}: ${text.substring(0, 50)}...`);
      
      // Registrar que el bot envió mensaje
      await this.updateConversationState(contactId, { 
        last_bot_message_at: new Date() 
      });
      
      return result;
    } catch (error) {
      console.error(`[Bot] Error enviando mensaje a ${contactId}:`, error.message);
      throw error;
    }
  }

  async sendAttachmentMsg(contactId, url, type = 'image') {
    try {
      await this.api.sendAttachment(`id:${contactId}`, type, url);
      await this.updateConversationState(contactId, { last_bot_message_at: new Date() });
      console.log(`[Bot] Attachment (${type}) enviado a ${contactId}`);
    } catch (error) {
      console.error(`[Bot] Error enviando attachment a ${contactId}:`, error.message);
    }
  }

  async assignToAgent(contactId, agentIdOrEmail, agentName = null) {
    try {
      const result = await this.api.assignConversation(`id:${contactId}`, agentIdOrEmail);
      console.log(`[Bot] Contacto ${contactId} asignado a ${agentName || agentIdOrEmail}`);
      
      await this.updateConversationState(contactId, { 
        assigned_agent_id: agentIdOrEmail,
        agent_active: true,
        last_agent_message_at: new Date()
      });
      
      return result;
    } catch (error) {
      console.error(`[Bot] Error asignando contacto ${contactId}:`, error.message);
      throw error;
    }
  }

  async addTrackingTag(contactId, tag) {
    try {
      await this.api.addTags(`id:${contactId}`, [tag]);
      console.log(`[Bot] Tag '${tag}' agregado a ${contactId}`);
    } catch (error) {
      console.error(`[Bot] Error agregando tag a ${contactId}:`, error.message);
    }
  }

  async addComment(contactId, comment) {
    try {
      await this.api.addComment(`id:${contactId}`, comment);
    } catch (error) {
      console.error(`[Bot] Error agregando comentario:`, error.message);
    }
  }

  // ==================== HORARIO ====================

  getBusinessHoursText() {
    const start = this.settings.business_hours_start || '09:00';
    const end = this.settings.business_hours_end || '18:00';
    let businessDays = this.settings.business_days || [1, 2, 3, 4, 5];
    if (typeof businessDays === 'string') {
      businessDays = businessDays.replace(/["\[\]]/g, '').split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
    }
    if (!Array.isArray(businessDays)) businessDays = [1, 2, 3, 4, 5];

    const dayNames = { 0: 'Domingo', 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado' };
    const sorted = [...businessDays].sort((a, b) => a - b);
    let daysText;
    if (JSON.stringify(sorted) === JSON.stringify([1, 2, 3, 4, 5])) {
      daysText = 'Lunes a Viernes';
    } else if (JSON.stringify(sorted) === JSON.stringify([1, 2, 3, 4, 5, 6])) {
      daysText = 'Lunes a Sábado';
    } else if (JSON.stringify(sorted) === JSON.stringify([0, 1, 2, 3, 4, 5, 6])) {
      daysText = 'todos los días';
    } else {
      daysText = sorted.map(d => dayNames[d]).join(', ');
    }

    const fmt = (t) => {
      const [h, m] = t.split(':').map(Number);
      const ampm = h >= 12 ? 'pm' : 'am';
      const h12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`;
    };

    return `${daysText} de ${fmt(start)} a ${fmt(end)} (hora de Dallas)`;
  }

  getHandoffText() {
    if (!this.isWithinBusinessHours()) {
      const hoursText = this.getBusinessHoursText();
      return `en nuestro horario de atención (${hoursText}), un agente o diseñador te atenderá 🕐`;
    }
    return 'un agente te atenderá en breve';
  }

  // ==================== VERIFICACIONES ====================

  isWithinBusinessHours() {
    if (!this.settings.business_hours_enabled) {
      return true;
    }

    const timezone = this.settings.timezone || 'America/Chicago';
    const now = new Date();
    
    const options = { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false };
    const timeStr = now.toLocaleTimeString('en-US', options);
    let [hours, minutes] = timeStr.split(':').map(Number);
    if (hours === 24) hours = 0;
    const currentMinutes = hours * 60 + minutes;

    const dayOptions = { timeZone: timezone, weekday: 'short' };
    const dayStr = now.toLocaleDateString('en-US', dayOptions);
    const dayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const currentDay = dayMap[dayStr];

    let businessDays = this.settings.business_days || [1, 2, 3, 4, 5];
    if (typeof businessDays === 'string') {
      businessDays = businessDays.replace(/["\[\]]/g, '').split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
    }
    if (!Array.isArray(businessDays)) {
      businessDays = [1, 2, 3, 4, 5];
    }

    console.log(`[Bot] Horario: dia=${dayStr}(${currentDay}), hora=${timeStr}, diasHabiles=${JSON.stringify(businessDays)}, diaEsHabil=${businessDays.includes(currentDay)}`);

    if (!businessDays.includes(currentDay)) {
      console.log(`[Bot] FUERA DE HORARIO: ${dayStr} no es dia habil`);
      return false;
    }

    const [startHour, startMin] = (this.settings.business_hours_start || '09:00').split(':').map(Number);
    const [endHour, endMin] = (this.settings.business_hours_end || '18:00').split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    const withinHours = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    if (!withinHours) {
      console.log(`[Bot] FUERA DE HORARIO: ${hours}:${minutes} fuera de ${startHour}:${startMin}-${endHour}:${endMin}`);
    }
    return withinHours;
  }

  hasExcludedTag(contact) {
    const excludedTags = this.settings.excluded_tags || ['Personal', 'Personales', 'IprintPOS', 'ClientesArea', 'Area862Designers'];
    const contactTags = contact.tags || [];
    
    for (const tag of contactTags) {
      const tagName = typeof tag === 'string' ? tag : tag.name;
      if (excludedTags.some(ex => ex.toLowerCase() === (tagName || '').toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  isConversationAbandoned(convState) {
    if (!convState.agent_active || !convState.last_agent_message_at) {
      return false;
    }
    
    const lastAgentTime = new Date(convState.last_agent_message_at).getTime();
    const now = Date.now();
    const diffMinutes = (now - lastAgentTime) / (1000 * 60);
    
    return diffMinutes >= this.abandonmentMinutes;
  }

  shouldBotRespond(convState) {
    // Si el bot está pausado, no responder
    if (convState.bot_paused) {
      return { respond: false, reason: 'bot_paused' };
    }
    
    // Si hay un agente activo, NUNCA interferir - sin excepciones
    if (convState.agent_active) {
      return { respond: false, reason: 'agent_active' };
    }
    
    // Si el último mensaje fue del bot y no ha pasado tiempo, esperar respuesta
    if (convState.last_bot_message_at && convState.last_customer_message_at) {
      const botTime = new Date(convState.last_bot_message_at).getTime();
      const customerTime = new Date(convState.last_customer_message_at).getTime();
      
      // Si el bot fue el último en escribir, esperar
      if (botTime > customerTime) {
        return { respond: false, reason: 'waiting_customer_response' };
      }
    }
    
    return { respond: true };
  }

  async isConversationReopened(contactId) {
    try {
      const convState = await ConversationState.findOne({
        where: { contact_id: contactId.toString() }
      });

      if (!convState) {
        return false;
      }

      if (convState.conversation_closed_at) {
        console.log(`[Bot] Conversacion ${contactId} fue cerrada el ${convState.conversation_closed_at} y reabierta`);
        return true;
      }

      console.log(`[Bot] Conversacion ${contactId} sigue abierta (no se ha detectado cierre), no interferir`);
      return false;
    } catch (error) {
      console.error(`[Bot] Error verificando si conversacion fue reabierta:`, error.message);
      return false;
    }
  }

  async hasAgentAlreadyResponded(contactId, isReopened = false, cutoffTime = null) {
    try {
      const result = await this.api.listMessages(`id:${contactId}`, 50);
      
      if (!result.success || !result.items) {
        return { hasResponded: false, agentName: null };
      }

      const messages = result.items;
      
      for (const msg of messages) {
        if (msg.traffic === 'outgoing' && msg.sender) {
          const senderSource = msg.sender.source || '';
          const senderId = msg.sender.userId || '';
          
          if (senderSource === 'user') {
            if (isReopened && cutoffTime) {
              const msgTime = new Date(msg.createdAt || msg.timestamp || 0).getTime();
              if (msgTime < cutoffTime) {
                continue;
              }
            }
            console.log(`[Bot] Agente (userId: ${senderId}) ya respondio en conversacion ${contactId}`);
            return { hasResponded: true, agentName: senderId };
          }
        }
      }
      
      return { hasResponded: false, agentName: null };
    } catch (error) {
      console.error(`[Bot] Error verificando mensajes de agente:`, error.message);
      return { hasResponded: false, agentName: null };
    }
  }

  async hasBotAlreadyInteracted(contactId) {
    try {
      const result = await this.api.listMessages(`id:${contactId}`, 50);
      
      if (!result.success || !result.items) {
        return false;
      }

      const messages = result.items;
      
      for (const msg of messages) {
        if (msg.traffic === 'outgoing' && msg.sender) {
          const senderSource = msg.sender.source || '';
          if (senderSource === 'bot' || senderSource === 'flow' || senderSource === 'automation') {
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error(`[Bot] Error verificando mensajes bot previos:`, error.message);
      return false;
    }
  }

  // ==================== ESTADO DE CONVERSACIÓN ====================

  async getOrCreateConversationState(contactId) {
    let state = await ConversationState.findOne({
      where: { contact_id: contactId.toString() }
    });

    if (!state) {
      state = await ConversationState.create({
        user_id: this.userId,
        contact_id: contactId.toString(),
        state: 'initial'
      });
    }

    return state;
  }

  async updateConversationState(contactId, updates) {
    const finalUpdates = { ...updates, last_interaction: new Date() };
    
    if (updates.state === 'assigned' || updates.state === 'closed_no_coverage') {
      finalUpdates.last_seen_open_at = new Date();
    }
    
    await ConversationState.update(
      finalUpdates,
      { where: { contact_id: contactId.toString() } }
    );
  }

  async checkIfExistingCustomer(contact) {
    const existingOrder = await MessagingOrder.findOne({
      where: {
        respond_contact_id: contact.id.toString()
      }
    });
    return !!existingOrder;
  }

  // ==================== PARSERS ====================

  async parseYesNoResponse(text) {
    // Intentar con IA primero (entiende "simon", "nel", "ta bien", etc.)
    if (this.ai.isAvailable) {
      const aiResult = await this.ai.classifyYesNo(text);
      if (aiResult === 'yes' || aiResult === 'no') {
        console.log(`[Bot-IA] parseYesNo: "${text}" → ${aiResult}`);
        return aiResult;
      }
    }

    // Fallback a regex
    const cleanText = text.trim().toLowerCase();
    const yesPatterns = ['si', 'sí', 'yes', 'ya', 'claro', 'correcto', 'afirmativo', 'ok', 'okay', 'dale', 'simon', 'seee', 'sep', 'sip', 'aja', 'ajá', 'exacto', 'asi es', 'así es'];
    const noPatterns = ['no', 'nop', 'nope', 'nel', 'negativo', 'todavia no', 'aun no', 'todavía no', 'aún no', 'not yet', 'nada', 'nunca'];
    
    if (yesPatterns.some(p => cleanText === p || cleanText.startsWith(p + ' ') || cleanText.includes(p))) {
      return 'yes';
    }
    if (noPatterns.some(p => cleanText === p || cleanText.startsWith(p + ' '))) {
      return 'no';
    }
    return null;
  }

  levenshteinDistance(a, b) {
    const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = a[j - 1] === b[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[b.length][a.length];
  }

  sharedLetterRatio(a, b) {
    const aChars = {};
    const bChars = {};
    for (const c of a) aChars[c] = (aChars[c] || 0) + 1;
    for (const c of b) bChars[c] = (bChars[c] || 0) + 1;
    let shared = 0;
    for (const c of Object.keys(aChars)) {
      shared += Math.min(aChars[c] || 0, bChars[c] || 0);
    }
    return shared / Math.max(a.length, b.length);
  }

  isSimilar(word, target, threshold) {
    if (!word || !target) return false;
    const maxLen = Math.max(word.length, target.length);
    if (maxLen === 0) return true;
    const dist = this.levenshteinDistance(word, target);
    const levSimilarity = 1 - (dist / maxLen);
    const sharedRatio = this.sharedLetterRatio(word, target);
    const combined = (levSimilarity + sharedRatio) / 2;
    return combined >= (threshold || 0.55);
  }

  async parseProductSelection(text, keywordOnly = false) {
    // Construir lista de productos para la IA
    let productsList = [];
    try {
      let rawList = this.settings.products_list;
      if (typeof rawList === 'string') rawList = JSON.parse(rawList);
      if (Array.isArray(rawList) && rawList.length > 0) {
        productsList = rawList.map((p, i) => ({ id: i + 1, name: p.name, message: p.message }));
      }
    } catch (e) {}
    if (productsList.length === 0) {
      productsList = [
        { id: 1, name: 'Tarjetas' },
        { id: 2, name: 'Magnéticos' },
        { id: 3, name: 'Post cards' },
        { id: 4, name: 'Playeras' }
      ];
    }

    // Intentar con IA — solo si NO estamos en modo solo-palabras-clave
    if (!keywordOnly && this.ai.isAvailable) {
      const aiNum = await this.ai.extractProductSelection(text, productsList);
      if (aiNum !== null) {
        console.log(`[Bot-IA] parseProduct: "${text}" → opción ${aiNum}`);
        if (aiNum >= 1 && aiNum <= productsList.length) {
          return productsList[aiNum - 1];
        }
        if (aiNum === productsList.length + 1) {
          return { id: aiNum, name: 'Otros', isOther: true };
        }
      }
    }

    // Fallback a lógica original
    const cleanText = text.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    const cleanTextLettersOnly = cleanText.replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
    
    const allVariants = {
      'tarjetas': ['tarjeta', 'targetas', 'targeta', 'tarjeta', 'tarjetas', 'tarjtas', 'tarjeta', 'tarjet', 'tajetas', 'tajeta', 'cards', 'card', 'presentacion', 'business cards', 'business card', 'bussines card', 'bisnes card', 'bisness'],
      'magneticos': ['magnetico', 'magneticos', 'magnets', 'magnet', 'iman', 'imanes', 'magnetic', 'magntico', 'magnsticos', 'magnetico', 'mangeticos', 'mangneticos', 'magnéticos', 'maneticos'],
      'post cards': ['postcards', 'postcard', 'post card', 'postcar', 'postcars', 'poscard', 'poscards', 'pos card', 'pos cards', 'postal', 'postales', 'flyers', 'flyer', 'volantes', 'volante', 'flayer', 'flayers', 'flyres', 'postales'],
      'playeras': ['playera', 'camisetas', 'camiseta', 'shirts', 'shirt', 't-shirt', 'tshirt', 'remeras', 'remera', 'poleras', 'polera', 'plaiera', 'plaieras', 'playras', 'playersa', 'camisas', 'camisa', 'jersey', 'jerseys'],
      'stickers': ['sticker', 'stiker', 'stikers', 'etiquetas', 'etiqueta', 'calcomanias', 'calcomania', 'pegatinas', 'pegatina', 'adhesivos', 'adhesivo'],
      'banners': ['banner', 'banners', 'baner', 'baners', 'pendones', 'pendon', 'lonas', 'lona', 'pancarta', 'pancartas', 'letrero', 'letreros'],
      'sellos': ['sello', 'sellos', 'stamp', 'stamps', 'estampas', 'estampa'],
      'gorras': ['gorra', 'gorras', 'caps', 'cap', 'cachuchas', 'cachucha', 'sombreros', 'sombrero'],
      'tazas': ['taza', 'tazas', 'mugs', 'mug', 'vasos', 'vaso', 'pocillos', 'pocillo'],
      'wraps': ['wrap', 'wraps', 'rotulado', 'rotulados', 'vinilo', 'vinilos', 'forrado', 'forrados', 'vehicular', 'vehiculares']
    };
    
    const numMatch = cleanText.match(/\b(\d+)\b/);
    if (numMatch) {
      const num = parseInt(numMatch[1]);
      if (num >= 1 && num <= productsList.length) {
        return productsList[num - 1];
      }
      if (num === productsList.length + 1) {
        return { id: num, name: 'Otros', isOther: true };
      }
    }
    
    const otherKeywords = ['otro', 'otros', 'otra', 'otras', 'diferente', 'distinto', 'other', 'something else', 'ninguno', 'ninguna', 'nada de eso'];
    for (const keyword of otherKeywords) {
      if (cleanText.includes(keyword)) {
        return { id: productsList.length + 1, name: 'Otros', isOther: true };
      }
    }

    const textVersions = [cleanText, cleanTextLettersOnly];
    const textNoSpacesVersions = [cleanText.replace(/\s+/g, ''), cleanTextLettersOnly.replace(/\s+/g, '')];

    for (const product of productsList) {
      const productName = product.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const productNameNoSpaces = productName.replace(/\s+/g, '');
      
      for (const tv of textVersions) {
        if (tv.includes(productName)) return product;
      }
      for (const tvns of textNoSpacesVersions) {
        if (tvns.includes(productNameNoSpaces)) return product;
      }
      
      const variants = allVariants[productName] || [];
      for (const variant of variants) {
        const variantNoSpaces = variant.replace(/\s+/g, '');
        for (const tv of textVersions) {
          if (tv.includes(variant)) return product;
        }
        for (const tvns of textNoSpacesVersions) {
          if (tvns.includes(variantNoSpaces)) return product;
        }
      }
      
      for (const [key, variantList] of Object.entries(allVariants)) {
        const keyNorm = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const allMatchTerms = [keyNorm, ...variantList];
        if (allMatchTerms.some(t => t === productName || t.replace(/\s+/g, '') === productNameNoSpaces)) {
          for (const term of allMatchTerms) {
            const termNoSpaces = term.replace(/\s+/g, '');
            for (const tv of textVersions) {
              if (tv.includes(term)) return product;
            }
            for (const tvns of textNoSpacesVersions) {
              if (tvns.includes(termNoSpaces)) return product;
            }
          }
        }
      }
    }
    
    const allUserWords = [...new Set([
      ...cleanText.split(/\s+/).filter(w => w.length >= 3),
      ...cleanTextLettersOnly.split(/\s+/).filter(w => w.length >= 3)
    ])];
    
    for (const word of allUserWords) {
      for (const product of productsList) {
        const productName = product.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const productWords = productName.split(/\s+/);
        
        for (const pWord of productWords) {
          if (pWord.length >= 3 && this.isSimilar(word, pWord, 0.6)) {
            return product;
          }
        }
        
        for (const [key, variantList] of Object.entries(allVariants)) {
          const keyNorm = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const allTerms = [keyNorm, ...variantList];
          if (allTerms.some(t => t === productName)) {
            for (const term of allTerms) {
              const termWords = term.split(/\s+/);
              for (const tw of termWords) {
                if (tw.length >= 3 && this.isSimilar(word, tw, 0.6)) {
                  return product;
                }
              }
            }
          }
        }
      }
    }

    return null;
  }

  async detectFrustration(text) {
    const cleanText = text.trim();

    // Detección rápida por regex (sin costo de IA)
    const upperCount = (cleanText.match(/[A-Z]/g) || []).length;
    const letterCount = (cleanText.match(/[a-zA-Z]/g) || []).length;
    if (letterCount > 5 && upperCount / letterCount > 0.7) {
      return true;
    }
    const frustrationWords = ['molesto', 'enojado', 'frustrado', 'terrible', 'pesimo', 'pésimo', 'horrible', 'mal servicio', 'no sirve'];
    if (frustrationWords.some(w => cleanText.toLowerCase().includes(w))) {
      return true;
    }

    // Si la IA está disponible, validar casos ambiguos
    if (this.ai.isAvailable) {
      const aiResult = await this.ai.detectFrustration(text);
      if (aiResult) {
        console.log(`[Bot-IA] Frustración detectada en: "${text}"`);
        return true;
      }
    }

    return false;
  }

  // ==================== HELPER IA ====================

  // Genera un mensaje con IA o usa el fallback del template si la IA no está disponible
  async getAIMsg(intent, params, fallbackMsg) {
    if (this.ai.isAvailable) {
      const aiMsg = await this.ai.generateFlowMessage(intent, params);
      if (aiMsg) return aiMsg;
    }
    return fallbackMsg;
  }

  // ==================== MENSAJES CONFIGURABLES ====================

  getMessages() {
    return {
      // Saludo nuevo cliente
      welcomeNew: this.settings.welcome_new_customer || 
        '¡Hola! 👋 Bienvenido a Area 862 Graphics 🎨\n\nNos da mucho gusto saludarte 😊\n\nCuéntame, ¿ya uno de nuestros agentes te brindó información sobre nuestros servicios y precios?',
      
      // Saludo cliente existente
      welcomeExisting: this.settings.welcome_existing_customer || 
        '¡Hola de nuevo! 👋 Qué gusto verte por aquí 😊\n\nEspero que todo haya salido bien con tu pedido anterior.\n\nCuéntame, ¿en qué puedo ayudarte hoy?',
      
      // Ya tiene info - enviar catálogo
      hasInfoResponse: this.settings.has_info_response || 
        'Perfecto ✅ Por acá puede ver algunos diseños que tenemos disponibles 🎨',
      
      // Ya tiene info - pedir ZIP después
      hasInfoRequestZip: this.settings.has_info_request_zip || 
        'Para poder continuar, necesito que me envíes tu código postal (ZIP) ✅\n\nPor ejemplo: 75208',
      
      // No tiene info - pedir ZIP
      noInfoRequestZip: this.settings.request_zip_message || 
        '¡Perfecto! Con gusto te ayudo 😄\n\nPara verificar que llegamos a tu zona, ¿me puedes compartir tu código postal (ZIP)?\n\nPor ejemplo: 75208 📍',
      
      // Con cobertura
      hasCoverage: this.settings.coverage_message || 
        '✅ ¡Excelente noticia! Sí tenemos cobertura en tu zona ({{zip_code}}) 🚚\n\nAhora cuéntame, ¿en cuál de nuestros productos estás interesado?',
      
      // Menú de productos
      productMenu: this.settings.product_menu_message || 
        '1️⃣ Tarjetas de presentación\n2️⃣ Magnéticos\n3️⃣ Post Cards\n4️⃣ Playeras\n\nSolo responde con el número 😊',
      
      // Sin cobertura
      noCoverage: this.settings.no_coverage_message || 
        'Lo sentimos, actualmente no tenemos cobertura en tu zona. Te notificaremos cuando ampliemos nuestra área de servicio.',
      
      // Producto seleccionado (con info previa) - preguntar sobre diseño
      productSelectedAskDesign: '¡Excelente elección! {{product}} 👍\n\n¿Ya tienes un diseño en mente o quieres que te lo hagamos de cero? 🎨',
      
      // Tiene diseño
      hasDesignResponse: `¡Perfecto! 📸 Envíanos tu diseño o la información de lo que necesitas.\n\n${this.getHandoffText().charAt(0).toUpperCase() + this.getHandoffText().slice(1)} para ayudarte con tu pedido 👨‍💼`,
      
      // Necesita diseño nuevo
      needsDesignResponse: `¡Genial! 🎨 Cuéntanos qué información quieres incluir en tu diseño (nombre, teléfono, logo, etc.)\n\n${this.getHandoffText().charAt(0).toUpperCase() + this.getHandoffText().slice(1)} para crear algo increíble para ti 👨‍💼`,
      
      // Producto seleccionado (sin info previa - flujo de validación)
      productSelected: this.settings.product_selected_message || 
        `¡Perfecto! Te interesan {{product}} 👍\n\nDame un momento, ${this.getHandoffText()} que te dará toda la información sobre precios, diseños y tiempos de entrega 📋✨`,
      
      // Fuera de horario
      outOfHours: this.settings.out_of_hours_message || 
        `🌙 ¡Hola! Gracias por escribirnos 😊\n\nEn este momento estamos fuera de horario de atención.\nNuestro horario es ${this.getBusinessHoursText()}.\n\n¡Pero no te preocupes! Puedo tomarte los datos de tu pedido ahora mismo 📋 y cuando estemos en horario, un agente o diseñador te contactará para confirmar todo y darte seguimiento 👨‍💼✨`,
      
      // No entendió ZIP
      remindZip: this.settings.remind_zip_message || 
        '¡No te preocupes! 😊\n\nEl código postal (ZIP) son 5 números que identifican tu zona.\nLo puedes encontrar en tu correo o buscando en Google: "ZIP code + tu ciudad"\n\nPor ejemplo, si vives en Dallas puede ser 75201.\n\n¿Me lo puedes compartir? 📍',
      
      // No entendió producto
      remindProduct: this.settings.remind_product_message || 
        'Disculpa, no entendí tu selección 😅\n\nPor favor responde con el número del producto:',
      
      // No entendió Sí/No
      remindYesNo: this.settings.remind_yes_no_message || 
        'Por favor, responde Sí o No: ¿Ya te brindaron información sobre nuestros servicios y precios? 😊',
      
      // Conversación abandonada
      abandonedConversation: this.settings.abandoned_message || 
        '¡Hola! 👋 Noté que quedamos pendientes.\n\n¿Sigues interesado en continuar con tu pedido?\n¿Hay algo más en lo que pueda ayudarte?',
      
      // Cliente frustrado
      frustratedCustomer: this.settings.frustrated_message || 
        'Entiendo tu frustración y lamento mucho cualquier inconveniente 😔\n\nDéjame pasarte de inmediato con uno de nuestros agentes para resolver tu situación de la mejor manera posible.',
      
      // Pasando a agente
      passingToAgent: this.settings.passing_to_agent_message || 
        'Un momento, te conecto con uno de nuestros agentes 👨‍💼'
    };
  }

  // ==================== PROCESO PRINCIPAL ====================

  async processMessage(contact, messageText, imageUrl = null) {
    const msgs = this.getMessages();
    
    // Verificar tags excluidos
    if (this.hasExcludedTag(contact)) {
      console.log(`[Bot] Contacto ${contact.id} tiene tag excluido, ignorando`);
      return { handled: false, reason: 'excluded_tag' };
    }

    let convState = await this.getOrCreateConversationState(contact.id);

    // PASO 1: VERIFICAR REAPERTURA - Si la conversacion fue cerrada y reabierta,
    // resetear el flujo para cliente existente ANTES de verificar agentes
    // (los mensajes de agente de ANTES del cierre no cuentan)
    let isReopened = false;
    let reopenedCutoffTime = null;
    if (convState.conversation_closed_at) {
      console.log(`[Bot] Conversacion de ${contact.id} fue cerrada el ${convState.conversation_closed_at} y reabierta, reiniciando flujo como CLIENTE EXISTENTE`);
      isReopened = true;
      reopenedCutoffTime = new Date(convState.conversation_closed_at).getTime();
      await this.updateConversationState(contact.id, { 
        state: 'initial',
        conversation_closed_at: null,
        out_of_hours_notified: false,
        agent_active: false,
        bot_paused: false,
        greeting_sent: false,
        awaiting_response: null,
        has_prior_info: true,
        is_existing_customer: true,
        is_reopened: true,
        selected_product: null,
        validated_zip: null
      });
      convState = await this.getOrCreateConversationState(contact.id);
    }

    // PASO 2: VERIFICAR AGENTE - Consultar directamente la API de Respond.io
    // Si un agente ya respondio, el bot NUNCA debe interferir
    // Para reaperturas: solo verificar mensajes de agente DESPUES de la reapertura
    // EXCEPCION: En modo de prueba, se salta esta verificación
    if (!this.isTestMode) {
      const agentCheck = await this.hasAgentAlreadyResponded(contact.id, isReopened, reopenedCutoffTime);
      if (agentCheck.hasResponded) {
        console.log(`[Bot] Agente ${agentCheck.agentName} ya atendio a ${contact.id}, bot no interferira`);
        await this.updateConversationState(contact.id, {
          agent_active: true,
          last_agent_message_at: new Date(),
          is_existing_customer: true
        });
        return { handled: false, reason: 'agent_already_responded', agentName: agentCheck.agentName };
      }
    } else {
      console.log(`[Bot] MODO PRUEBA - Saltando verificación de agente para ${contact.id}`);
    }

    // PASO 3: Manejar pausa por seguimiento o reactivación por agente
    if (convState.bot_paused) {
      console.log(`[Bot] Contacto ${contact.id} respondio tras pausa, reactivando bot y analizando contexto`);
      await this.updateConversationState(contact.id, {
        bot_paused: false,
        followup_count: 0,
        followup_last_sent_at: null,
        last_customer_message_at: new Date()
      });

      // Leer el historial reciente para decidir si es flujo de cierre o pregunta nueva
      if (this.ai.isAvailable) {
        try {
          let recentMessages = [];
          const histResult = await this.api.listMessages(`id:${contact.id}`, 15);
          if (histResult.success && histResult.items) {
            recentMessages = histResult.items.map(m => ({
              text: m.body?.text || m.text || '',
              isFromBot: m.sender?.source === 'bot' || m.sender?.source === 'automation',
              isFromAgent: m.sender?.source === 'user' && m.traffic === 'outgoing',
              isFromCustomer: m.traffic === 'incoming'
            })).filter(m => m.text);
          }

          if (recentMessages.length > 0) {
            const closingAnalysis = await this.ai.analyzeClosingContext(recentMessages);
            console.log(`[Bot] Post-reactivación análisis cierre: closing=${closingAnalysis.isClosingFlow}, confidence=${closingAnalysis.confidence}, reason=${closingAnalysis.reason}`);

            if (closingAnalysis.isClosingFlow && closingAnalysis.confidence !== 'baja') {
              console.log(`[Bot] Iniciando flujo de cierre automático para ${contact.id} (producto: ${closingAnalysis.product})`);
              return await this.startClosingFlow(contact, closingAnalysis.product || 'tarjetas');
            }
          }
        } catch (e) {
          console.error('[Bot] Error analizando contexto post-reactivación:', e.message);
        }
      }

      convState = await this.getOrCreateConversationState(contact.id);
    } else {
      await this.updateConversationState(contact.id, { 
        last_customer_message_at: new Date(),
        followup_count: 0,
        followup_last_sent_at: null
      });
    }
    
    // PASO 4: VERIFICAR HISTORIAL para conversaciones abiertas sin cerrar
    // Si el bot ya interactuó antes, NO iniciar un nuevo flujo
    // EXCEPCION: En modo prueba se salta esta verificación
    if (!this.isTestMode && convState.state === 'initial' && !convState.conversation_closed_at && !convState.is_existing_customer && !isReopened) {
      const botAlreadyTalked = await this.hasBotAlreadyInteracted(contact.id);
      if (botAlreadyTalked) {
        console.log(`[Bot] Contacto ${contact.id} ya tiene mensajes del bot en historial (conversacion abierta sin cerrar), bot NO interferira`);
        await this.updateConversationState(contact.id, { 
          state: 'assigned',
          is_existing_customer: true
        });
        return { handled: false, reason: 'bot_already_interacted_open_conversation' };
      }
    }

    // Recargar el estado actualizado
    convState = await this.getOrCreateConversationState(contact.id);

    // REANUDACION POST FUERA-DE-HORARIO
    if (convState.out_of_hours_notified && this.isWithinBusinessHours()) {
      const agentCheck = await this.hasAgentAlreadyResponded(contact.id, false);
      if (!agentCheck.hasResponded) {
        // Si el cliente ya completó el flujo OOH (estado 'assigned' u otro terminal),
        // no reiniciamos — solo limpiamos el flag
        if (convState.state === 'assigned' || convState.state === 'closed_no_coverage') {
          await this.updateConversationState(contact.id, { out_of_hours_notified: false });
          convState = await this.getOrCreateConversationState(contact.id);
          console.log(`[Bot] Contacto ${contact.id} vuelve en horario con flujo completado OOH (estado: ${convState.state}), limpiando flag`);
        } else {
          const botInteracted = await this.hasBotAlreadyInteracted(contact.id);
          const isExisting = botInteracted || convState.is_existing_customer;
          console.log(`[Bot] Contacto ${contact.id} vuelve en horario de atencion, ningun agente respondio, reiniciando flujo como ${isExisting ? 'CLIENTE EXISTENTE' : 'CLIENTE NUEVO'}`);
          await this.updateConversationState(contact.id, { 
            out_of_hours_notified: false,
            agent_active: false,
            state: 'initial',
            is_existing_customer: isExisting,
            has_prior_info: isExisting
          });
          convState = await this.getOrCreateConversationState(contact.id);
        }
      } else {
        console.log(`[Bot] Contacto ${contact.id} vuelve en horario pero agente ${agentCheck.agentName} ya respondio, bot no interferira`);
        return { handled: false, reason: 'agent_already_responded' };
      }
    }

    // VERIFICACIÓN CON IA: Si hay agente activo, preguntar a la IA si puede intervenir
    if (convState.agent_active && this.ai.isAvailable) {
      let recentMessages = [];
      try {
        const histResult = await this.api.listMessages(`id:${contact.id}`, 10);
        if (histResult.success && histResult.items) {
          recentMessages = histResult.items.map(m => ({
            text: m.body?.text || m.text || '',
            isFromBot: m.sender?.source === 'bot' || m.sender?.source === 'automation',
            isFromAgent: m.sender?.source === 'user' && m.traffic === 'outgoing',
            isFromCustomer: m.traffic === 'incoming'
          })).filter(m => m.text);
        }
      } catch (e) {
        console.error('[Bot-IA] Error obteniendo historial para intervención:', e.message);
      }

      const intervention = await this.ai.evaluateAgentIntervention(messageText, recentMessages, convState);
      if (intervention.shouldIntervene && intervention.response) {
        console.log(`[Bot-IA] Interviniendo durante agente: ${intervention.reason}`);
        await this.sendMessage(contact.id, intervention.response);
        await this.addComment(contact.id, `[Bot-IA] Respondió FAQ durante atención de agente: "${messageText}"`);
        return { handled: true, action: 'ai_faq_during_agent', reason: intervention.reason };
      } else {
        console.log(`[Bot-IA] No intervenir durante agente: ${intervention.reason}`);
        return { handled: false, reason: 'agent_active_ai_decided_no_intervene' };
      }
    }

    // Verificar si el bot debe responder
    const shouldRespond = this.shouldBotRespond(convState);
    if (!shouldRespond.respond) {
      console.log(`[Bot] No responder a ${contact.id}: ${shouldRespond.reason}`);
      return { handled: false, reason: shouldRespond.reason };
    }

    // Detectar frustración - pasar a agente inmediatamente
    if (await this.detectFrustration(messageText)) {
      const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || null;
      const frustMsg = await this.getAIMsg('frustrated', { customerName }, msgs.frustratedCustomer);
      await this.sendMessage(contact.id, frustMsg);
      await this.assignToDefaultAgent(contact.id);
      await this.addTrackingTag(contact.id, 'ClienteFrustrado');
      await this.updateConversationState(contact.id, { state: 'assigned' });
      return { handled: true, action: 'frustrated_customer' };
    }

    // Verificar horario de atención
    if (!this.isWithinBusinessHours()) {
      if (!convState.out_of_hours_notified) {
        const customerNameOOH = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || null;
        const isExistingOOH = convState.is_existing_customer || convState.is_reopened || false;
        const outMsg = await this.getAIMsg('out_of_hours', {
          customerName: customerNameOOH,
          lastMessage: messageText,
          isExisting: isExistingOOH,
          businessHours: this.getBusinessHoursText()
        }, msgs.outOfHours);
        await this.sendMessage(contact.id, outMsg);
        await this.updateConversationState(contact.id, { out_of_hours_notified: true });
        convState.out_of_hours_notified = true;
        await this.addTrackingTag(contact.id, 'FueraDeHorario');
        console.log(`[Bot] Fuera de horario — aviso enviado a ${contact.id}, continuando flujo normal`);
      }
      // Continúa el flujo normal aunque sea fuera de horario
    } else {
      // Reset out of hours flag si volvimos a horario hábil
      if (convState.out_of_hours_notified) {
        await this.updateConversationState(contact.id, { out_of_hours_notified: false });
        convState.out_of_hours_notified = false;
      }
    }

    // Verificar si conversación fue abandonada
    if (this.isConversationAbandoned(convState)) {
      const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || null;
      const abandonMsg = await this.getAIMsg('abandoned', { customerName, lastMessage: messageText }, msgs.abandonedConversation);
      await this.sendMessage(contact.id, abandonMsg);
      await this.updateConversationState(contact.id, { 
        state: 'awaiting_continuation',
        agent_active: false 
      });
      return { handled: true, action: 'abandoned_reengagement' };
    }

    if (convState.state !== 'assigned' && convState.state !== 'closed_no_coverage' && !convState.agent_active) {
      const isZipMessage = this.addressValidation.isZipCodeMessage(messageText);
      const isCityMessage = this.addressValidation.isCityMessage(messageText);
      
      if (isZipMessage || isCityMessage) {
        const isLikelyAddress = this.addressValidation.isLikelyAddress ? 
          this.addressValidation.isLikelyAddress(messageText) : false;
        if (!isLikelyAddress || isZipMessage) {
          return await this.handleZipValidation(contact, messageText, convState);
        }
      }
    }

    // Procesar según estado actual
    switch (convState.state) {
      case 'initial':
        return await this.handleInitialState(contact, messageText, convState);
      
      case 'awaiting_prior_info':
        return await this.handleAwaitingPriorInfo(contact, messageText, convState);
      
      case 'awaiting_zip':
        return await this.handleAwaitingZip(contact, messageText, convState);
      
      case 'awaiting_zip_no_info':
        return await this.handleAwaitingZipNoInfo(contact, messageText, convState);
      
      case 'awaiting_product_no_info':
        return await this.handleAwaitingProductNoInfo(contact, messageText, convState);
      
      case 'awaiting_product_response':
        return await this.handleAwaitingProductResponse(contact, messageText, convState);
      
      case 'awaiting_product_selection':
      case 'awaiting_product_selection_with_info':
        return await this.handleAwaitingProductSelection(contact, messageText, convState);
      
      case 'awaiting_design_info':
        return await this.handleAwaitingDesignInfo(contact, messageText, convState);
      
      case 'awaiting_product':
        return await this.handleAwaitingProduct(contact, messageText, convState);
      
      case 'awaiting_continuation':
        return await this.handleAwaitingContinuation(contact, messageText, convState);
      
      case 'closing_approval':
        return await this.handleClosingApproval(contact, messageText, convState);
      
      case 'closing_quantity':
        return await this.handleClosingQuantity(contact, messageText, convState);
      
      case 'closing_address':
        return await this.handleClosingAddress(contact, messageText, convState);
      
      case 'closing_deposit_verification':
        return await this.handleClosingDepositVerification(contact, messageText, convState, imageUrl);

      case 'closing_complete':
        return { handled: false, reason: 'order_already_completed' };

      case 'assigned': {
        const wasReopened = await this.isConversationReopened(contact.id);
        if (wasReopened) {
          console.log(`[Bot] Conversacion de ${contact.id} fue cerrada y reabierta, reiniciando flujo`);
          await this.updateConversationState(contact.id, { 
            state: 'initial', 
            conversation_closed_at: null 
          });
          return await this.handleInitialState(contact, messageText, convState);
        }
        return { handled: false, reason: 'already_assigned' };
      }
      
      case 'closed_no_coverage': {
        const wasReopenedNoCov = await this.isConversationReopened(contact.id);
        if (wasReopenedNoCov) {
          console.log(`[Bot] Conversacion de ${contact.id} (sin cobertura) fue cerrada y reabierta, reiniciando flujo`);
          await this.updateConversationState(contact.id, { 
            state: 'initial', 
            conversation_closed_at: null 
          });
          return await this.handleInitialState(contact, messageText, convState);
        }
        return { handled: true, action: 'ignored_no_coverage' };
      }
      
      default:
        return await this.handleInitialState(contact, messageText, convState);
    }
  }

  // ==================== HANDLERS POR ESTADO ====================

  detectMessageIntent(messageText) {
    const lowerText = messageText.toLowerCase().trim();
    
    // Detectar si quiere información
    if (lowerText.includes('informacion') || lowerText.includes('información') ||
        lowerText.includes('info') || lowerText.includes('precios') ||
        lowerText.includes('costo') || lowerText.includes('cuanto')) {
      return 'wants_info';
    }
    
    // Detectar si quiere ordenar
    if (lowerText.includes('ordenar') || lowerText.includes('pedir') ||
        lowerText.includes('comprar') || lowerText.includes('quiero') ||
        lowerText.includes('necesito')) {
      return 'wants_order';
    }
    
    // Detectar saludo simple
    if (lowerText.match(/^(hola|hi|buenos?\s*d[ií]as?|buenas?\s*tardes?|buenas?\s*noches?)[\s!,.]*$/i)) {
      return 'greeting';
    }
    
    return 'unknown';
  }

  detectFacebookAdOrigin(contact) {
    // Detectar si viene de Facebook Ad por el canal o fuente
    const source = contact.source?.toLowerCase() || '';
    const channel = contact.channel?.toLowerCase() || '';
    const lastChannel = contact.lastChannel?.toLowerCase() || '';
    
    if (source.includes('facebook') || source.includes('fb') ||
        channel.includes('facebook') || channel.includes('fb') ||
        lastChannel.includes('facebook') || lastChannel.includes('fb')) {
      return true;
    }
    
    // También detectar por tags
    const tags = contact.tags || [];
    if (tags.some(t => t.toLowerCase().includes('facebook') || t.toLowerCase().includes('fb'))) {
      return true;
    }
    
    return false;
  }

  async handleInitialState(contact, messageText, convState) {
    const msgs = this.getMessages();
    const isExistingFromDB = await this.checkIfExistingCustomer(contact);
    const isExisting = isExistingFromDB || convState.is_existing_customer || convState.is_reopened;
    const isFromFacebookAd = this.detectFacebookAdOrigin(contact);
    const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || null;

    // ─── DETECCIÓN DE PEDIDO DIRECTO ─────────────────────────────────────────
    // Si el cliente ya menciona un producto específico desde el primer mensaje,
    // no hay que hacerle el flujo completo — ya sabe lo que quiere.
    // IMPORTANTE: en el estado inicial usamos solo palabras clave (sin IA) para
    // evitar falsos positivos donde el AI alucina un producto en mensajes que
    // en realidad son datos de contacto, saludos o información general.
    const directProduct = await this.parseProductSelection(messageText, true);
    if (directProduct && !directProduct.isOther) {
      return await this.handleDirectOrderRequest(contact, messageText, directProduct, customerName);
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (isExisting) {
      const welcomeMsg = await this.getAIMsg('welcome_existing', { customerName, lastMessage: messageText }, msgs.welcomeExisting);
      await this.sendMessage(contact.id, welcomeMsg);
      
      const productMenu = this.generateProductMenu();
      await this.sendMessage(contact.id, productMenu);
      
      await this.updateConversationState(contact.id, {
        state: 'awaiting_product_selection_with_info',
        is_existing_customer: true,
        has_prior_info: true,
        greeting_sent: true
      });
      
      await this.addTrackingTag(contact.id, 'ClienteExistente');
      await this.addComment(contact.id, '[Bot] Cliente recurrente. Mostrando menu de productos.');
      
      return { handled: true, action: 'welcome_existing_show_menu' };
    }
    
    // Si viene de Facebook Ad, saludar y pedir ZIP directo (flujo sin info)
    if (isFromFacebookAd) {
      const greeting = await this.getAIMsg(
        'facebook_ad_welcome',
        { customerName, lastMessage: messageText },
        this.settings.welcome_from_ads || 'Hola! 👋 Gracias por tu interes.\n\nPara verificar si tenemos cobertura en tu zona, por favor enviame tu codigo postal (ZIP) 📍\n\nPor ejemplo: 75208'
      );
      await this.sendMessage(contact.id, greeting);
      
      await this.updateConversationState(contact.id, {
        state: 'awaiting_zip_no_info',
        has_prior_info: false,
        from_ads: true,
        awaiting_response: 'zip_code',
        greeting_sent: true
      });
      await this.addTrackingTag(contact.id, 'FacebookAd');
      
      return { handled: true, action: 'facebook_ad_direct_zip' };
    }
    
    // Para cualquier mensaje genérico: saludar y preguntar si ya tiene información previa
    const welcomeMsg = await this.getAIMsg('welcome_new', { customerName, lastMessage: messageText }, msgs.welcomeNew);
    await this.sendMessage(contact.id, welcomeMsg);
    await this.updateConversationState(contact.id, {
      state: 'awaiting_prior_info',
      awaiting_response: 'yes_no',
      greeting_sent: true
    });
    
    return { handled: true, action: 'welcome_new' };
  }

  // Maneja el caso donde el cliente llega ya sabiendo lo que quiere
  async handleDirectOrderRequest(contact, messageText, product, customerName) {
    const ooh = !this.isWithinBusinessHours();
    const oohParams = ooh ? { outOfHours: true, businessHours: this.getBusinessHoursText() } : {};
    const directMsg = await this.getAIMsg(
      'direct_order',
      { customerName, product: product.name, lastMessage: messageText, ...oohParams },
      `¡Hola! Claro que te ayudamos con ${product.name} 😊\n\n${this.getHandoffText().charAt(0).toUpperCase() + this.getHandoffText().slice(1)} que te dará todos los detalles sobre precio, tiempo de entrega y diseño 📋✨`
    );
    await this.sendMessage(contact.id, directMsg);
    
    // Enviar info del producto si está configurada
    const productInfo = this.getProductInfoMessage(product.name);
    if (productInfo) {
      await this.sendMessage(contact.id, productInfo);
    }
    
    await this.updateConversationState(contact.id, {
      state: 'assigned',
      selected_product: product.name,
      has_prior_info: true,
      greeting_sent: true
    });
    
    const agent = await this.findAgentForProduct(product.name);
    if (agent) {
      await this.assignToAgent(contact.id, agent.respond_agent_id || agent.agent_id, agent.agent_name);
    } else {
      await this.assignToDefaultAgent(contact.id);
    }
    
    await this.addTrackingTag(contact.id, 'PedidoDirecto');
    await this.addTrackingTag(contact.id, `Producto_${product.name}`);
    await this.addComment(contact.id, `[Bot] Cliente llegó directo con pedido de: ${product.name}. Mensaje: "${messageText}"`);
    
    console.log(`[Bot] Pedido directo detectado: "${product.name}" desde mensaje: "${messageText}"`);
    return { handled: true, action: 'direct_order_assigned', product: product.name };
  }

  async handleAwaitingPriorInfo(contact, messageText, convState) {
    const msgs = this.getMessages();
    const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || null;

    // Si el cliente menciona un producto directamente, cortocircuitar el flujo
    const directProduct = await this.parseProductSelection(messageText);
    if (directProduct && !directProduct.isOther) {
      return await this.handleDirectOrderRequest(contact, messageText, directProduct, customerName);
    }

    const response = await this.parseYesNoResponse(messageText);
    
    if (response === 'yes') {
      // Ya tiene info - mostrar menú de productos
      const productMenu = this.generateProductMenu();
      await this.sendMessage(contact.id, productMenu);
      
      await this.updateConversationState(contact.id, {
        state: 'awaiting_product_selection',
        has_prior_info: true,
        awaiting_response: 'product'
      });
      return { handled: true, action: 'has_info_ask_product' };
      
    } else if (response === 'no') {
      // No tiene info - pedir ZIP primero para validar cobertura
      const zipMsg = await this.getAIMsg('ask_zip_no_info', { customerName }, msgs.noInfoRequestZip);
      await this.sendMessage(contact.id, zipMsg);
      await this.updateConversationState(contact.id, {
        state: 'awaiting_zip_no_info',
        has_prior_info: false,
        awaiting_response: 'zip_code'
      });
      return { handled: true, action: 'no_info_request_zip' };
      
    } else {
      // No entendió, recordar
      const remindMsg = await this.getAIMsg('remind_yes_no', { customerName, lastMessage: messageText }, msgs.remindYesNo);
      await this.sendMessage(contact.id, remindMsg);
      return { handled: true, action: 'remind_yes_no' };
    }
  }

  async handleAwaitingProductSelection(contact, messageText, convState) {
    // Este handler es para clientes que YA tienen información
    const msgs = this.getMessages();
    const product = await this.parseProductSelection(messageText);
    
    if (product) {
      // Si seleccionó "Otros", asignar a agente directamente
      if (product.isOther) {
        const otherMsg = `¡Perfecto! ${this.getHandoffText().charAt(0).toUpperCase() + this.getHandoffText().slice(1)} para ayudarte con tu consulta 😊`;
        await this.sendMessage(contact.id, otherMsg);
        
        await this.updateConversationState(contact.id, {
          state: 'assigned',
          selected_product: 'Otros'
        });
        
        await this.assignToDefaultAgent(contact.id);
        await this.addTrackingTag(contact.id, 'ProductoOtros');
        await this.addComment(contact.id, `[Bot] Cliente seleccionó "Otros". Requiere atención de agente.`);
        
        return { handled: true, action: 'other_product_assigned' };
      }
      
      // Cliente YA tiene información - preguntar sobre diseño
      const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || null;
      const designQuestion = await this.getAIMsg(
        'product_selected_ask_design',
        { customerName, product: product.name || product },
        msgs.productSelectedAskDesign?.replace('{{product}}', product.name || product) ||
          `Perfecto, ${product.name || product} 👍\n\n¿Ya tienes un diseño en mente o te gustaría que te ayudemos a crear uno desde cero?`
      );
      
      await this.sendMessage(contact.id, designQuestion);
      
      await this.updateConversationState(contact.id, {
        state: 'awaiting_design_info',
        selected_product: product.name || product,
        awaiting_response: 'design_info'
      });
      
      return { handled: true, action: 'product_selected_ask_design' };
    } else {
      // No entendió, mostrar menú de nuevo
      const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || null;
      const remindMsg = await this.getAIMsg('remind_product', { customerName, lastMessage: messageText }, msgs.remindProduct);
      await this.sendMessage(contact.id, remindMsg);
      const productMenu = this.generateProductMenu();
      await this.sendMessage(contact.id, productMenu);
      return { handled: true, action: 'remind_product' };
    }
  }

  async handleAwaitingDesignInfo(contact, messageText, convState) {
    const msgs = this.getMessages();
    const hasDesign = this.parseDesignResponse(messageText);
    const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || null;

    const ooh = !this.isWithinBusinessHours();
    const oohParams = ooh ? { outOfHours: true, businessHours: this.getBusinessHoursText() } : {};

    if (hasDesign === 'no') {
      const needsMsg = await this.getAIMsg('needs_design', { customerName, ...oohParams }, msgs.needsDesignResponse);
      await this.sendMessage(contact.id, needsMsg);
    } else {
      // Tiene diseño o respuesta ambigua (asumir que sí tiene)
      const hasMsg = await this.getAIMsg('has_design', { customerName, ...oohParams }, msgs.hasDesignResponse);
      await this.sendMessage(contact.id, hasMsg);
    }
    
    // Asignar a agente
    await this.assignToDefaultAgent(contact.id);
    await this.addTrackingTag(contact.id, `Producto_${convState.selected_product || 'General'}`);
    await this.addTrackingTag(contact.id, hasDesign === 'yes' ? 'TieneDiseno' : 'NecesitaDiseno');
    
    await this.updateConversationState(contact.id, {
      state: 'assigned',
      context_data: { 
        ...convState.context_data,
        has_design: hasDesign === 'yes'
      }
    });
    
    return { handled: true, action: 'design_info_received_assigned' };
  }

  parseDesignResponse(text) {
    const lowerText = text.toLowerCase().trim();
    
    // Detectar si tiene diseño
    if (lowerText.includes('ya tengo') || lowerText.includes('si tengo') ||
        lowerText.includes('tengo diseño') || lowerText.includes('tengo un diseño') ||
        lowerText.match(/^s[ií][\s,!.]*$/i) || lowerText.includes('ya lo tengo')) {
      return 'yes';
    }
    
    // Detectar si necesita diseño nuevo
    if (lowerText.includes('de cero') || lowerText.includes('desde cero') ||
        lowerText.includes('no tengo') || lowerText.includes('haganlo') ||
        lowerText.includes('háganlo') || lowerText.includes('nuevo') ||
        lowerText.match(/^no[\s,!.]*$/i)) {
      return 'no';
    }
    
    // Respuesta ambigua
    return 'unknown';
  }

  async handleAwaitingZip(contact, messageText, convState) {
    const msgs = this.getMessages();
    
    const isZipMessage = this.addressValidation.isZipCodeMessage(messageText);
    const isCityMessage = this.addressValidation.isCityMessage(messageText);
    
    if (isZipMessage || isCityMessage) {
      return await this.handleZipValidation(contact, messageText, convState);
    } else {
      const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || null;
      const remindMsg = await this.getAIMsg('remind_zip', { customerName, lastMessage: messageText }, msgs.remindZip);
      await this.sendMessage(contact.id, remindMsg);
      return { handled: true, action: 'remind_zip' };
    }
  }

  async handleZipValidation(contact, messageText, convState) {
    const msgs = this.getMessages();
    const validation = await this.addressValidation.validateZipOrCity(messageText);
    const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Sin nombre';
    const name = customerName !== 'Sin nombre' ? customerName : null;
    
    if (validation.valid) {
      const fallbackCoverage = msgs.hasCoverage
        .replace('{{zip_code}}', validation.value)
        .replace('{{city}}', validation.zone?.city || '')
        .replace('{{zone}}', validation.zone?.zone_name || '');
      const coverageMsg = await this.getAIMsg('zip_covered', {
        customerName: name,
        zipCode: validation.value,
        city: validation.zone?.city || null,
        zone: validation.zone?.zone_name || null
      }, fallbackCoverage);
      
      await this.sendMessage(contact.id, coverageMsg);
      await this.sendMessage(contact.id, this.generateProductMenu());
      
      await this.createOrUpdateOrder(contact, validation.value, customerName, 'covered', validation.zone);
      
      await this.updateConversationState(contact.id, {
        state: 'awaiting_product_no_info',
        validated_zip: validation.value,
        has_prior_info: false,
        awaiting_response: 'product_selection'
      });
      
      await this.addTrackingTag(contact.id, 'ConCobertura');
      
      return { handled: true, action: 'zip_validated_show_menu' };
      
    } else {
      const fallbackNoCoverage = msgs.noCoverage
        .replace('{{zip_code}}', validation.value)
        .replace('{{city}}', validation.value);
      const noCoverageMsg = await this.getAIMsg('zip_no_coverage', {
        customerName: name,
        zipCode: validation.value
      }, fallbackNoCoverage);
      
      await this.sendMessage(contact.id, noCoverageMsg);
      await this.createOrUpdateOrder(contact, validation.value, customerName, 'no_coverage', null);
      await this.addTrackingTag(contact.id, 'SinCobertura');
      await this.addComment(contact.id, `[Bot] Cliente en zona sin cobertura. ZIP: ${validation.value}`);
      
      await this.updateConversationState(contact.id, { state: 'closed_no_coverage' });
      
      return { handled: true, action: 'zip_no_coverage_closed' };
    }
  }

  // Handler para usuarios SIN información esperando ZIP
  async handleAwaitingZipNoInfo(contact, messageText, convState) {
    const msgs = this.getMessages();
    const isZipMessage = this.addressValidation.isZipCodeMessage(messageText);
    const isCityMessage = this.addressValidation.isCityMessage(messageText);
    
    if (isZipMessage || isCityMessage) {
      return await this.handleZipValidation(contact, messageText, convState);
    } else {
      const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || null;
      const insistMsg = await this.getAIMsg(
        'remind_zip',
        { customerName, lastMessage: messageText },
        'Por favor, antes de continuar necesito que me envies tu codigo postal (ZIP) para validar si tenemos cobertura en tu zona 📍\n\nPor ejemplo: 75208'
      );
      await this.sendMessage(contact.id, insistMsg);
      return { handled: true, action: 'insist_zip' };
    }
  }

  // Handler para usuarios SIN información seleccionando producto
  async handleAwaitingProductNoInfo(contact, messageText, convState) {
    const msgs = this.getMessages();
    const product = await this.parseProductSelection(messageText);
    
    if (product) {
      // Si seleccionó "Otros", asignar a agente directamente
      if (product.isOther) {
        const otherMsg = `¡Perfecto! ${this.getHandoffText().charAt(0).toUpperCase() + this.getHandoffText().slice(1)} para ayudarte con tu consulta 😊`;
        await this.sendMessage(contact.id, otherMsg);
        
        await this.updateConversationState(contact.id, {
          state: 'assigned',
          selected_product: 'Otros'
        });
        
        await this.assignToDefaultAgent(contact.id);
        await this.addTrackingTag(contact.id, 'ProductoOtros');
        await this.addComment(contact.id, `[Bot] Cliente seleccionó "Otros". Requiere atención de agente.`);
        
        return { handled: true, action: 'other_product_assigned' };
      }
      
      // Obtener mensaje de información del producto
      const productInfo = this.getProductInfoMessage(product.name);
      const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || null;
      
      if (productInfo) {
        await this.sendMessage(contact.id, productInfo);
      } else {
        const genericMsg = await this.getAIMsg(
          'product_info_sent',
          { customerName, product: product.name },
          `Excelente eleccion! 👍 Has seleccionado: ${product.name}\n\nUn agente te atendera en breve para darte mas informacion.`
        );
        await this.sendMessage(contact.id, genericMsg);
      }
      
      await this.updateConversationState(contact.id, {
        state: 'awaiting_product_response',
        selected_product: product.name,
        awaiting_response: 'product_response'
      });
      
      return { handled: true, action: 'product_info_sent' };
    } else {
      // No entendió - recordar menú
      const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || null;
      const remindMsg = await this.getAIMsg('remind_product', { customerName, lastMessage: messageText }, msgs.remindProduct);
      await this.sendMessage(contact.id, remindMsg);
      await this.sendMessage(contact.id, this.generateProductMenu());
      return { handled: true, action: 'remind_product' };
    }
  }

  // Handler para cuando el usuario responde al mensaje de info del producto
  async handleAwaitingProductResponse(contact, messageText, convState) {
    // El usuario respondió al mensaje de info - asignar a agente
    const product = convState.selected_product || 'General';
    
    // Buscar agente específico para el producto
    const agent = await this.findAgentForProduct(product);
    const agentId = agent?.agent_id || agent?.agent_email || this.settings.default_agent_id || this.settings.default_agent_email;
    
    if (agentId) {
      await this.assignToAgent(contact.id, agentId, agent?.agent_name);
    } else {
      await this.assignToDefaultAgent(contact.id);
    }
    
    await this.addTrackingTag(contact.id, `Producto_${product}`);
    await this.addTrackingTag(contact.id, 'SinInfoPrevia');
    await this.addComment(contact.id, 
      `[Bot] Cliente sin info previa. ZIP: ${convState.validated_zip || 'N/A'}. Producto: ${product}. Asignado a: ${agent?.agent_name || 'Agente por defecto'}`
    );
    
    await this.updateConversationState(contact.id, { 
      state: 'assigned',
      selected_product: product
    });
    
    return { handled: true, action: 'product_response_assigned' };
  }

  // Obtener mensaje de información del producto desde products_list
  getProductInfoMessage(productName) {
    try {
      let productsList = this.settings.products_list;
      if (typeof productsList === 'string') {
        productsList = JSON.parse(productsList);
      }
      if (Array.isArray(productsList)) {
        const product = productsList.find(p => 
          p.name.toLowerCase() === productName.toLowerCase()
        );
        return product?.message || null;
      }
    } catch (e) {
      console.error('Error getting product info:', e);
    }
    return null;
  }

  // Generar menú de productos desde products_list
  generateProductMenu() {
    try {
      let productsList = this.settings.products_list;
      if (typeof productsList === 'string') {
        productsList = JSON.parse(productsList);
      }
      if (Array.isArray(productsList) && productsList.length > 0) {
        const menuItems = productsList.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
        const otherOption = `${productsList.length + 1}. Otros`;
        return `¿En cual de estos productos estas interesado? (Indica el numero)\n\n${menuItems}\n${otherOption}`;
      }
    } catch (e) {
      console.error('Error generating product menu:', e);
    }
    // Fallback
    return '¿En cual de estos productos estas interesado?\n\n1. Tarjetas\n2. Magnéticos\n3. Post cards\n4. Playeras\n5. Otros';
  }

  async handleAwaitingProduct(contact, messageText, convState) {
    const msgs = this.getMessages();
    const product = await this.parseProductSelection(messageText);
    
    if (product) {
      // Cliente NO tenía información - enviar información específica del producto
      const productInfoMsg = this.getProductInfoMessage(product.name || product);
      
      if (productInfoMsg) {
        await this.sendMessage(contact.id, productInfoMsg);
      } else {
        // Fallback si no hay mensaje configurado
        const fallbackMsg = `Has seleccionado: ${product.name || product}\n\nUn agente te contactará en breve para darte más información.`;
        await this.sendMessage(contact.id, fallbackMsg);
      }
      
      await this.updateConversationState(contact.id, {
        state: 'assigned',
        selected_product: product.name || product
      });

      // Buscar agente específico para el producto
      const agent = await this.findAgentForProduct(product.name || product);
      if (agent) {
        await this.assignToAgent(contact.id, agent.respond_agent_id, agent.agent_name);
      } else {
        await this.assignToDefaultAgent(contact.id);
      }
      
      await this.addTrackingTag(contact.id, 'ProductoSeleccionado');
      await this.addComment(contact.id, 
        `[Bot] Cliente nuevo. ZIP: ${convState.validated_zip || 'N/A'}. Producto: ${product.name || product}.`
      );
      
      return { handled: true, action: 'product_selected', product: product.name || product };
      
    } else {
      // No entendió, mostrar menú de nuevo
      const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || null;
      const remindMsg = await this.getAIMsg('remind_product', { customerName, lastMessage: messageText }, msgs.remindProduct);
      await this.sendMessage(contact.id, remindMsg);
      const productMenu = this.generateProductMenu();
      await this.sendMessage(contact.id, productMenu);
      return { handled: true, action: 'remind_product' };
    }
  }

  async handleAwaitingContinuation(contact, messageText, convState) {
    const msgs = this.getMessages();
    const response = await this.parseYesNoResponse(messageText);
    
    if (response === 'yes') {
      // Quiere continuar, verificar dónde quedó
      if (convState.validated_zip && !convState.selected_product) {
        // Ya tiene ZIP, mostrar productos
        await this.sendMessage(contact.id, '¡Perfecto! Continuemos 😊\n\n¿En cuál producto estás interesado?');
        await this.sendMessage(contact.id, msgs.productMenu);
        await this.updateConversationState(contact.id, { state: 'awaiting_product' });
        return { handled: true, action: 'continue_to_products' };
      } else {
        // Empezar de nuevo
        await this.sendMessage(contact.id, '¡Perfecto! Continuemos 😊\n\n¿Me compartes tu código postal (ZIP)? 📍');
        await this.updateConversationState(contact.id, { state: 'awaiting_zip' });
        return { handled: true, action: 'continue_to_zip' };
      }
    } else if (response === 'no') {
      await this.sendMessage(contact.id, '¡Está bien! Si necesitas algo más adelante, aquí estaremos para ayudarte 😊 ¡Que tengas un excelente día!');
      await this.updateConversationState(contact.id, { state: 'closed' });
      return { handled: true, action: 'conversation_closed' };
    } else {
      // Asumir que quiere continuar
      return await this.handleInitialState(contact, messageText, convState);
    }
  }

  // ==================== UTILIDADES ====================

  async assignToDefaultAgent(contactId) {
    const agentId = this.settings.default_agent_id || this.settings.default_agent_email;
    if (agentId) {
      await this.assignToAgent(contactId, agentId, this.settings.default_agent_name);
    }
  }

  async findAgentForProduct(productName) {
    try {
      const agents = await ServiceAgent.findAll({
        where: { is_active: true }
      });

      const productLower = productName.toLowerCase();
      
      // Buscar agente específico para el producto
      for (const agent of agents) {
        const products = agent.products || [];
        if (products.some(p => p.toLowerCase().includes(productLower) || productLower.includes(p.toLowerCase()))) {
          return agent;
        }
      }

      // Si no hay específico, buscar el default
      const defaultAgent = agents.find(a => a.is_default);
      return defaultAgent || null;
    } catch (error) {
      console.error('[Bot] Error buscando agente para producto:', error.message);
      return null;
    }
  }

  // ==================== FLUJO DE CIERRE (TARJETAS) ====================

  // Paso 0: Envía el mensaje de aprobación con imagen aviso
  async startClosingFlow(contact, product = 'tarjetas') {
    const msg0 = 'Hola, veo que ya está aprobando su orden 🎉\n\nTome unos minutos y lea este mensaje para asegurar que todo esté bien.\n\n✅ POR FAVOR escriba:\n- *APROBADO* si todo está correcto\n- *Necesita cambios* si desea modificar algo';

    // Enviar imagen aviso (URL configurada en settings o la predeterminada de producción)
    const avisoUrl = this.settings.closing_aviso_image_url ||
      'https://production--bucket.s3-accelerate.amazonaws.com/files/313144/879645/1760541638162/aviso.jpg';
    await this.sendAttachmentMsg(contact.id, avisoUrl, 'image');

    await this.sendMessage(contact.id, msg0);

    await this.updateConversationState(contact.id, {
      state: 'closing_approval',
      selected_product: product,
      context_data: {
        closing_product: product,
        closing_started_at: new Date().toISOString()
      }
    });

    await this.addComment(contact.id, `[Bot] Flujo de cierre iniciado para: ${product}`);
    await this.addTrackingTag(contact.id, 'FlujoCierre');

    console.log(`[Bot] Flujo de cierre iniciado para ${contact.id}, producto: ${product}`);
    return { handled: true, action: 'closing_flow_started', product };
  }

  // Detecta si el cliente está corrigiendo algo en el flujo de cierre
  isClosingCorrection(text) {
    const lower = text.toLowerCase();
    return (
      lower.includes('me equivoc') ||
      lower.includes('equivoque') ||
      lower.includes('equivoqué') ||
      lower.includes('perdon') ||
      lower.includes('perdón') ||
      lower.includes('disculpa') ||
      lower.includes('lo siento') ||
      lower.includes('error') ||
      lower.includes('no era') ||
      lower.includes('no eran') ||
      lower.includes('en realidad') ||
      lower.includes('quise decir') ||
      lower.includes('quería decir') ||
      (lower.includes('espera') && lower.length < 40) ||
      (lower.startsWith('no ') && lower.length < 50)
    );
  }

  // Paso 1: Procesa APROBADO o Necesita cambios
  async handleClosingApproval(contact, messageText, convState) {
    const lower = messageText.toLowerCase().trim();

    const needsChanges = lower.includes('cambio') || lower.includes('modific') || lower.includes('cambiar') || lower.includes('diferente') || (lower.match(/^no[\s!.,]*$/) && !lower.includes('aprobado'));

    const approved = !needsChanges && (
      lower.includes('aprobado') || lower.includes('aprobada') || lower.includes('aprob') ||
      lower.match(/^s[ií][\s!.,]*$/) || lower.includes('ok') || lower.includes('dale') ||
      lower.includes('correcto') || lower.includes('listo') || lower.includes('adelante') ||
      lower.includes('va ') || lower === 'va' || lower.includes('perfecto') || lower.includes('bien')
    );

    if (approved) {
      const msg1 = 'Me indica cuántas desea ordenar 🃏\n\n💳 Paquetes disponibles de Tarjetas:\n\n🔹 500 tarjetas — $60\n🔹 1000 tarjetas — $70\n✨ 2500 tarjetas — $120 (depósito $40)\n✨ 5000 tarjetas — $140 (depósito $50)';
      await this.sendMessage(contact.id, msg1);
      await this.updateConversationState(contact.id, { state: 'closing_quantity' });
      await this.addComment(contact.id, `[Bot] Cliente aprobó pedido. Preguntando cantidad.`);
      return { handled: true, action: 'closing_approved_ask_quantity' };

    } else if (needsChanges) {
      const changesMsg = 'Entendido 😊 ¿Qué cambios necesita? Cuéntenos y con gusto lo ajustamos para usted.';
      await this.sendMessage(contact.id, changesMsg);
      await this.updateConversationState(contact.id, { state: 'assigned' });
      await this.assignToDefaultAgent(contact.id);
      await this.addComment(contact.id, `[Bot] Cliente solicitó cambios. Mensaje: "${messageText}". Pasando a agente.`);
      return { handled: true, action: 'closing_needs_changes' };

    } else {
      // No entendió — recordar opciones
      const remindMsg = 'Por favor responda:\n\n✅ *APROBADO* — si todo está correcto\n❌ *Necesita cambios* — si desea modificar algo 😊';
      await this.sendMessage(contact.id, remindMsg);
      return { handled: true, action: 'closing_approval_remind' };
    }
  }

  // Paso 2: Procesa la cantidad elegida
  async handleClosingQuantity(contact, messageText, convState) {
    const lower = messageText.toLowerCase().replace(/,/g, '').trim();

    // Si el cliente se está corrigiendo pero no menciona cantidad, volver a preguntar
    if (this.isClosingCorrection(lower) && !/\d/.test(lower)) {
      const remindMsg = 'Sin problema 😊 ¿Cuántas tarjetas desea ordenar?\n\n🔹 *500 tarjetas* — $60\n🔹 *1000 tarjetas* — $70\n✨ *2500 tarjetas* — $120 (depósito $40)\n✨ *5000 tarjetas* — $140 (depósito $50)';
      await this.sendMessage(contact.id, remindMsg);
      return { handled: true, action: 'closing_quantity_correction_prompt' };
    }

    // Detectar cantidad exacta con límites de palabra
    let quantity = null;
    if (/\b500\b/.test(lower) || lower.includes('quinientas') || lower.includes('quinientos')) {
      quantity = 500;
    } else if (/\b1000\b|\b1 000\b/.test(lower) || lower.includes('mil tarjetas') || lower === 'mil') {
      quantity = 1000;
    } else if (/\b2500\b|\b2 500\b/.test(lower) || lower.includes('dos mil quinientas') || lower.includes('dos mil quinientos')) {
      quantity = 2500;
    } else if (/\b5000\b|\b5 000\b/.test(lower) || lower.includes('cinco mil')) {
      quantity = 5000;
    } else {
      // Intentar extraer cualquier número mencionado
      const numMatch = lower.match(/\b(\d[\d\s]*)\b/);
      if (numMatch) {
        const parsed = parseInt(numMatch[1].replace(/\s/g, ''), 10);
        if (!isNaN(parsed) && parsed > 0) quantity = parsed;
      }
    }

    const PACKAGES = {
      500:  { price: '$60',  deposit: null },
      1000: { price: '$70',  deposit: null },
      2500: { price: '$120', deposit: '$40' },
      5000: { price: '$140', deposit: '$50' },
    };

    if (PACKAGES[quantity]) {
      const pkg = PACKAGES[quantity];
      let msg2;
      if (pkg.deposit) {
        msg2 = `¡Excelente! ${quantity} tarjetas por ${pkg.price} 😊\n\nEste paquete requiere un depósito de ${pkg.deposit} para apartar el pedido, y el resto se paga al momento de la entrega 💳\n\n¿Podría compartirnos la dirección exacta de entrega? 📍\n\nSi es apartamento, favor de indicarnos también el número de unidad 🏠\n\n¡Gracias!`;
      } else {
        msg2 = `¡Excelente! ${quantity} tarjetas por ${pkg.price} 😊\n\nYa que el pago se realiza al momento de la entrega, ¿podría compartirnos la dirección exacta de entrega? 📍\n\nSi es apartamento, favor de indicarnos también el número de unidad 🏠\n\n¡Gracias!`;
      }
      await this.sendMessage(contact.id, msg2);

      const existingCtx = convState.context_data || {};
      await this.updateConversationState(contact.id, {
        state: 'closing_address',
        context_data: {
          ...existingCtx,
          closing_quantity: quantity,
          closing_price: pkg.price,
          closing_deposit: pkg.deposit || null
        }
      });

      await this.addComment(contact.id, `[Bot] Cantidad seleccionada: ${quantity} tarjetas (${pkg.price}${pkg.deposit ? `, depósito ${pkg.deposit}` : ''}). Solicitando dirección.`);
      return { handled: true, action: 'closing_quantity_selected', quantity, price: pkg.price };

    } else {
      // Cantidad no estándar o pregunta de precio — usar IA para responder naturalmente
      try {
        const packageInfo = '500 tarjetas = $60 (pago en entrega), 1000 tarjetas = $70 (pago en entrega), 2500 tarjetas = $120 con depósito de $40, 5000 tarjetas = $140 con depósito de $50';
        const aiMessages = [
          {
            role: 'system',
            content: `Eres un asistente de ventas amable de una imprenta. El cliente está en el proceso de confirmar su pedido de tarjetas de presentación.
Los paquetes disponibles son: ${packageInfo}.
Si el cliente pregunta por una cantidad diferente, responde de forma natural y útil:
- Menciona los 4 paquetes disponibles de forma conversacional
- Para paquetes grandes (2500 y 5000) menciona que requieren un depósito para apartar el pedido
- Mantén el tono amigable y sin presión
- Responde en español, máximo 3 oraciones
- Al final, redirige amablemente a elegir uno de los 4 paquetes disponibles
No repitas los precios en formato de lista — responde conversacionalmente.`
          },
          {
            role: 'user',
            content: messageText
          }
        ];

        const aiResult = await this.ai.callOpenAI(aiMessages, 200);
        if (aiResult.success && aiResult.content) {
          await this.sendMessage(contact.id, aiResult.content.trim());
          await this.addComment(contact.id, `[Bot] Respuesta IA a cantidad no estándar: "${messageText}"`);
          return { handled: true, action: 'closing_quantity_ai_response' };
        }
      } catch (aiErr) {
        console.log(`[Bot] Error IA en handleClosingQuantity:`, aiErr.message);
      }

      // Fallback si la IA falla
      const remindMsg = 'Claro 😊 Contamos con estos paquetes:\n\n🔹 *500 tarjetas* — $60\n🔹 *1000 tarjetas* — $70\n✨ *2500 tarjetas* — $120 (depósito $40)\n✨ *5000 tarjetas* — $140 (depósito $50)\n\n¿Cuál le gustaría ordenar?';
      await this.sendMessage(contact.id, remindMsg);
      return { handled: true, action: 'closing_quantity_remind' };
    }
  }

  // Paso 3: Procesa la dirección y cierra el pedido
  async handleClosingAddress(contact, messageText, convState) {
    const lower = messageText.toLowerCase().replace(/,/g, '').trim();

    // Detectar corrección — el cliente se equivocó en algo anterior
    if (this.isClosingCorrection(lower)) {
      const existingCtx = convState.context_data || {};

      // ¿Está corrigiendo la cantidad?
      const mentionsQuantity = /\b(\d+)\b/.test(lower) && (
        lower.includes('tarjet') || lower.includes('card') || lower.includes('paquete') ||
        lower.includes('unidad') || lower.includes('pieza') || /\b(500|1000|2500|5000|mil)\b/.test(lower)
      );

      if (mentionsQuantity) {
        // Volver al paso de cantidad con el nuevo valor
        await this.updateConversationState(contact.id, {
          state: 'closing_quantity',
          context_data: { ...existingCtx, closing_quantity: null, closing_price: null, closing_deposit: null }
        });
        await this.addComment(contact.id, `[Bot] Cliente corrigió cantidad durante paso de dirección`);
        return await this.handleClosingQuantity(contact, messageText, convState);
      }

      // Corrección genérica — preguntar qué desea cambiar usando IA
      try {
        const aiMessages = [
          {
            role: 'system',
            content: `Eres un asistente amable de una imprenta. El cliente está confirmando su pedido y acaba de decir que cometió un error.
Contexto del pedido: ${existingCtx.closing_quantity ? `${existingCtx.closing_quantity} tarjetas a ${existingCtx.closing_price}` : 'cantidad pendiente'}.
Responde de forma empática y amigable preguntando qué desea corregir (la cantidad o algo más). Máximo 2 oraciones, en español.`
          },
          { role: 'user', content: messageText }
        ];
        const aiResult = await this.ai.callOpenAI(aiMessages, 150);
        if (aiResult.success && aiResult.content) {
          await this.sendMessage(contact.id, aiResult.content.trim());
          // Regresar al estado de cantidad para que el próximo mensaje sea la corrección
          await this.updateConversationState(contact.id, {
            state: 'closing_quantity',
            context_data: { ...existingCtx, closing_quantity: null, closing_price: null }
          });
          return { handled: true, action: 'closing_correction_prompt' };
        }
      } catch (aiErr) {}

      // Fallback
      const fallbackMsg = 'Sin problema 😊 ¿Qué desea corregir? ¿La cantidad de tarjetas o algo más?';
      await this.sendMessage(contact.id, fallbackMsg);
      await this.updateConversationState(contact.id, {
        state: 'closing_quantity',
        context_data: { ...existingCtx, closing_quantity: null, closing_price: null }
      });
      return { handled: true, action: 'closing_correction_fallback' };
    }

    const wordCount = messageText.trim().split(/\s+/).length;

    if (wordCount < 3) {
      const remindMsg = 'Por favor comparta la dirección completa de entrega 📍\n\n(Calle, número, ciudad y ZIP)';
      await this.sendMessage(contact.id, remindMsg);
      return { handled: true, action: 'closing_address_remind' };
    }

    const existingCtx = convState.context_data || {};
    const depositRequired = existingCtx.closing_deposit;

    if (depositRequired) {
      // Paquete con depósito — pedir captura de Zelle antes de cerrar
      const depositMsg = `¡Perfecto! Anotamos su dirección 📍\n\nPara apartar su pedido necesitamos el depósito de *${depositRequired}* vía Zelle 💳\n\nPor favor envíe la captura de pantalla de su transferencia Zelle para confirmar su orden 📸`;
      await this.sendMessage(contact.id, depositMsg);

      await this.updateConversationState(contact.id, {
        state: 'closing_deposit_verification',
        context_data: {
          ...existingCtx,
          closing_address: messageText
        }
      });

      await this.addComment(contact.id, `[Bot] Dirección recibida: ${messageText}. Solicitando captura de depósito Zelle (${depositRequired}).`);
      return { handled: true, action: 'closing_deposit_requested', address: messageText };
    }

    // Paquete sin depósito — cierre directo
    const msg3 = 'Procesamos su orden, ¡muchas gracias por preferirnos! 🎉\n\nEl proceso de entrega es de 3 a 4 días hábiles.\n\nPor ahora muchas gracias y uno de nuestro personal de entregas se comunicará con usted cuando su orden esté lista 🚚';
    await this.sendMessage(contact.id, msg3);

    await this.updateConversationState(contact.id, {
      state: 'closing_complete',
      context_data: {
        ...existingCtx,
        closing_address: messageText,
        closing_completed_at: new Date().toISOString()
      }
    });

    const product = convState.selected_product || 'tarjetas';
    const quantity = existingCtx.closing_quantity || '?';
    const price = existingCtx.closing_price || '';

    await this.addComment(contact.id, `[Bot] ✅ PEDIDO CERRADO — ${product} x${quantity} (${price}) — Dirección: ${messageText}`);
    await this.addTrackingTag(contact.id, 'PedidoConfirmado');

    console.log(`[Bot] Cierre completado para ${contact.id}: ${quantity} tarjetas → ${messageText}`);
    return { handled: true, action: 'closing_complete', address: messageText };
  }

  // Paso 4 (solo paquetes con depósito): Verifica captura de Zelle
  async handleClosingDepositVerification(contact, messageText, convState, imageUrl = null) {
    const existingCtx = convState.context_data || {};
    const depositAmount = existingCtx.closing_deposit;
    const quantity = existingCtx.closing_quantity || '?';
    const price = existingCtx.closing_price || '';
    const address = existingCtx.closing_address || '';
    const product = convState.selected_product || 'tarjetas';

    // Si el cliente envió una imagen (captura de Zelle)
    if (imageUrl) {
      try {
        const aiKey = this.settings?.openai_api_key || process.env.OPENAI_API_KEY;
        if (aiKey) {
          const ai = new (await import('./aiService.js')).default(aiKey, this.settings, this.userId);
          const aiMessages = [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analiza esta imagen y determina si es una captura de pantalla de un pago Zelle. 
Si es un pago Zelle, extrae: monto enviado, nombre del destinatario o número de teléfono si aparece, y fecha/hora.
El depósito esperado es de ${depositAmount}.
¿El monto enviado coincide con ${depositAmount}? 
Responde en formato JSON: { "esZelle": true/false, "monto": "X", "coincide": true/false, "detalles": "..." }`
                },
                {
                  type: 'image_url',
                  image_url: { url: imageUrl, detail: 'high' }
                }
              ]
            }
          ];

          const result = await ai.callOpenAI(aiMessages, 300, 'gpt-4o');
          if (result.success && result.content) {
            let parsed = null;
            try {
              const jsonMatch = result.content.match(/\{[\s\S]*\}/);
              if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
            } catch (e) {}

            if (parsed?.esZelle) {
              if (parsed.coincide) {
                // ✅ Depósito verificado
                const confirmMsg = `¡Perfecto! Recibimos la confirmación de su depósito de ${depositAmount} vía Zelle ✅\n\n¡Muchas gracias por preferirnos! 🎉\n\nEl proceso de entrega es de 3 a 4 días hábiles. Uno de nuestro personal de entregas se comunicará con usted cuando su orden esté lista 🚚`;
                await this.sendMessage(contact.id, confirmMsg);

                await this.updateConversationState(contact.id, {
                  state: 'closing_complete',
                  context_data: {
                    ...existingCtx,
                    closing_deposit_verified: true,
                    closing_deposit_amount_detected: parsed.monto,
                    closing_completed_at: new Date().toISOString()
                  }
                });

                await this.addComment(contact.id, `[Bot] ✅ PEDIDO CERRADO CON DEPÓSITO — ${product} x${quantity} (${price}) — Depósito Zelle ${depositAmount} verificado — Dirección: ${address}`);
                await this.addTrackingTag(contact.id, 'PedidoConfirmado');
                return { handled: true, action: 'closing_deposit_verified' };

              } else {
                // ⚠️ Es Zelle pero monto no coincide
                const wrongAmountMsg = `Recibimos su captura, pero el monto detectado es *${parsed.monto || 'desconocido'}* y el depósito requerido es *${depositAmount}* 🙏\n\nSi es correcto, por favor comuníquese con nosotros para aclarar. Si fue un error, puede enviarnos la captura correcta 😊`;
                await this.sendMessage(contact.id, wrongAmountMsg);
                await this.addComment(contact.id, `[Bot] Captura Zelle recibida pero monto (${parsed.monto}) no coincide con depósito esperado (${depositAmount}). Detalles: ${parsed.detalles}`);
                return { handled: true, action: 'closing_deposit_wrong_amount' };
              }
            } else {
              // No parece Zelle
              const notZelleMsg = `No pudimos identificar esto como una captura de Zelle 🙏\n\nPor favor envíe una captura de pantalla de su transferencia Zelle por ${depositAmount} para apartar su pedido 📸`;
              await this.sendMessage(contact.id, notZelleMsg);
              await this.addComment(contact.id, `[Bot] Imagen recibida pero no identificada como Zelle. Detalles IA: ${parsed?.detalles || result.content.substring(0, 100)}`);
              return { handled: true, action: 'closing_deposit_not_zelle' };
            }
          }
        }
      } catch (err) {
        console.error(`[Bot] Error verificando depósito Zelle con visión IA:`, err.message);
      }

      // Fallback si la IA falla — aceptar y dejar que el agente verifique
      const fallbackMsg = `Recibimos su captura ✅\n\nUno de nuestros agentes verificará el depósito y confirmará su pedido en breve 😊`;
      await this.sendMessage(contact.id, fallbackMsg);
      await this.addComment(contact.id, `[Bot] ⚠️ Imagen de depósito recibida pero IA no pudo verificar — requiere revisión manual. Pedido: ${product} x${quantity} (${price}), Dirección: ${address}`);
      await this.updateConversationState(contact.id, {
        state: 'closing_complete',
        context_data: { ...existingCtx, closing_deposit_verified: 'manual_review', closing_completed_at: new Date().toISOString() }
      });
      await this.addTrackingTag(contact.id, 'PedidoConfirmado');
      return { handled: true, action: 'closing_deposit_manual_review' };
    }

    // El cliente escribió texto en lugar de enviar imagen
    const lowerText = messageText.toLowerCase();

    // Si dice que ya lo envió o pregunta algo
    if (lowerText.includes('ya envié') || lowerText.includes('ya mande') || lowerText.includes('ya mandé') || lowerText.includes('ya pague') || lowerText.includes('ya pagué')) {
      const sentMsg = `Todavía no recibimos la captura 📸 Por favor envíe la imagen de la confirmación de su transferencia Zelle por ${depositAmount} para apartar su pedido 😊`;
      await this.sendMessage(contact.id, sentMsg);
      return { handled: true, action: 'closing_deposit_remind' };
    }

    // Recordatorio genérico
    const remindMsg = `Para apartar su pedido necesitamos la captura de su depósito Zelle por *${depositAmount}* 📸\n\nPor favor envíe la imagen de la transferencia para confirmar 😊`;
    await this.sendMessage(contact.id, remindMsg);
    return { handled: true, action: 'closing_deposit_remind' };
  }

  async createOrUpdateOrder(contact, zipCode, customerName, validationStatus, zone) {
    try {
      let order = await MessagingOrder.findOne({
        where: {
          respond_contact_id: contact.id.toString(),
          status: 'pending'
        }
      });

      const orderData = {
        customer_name: customerName,
        customer_phone: contact.phone || null,
        zip_code: zipCode,
        validation_status: validationStatus,
        validation_message: validationStatus === 'covered' 
          ? `ZIP ${zipCode} con cobertura${zone ? ` - ${zone.zone_name}` : ''}`
          : `ZIP ${zipCode} sin cobertura`,
        lifecycle: contact.lifecycle || null
      };

      if (order) {
        await order.update(orderData);
        console.log(`[Bot] Orden actualizada para contacto ${contact.id}, ZIP: ${zipCode}`);
      } else {
        await MessagingOrder.create({
          user_id: this.userId,
          respond_contact_id: contact.id.toString(),
          channel_type: 'respond.io',
          address: `ZIP: ${zipCode}`,
          status: 'pending',
          ...orderData
        });
        console.log(`[Bot] Orden creada para contacto ${contact.id}, ZIP: ${zipCode}`);
      }
    } catch (error) {
      console.error('[Bot] Error creando/actualizando orden:', error.message);
    }
  }

  // ==================== CONTROL DEL BOT ====================

  async pauseBot(contactId) {
    await this.updateConversationState(contactId, { bot_paused: true });
    return { success: true, message: 'Bot pausado para este contacto' };
  }

  async resumeBot(contactId) {
    await this.updateConversationState(contactId, { bot_paused: false });
    return { success: true, message: 'Bot reactivado para este contacto' };
  }

  async resetConversation(contactId) {
    await this.updateConversationState(contactId, {
      state: 'initial',
      awaiting_response: null,
      has_prior_info: null,
      selected_product: null,
      validated_zip: null,
      out_of_hours_notified: false,
      bot_paused: false,
      agent_active: false,
      greeting_sent: false,
      last_bot_message_at: null,
      last_agent_message_at: null,
      last_customer_message_at: null
    });
    return { success: true, message: 'Conversación reiniciada' };
  }

  async markAgentActive(contactId, agentId) {
    await this.updateConversationState(contactId, { 
      agent_active: true,
      assigned_agent_id: agentId,
      last_agent_message_at: new Date()
    });
    return { success: true };
  }

  async markAgentInactive(contactId) {
    await this.updateConversationState(contactId, { 
      agent_active: false 
    });
    return { success: true };
  }
}

export default ChatbotService;
