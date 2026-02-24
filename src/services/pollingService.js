import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import RespondioService from './respondio.js';
import AddressValidationService from './addressValidation.js';
import AddressExtractorService from './addressExtractorService.js';
import geocodingService from './geocodingService.js';
import ChatbotService from './chatbotService.js';
import MessagingSettings from '../models/MessagingSettings.js';
import MessagingOrder from '../models/MessagingOrder.js';
import MessageLog from '../models/MessageLog.js';
import CoverageZone from '../models/CoverageZone.js';
import ConversationState from '../models/ConversationState.js';
import ValidatedAddress from '../models/ValidatedAddress.js';

class PollingService {
  constructor() {
    this.activePollers = new Map();
    this.processedMessages = new Map();
    this.addressScannedContacts = new Set();
    this.lastFullAddressScan = null;
    this.respondioInstances = new Map();
  }

  getRespondioInstance(apiToken) {
    if (!this.respondioInstances.has(apiToken)) {
      this.respondioInstances.set(apiToken, new RespondioService(apiToken));
    }
    return this.respondioInstances.get(apiToken);
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
      pollInProgress: false,
      scanInProgress: false,
      processedMessageIds: new Set(),
      intervalId: null,
      scanIntervalId: null
    };

    const pollFn = async () => {
      if (!poller.isRunning) return;
      if (poller.pollInProgress) {
        console.log(`[Polling] Poll anterior aun en curso para usuario ${userId}, saltando este ciclo`);
        return;
      }
      
      poller.pollInProgress = true;
      try {
        console.log(`[Polling] Ejecutando poll para usuario ${userId}...`);
        await this.pollForNewMessages(userId, settings.respond_api_token, poller);
        poller.lastPoll = new Date();
        console.log(`[Polling] Poll completado para usuario ${userId}`);
      } catch (error) {
        console.error(`[Polling] ERROR en poll para usuario ${userId}:`, error.message);
        console.error(error.stack);
      } finally {
        poller.pollInProgress = false;
      }
    };

    const scanFn = async () => {
      if (!poller.isRunning) return;
      if (poller.scanInProgress) return;
      
      poller.scanInProgress = true;
      try {
        await this.runAddressScanCycle(userId, settings.respond_api_token, settings);
      } catch (error) {
        console.error(`[AddressScan] ERROR en ciclo de escaneo:`, error.message);
      } finally {
        poller.scanInProgress = false;
      }
    };

    this.activePollers.set(userId, poller);

    (async () => {
      try {
        console.log(`[Polling] Ejecutando sincronizacion inicial...`);
        await this.initializeConversationSnapshot(userId, settings.respond_api_token);
        console.log(`[Polling] Ejecutando primer poll...`);
        await pollFn();
      } catch (err) {
        console.error(`[Polling] Error en inicializacion:`, err.message);
      }
      poller.intervalId = setInterval(pollFn, poller.intervalMs);
      console.log(`[Polling] Bot ACTIVO para usuario ${userId} cada ${intervalSeconds}s`);

      setTimeout(() => scanFn(), 5000);
      poller.scanIntervalId = setInterval(scanFn, 20000);
      console.log(`[AddressScan] Scanner ACTIVO para usuario ${userId} cada 20s (independiente del bot)`);
    })();

    return { success: true, message: `Polling iniciado cada ${intervalSeconds} segundos` };
  }

  stopPolling(userId) {
    const poller = this.activePollers.get(userId);
    if (poller) {
      poller.isRunning = false;
      if (poller.intervalId) {
        clearInterval(poller.intervalId);
      }
      if (poller.scanIntervalId) {
        clearInterval(poller.scanIntervalId);
      }
      this.activePollers.delete(userId);
      console.log(`Stopped polling and address scanner for user ${userId}`);
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

      const respondio = this.getRespondioInstance(settings.respond_api_token);
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
    const respondio = this.getRespondioInstance(apiToken);
    
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
    
    const respondio = this.getRespondioInstance(apiToken);
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
    // En MODO PRUEBA: ignorar detección de agente para simular cliente nuevo
    if (!isTestMode) {
      const outgoingAgentMessages = messages
        .filter(msg => msg.traffic === 'outgoing' && msg.sender?.source === 'user')
        .filter(msg => !poller.processedMessageIds.has(`out_${msg.messageId}`));
      
      if (outgoingAgentMessages.length > 0) {
        const latestAgentMsg = outgoingAgentMessages[0];
        const latestAgentTime = new Date(latestAgentMsg.createdAt || latestAgentMsg.timestamp || 0);
        const hasCloseAfterAgent = this.detectCloseReopenInMessages(messages, latestAgentTime);
        
        if (!hasCloseAfterAgent) {
          await this.markAgentActivity(userId, contact.id);
          for (const msg of outgoingAgentMessages) {
            poller.processedMessageIds.add(`out_${msg.messageId}`);
          }

          const newIncomingMessages = messages
            .filter(m => m.traffic === 'incoming')
            .filter(m => !poller.processedMessageIds.has(m.messageId));

          for (const msg of messages.filter(m => m.traffic === 'incoming')) {
            poller.processedMessageIds.add(msg.messageId);
          }

          if (newIncomingMessages.length > 0) {
            await this.extractAndSaveAddressFromMessages(userId, contact, newIncomingMessages, respondio);
          }

          return;
        } else {
          console.log(`[Polling] Mensajes de agente detectados para ${contact.id} pero hubo cierre posterior, no se marca agent_active`);
          for (const msg of outgoingAgentMessages) {
            poller.processedMessageIds.add(`out_${msg.messageId}`);
          }
        }
      }
    } else {
      for (const msg of messages.filter(m => m.traffic === 'outgoing')) {
        poller.processedMessageIds.add(`out_${msg.messageId}`);
      }
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

    if (!isTestMode) {
      const convState = await ConversationState.findOne({
        where: { user_id: userId, contact_id: contact.id.toString() }
      });
      if (convState && convState.agent_active) {
        const wasClosedAndReopened = this.detectCloseReopenInMessages(messages, convState.last_agent_message_at);
        if (wasClosedAndReopened) {
          console.log(`[Polling] Contacto ${contact.id} tenia agent_active=true PERO se detecto cierre+reapertura en mensajes, reseteando estado`);
          await convState.update({
            agent_active: false,
            bot_paused: false,
            state: 'initial',
            conversation_closed_at: null,
            out_of_hours_notified: false,
            greeting_sent: false,
            awaiting_response: null,
            has_prior_info: true,
            is_existing_customer: true,
            is_reopened: true,
            selected_product: null,
            followup_count: 0,
            followup_last_sent_at: null
          });
        } else {
          console.log(`[Polling] Contacto ${contact.id} tiene agent_active=true, extrayendo direcciones sin procesar con bot`);
          for (const msg of incomingMessages) {
            poller.processedMessageIds.add(msg.messageId);
          }
          await this.extractAndSaveAddressFromMessages(userId, contact, incomingMessages, respondio);
          this.addressScannedContacts.delete(contact.id.toString());
          return;
        }
      }
    }

    this.addressScannedContacts.delete(contact.id.toString());

    const settings = await MessagingSettings.findOne({ where: { user_id: userId } });
    const isAutomatic = settings?.attention_mode === 'automatic';

    const latestMessage = incomingMessages[incomingMessages.length - 1];
    
    for (const msg of incomingMessages) {
      poller.processedMessageIds.add(msg.messageId);
    }
    
    const alreadyProcessed = await MessageLog.findOne({
      where: { 
        respond_message_id: latestMessage.messageId?.toString(),
        user_id: userId
      }
    });
    
    if (alreadyProcessed) {
      return;
    }
    
    await this.processIncomingMessage(userId, contact, latestMessage, respondio, isAutomatic, isTestMode);

    if (poller.processedMessageIds.size > 10000) {
      const idsArray = Array.from(poller.processedMessageIds);
      poller.processedMessageIds = new Set(idsArray.slice(-5000));
    }
  }

  async initializeConversationSnapshot(userId, apiToken) {
    try {
      console.log(`[Polling] === SINCRONIZACION INICIAL: Escaneando TODAS las conversaciones ===`);
      const respondio = this.getRespondioInstance(apiToken);
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
      const trackedContactIds = new Set(trackedStates.map(s => s.contact_id));

      let openCount = 0, closedCount = 0, unknownCount = 0;

      for (const convState of trackedStates) {
        const contactId = convState.contact_id;

        if (openContactIds.has(contactId)) {
          await convState.update({ last_seen_open_at: now, conversation_closed_at: null });
          openCount++;
        } else if (closedContactIds.has(contactId)) {
          if (!convState.conversation_closed_at) {
            await convState.update({ conversation_closed_at: now });
          }
          closedCount++;
        } else if (closedFetchComplete) {
          if (!convState.conversation_closed_at) {
            await convState.update({ conversation_closed_at: now });
          }
          unknownCount++;
        }
      }

      let newClosedRegistered = 0;
      for (const contact of allClosedContacts) {
        const contactId = contact.id.toString();
        if (!trackedContactIds.has(contactId)) {
          await ConversationState.findOrCreate({
            where: { user_id: userId, contact_id: contactId },
            defaults: {
              user_id: userId,
              contact_id: contactId,
              state: 'completed',
              conversation_closed_at: now,
              agent_active: false,
              bot_paused: true,
              is_existing_customer: true
            }
          });
          newClosedRegistered++;
        }
      }

      const totalClosed = closedCount + unknownCount + newClosedRegistered;
      console.log(`[Polling] === SINCRONIZACION COMPLETA ===`);
      console.log(`[Polling] Respond.io: ${allOpenContacts.length} abiertas, ${allClosedContacts.length} cerradas`);
      console.log(`[Polling] Rastreados previos: ${trackedStates.length} (${openCount} abiertos, ${closedCount + unknownCount} cerrados)`);
      console.log(`[Polling] Nuevos cerrados registrados: ${newClosedRegistered}`);
      console.log(`[Polling] Total rastreados: ${trackedStates.length + newClosedRegistered} | Abiertos: ${openCount} | Cerrados: ${totalClosed}`);
    } catch (error) {
      console.error(`[Polling] Error en sincronizacion inicial:`, error.message);
    }
  }

  detectCloseReopenInMessages(messages, lastAgentMessageAt) {
    try {
      const agentTime = lastAgentMessageAt ? new Date(lastAgentMessageAt).getTime() : 0;
      
      for (const msg of messages) {
        const msgTime = new Date(msg.createdAt || msg.timestamp || 0).getTime();
        if (agentTime > 0 && msgTime < agentTime) continue;

        const msgType = msg.message?.type || msg.type || '';
        const msgText = msg.message?.text || '';
        const traffic = msg.traffic || '';

        if (msgType === 'event' || traffic === 'event') {
          const eventType = msg.message?.event?.type || msg.event?.type || '';
          if (eventType === 'conversation_closed' || 
              eventType === 'close' || 
              msgText.toLowerCase().includes('conversation closed') ||
              msgText.toLowerCase().includes('conversación cerrada') ||
              msgText.toLowerCase().includes('cerrada por')) {
            console.log(`[Polling] Evento de cierre detectado en mensajes (msgId: ${msg.messageId}, time: ${msg.createdAt})`);
            return true;
          }
        }

        if (msgType === 'assign' || msgType === 'unassign') {
          continue;
        }

        if (traffic === 'outgoing' && msg.sender?.source === 'system') {
          const text = (msg.message?.text || '').toLowerCase();
          if (text.includes('cerrada') || text.includes('closed') || text.includes('conversation close')) {
            console.log(`[Polling] Mensaje de sistema indicando cierre detectado (msgId: ${msg.messageId})`);
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error(`[Polling] Error detectando cierre/reapertura en mensajes:`, error.message);
      return false;
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
            await convState.update({
              last_seen_open_at: now,
              agent_active: false,
              bot_paused: false,
              state: 'initial',
              conversation_closed_at: null,
              out_of_hours_notified: false,
              greeting_sent: false,
              awaiting_response: null,
              has_prior_info: true,
              is_existing_customer: true,
              is_reopened: true,
              selected_product: null,
              followup_count: 0,
              followup_last_sent_at: null
            });
            console.log(`[Polling] Estado reseteado para contacto ${convState.contact_id} por reapertura`);
          } else {
            await convState.update({ last_seen_open_at: now });
          }
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
      const [state, created] = await ConversationState.findOrCreate({
        where: { user_id: userId, contact_id: contactId.toString() },
        defaults: {
          user_id: userId,
          contact_id: contactId.toString(),
          state: 'assigned',
          agent_active: true,
          last_agent_message_at: new Date(),
          last_interaction: new Date(),
          is_existing_customer: true,
          followup_count: 0,
          followup_last_sent_at: null
        }
      });

      if (!created) {
        await state.update({
          agent_active: true,
          last_agent_message_at: new Date(),
          last_interaction: new Date(),
          followup_count: 0,
          followup_last_sent_at: null
        });
      }

      console.log(`[Polling] Agente activo detectado para contacto ${contactId} (registro ${created ? 'CREADO' : 'actualizado'})`);
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

  async extractAndSaveAddressFromMessages(userId, contact, messages, respondio) {
    try {
      const extractor = new AddressExtractorService();
      const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Sin nombre';

      let latestAddress = null;
      for (const msg of messages) {
        const text = msg.message?.text || '';
        if (!text || text.length < 5) continue;

        const extractedAddress = extractor.extractAddressFromMessage(text);
        if (extractedAddress) {
          latestAddress = extractedAddress;
          break;
        }
      }

      if (!latestAddress) return;

      const existingAddr = await ValidatedAddress.findOne({
        where: { user_id: userId, respond_contact_id: contact.id.toString() },
        order: [['created_at', 'DESC']]
      });

      if (existingAddr) {
        const newNorm = latestAddress.toLowerCase().replace(/[^a-z0-9]/g, '');
        const origNorm = (existingAddr.original_address || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const validNorm = (existingAddr.validated_address || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (newNorm === origNorm || newNorm === validNorm) {
          return;
        }
        console.log(`[AddressScan-Agent] Nueva direccion de ${contactName} (${contact.id}): "${latestAddress}" (anterior: "${existingAddr.validated_address}")`);
      } else {
        console.log(`[AddressScan-Agent] Direccion de ${contactName} (${contact.id}): "${latestAddress}"`);
      }

      let finalAddress = latestAddress;
      let finalZip = null;
      let geocoded = { success: false };

      try {
        geocoded = await geocodingService.geocodeAddress(latestAddress);
        if (geocoded.success) {
          finalAddress = geocoded.fullAddress;
          finalZip = geocoded.zip || finalZip;
          if (geocoded.wasChanged) {
            console.log(`[AddressScan-Agent] Geocoding corrigio: "${latestAddress}" -> "${finalAddress}"`);
          }
        }
      } catch (geoError) {
        console.error(`[AddressScan-Agent] Error geocoding:`, geoError.message);
      }

      const customFieldsUpdate = {};
      customFieldsUpdate.address = finalAddress;
      if (finalZip) {
        customFieldsUpdate.zip_code = finalZip;
      }

      let updateResult;
      try {
        updateResult = await respondio.updateContactCustomFields(contact.id, customFieldsUpdate);
      } catch (updateErr) {
        console.log(`[AddressScan-Agent] No se pudo actualizar ${contactName} (${contact.id}), se reintentará después`);
        return;
      }
      if (updateResult.success) {
        console.log(`[AddressScan-Agent] Campos actualizados para ${contactName} (${contact.id}): Address="${finalAddress}"${finalZip ? ` ZIP: ${finalZip}` : ''}`);
      } else {
        const altFieldsUpdate = {};
        altFieldsUpdate['Address'] = finalAddress;
        if (finalZip) {
          altFieldsUpdate['Zip Code'] = finalZip;
        }
        try {
          const altResult = await respondio.updateContactCustomFields(contact.id, altFieldsUpdate);
          if (altResult.success) {
            console.log(`[AddressScan-Agent] Campos actualizados (nombres alternativos) para ${contactName} (${contact.id}): Address="${finalAddress}"`);
          } else {
            console.error(`[AddressScan-Agent] Error actualizando campos para ${contactName} (${contact.id}):`, altResult.error);
          }
        } catch (altErr) {
          console.log(`[AddressScan-Agent] No se pudo actualizar (alt) ${contactName} (${contact.id}), se reintentará después`);
        }
      }

      await this.saveValidatedAddress(userId, contact, finalAddress, latestAddress, finalZip, geocoded);

      this.addressScannedContacts.delete(contact.id.toString());
    } catch (error) {
      console.error(`[AddressScan-Agent] Error extrayendo direccion:`, error.message);
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

  async runAddressScanCycle(userId, apiToken, settings) {
    try {
      const respondio = this.getRespondioInstance(apiToken);
      const messageLimit = settings?.message_history_limit || 50;

      let allContacts = [];
      let cursorId = null;
      while (true) {
        const result = await respondio.listOpenConversations({ limit: 99, cursorId });
        if (!result.success) break;
        allContacts = [...allContacts, ...(result.items || [])];
        if (!result.pagination?.nextCursor || (result.items || []).length < 99) break;
        cursorId = result.pagination.nextCursor;
      }

      const excludedLifecycles = ['UPS Shipped', 'Delivered'];
      allContacts = allContacts.filter(contact => {
        if (contact.lifecycle && excludedLifecycles.includes(contact.lifecycle)) {
          return false;
        }
        return true;
      });

      if (allContacts.length === 0) return;

      await this.scanAddressesInConversations(userId, apiToken, allContacts, respondio, messageLimit, settings);
    } catch (error) {
      console.error(`[AddressScan] Error en ciclo independiente:`, error.message);
    }
  }

  async scanAddressesInConversations(userId, apiToken, allContacts, respondio, messageLimit, settings) {
    try {
      const extractor = new AddressExtractorService();
      let updatedCount = 0;
      const MAX_CONTACTS_PER_SCAN = 15;
      const RESCAN_INTERVAL_MS = 10 * 60 * 1000;
      const DELAY_BETWEEN_CONTACTS_MS = 500;

      let contactsToScan = allContacts.filter((contact, index, self) =>
        index === self.findIndex(c => c.id === contact.id)
      );

      contactsToScan = contactsToScan.filter(c => !this.addressScannedContacts.has(c.id.toString()));

      const terminalStates = ['initial', 'assigned', 'completed', 'closed_no_coverage', 'closed'];

      const contactIds = contactsToScan.map(c => c.id.toString());

      if (contactIds.length > 0) {
        const busyConversations = await ConversationState.findAll({
          where: {
            user_id: userId,
            contact_id: { [Op.in]: contactIds },
            state: { [Op.notIn]: terminalStates }
          }
        });

        const busyContactIds = new Set(busyConversations.map(c => c.contact_id));

        if (busyContactIds.size > 0) {
          console.log(`[AddressScan] Saltando ${busyContactIds.size} contactos con flujo de chatbot activo: ${[...busyContactIds].join(', ')}`);
        }

        contactsToScan = contactsToScan.filter(c => !busyContactIds.has(c.id.toString()));
      }

      if (contactsToScan.length === 0) {
        if (this.lastFullAddressScan && (Date.now() - this.lastFullAddressScan) > RESCAN_INTERVAL_MS) {
          this.addressScannedContacts.clear();
          console.log(`[AddressScan] Cache limpiado, proximo ciclo re-escaneara todos los contactos`);
          this.lastFullAddressScan = Date.now();
        }
        return;
      }

      if (!this.lastFullAddressScan) {
        this.lastFullAddressScan = Date.now();
      }

      const batch = contactsToScan.slice(0, MAX_CONTACTS_PER_SCAN);

      const batchContactIds = batch.map(c => c.id.toString());
      const existingAddresses = await ValidatedAddress.findAll({
        where: {
          user_id: userId,
          respond_contact_id: { [Op.in]: batchContactIds }
        }
      });
      const addressMap = new Map();
      for (const va of existingAddresses) {
        addressMap.set(va.respond_contact_id, {
          validated: va.validated_address,
          original: va.original_address
        });
      }

      for (let i = 0; i < batch.length; i++) {
        const contact = batch[i];
        const contactIdStr = contact.id.toString();
        this.addressScannedContacts.add(contactIdStr);

        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CONTACTS_MS));
        }

        try {
          const messagesResult = await respondio.listMessages(contact.id, { limit: messageLimit });
          if (!messagesResult.success || !messagesResult.items) continue;

          const incomingMessages = messagesResult.items.filter(m => m.traffic === 'incoming');
          let latestExtracted = null;
          for (const msg of incomingMessages) {
            const text = msg.message?.text || '';
            if (!text || text.length < 5) continue;
            const addr = extractor.extractAddressFromMessage(text);
            if (addr) {
              latestExtracted = addr;
              break;
            }
          }

          const result = latestExtracted ? { address: latestExtracted } : extractor.extractAddressFromConversation(messagesResult.items);

          if (result && result.address) {
            const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
            const existing = addressMap.get(contactIdStr);

            if (existing) {
              const newAddrNorm = result.address.toLowerCase().replace(/[^a-z0-9]/g, '');
              const existOrigNorm = (existing.original || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              const existValidNorm = (existing.validated || '').toLowerCase().replace(/[^a-z0-9]/g, '');

              if (newAddrNorm === existOrigNorm || newAddrNorm === existValidNorm) {
                continue;
              }
              console.log(`[AddressScan] Nueva direccion detectada para ${contactName} (${contact.id}): "${result.address}" (anterior: "${existing.validated}")`);
            }

            let finalAddress = result.address;
            let finalZip = null;

            const geocoded = await geocodingService.geocodeAddress(result.address);

            if (geocoded.success && geocoded.confidence === 'high') {
              finalAddress = geocoded.fullAddress;
              finalZip = geocoded.zip;
              if (geocoded.wasChanged) {
                console.log(`[AddressScan] Geocoding corrigió: "${result.address}" -> "${finalAddress}"`);
              }
            } else if (geocoded.success && geocoded.confidence === 'low') {
              finalAddress = geocoded.fullAddress;
              finalZip = geocoded.zip;
              console.log(`[AddressScan] Geocoding (baja confianza): "${result.address}" -> "${finalAddress}"`);
            } else {
              const components = extractor.extractFullAddressComponents(result.address);
              finalZip = components.zip;
              console.log(`[AddressScan] Geocoding no disponible, usando dirección original: "${result.address}"`);
            }

            const customFieldsUpdate = {};
            customFieldsUpdate.address = finalAddress;

            if (finalZip) {
              customFieldsUpdate.zip_code = finalZip;
            }

            let updateResult;
            try {
              updateResult = await respondio.updateContactCustomFields(contact.id, customFieldsUpdate);
            } catch (updateErr) {
              console.log(`[AddressScan] No se pudo actualizar ${contactName} (${contact.id}), se reintentará después`);
              this.addressScannedContacts.delete(contactIdStr);
              continue;
            }

            if (updateResult.success) {
              updatedCount++;
              console.log(`[AddressScan] Direccion actualizada para ${contactName} (${contact.id}): "${finalAddress}"${finalZip ? ` ZIP: ${finalZip}` : ''}`);
            } else {
              const altFieldsUpdate = {};
              altFieldsUpdate['Address'] = finalAddress;
              if (finalZip) {
                altFieldsUpdate['Zip Code'] = finalZip;
              }

              try {
                const altResult = await respondio.updateContactCustomFields(contact.id, altFieldsUpdate);
                if (altResult.success) {
                  updatedCount++;
                  console.log(`[AddressScan] Direccion actualizada (alt) para ${contactName} (${contact.id}): "${finalAddress}"`);
                } else {
                  console.error(`[AddressScan] Error actualizando direccion de ${contactName} (${contact.id}):`, updateResult.error);
                }
              } catch (altErr) {
                console.log(`[AddressScan] No se pudo actualizar (alt) ${contactName} (${contact.id}), se reintentará después`);
                this.addressScannedContacts.delete(contactIdStr);
              }
            }

            await this.saveValidatedAddress(userId, contact, finalAddress, result.address, finalZip, geocoded);
          }
        } catch (contactError) {
          console.error(`[AddressScan] Error procesando contacto ${contact.id}:`, contactError.message);
        }
      }

      if (updatedCount > 0) {
        console.log(`[AddressScan] === ${updatedCount} contactos actualizados con direccion ===`);
      }

      const remaining = contactsToScan.length - batch.length;
      if (remaining > 0) {
        console.log(`[AddressScan] ${batch.length} escaneados, ${remaining} pendientes para proximo ciclo`);
      }
    } catch (error) {
      console.error(`[AddressScan] Error general en escaneo de direcciones:`, error.message);
    }
  }

  async saveValidatedAddress(userId, contact, finalAddress, originalAddress, finalZip, geocoded) {
    try {
      const contactIdStr = contact.id.toString();
      const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Sin nombre';
      const lat = geocoded?.success ? geocoded.latitude : null;
      const lng = geocoded?.success ? geocoded.longitude : null;

      if (!lat || !lng) {
        return;
      }

      const existing = await ValidatedAddress.findOne({
        where: {
          user_id: userId,
          respond_contact_id: contactIdStr
        },
        order: [['created_at', 'DESC']]
      });

      if (existing) {
        await existing.update({
          validated_address: finalAddress,
          original_address: originalAddress,
          address_lat: lat,
          address_lng: lng,
          zip_code: finalZip || existing.zip_code,
          city: geocoded.city || existing.city,
          state: geocoded.stateShort || geocoded.state || existing.state,
          confidence: geocoded.confidence || existing.confidence,
          customer_name: customerName,
          customer_phone: contact.phone || existing.customer_phone
        });
        console.log(`[ValidatedAddr] Actualizada para ${customerName}: "${finalAddress}" (${lat}, ${lng})`);
      } else {
        await ValidatedAddress.create({
          user_id: userId,
          respond_contact_id: contactIdStr,
          customer_name: customerName,
          customer_phone: contact.phone || null,
          original_address: originalAddress,
          validated_address: finalAddress,
          address_lat: lat,
          address_lng: lng,
          zip_code: finalZip,
          city: geocoded.city || null,
          state: geocoded.stateShort || geocoded.state || null,
          confidence: geocoded.confidence || null,
          source: 'scanner'
        });
        console.log(`[ValidatedAddr] Nueva direccion para ${customerName}: "${finalAddress}" (${lat}, ${lng})`);
      }
    } catch (error) {
      console.error(`[ValidatedAddr] Error guardando direccion validada:`, error.message);
    }
  }
}

const pollingServiceInstance = new PollingService();
export default pollingServiceInstance;
