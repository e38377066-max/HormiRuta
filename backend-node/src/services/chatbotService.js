import ConversationState from '../models/ConversationState.js';
import MessagingSettings from '../models/MessagingSettings.js';
import MessagingOrder from '../models/MessagingOrder.js';
import AddressValidationService from './addressValidation.js';

class ChatbotService {
  constructor(userId, settings, respondio) {
    this.userId = userId;
    this.settings = settings;
    this.respondio = respondio;
    this.addressValidation = new AddressValidationService(userId);
  }

  isWithinBusinessHours() {
    if (!this.settings.business_hours_enabled) {
      return true;
    }

    const timezone = this.settings.timezone || 'America/Chicago';
    const now = new Date();
    
    const options = { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false };
    const timeStr = now.toLocaleTimeString('en-US', options);
    const [hours, minutes] = timeStr.split(':').map(Number);
    const currentMinutes = hours * 60 + minutes;

    const dayOptions = { timeZone: timezone, weekday: 'short' };
    const dayStr = now.toLocaleDateString('en-US', dayOptions);
    const dayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const currentDay = dayMap[dayStr];

    const businessDays = this.settings.business_days || [1, 2, 3, 4, 5];
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
    await ConversationState.update(
      { ...updates, last_interaction: new Date() },
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

  parseYesNoResponse(text) {
    const cleanText = text.trim().toLowerCase();
    
    const yesPatterns = ['si', 'sí', 'yes', 'ya', 'claro', 'correcto', 'afirmativo', 'ok', 'okay', 'dale', 'simon', 'seee', 'sep', 'sip', 'aja', 'ajá'];
    const noPatterns = ['no', 'nop', 'nope', 'nel', 'negativo', 'todavia no', 'aun no', 'todavía no', 'aún no', 'not yet'];
    
    if (yesPatterns.some(p => cleanText === p || cleanText.startsWith(p + ' '))) {
      return 'yes';
    }
    if (noPatterns.some(p => cleanText === p || cleanText.startsWith(p + ' '))) {
      return 'no';
    }
    return null;
  }

  parseProductSelection(text) {
    const cleanText = text.trim().toLowerCase();
    const products = this.settings.products || [
      { id: 1, name: 'Tarjetas', keywords: ['tarjetas', 'tarjeta', 'cards', 'card'] },
      { id: 2, name: 'Magnéticos', keywords: ['magneticos', 'magnetico', 'magnets', 'magnet'] },
      { id: 3, name: 'Post Cards', keywords: ['postcards', 'postcard', 'post cards', 'postal'] },
      { id: 4, name: 'Playeras', keywords: ['playeras', 'playera', 'camisetas', 'shirts'] }
    ];

    const numMatch = cleanText.match(/^\d+$/);
    if (numMatch) {
      const num = parseInt(numMatch[0]);
      const product = products.find(p => p.id === num);
      if (product) return product;
    }

    for (const product of products) {
      for (const keyword of product.keywords) {
        if (cleanText.includes(keyword.toLowerCase())) {
          return product;
        }
      }
    }

    return null;
  }

  async processMessage(contact, messageText) {
    if (this.hasExcludedTag(contact)) {
      console.log(`Contact ${contact.id} has excluded tag, skipping chatbot`);
      return { handled: false, reason: 'excluded_tag' };
    }

    const convState = await this.getOrCreateConversationState(contact.id);

    if (convState.bot_paused) {
      console.log(`Bot paused for contact ${contact.id}`);
      return { handled: false, reason: 'bot_paused' };
    }

    if (!this.isWithinBusinessHours()) {
      if (!convState.out_of_hours_notified) {
        const outOfHoursMsg = this.settings.out_of_hours_message || 
          '🌙 ¡Hola hola! 😊\n\nGracias por comunicarte con nosotros 😊 Ahorita estamos fuera de horario 🕒 pero puedes dejar tu mensaje sin problema 💬\n\nEscríbenos lo que necesitas 🙌 y en cuanto estemos de regreso en horario laboral lo leemos y te respondemos lo más pronto posible 💛📲';
        
        await this.respondio.sendMessage(contact.id, outOfHoursMsg);
        await this.updateConversationState(contact.id, { out_of_hours_notified: true });

        if (this.settings.default_agent_id) {
          await this.respondio.assignContact(contact.id, this.settings.default_agent_id);
        }
        
        return { handled: true, action: 'out_of_hours_message', message: outOfHoursMsg };
      }
      return { handled: false, reason: 'out_of_hours_already_notified' };
    }

    await this.updateConversationState(contact.id, { out_of_hours_notified: false });

    switch (convState.state) {
      case 'initial':
        return await this.handleInitialState(contact, messageText, convState);
      
      case 'awaiting_prior_info':
        return await this.handleAwaitingPriorInfo(contact, messageText, convState);
      
      case 'awaiting_zip':
        return await this.handleAwaitingZip(contact, messageText, convState);
      
      case 'awaiting_product':
        return await this.handleAwaitingProduct(contact, messageText, convState);
      
      case 'assigned':
        return { handled: false, reason: 'already_assigned' };
      
      default:
        return await this.handleInitialState(contact, messageText, convState);
    }
  }

  async handleInitialState(contact, messageText, convState) {
    const isExisting = await this.checkIfExistingCustomer(contact);
    
    if (isExisting) {
      const welcomeMsg = this.settings.welcome_existing_customer ||
        '👋 ¡Hola! Qué gusto volver a tener noticias suyas 😊 Espero que todo esté yendo muy bien.\n\nPor favor, cuéntame en qué puedo ayudarle esta vez 🤔✨';
      
      await this.respondio.sendMessage(contact.id, welcomeMsg);
      await this.updateConversationState(contact.id, {
        state: 'assigned',
        is_existing_customer: true
      });

      if (this.settings.default_agent_id) {
        await this.respondio.assignContact(contact.id, this.settings.default_agent_id);
      }
      
      return { handled: true, action: 'welcome_existing', message: welcomeMsg };
    } else {
      const welcomeMsg = this.settings.welcome_new_customer ||
        '¡Hola! 🙌 Somos de Area 862 Graphics.\n\n📩😊 Cuéntanos, ¿ya uno de nuestros agentes le brindó información sobre nuestros servicios y precios?';
      
      await this.respondio.sendMessage(contact.id, welcomeMsg);
      await this.updateConversationState(contact.id, {
        state: 'awaiting_prior_info',
        awaiting_response: 'yes_no'
      });
      
      return { handled: true, action: 'welcome_new', message: welcomeMsg };
    }
  }

  async handleAwaitingPriorInfo(contact, messageText, convState) {
    const response = this.parseYesNoResponse(messageText);
    
    if (response === 'yes') {
      const hasInfoMsg = this.settings.has_info_response ||
        'Perfecto ✅ entonces solo envíenos los datos e información para poder preparar el diseño de su orden ✍️😊';
      
      await this.respondio.sendMessage(contact.id, hasInfoMsg);
      await this.updateConversationState(contact.id, {
        state: 'assigned',
        has_prior_info: true
      });

      if (this.settings.default_agent_id) {
        await this.respondio.assignContact(contact.id, this.settings.default_agent_id);
      }
      
      return { handled: true, action: 'has_prior_info', message: hasInfoMsg };
    } else if (response === 'no') {
      const requestZipMsg = this.settings.request_zip_message ||
        'Vi que te interesan algunos de nuestros productos y quiero ayudarte a encontrar las mejores opciones 😄\n\n📍 Por favor, envíame solo el número de tu código postal (ZIP), por ejemplo 75208 ✉️\n\nCon eso confirmo si llegamos a tu zona y te paso los precios enseguida 🚚✨';
      
      await this.respondio.sendMessage(contact.id, requestZipMsg);
      await this.updateConversationState(contact.id, {
        state: 'awaiting_zip',
        has_prior_info: false,
        awaiting_response: 'zip_code'
      });
      
      return { handled: true, action: 'request_zip', message: requestZipMsg };
    } else {
      const remindMsg = 'Por favor, responde Sí o No: ¿Ya te brindaron información sobre nuestros servicios y precios? 😊';
      await this.respondio.sendMessage(contact.id, remindMsg);
      return { handled: true, action: 'remind_yes_no', message: remindMsg };
    }
  }

  async handleAwaitingZip(contact, messageText, convState) {
    const isZipMessage = this.addressValidation.isZipCodeMessage(messageText);
    const isCityMessage = this.addressValidation.isCityMessage(messageText);
    
    if (isZipMessage || isCityMessage) {
      const validation = await this.addressValidation.validateZipOrCity(messageText);
      
      if (validation.valid) {
        const coverageMsg = (this.settings.coverage_message || '✅ ¡Excelente! Tenemos cobertura en tu zona ({{zip_code}})')
          .replace('{{zip_code}}', validation.value)
          .replace('{{city}}', validation.zone?.city || '')
          .replace('{{zone}}', validation.zone?.zone_name || '');
        
        await this.respondio.sendMessage(contact.id, coverageMsg);

        const productMenuMsg = this.settings.product_menu_message ||
          '¿En cuál de estos productos está interesado? (Indica el número del producto)\n\n1. Tarjetas\n2. Magnéticos\n3. Post Cards\n4. Playeras';
        
        await this.respondio.sendMessage(contact.id, productMenuMsg);
        
        await this.updateConversationState(contact.id, {
          state: 'awaiting_product',
          validated_zip: validation.value,
          awaiting_response: 'product_selection'
        });
        
        return { handled: true, action: 'zip_validated', message: coverageMsg };
      } else {
        const noCoverageMsg = (this.settings.no_coverage_message || 'Lo sentimos, actualmente no tenemos cobertura en {{zip_code}}')
          .replace('{{zip_code}}', validation.value)
          .replace('{{city}}', validation.value);
        
        await this.respondio.sendMessage(contact.id, noCoverageMsg);

        if (this.settings.default_agent_id) {
          await this.respondio.assignContact(contact.id, this.settings.default_agent_id);
        }
        
        await this.updateConversationState(contact.id, { state: 'assigned' });
        
        return { handled: true, action: 'no_coverage', message: noCoverageMsg };
      }
    } else {
      const remindZipMsg = this.settings.remind_zip_message ||
        'Para poder continuar, necesito que me envíes tu código postal (ZIP) ✅\n\nPor ejemplo: 75208';
      
      await this.respondio.sendMessage(contact.id, remindZipMsg);
      return { handled: true, action: 'remind_zip', message: remindZipMsg };
    }
  }

  async handleAwaitingProduct(contact, messageText, convState) {
    const product = this.parseProductSelection(messageText);
    
    if (product) {
      const confirmMsg = `¡Perfecto! Has seleccionado: ${product.name} 👍\n\nUn momento, te paso con uno de nuestros agentes para darte más información sobre precios y disponibilidad 😊`;
      
      await this.respondio.sendMessage(contact.id, confirmMsg);
      await this.updateConversationState(contact.id, {
        state: 'assigned',
        selected_product: product.name
      });

      if (this.settings.default_agent_id) {
        await this.respondio.assignContact(contact.id, this.settings.default_agent_id);
      }
      
      return { handled: true, action: 'product_selected', product: product.name, message: confirmMsg };
    } else {
      const productMenuMsg = this.settings.product_menu_message ||
        '¿En cuál de estos productos está interesado? (Indica el número del producto)\n\n1. Tarjetas\n2. Magnéticos\n3. Post Cards\n4. Playeras';
      
      const remindMsg = `No entendí tu selección. ${productMenuMsg}`;
      await this.respondio.sendMessage(contact.id, remindMsg);
      return { handled: true, action: 'remind_product', message: remindMsg };
    }
  }

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
      bot_paused: false
    });
    return { success: true, message: 'Conversación reiniciada' };
  }
}

export default ChatbotService;
