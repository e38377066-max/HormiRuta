import RespondioService from './respondio.js';
import AddressValidationService from './addressValidation.js';
import ChatbotService from './chatbotService.js';
import MessagingSettings from '../models/MessagingSettings.js';
import MessagingOrder from '../models/MessagingOrder.js';
import MessageLog from '../models/MessageLog.js';
import CoverageZone from '../models/CoverageZone.js';
import ConversationState from '../models/ConversationState.js';

class PollingService {
  constructor() {
    this.activePollers = new Map();
    this.processedMessages = new Map();
  }

  async startPolling(userId, intervalSeconds = 30) {
    console.log(`[Polling] Iniciando polling para usuario ${userId}...`);
    
    if (this.activePollers.has(userId)) {
      console.log(`[Polling] Ya está activo para usuario ${userId}`);
      return { success: true, message: 'Polling ya está activo' };
    }

    const settings = await MessagingSettings.findOne({ where: { user_id: userId } });
    
    if (!settings) {
      console.log(`[Polling] ERROR: No hay configuración de mensajería para usuario ${userId}`);
      return { success: false, error: 'No hay configuración de mensajería. Ve a Configuración primero.' };
    }
    
    if (!settings.respond_api_token) {
      console.log(`[Polling] ERROR: No hay token de API para usuario ${userId}`);
      return { success: false, error: 'No se ha configurado el token de API de Respond.io. Configúralo en Ajustes.' };
    }

    if (!settings.is_active) {
      console.log(`[Polling] ERROR: Módulo de mensajería desactivado para usuario ${userId}`);
      return { success: false, error: 'El módulo de mensajería está desactivado. Actívalo en Ajustes.' };
    }
    
    console.log(`[Polling] Configuración válida. Token: ${settings.respond_api_token.substring(0, 10)}...`);

    const poller = {
      userId,
      intervalMs: intervalSeconds * 1000,
      lastPoll: null,
      isRunning: true,
      processedMessageIds: new Set(),
      intervalId: null
    };

    const pollFn = async () => {
      if (!poller.isRunning) return;
      
      try {
        console.log(`[Polling] Ejecutando poll para usuario ${userId}...`);
        await this.pollForNewMessages(userId, settings.respond_api_token, poller);
        poller.lastPoll = new Date();
        console.log(`[Polling] Poll completado para usuario ${userId}`);
      } catch (error) {
        console.error(`[Polling] ERROR en poll para usuario ${userId}:`, error.message);
        console.error(error.stack);
      }
    };

    console.log(`[Polling] Ejecutando primer poll...`);
    await pollFn();
    
    poller.intervalId = setInterval(pollFn, poller.intervalMs);
    this.activePollers.set(userId, poller);

    console.log(`[Polling] ACTIVO para usuario ${userId} cada ${intervalSeconds}s`);
    return { success: true, message: `Polling iniciado cada ${intervalSeconds} segundos` };
  }

  stopPolling(userId) {
    const poller = this.activePollers.get(userId);
    if (poller) {
      poller.isRunning = false;
      if (poller.intervalId) {
        clearInterval(poller.intervalId);
      }
      this.activePollers.delete(userId);
      console.log(`Stopped polling for user ${userId}`);
      return { success: true, message: 'Polling detenido' };
    }
    return { success: false, error: 'No hay polling activo para este usuario' };
  }

  getPollingStatus(userId) {
    const poller = this.activePollers.get(userId);
    if (poller) {
      return {
        active: true,
        lastPoll: poller.lastPoll,
        intervalMs: poller.intervalMs,
        processedCount: poller.processedMessageIds.size
      };
    }
    return { active: false };
  }

  async pollForNewMessages(userId, apiToken, poller) {
    console.log(`[Polling] Conectando a Respond.io API...`);
    const respondio = new RespondioService(apiToken);
    
    const settings = await MessagingSettings.findOne({ where: { user_id: userId } });
    const messageLimit = settings?.message_history_limit || 50;
    
    // MODO PRUEBA: Solo procesar un contacto específico
    if (settings?.test_mode && settings?.test_contact_id) {
      console.log(`[Polling] MODO PRUEBA - Solo procesando contacto ID: ${settings.test_contact_id}`);
      const contactResult = await respondio.getContact(settings.test_contact_id);
      
      if (contactResult.success && contactResult.contact) {
        await this.processContactMessages(userId, apiToken, contactResult.contact, poller, respondio, messageLimit);
        console.log(`[Polling] MODO PRUEBA - Contacto ${contactResult.contact.firstName || settings.test_contact_id} procesado`);
      } else {
        console.error(`[Polling] MODO PRUEBA - No se encontró el contacto ${settings.test_contact_id}`);
      }
      return;
    }
    
    console.log(`[Polling] Obteniendo conversaciones ABIERTAS con lifecycle New Lead/Pending (limite: ${messageLimit} msgs)...`);
    
    let allContacts = [];
    let cursorId = null;
    let pageCount = 0;
    const maxPages = 3;
    
    while (pageCount < maxPages) {
      const contactsResult = await respondio.listOpenConversations({ 
        limit: 99,
        cursorId: cursorId
      });

      if (!contactsResult.success) {
        console.error('[Polling] Error obteniendo conversaciones abiertas:', contactsResult.error);
        break;
      }

      const items = contactsResult.items || [];
      allContacts = [...allContacts, ...items];
      console.log(`[Polling] Pagina ${pageCount + 1}: ${items.length} conversaciones abiertas`);
      
      if (!contactsResult.pagination?.nextCursor || items.length < 99) {
        break;
      }
      
      cursorId = contactsResult.pagination.nextCursor;
      pageCount++;
    }

    const targetLifecycles = ['New Lead', 'Pending'];
    const filteredContacts = allContacts.filter(contact => 
      contact.lifecycle && targetLifecycles.includes(contact.lifecycle)
    );

    const uniqueContacts = filteredContacts.filter((contact, index, self) =>
      index === self.findIndex(c => c.id === contact.id)
    );

    console.log(`[Polling] Conversaciones abiertas: ${allContacts.length}, Con lifecycle New Lead/Pending: ${uniqueContacts.length}`);

    for (const contact of uniqueContacts) {
      await this.processContactMessages(userId, apiToken, contact, poller, respondio, messageLimit);
    }
  }

  async processContactMessages(userId, apiToken, contact, poller, respondio, messageLimit = 50) {
    const messagesResult = await respondio.listMessages(contact.id, { limit: messageLimit });
    
    if (!messagesResult.success) {
      console.error(`Failed to fetch messages for contact ${contact.id}:`, messagesResult.error);
      return;
    }

    const messages = messagesResult.items || [];
    
    // Detectar mensajes salientes de agentes (sender.source === 'user') para marcar agente activo
    // Según API Respond.io: sender.source = 'user' indica mensaje enviado por agente humano
    const outgoingAgentMessages = messages
      .filter(msg => msg.traffic === 'outgoing' && msg.sender?.source === 'user')
      .filter(msg => !poller.processedMessageIds.has(`out_${msg.messageId}`));
    
    if (outgoingAgentMessages.length > 0) {
      await this.markAgentActivity(userId, contact.id);
      for (const msg of outgoingAgentMessages) {
        poller.processedMessageIds.add(`out_${msg.messageId}`);
      }
    }
    
    const incomingMessages = messages
      .filter(msg => msg.traffic === 'incoming')
      .filter(msg => !poller.processedMessageIds.has(msg.messageId))
      .reverse();

    if (incomingMessages.length === 0) return;

    const settings = await MessagingSettings.findOne({ where: { user_id: userId } });
    const isAutomatic = settings?.attention_mode === 'automatic';

    for (const message of incomingMessages) {
      poller.processedMessageIds.add(message.messageId);
      await this.processIncomingMessage(userId, contact, message, respondio, isAutomatic);
    }

    if (poller.processedMessageIds.size > 10000) {
      const idsArray = Array.from(poller.processedMessageIds);
      poller.processedMessageIds = new Set(idsArray.slice(-5000));
    }
  }

  async markAgentActivity(userId, contactId) {
    try {
      await ConversationState.update(
        { 
          agent_active: true, 
          last_agent_message_at: new Date(),
          last_interaction: new Date()
        },
        { where: { user_id: userId, contact_id: contactId.toString() } }
      );
      console.log(`[Polling] Agente activo detectado para contacto ${contactId}`);
    } catch (error) {
      console.error(`[Polling] Error marcando agente activo:`, error.message);
    }
  }

  async processIncomingMessage(userId, contact, message, respondio, useAutomaticMode = false) {
    try {
      const settings = await MessagingSettings.findOne({ where: { user_id: userId } });
      if (!settings) return;

      const messageText = message.message?.text || '';
      
      await MessageLog.create({
        user_id: userId,
        contact_id: contact.id.toString(),
        contact_name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Sin nombre',
        contact_phone: contact.phone || null,
        channel: 'respond.io',
        direction: 'incoming',
        message_type: message.message?.type || 'text',
        message_content: messageText,
        respond_message_id: message.messageId?.toString(),
        processed: false
      });

      if (useAutomaticMode) {
        const chatbot = new ChatbotService(userId, settings);
        const result = await chatbot.processMessage(contact, messageText);
        
        console.log(`[Chatbot] ${contact.firstName}: "${messageText.substring(0, 30)}..." -> ${result.action || result.reason || 'no_action'}`);
        
        if (result.handled) {
          await this.logOutgoingMessage(userId, contact, result.message || '', result.action || 'chatbot');
        }
        
        await MessageLog.update(
          { processed: true },
          { where: { respond_message_id: message.messageId?.toString(), user_id: userId } }
        );
        return;
      }

      const addressValidation = new AddressValidationService(userId);
      const validation = await addressValidation.validateAddress(messageText);
      
      const extractedZip = addressValidation.extractZipCode(messageText);
      const hasZipCode = extractedZip !== null;
      const channelId = message.channelId || null;

      console.log(`Message from ${contact.firstName}: "${messageText.substring(0, 50)}..." - isAddress: ${validation.isAddress}, hasZIP: ${hasZipCode}, ZIP: ${extractedZip || 'none'}, ChannelId: ${channelId || 'N/A'}`);

      if (validation.isAddress || hasZipCode) {
        const zipToUse = validation.zipCode || extractedZip;
        const coverageCheck = await addressValidation.checkCoverage(zipToUse);
        const hasCoverage = validation.hasCoverage || coverageCheck.hasCoverage;
        const validationMsg = validation.isAddress 
          ? validation.validationMessage 
          : (hasCoverage ? `ZIP ${zipToUse} con cobertura` : `ZIP ${zipToUse} sin cobertura`);
        
        console.log(`Creating/updating order - ZIP: ${zipToUse}, Coverage: ${hasCoverage}`);
        
        const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Sin nombre';
        
        let order = await MessagingOrder.findOne({
          where: {
            user_id: userId,
            respond_contact_id: contact.id.toString(),
            status: 'pending'
          }
        });

        if (!order) {
          order = await MessagingOrder.create({
            user_id: userId,
            respond_contact_id: contact.id.toString(),
            customer_name: customerName,
            customer_phone: contact.phone || null,
            channel_type: 'respond.io',
            channel_id: message.channelId || null,
            address: validation.isAddress ? messageText : `ZIP: ${zipToUse}`,
            zip_code: zipToUse,
            address_type: validation.addressType || 'unknown',
            status: 'pending',
            validation_status: hasCoverage ? 'covered' : 'no_coverage',
            validation_message: validationMsg,
            lifecycle: contact.lifecycle || null,
            notes: validation.needsApartmentNumber ? 'Pendiente: Solicitar numero de apartamento' : (validation.isAddress ? null : 'Solo ZIP code recibido - falta direccion completa')
          });
          console.log(`Created new order #${order.id} for ${customerName} (ZIP: ${zipToUse}, Channel: ${message.channelId || 'N/A'})`);
        } else {
          await order.update({
            address: validation.isAddress ? messageText : `ZIP: ${zipToUse}`,
            zip_code: zipToUse,
            channel_id: message.channelId || order.channel_id,
            validation_status: hasCoverage ? 'covered' : 'no_coverage',
            validation_message: validationMsg,
            lifecycle: contact.lifecycle || order.lifecycle
          });
          console.log(`Updated order #${order.id} with new ZIP: ${zipToUse} (replaced previous)`);
        }

        await MessageLog.update(
          { processed: true, order_id: order.id },
          { where: { respond_message_id: message.messageId?.toString(), user_id: userId } }
        );
      }
    } catch (error) {
      console.error('Error processing message:', error.message);
    }
  }

  async logOutgoingMessage(userId, contact, text, messageType) {
    await MessageLog.create({
      user_id: userId,
      contact_id: contact.id.toString(),
      contact_name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
      contact_phone: contact.phone || null,
      channel: 'respond.io',
      direction: 'outgoing',
      message_type: messageType,
      message_content: text,
      processed: true
    });
  }
}

const pollingServiceInstance = new PollingService();
export default pollingServiceInstance;
