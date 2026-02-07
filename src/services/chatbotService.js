import ConversationState from '../models/ConversationState.js';
import MessagingSettings from '../models/MessagingSettings.js';
import MessagingOrder from '../models/MessagingOrder.js';
import ServiceAgent from '../models/ServiceAgent.js';
import AddressValidationService from './addressValidation.js';
import respondApiService from './respondApiService.js';

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

    if (!businessDays.includes(currentDay)) {
      return false;
    }

    const [startHour, startMin] = (this.settings.business_hours_start || '09:00').split(':').map(Number);
    const [endHour, endMin] = (this.settings.business_hours_end || '18:00').split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  hasExcludedTag(contact) {
    const excludedTags = this.settings.excluded_tags || ['Personal', 'IprintPOS', 'ClientesArea', 'Area862Designers'];
    const contactTags = contact.tags || [];
    
    for (const tag of contactTags) {
      const tagName = typeof tag === 'string' ? tag : tag.name;
      if (excludedTags.includes(tagName)) {
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
    
    // Si hay un agente activo y no está abandonado, no interferir
    if (convState.agent_active && !this.isConversationAbandoned(convState)) {
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
        where: { user_id: this.userId, contact_id: contactId.toString() }
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

  async hasAgentAlreadyResponded(contactId) {
    try {
      const result = await this.api.listMessages(`id:${contactId}`, 30);
      
      if (!result.success || !result.data?.items) {
        return { hasResponded: false, agentName: null };
      }

      const messages = result.data.items;
      
      for (const msg of messages) {
        // traffic: "outgoing" = mensaje enviado (no recibido)
        // sender.source: "user" = enviado por un agente humano
        if (msg.traffic === 'outgoing' && msg.sender) {
          const senderSource = msg.sender.source || '';
          const senderId = msg.sender.userId || '';
          
          // "user" significa agente humano, otros valores como "bot" o "workflow" son automatizados
          if (senderSource === 'user') {
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

  // ==================== ESTADO DE CONVERSACIÓN ====================

  async getOrCreateConversationState(contactId) {
    let state = await ConversationState.findOne({
      where: { user_id: this.userId, contact_id: contactId.toString() }
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
      { where: { user_id: this.userId, contact_id: contactId.toString() } }
    );
  }

  async checkIfExistingCustomer(contact) {
    const existingOrder = await MessagingOrder.findOne({
      where: {
        user_id: this.userId,
        respond_contact_id: contact.id.toString()
      }
    });
    return !!existingOrder;
  }

  // ==================== PARSERS ====================

  parseYesNoResponse(text) {
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

  parseProductSelection(text) {
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
    
    let productsList = [];
    try {
      let rawList = this.settings.products_list;
      if (typeof rawList === 'string') {
        rawList = JSON.parse(rawList);
      }
      if (Array.isArray(rawList) && rawList.length > 0) {
        productsList = rawList.map((p, i) => ({
          id: i + 1,
          name: p.name,
          message: p.message
        }));
      }
    } catch (e) {
      console.error('Error parsing products_list:', e);
    }
    
    if (productsList.length === 0) {
      productsList = [
        { id: 1, name: 'Tarjetas' },
        { id: 2, name: 'Magnéticos' },
        { id: 3, name: 'Post cards' },
        { id: 4, name: 'Playeras' }
      ];
    }

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

  detectFrustration(text) {
    const cleanText = text.trim();
    
    // Detectar mayúsculas excesivas
    const upperCount = (cleanText.match(/[A-Z]/g) || []).length;
    const letterCount = (cleanText.match(/[a-zA-Z]/g) || []).length;
    if (letterCount > 5 && upperCount / letterCount > 0.7) {
      return true;
    }
    
    // Palabras de frustración
    const frustrationWords = ['molesto', 'enojado', 'frustrado', 'terrible', 'pesimo', 'pésimo', 'horrible', 'mal servicio', 'no sirve'];
    if (frustrationWords.some(w => cleanText.toLowerCase().includes(w))) {
      return true;
    }
    
    return false;
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
      hasDesignResponse: '¡Perfecto! 📸 Envíanos tu diseño o la información de lo que necesitas.\n\nUn agente te atenderá en breve para ayudarte con tu pedido.',
      
      // Necesita diseño nuevo
      needsDesignResponse: '¡Genial! 🎨 Cuéntanos qué información quieres incluir en tu diseño (nombre, teléfono, logo, etc.)\n\nUn agente te atenderá en breve para crear algo increíble para ti.',
      
      // Producto seleccionado (sin info previa - flujo de validación)
      productSelected: this.settings.product_selected_message || 
        '¡Perfecto! Te interesan {{product}} 👍\n\nDame un momento, te paso con uno de nuestros especialistas que te dará toda la información sobre precios, diseños y tiempos de entrega 📋✨',
      
      // Fuera de horario
      outOfHours: this.settings.out_of_hours_message || 
        '🌙 ¡Hola! Gracias por escribirnos 😊\n\nEn este momento estamos fuera de horario de atención.\nNuestro horario es de Lunes a Viernes de 9am a 6pm (hora de Dallas).\n\nPero no te preocupes, deja tu mensaje y en cuanto regresemos te respondemos lo antes posible 💬\n\nSi es urgente, también puedes dejarnos tu número y te llamamos mañana temprano 📞',
      
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

  async processMessage(contact, messageText) {
    const msgs = this.getMessages();
    
    // Verificar tags excluidos
    if (this.hasExcludedTag(contact)) {
      console.log(`[Bot] Contacto ${contact.id} tiene tag excluido, ignorando`);
      return { handled: false, reason: 'excluded_tag' };
    }

    // IMPORTANTE: Verificar si un agente humano ya respondió en esta conversación
    // Si ya hay respuestas de agentes, el bot NO debe interferir
    // EXCEPCION: En modo de prueba, se salta esta verificación para permitir probar el flujo
    if (!this.isTestMode) {
      const agentCheck = await this.hasAgentAlreadyResponded(contact.id);
      if (agentCheck.hasResponded) {
        console.log(`[Bot] Agente ${agentCheck.agentName} ya atendio a ${contact.id}, bot no interferira`);
        return { handled: false, reason: 'agent_already_responded', agentName: agentCheck.agentName };
      }
    } else {
      console.log(`[Bot] MODO PRUEBA - Saltando verificación de agente para ${contact.id}`);
    }

    let convState = await this.getOrCreateConversationState(contact.id);
    
    // Actualizar último mensaje del cliente ANTES de verificar si debe responder
    await this.updateConversationState(contact.id, { 
      last_customer_message_at: new Date() 
    });
    
    // VERIFICAR REAPERTURA ANTES DE TODO: Si la conversacion fue cerrada y reabierta,
    // limpiar estado de flujo pero marcar como cliente existente (ya tuvo conversacion previa)
    if (convState.conversation_closed_at) {
      console.log(`[Bot] Conversacion de ${contact.id} fue cerrada el ${convState.conversation_closed_at} y reabierta, reiniciando flujo como CLIENTE EXISTENTE`);
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
    
    // Recargar el estado actualizado para que shouldBotRespond use los tiempos correctos
    convState = await this.getOrCreateConversationState(contact.id);

    // Verificar si el bot debe responder
    const shouldRespond = this.shouldBotRespond(convState);
    if (!shouldRespond.respond) {
      console.log(`[Bot] No responder a ${contact.id}: ${shouldRespond.reason}`);
      return { handled: false, reason: shouldRespond.reason };
    }

    // Detectar frustración - pasar a agente inmediatamente
    if (this.detectFrustration(messageText)) {
      await this.sendMessage(contact.id, msgs.frustratedCustomer);
      await this.assignToDefaultAgent(contact.id);
      await this.addTrackingTag(contact.id, 'ClienteFrustrado');
      await this.updateConversationState(contact.id, { state: 'assigned' });
      return { handled: true, action: 'frustrated_customer' };
    }

    // Verificar horario de atención
    if (!this.isWithinBusinessHours()) {
      if (!convState.out_of_hours_notified) {
        await this.sendMessage(contact.id, msgs.outOfHours);
        await this.updateConversationState(contact.id, { out_of_hours_notified: true });
        await this.assignToDefaultAgent(contact.id);
        await this.addTrackingTag(contact.id, 'FueraDeHorario');
        return { handled: true, action: 'out_of_hours' };
      }
      return { handled: false, reason: 'out_of_hours_already_notified' };
    }

    // Reset out of hours flag si estamos en horario
    if (convState.out_of_hours_notified) {
      await this.updateConversationState(contact.id, { out_of_hours_notified: false });
    }

    // Verificar si conversación fue abandonada
    if (this.isConversationAbandoned(convState)) {
      await this.sendMessage(contact.id, msgs.abandonedConversation);
      await this.updateConversationState(contact.id, { 
        state: 'awaiting_continuation',
        agent_active: false 
      });
      return { handled: true, action: 'abandoned_reengagement' };
    }

    // Detectar ZIP en cualquier momento
    const isZipMessage = this.addressValidation.isZipCodeMessage(messageText);
    const isCityMessage = this.addressValidation.isCityMessage(messageText);
    
    if (isZipMessage || isCityMessage) {
      return await this.handleZipValidation(contact, messageText, convState);
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
    const intent = this.detectMessageIntent(messageText);
    const isFromFacebookAd = this.detectFacebookAdOrigin(contact);
    
    if (isExisting) {
      await this.sendMessage(contact.id, msgs.welcomeExisting);
      
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
    
    // Cliente nuevo
    // Si viene de Facebook Ad, saludar y pedir ZIP directo (flujo sin info)
    if (isFromFacebookAd || intent === 'wants_order') {
      // Saludar primero
      const greeting = this.settings.welcome_from_ads || 'Hola! 👋 Gracias por tu interes.\n\nPara verificar si tenemos cobertura en tu zona, por favor enviame tu codigo postal (ZIP) 📍\n\nPor ejemplo: 75208';
      await this.sendMessage(contact.id, greeting);
      
      await this.updateConversationState(contact.id, {
        state: 'awaiting_zip_no_info',
        has_prior_info: false,
        from_ads: true,
        awaiting_response: 'zip_code',
        greeting_sent: true
      });
      await this.addTrackingTag(contact.id, isFromFacebookAd ? 'FacebookAd' : 'QuiereOrdenar');
      
      return { handled: true, action: 'facebook_ad_direct_zip' };
    }
    
    // Para cualquier mensaje (quiere info, saludo, o genérico):
    // Siempre saludar y preguntar si ya tiene información previa
    await this.sendMessage(contact.id, msgs.welcomeNew);
    await this.updateConversationState(contact.id, {
      state: 'awaiting_prior_info',
      awaiting_response: 'yes_no',
      greeting_sent: true
    });
    
    if (intent === 'wants_info') {
      await this.addTrackingTag(contact.id, 'QuiereInfo');
    }
    
    return { handled: true, action: 'welcome_new' };
  }

  async handleAwaitingPriorInfo(contact, messageText, convState) {
    const msgs = this.getMessages();
    const response = this.parseYesNoResponse(messageText);
    
    if (response === 'yes') {
      // Ya tiene info - preguntar qué producto le interesa usando el menú dinámico
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
      await this.sendMessage(contact.id, msgs.noInfoRequestZip);
      await this.updateConversationState(contact.id, {
        state: 'awaiting_zip_no_info',
        has_prior_info: false,
        awaiting_response: 'zip_code'
      });
      return { handled: true, action: 'no_info_request_zip' };
      
    } else {
      // No entendió, recordar
      await this.sendMessage(contact.id, msgs.remindYesNo);
      return { handled: true, action: 'remind_yes_no' };
    }
  }

  async handleAwaitingProductSelection(contact, messageText, convState) {
    // Este handler es para clientes que YA tienen información
    const msgs = this.getMessages();
    const product = this.parseProductSelection(messageText);
    
    if (product) {
      // Si seleccionó "Otros", asignar a agente directamente
      if (product.isOther) {
        const otherMsg = '¡Perfecto! Te paso con uno de nuestros agentes para ayudarte con tu consulta 😊';
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
      const designQuestion = msgs.productSelectedAskDesign?.replace('{{product}}', product.name || product) ||
        `Perfecto, ${product.name || product} 👍\n\n¿Ya tienes un diseño en mente o te gustaría que te ayudemos a crear uno desde cero?`;
      
      await this.sendMessage(contact.id, designQuestion);
      
      await this.updateConversationState(contact.id, {
        state: 'awaiting_design_info',
        selected_product: product.name || product,
        awaiting_response: 'design_info'
      });
      
      return { handled: true, action: 'product_selected_ask_design' };
    } else {
      // No entendió, mostrar menú de nuevo
      await this.sendMessage(contact.id, msgs.remindProduct);
      const productMenu = this.generateProductMenu();
      await this.sendMessage(contact.id, productMenu);
      return { handled: true, action: 'remind_product' };
    }
  }

  async handleAwaitingDesignInfo(contact, messageText, convState) {
    const msgs = this.getMessages();
    const hasDesign = this.parseDesignResponse(messageText);
    
    if (hasDesign === 'yes') {
      // Tiene diseño
      await this.sendMessage(contact.id, msgs.hasDesignResponse);
    } else if (hasDesign === 'no') {
      // Necesita diseño nuevo
      await this.sendMessage(contact.id, msgs.needsDesignResponse);
    } else {
      // Respuesta ambigua - asumir que está dando info
      await this.sendMessage(contact.id, msgs.hasDesignResponse);
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
    
    // Verificar si parece un ZIP
    const isZipMessage = this.addressValidation.isZipCodeMessage(messageText);
    const isCityMessage = this.addressValidation.isCityMessage(messageText);
    
    if (isZipMessage || isCityMessage) {
      return await this.handleZipValidation(contact, messageText, convState);
    } else {
      // No parece ZIP, dar ayuda
      await this.sendMessage(contact.id, msgs.remindZip);
      return { handled: true, action: 'remind_zip' };
    }
  }

  async handleZipValidation(contact, messageText, convState) {
    const msgs = this.getMessages();
    const validation = await this.addressValidation.validateZipOrCity(messageText);
    const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Sin nombre';
    
    if (validation.valid) {
      // Con cobertura
      const coverageMsg = msgs.hasCoverage
        .replace('{{zip_code}}', validation.value)
        .replace('{{city}}', validation.zone?.city || '')
        .replace('{{zone}}', validation.zone?.zone_name || '');
      
      await this.sendMessage(contact.id, coverageMsg);
      
      // Enviar menú de productos generado dinámicamente
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
      // Sin cobertura - cerrar flujo sin asignar agente
      const noCoverageMsg = msgs.noCoverage
        .replace('{{zip_code}}', validation.value)
        .replace('{{city}}', validation.value);
      
      await this.sendMessage(contact.id, noCoverageMsg);
      await this.createOrUpdateOrder(contact, validation.value, customerName, 'no_coverage', null);
      await this.addTrackingTag(contact.id, 'SinCobertura');
      await this.addComment(contact.id, `[Bot] Cliente en zona sin cobertura. ZIP: ${validation.value}`);
      
      // Cerrar flujo - no asignar a nadie
      await this.updateConversationState(contact.id, { state: 'closed_no_coverage' });
      
      return { handled: true, action: 'zip_no_coverage_closed' };
    }
  }

  // Handler para usuarios SIN información esperando ZIP
  async handleAwaitingZipNoInfo(contact, messageText, convState) {
    const msgs = this.getMessages();
    
    // Verificar si parece un ZIP
    const isZipMessage = this.addressValidation.isZipCodeMessage(messageText);
    const isCityMessage = this.addressValidation.isCityMessage(messageText);
    
    if (isZipMessage || isCityMessage) {
      // Validar ZIP
      const validation = await this.addressValidation.validateZipOrCity(messageText);
      const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Sin nombre';
      
      if (validation.valid) {
        // Con cobertura - mostrar menú de productos
        const coverageMsg = msgs.hasCoverage
          .replace('{{zip_code}}', validation.value)
          .replace('{{city}}', validation.zone?.city || '')
          .replace('{{zone}}', validation.zone?.zone_name || '');
        
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
        // Sin cobertura - cerrar flujo sin asignar agente
        const noCoverageMsg = msgs.noCoverage
          .replace('{{zip_code}}', validation.value)
          .replace('{{city}}', validation.value);
        
        await this.sendMessage(contact.id, noCoverageMsg);
        await this.createOrUpdateOrder(contact, validation.value, customerName, 'no_coverage', null);
        await this.addTrackingTag(contact.id, 'SinCobertura');
        await this.addComment(contact.id, `[Bot] Cliente en zona sin cobertura. ZIP: ${validation.value}`);
        
        // Cerrar flujo - no asignar a nadie
        await this.updateConversationState(contact.id, { state: 'closed_no_coverage' });
        
        return { handled: true, action: 'zip_no_coverage_closed' };
      }
    } else {
      // No parece ZIP - insistir en pedir ZIP
      const insistZipMsg = 'Por favor, antes de continuar necesito que me envies tu codigo postal (ZIP) para validar si tenemos cobertura en tu zona 📍\n\nPor ejemplo: 75208';
      await this.sendMessage(contact.id, insistZipMsg);
      return { handled: true, action: 'insist_zip' };
    }
  }

  // Handler para usuarios SIN información seleccionando producto
  async handleAwaitingProductNoInfo(contact, messageText, convState) {
    const msgs = this.getMessages();
    const product = this.parseProductSelection(messageText);
    
    if (product) {
      // Si seleccionó "Otros", asignar a agente directamente
      if (product.isOther) {
        const otherMsg = '¡Perfecto! Te paso con uno de nuestros agentes para ayudarte con tu consulta 😊';
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
      
      if (productInfo) {
        await this.sendMessage(contact.id, productInfo);
      } else {
        // Si no hay mensaje configurado, usar mensaje genérico
        const genericMsg = `Excelente eleccion! 👍 Has seleccionado: ${product.name}\n\nUn agente te atendera en breve para darte mas informacion.`;
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
      await this.sendMessage(contact.id, msgs.remindProduct);
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
    const product = this.parseProductSelection(messageText);
    
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
      await this.sendMessage(contact.id, msgs.remindProduct);
      const productMenu = this.generateProductMenu();
      await this.sendMessage(contact.id, productMenu);
      return { handled: true, action: 'remind_product' };
    }
  }

  async handleAwaitingContinuation(contact, messageText, convState) {
    const msgs = this.getMessages();
    const response = this.parseYesNoResponse(messageText);
    
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
        where: { user_id: this.userId, is_active: true }
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

  async createOrUpdateOrder(contact, zipCode, customerName, validationStatus, zone) {
    try {
      let order = await MessagingOrder.findOne({
        where: {
          user_id: this.userId,
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
