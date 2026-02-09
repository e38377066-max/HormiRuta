import { Op } from 'sequelize';
import sequelize from '../config/database.js';
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

    console.log(`[Polling] Ejecutando sincronizacion inicial...`);
    await this.initializeConversationSnapshot(userId, settings.respond_api_token);

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

  async preloadContactMessages(userId, contactId) {
    const poller = this.activePollers.get(userId);
    if (!poller) return;

    try {
      const settings = await MessagingSettings.findOne({ where: { user_id: userId } });
      if (!settings?.respond_api_token) return;

      const respondio = new RespondioService(settings.respond_api_token);
      const messagesResult = await respondio.listMessages(contactId, { limit: settings.message_history_limit || 50 });
      
      if (messagesResult.success && messagesResult.items) {
        for (const msg of messagesResult.items) {
          if (msg.traffic === 'outgoing') {
            poller.processedMessageIds.add(`out_${msg.messageId}`);
          } else {
            poller.processedMessageIds.add(msg.messageId);
          }
        }
        console.log(`[Reset Test] Pre-cargados ${messagesResult.items.length} mensajes existentes para contacto ${contactId}`);
      }
    } catch (error) {
      console.error(`[Reset Test] Error pre-cargando mensajes:`, error.message);
    }
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
    const isTestMode = settings?.test_mode && settings?.test_contact_id;
    const testContactId = settings?.test_contact_id?.trim();
    
    if (isTestMode) {
      console.log(`[Polling] MODO PRUEBA - Buscando contacto: ${testContactId}`);
    }
    
    console.log(`[Polling] Obteniendo conversaciones ABIERTAS con lifecycle New Lead/Pending (limite: ${messageLimit} msgs)...`);
    
    let allContacts = [];
    let cursorId = null;
    let pageCount = 0;
    
    while (true) {
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
      pageCount++;
      console.log(`[Polling] Pagina ${pageCount}: ${items.length} conversaciones abiertas`);
      
      if (!contactsResult.pagination?.nextCursor || items.length < 99) {
        break;
      }
      
      cursorId = contactsResult.pagination.nextCursor;
    }

    const targetLifecycles = ['New Lead', 'Pending'];
    let filteredContacts = allContacts.filter(contact => 
      contact.lifecycle && targetLifecycles.includes(contact.lifecycle)
    );

    let uniqueContacts = filteredContacts.filter((contact, index, self) =>
      index === self.findIndex(c => c.id === contact.id)
    );

    console.log(`[Polling] Conversaciones abiertas: ${allContacts.length}, Con lifecycle New Lead/Pending: ${uniqueContacts.length}`);

    // MODO PRUEBA: Buscar contacto directamente via API de Respond.io (sin depender de listas)
    if (isTestMode && testContactId) {
      const searchResult = await respondio.listContacts({ search: testContactId, limit: 10 });
      
      if (searchResult.success && searchResult.items && searchResult.items.length > 0) {
        const testContactLower = testContactId.toLowerCase();
        uniqueContacts = searchResult.items.filter(contact => {
          const firstName = (contact.firstName || '').toLowerCase();
          const lastName = (contact.lastName || '').toLowerCase();
          const fullName = `${firstName} ${lastName}`.trim();
          return fullName.includes(testContactLower) || 
                 String(contact.id) === testContactId;
        });
        
        for (const contact of uniqueContacts) {
          const isOpen = allContacts.some(c => c.id === contact.id);
          console.log(`[Polling] MODO PRUEBA - Contacto encontrado: ${contact.firstName} ${contact.lastName} (ID: ${contact.id}, lifecycle: ${contact.lifecycle}, conversacion: ${isOpen ? 'ABIERTA' : 'CERRADA'})`);
          
          // Rastrear estado abierto/cerrado del contacto de prueba en la BD
          const [convState] = await ConversationState.findOrCreate({
            where: { user_id: userId, contact_id: contact.id.toString() },
            defaults: { state: 'initial' }
          });
          
          if (!isOpen && !convState.conversation_closed_at) {
            // Contacto CERRADO y sin registro de cierre -> marcar como cerrado
            await convState.update({ conversation_closed_at: new Date() });
            console.log(`[Polling] MODO PRUEBA - Conversacion de ${contact.id} marcada como CERRADA en BD`);
          } else if (isOpen && convState.conversation_closed_at) {
            // Contacto ABIERTO pero tenia cierre registrado -> se detectara reapertura en processMessage
            console.log(`[Polling] MODO PRUEBA - Contacto ${contact.id} tiene conversation_closed_at, reapertura se detectara en processMessage`);
          }
        }
      }
      
      if (uniqueContacts.length === 0) {
        console.log(`[Polling] MODO PRUEBA - No se encontró contacto que coincida con: ${testContactId}`);
      } else {
        console.log(`[Polling] MODO PRUEBA - Procesando solo ${uniqueContacts.length} contacto(s)`);
      }
    }

    if (pageCount > 0) {
      await this.detectConversationStateChanges(userId, allContacts);
    }

    if (uniqueContacts.length === 0) {
      return;
    }

    for (const contact of uniqueContacts) {
      await this.processContactMessages(userId, apiToken, contact, poller, respondio, messageLimit, isTestMode);
    }

    await this.checkFollowups(userId, apiToken, settings);
  }

  async checkFollowups(userId, apiToken, settings) {
    if (!settings.followup_enabled || !settings.followup_timeout_minutes) {
      return;
    }

    const timeoutMinutes = settings.followup_timeout_minutes;
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    const pendingConversations = await ConversationState.findAll({
      where: {
        user_id: userId,
        bot_paused: false,
        agent_active: false,
        last_bot_message_at: { [Op.ne]: null, [Op.lt]: cutoffTime },
        followup_count: { [Op.lt]: 2 },
        [Op.and]: [
          {
            [Op.or]: [
              { last_customer_message_at: null },
              { last_customer_message_at: { [Op.lt]: sequelize.col('last_bot_message_at') } }
            ]
          },
          {
            [Op.or]: [
              { last_agent_message_at: null },
              { last_agent_message_at: { [Op.lt]: sequelize.col('last_bot_message_at') } }
            ]
          }
        ],
        state: { [Op.notIn]: ['assigned', 'closed_no_coverage', 'initial'] }
      }
    });

    if (pendingConversations.length === 0) {
      return;
    }

    console.log(`[Followup] Encontradas ${pendingConversations.length} conversaciones sin respuesta (timeout: ${timeoutMinutes} min)`);
    
    const respondio = new RespondioService(apiToken);
    const chatbot = new ChatbotService(userId, settings);

    for (const conv of pendingConversations) {
      try {
        if (conv.followup_last_sent_at) {
          const lastFollowup = new Date(conv.followup_last_sent_at).getTime();
          const timeSinceFollowup = (Date.now() - lastFollowup) / (1000 * 60);
          if (timeSinceFollowup < timeoutMinutes) {
            continue;
          }
        }

        const newCount = (conv.followup_count || 0) + 1;
        const followupMsg = newCount === 1
          ? (settings.followup_message || 'Hola! Sigues ahi? Quedamos pendientes de nuestra conversacion. Puedo ayudarte en algo mas?')
          : (settings.followup_message_2 || 'Hola de nuevo! Como no recibimos respuesta, pausaremos la conversacion. Cuando gustes, escribenos y con gusto te atendemos!');
        
        console.log(`[Followup] Enviando seguimiento #${newCount} a contacto ${conv.contact_id} (estado: ${conv.state})`);
        
        await chatbot.sendMessage(conv.contact_id, followupMsg);
        
        await conv.update({
          followup_count: newCount,
          followup_last_sent_at: new Date()
        });

        if (newCount >= 2) {
          console.log(`[Followup] Contacto ${conv.contact_id}: 2do seguimiento enviado, deteniendo flujo`);
          await conv.update({ bot_paused: true });
          await chatbot.addTrackingTag(conv.contact_id, 'SinRespuesta');
        }

      } catch (error) {
        console.error(`[Followup] Error procesando contacto ${conv.contact_id}:`, error.message);
      }
    }
  }

  async processContactMessages(userId, apiToken, contact, poller, respondio, messageLimit = 50, isTestMode = false) {
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
      // Agente humano ya respondió en esta conversación, NO procesar mensajes entrantes
      // para evitar que el bot interfiera con conversaciones atendidas por agentes
      for (const msg of messages.filter(m => m.traffic === 'incoming')) {
        poller.processedMessageIds.add(msg.messageId);
      }
      return;
    }
    
    // Filtrar mensajes entrantes del CLIENTE (no del bot)
    // Los mensajes del bot tienen sender.source = 'bot' o 'flow' o traffic = 'outgoing'
    const incomingMessages = messages
      .filter(msg => msg.traffic === 'incoming')
      .filter(msg => !poller.processedMessageIds.has(msg.messageId))
      .filter(msg => {
        // Ignorar mensajes del bot o flujos automáticos
        const source = msg.sender?.source || '';
        if (source === 'bot' || source === 'flow' || source === 'automation') {
          return false;
        }
        return true;
      })
      .reverse();

    if (incomingMessages.length === 0) return;

    const settings = await MessagingSettings.findOne({ where: { user_id: userId } });
    const isAutomatic = settings?.attention_mode === 'automatic';

    // IMPORTANTE: Solo procesar el mensaje MÁS RECIENTE para evitar spam
    // Los mensajes están en orden cronológico después del reverse()
    const latestMessage = incomingMessages[incomingMessages.length - 1];
    
    // Marcar todos los mensajes como procesados para evitar re-procesamiento
    for (const msg of incomingMessages) {
      poller.processedMessageIds.add(msg.messageId);
    }
    
    // Verificar en BD si el último mensaje ya fue procesado
    const alreadyProcessed = await MessageLog.findOne({
      where: { 
        respond_message_id: latestMessage.messageId?.toString(),
        user_id: userId
      }
    });
    
    if (alreadyProcessed) {
      return; // Ya fue procesado anteriormente
    }
    
    // Procesar solo el mensaje más reciente
    await this.processIncomingMessage(userId, contact, latestMessage, respondio, isAutomatic, isTestMode);

    if (poller.processedMessageIds.size > 10000) {
      const idsArray = Array.from(poller.processedMessageIds);
      poller.processedMessageIds = new Set(idsArray.slice(-5000));
    }
  }

  async initializeConversationSnapshot(userId, apiToken) {
    try {
      console.log(`[Polling] === SINCRONIZACION INICIAL: Escaneando TODAS las conversaciones ===`);
      const respondio = new RespondioService(apiToken);
      const now = new Date();

      let allOpenContacts = [];
      let cursorId = null;
      let pageCount = 0;
      let openFetchComplete = true;
      while (true) {
        const result = await respondio.listOpenConversations({ limit: 99, cursorId });
        if (!result.success) {
          console.error(`[Polling] Error obteniendo conversaciones abiertas en pagina ${pageCount + 1}`);
          openFetchComplete = false;
          break;
        }
        allOpenContacts = [...allOpenContacts, ...(result.items || [])];
        pageCount++;
        if (!result.pagination?.nextCursor || (result.items || []).length < 99) break;
        cursorId = result.pagination.nextCursor;
      }
      console.log(`[Polling] Conversaciones abiertas encontradas: ${allOpenContacts.length} (${pageCount} paginas)`);

      let allClosedContacts = [];
      cursorId = null;
      pageCount = 0;
      let closedFetchComplete = true;
      while (true) {
        const result = await respondio.listClosedConversations({ limit: 99, cursorId });
        if (!result.success) {
          console.error(`[Polling] Error obteniendo conversaciones cerradas en pagina ${pageCount + 1}`);
          closedFetchComplete = false;
          break;
        }
        allClosedContacts = [...allClosedContacts, ...(result.items || [])];
        pageCount++;
        if (!result.pagination?.nextCursor || (result.items || []).length < 99) break;
        cursorId = result.pagination.nextCursor;
      }
      console.log(`[Polling] Conversaciones cerradas encontradas: ${allClosedContacts.length} (${pageCount} paginas)`);

      if (!openFetchComplete) {
        console.warn(`[Polling] Sincronizacion ABORTADA: no se pudieron obtener todas las conversaciones abiertas. No se actualizara ningun estado.`);
        return;
      }

      const openContactIds = new Set(allOpenContacts.map(c => c.id.toString()));
      const closedContactIds = new Set(allClosedContacts.map(c => c.id.toString()));

      const trackedStates = await ConversationState.findAll({
        where: {
          user_id: userId,
          state: { [Op.notIn]: ['completed'] }
        }
      });

      let openCount = 0, closedCount = 0, unknownCount = 0;

      for (const convState of trackedStates) {
        const contactId = convState.contact_id;

        if (openContactIds.has(contactId)) {
          await convState.update({ last_seen_open_at: now, conversation_closed_at: null });
          console.log(`[Polling] Sync inicial: contacto ${contactId} -> ABIERTA`);
          openCount++;
        } else if (closedContactIds.has(contactId)) {
          if (!convState.conversation_closed_at) {
            await convState.update({ conversation_closed_at: now });
          }
          console.log(`[Polling] Sync inicial: contacto ${contactId} -> CERRADA`);
          closedCount++;
        } else if (closedFetchComplete) {
          if (!convState.conversation_closed_at) {
            await convState.update({ conversation_closed_at: now });
          }
          console.log(`[Polling] Sync inicial: contacto ${contactId} -> NO ENCONTRADO, asumido CERRADA`);
          unknownCount++;
        }
      }

      console.log(`[Polling] === SINCRONIZACION COMPLETA ===`);
      console.log(`[Polling] Contactos rastreados: ${trackedStates.length} | Abiertos: ${openCount} | Cerrados: ${closedCount} | No encontrados: ${unknownCount}`);
    } catch (error) {
      console.error(`[Polling] Error en sincronizacion inicial:`, error.message);
    }
  }

  async detectConversationStateChanges(userId, openContacts) {
    try {
      const openContactIds = new Set(openContacts.map(c => c.id.toString()));
      const now = new Date();

      const trackedStates = await ConversationState.findAll({
        where: {
          user_id: userId,
          state: { [Op.notIn]: ['completed'] }
        }
      });

      for (const convState of trackedStates) {
        if (openContactIds.has(convState.contact_id)) {
          if (convState.conversation_closed_at) {
            console.log(`[Polling] REAPERTURA detectada: contacto ${convState.contact_id} estaba CERRADA (${convState.conversation_closed_at.toISOString()}) y ahora esta ABIERTA`);
          }
          await convState.update({ last_seen_open_at: now });
        } else {
          if (!convState.conversation_closed_at) {
            await convState.update({ conversation_closed_at: now });
            console.log(`[Polling] CIERRE detectado: contacto ${convState.contact_id} ya no esta en conversaciones abiertas -> marcada CERRADA`);
          }
        }
      }
    } catch (error) {
      console.error(`[Polling] Error detectando cambios de estado:`, error.message);
    }
  }

  async markAgentActivity(userId, contactId) {
    try {
      await ConversationState.update(
        { 
          agent_active: true, 
          last_agent_message_at: new Date(),
          last_interaction: new Date(),
          followup_count: 0,
          followup_last_sent_at: null
        },
        { where: { user_id: userId, contact_id: contactId.toString() } }
      );
      console.log(`[Polling] Agente activo detectado para contacto ${contactId}`);
    } catch (error) {
      console.error(`[Polling] Error marcando agente activo:`, error.message);
    }
  }

  async processIncomingMessage(userId, contact, message, respondio, useAutomaticMode = false, isTestMode = false) {
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
        const chatbot = new ChatbotService(userId, settings, isTestMode);
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
