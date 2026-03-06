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
import User from '../models/User.js';

async function getGlobalSettings(userId) {
  const user = await User.findByPk(userId);
  if (user?.role === 'admin') {
    return await MessagingSettings.findOne({ order: [['created_at', 'ASC']] });
  }
  return await MessagingSettings.findOne({ where: { user_id: userId } });
}

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

    const settings = await getGlobalSettings(userId);
    
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
      const settings = await getGlobalSettings(userId);
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

  getAnyActivePollingStatus() {
    for (const [userId, poller] of this.activePollers) {
      if (poller.isRunning) {
        return {
          active: true,
          lastPoll: poller.lastPoll,
          intervalMs: poller.intervalMs,
          processedCount: poller.processedMessageIds.size
        };
      }
    }
    return { active: false };
  }

  stopAllPolling() {
    if (this.activePollers.size === 0) {
      return { success: false, error: 'No hay polling activo' };
    }
    for (const [userId, poller] of this.activePollers) {
      poller.isRunning = false;
      if (poller.intervalId) clearInterval(poller.intervalId);
      if (poller.scanIntervalId) clearInterval(poller.scanIntervalId);
      this.activePollers.delete(userId);
      console.log(`[Polling] Detenido para usuario ${userId} (admin stop all)`);
    }
    return { success: true, message: 'Polling detenido' };
  }

  async pollForNewMessages(userId, apiToken, poller) {
    console.log(`[Polling] Conectando a Respond.io API...`);
    const respondio = this.getRespondioInstance(apiToken);
    
    const settings = await getGlobalSettings(userId);
    const messageLimit = settings?.message_history_limit || 50;
    
    // MODO PRUEBA: Solo procesar un contacto específico
    const isTestMode = settings?.test_mode && settings?.test_contact_id;
    const testContactId = settings?.test_contact_id?.trim();
    
    if (isTestMode) {
      console.log(`[Polling] MODO PRUEBA - Buscando contacto: ${testContactId}`);
    }
    
    console.log(`[Polling] Obteniendo conversaciones ABIERTAS con lifecycle New Lead (limite: ${messageLimit} msgs)...`);
    
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

    const targetLifecycles = ['New Lead'];
    let filteredContacts = allContacts.filter(contact => 
      contact.lifecycle && targetLifecycles.includes(contact.lifecycle)
    );

    let uniqueContacts = filteredContacts.filter((contact, index, self) =>
      index === self.findIndex(c => c.id === contact.id)
    );

    console.log(`[Polling] Conversaciones abiertas: ${allContacts.length}, Con lifecycle New Lead: ${uniqueContacts.length}`);

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

    const settings = await getGlobalSettings(userId);
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
      const settings = await getGlobalSettings(userId);
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
      let mapsLink = null;
      let locationCoords = null;

      for (const msg of messages) {
        if (msg.message?.type === 'location' && msg.message?.latitude && msg.message?.longitude) {
          locationCoords = { lat: msg.message.latitude, lng: msg.message.longitude };
          break;
        }

        const text = msg.message?.text || '';
        if (!text || text.length < 5) continue;

        const gLink = extractor.extractGoogleMapsLink(text);
        if (gLink) {
          mapsLink = gLink;
          break;
        }

        const extractedAddress = extractor.extractAddressFromMessage(text);
        if (extractedAddress) {
          latestAddress = extractedAddress;
          break;
        }
      }

      if (!latestAddress && !mapsLink && !locationCoords) return;

      let finalAddress = latestAddress;
      let finalZip = null;
      let geocoded = { success: false };

      if (locationCoords) {
        try {
          geocoded = await geocodingService.reverseGeocode(locationCoords.lat, locationCoords.lng);
          if (geocoded.success) {
            finalAddress = geocoded.fullAddress;
            finalZip = geocoded.zip;
            latestAddress = `Location: ${locationCoords.lat}, ${locationCoords.lng}`;
            console.log(`[AddressScan-Agent] Ubicacion de ${contactName}: ${finalAddress}`);
          }
        } catch (err) {
          console.error(`[AddressScan-Agent] Error reverse geocoding location:`, err.message);
          return;
        }
      } else if (mapsLink) {
        try {
          const resolved = await geocodingService.resolveGoogleMapsLink(mapsLink);
          if (resolved.success) {
            if (resolved.lat && resolved.lng) {
              geocoded = await geocodingService.reverseGeocode(resolved.lat, resolved.lng);
            } else if (resolved.address) {
              geocoded = await geocodingService.geocodeAddress(resolved.address);
            }
            if (geocoded.success) {
              finalAddress = geocoded.fullAddress;
              finalZip = geocoded.zip;
              latestAddress = mapsLink;
              console.log(`[AddressScan-Agent] Google Maps de ${contactName}: ${finalAddress}`);
            }
          }
        } catch (err) {
          console.error(`[AddressScan-Agent] Error resolving maps link:`, err.message);
          return;
        }
      }

      if (!finalAddress) return;

      const existingAddr = await ValidatedAddress.findOne({
        where: { user_id: userId, respond_contact_id: contact.id.toString() },
        order: [['created_at', 'DESC']]
      });

      if (existingAddr) {
        if (existingAddr.source === 'contact_corrected') {
          console.log(`[AddressScan-Agent] ${contactName} (${contact.id}) tiene direccion corregida por agente, ignorando mensaje del chat`);
          return;
        }
        const newNorm = finalAddress.toLowerCase().replace(/[^a-z0-9]/g, '');
        const origNorm = (existingAddr.original_address || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const validNorm = (existingAddr.validated_address || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (newNorm === origNorm || newNorm === validNorm) {
          return;
        }
        console.log(`[AddressScan-Agent] Nueva direccion de ${contactName} (${contact.id}): "${finalAddress}" (anterior: "${existingAddr.validated_address}")`);
      } else {
        console.log(`[AddressScan-Agent] Direccion de ${contactName} (${contact.id}): "${finalAddress}"`);
      }

      if (!mapsLink && !locationCoords) {
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

      if (allContacts.length === 0) return;

      const excludedTags = ['rec'];
      const tagFilteredContacts = allContacts.filter(contact => {
        const contactTags = contact.tags || [];
        const tagNames = contactTags.map(t => (typeof t === 'string' ? t : t.name || '').toLowerCase());
        return !tagNames.some(tag => excludedTags.includes(tag));
      });

      const tagExcludedIds = allContacts
        .filter(c => !tagFilteredContacts.includes(c))
        .map(c => c.id.toString());

      if (tagExcludedIds.length > 0) {
        try {
          const deletedCount = await ValidatedAddress.destroy({
            where: {
              user_id: userId,
              respond_contact_id: { [Op.in]: tagExcludedIds }
            }
          });
          if (deletedCount > 0) {
            console.log(`[AddressScan] ${deletedCount} orden(es) eliminada(s) por tag excluido (rec)`);
          }
        } catch (err) {
          console.error(`[AddressScan] Error limpiando tags excluidos:`, err.message);
        }
      }

      await this.syncContactNames(userId, tagFilteredContacts);
      await this.syncClosedConversationLifecycles(userId, apiToken, tagFilteredContacts);
      await this.cleanupDuplicateAddresses(userId);
      await this.cleanupDeliveredOrders();

      const excludedLifecycles = ['New Lead', 'Pending', 'Impropos'];
      const scanContacts = tagFilteredContacts.filter(contact => {
        if (contact.lifecycle && excludedLifecycles.includes(contact.lifecycle)) {
          return false;
        }
        return true;
      });

      if (scanContacts.length === 0) return;

      await this.scanAddressesInConversations(userId, apiToken, scanContacts, respondio, messageLimit, settings);
    } catch (error) {
      console.error(`[AddressScan] Error en ciclo independiente:`, error.message);
    }
  }

  async syncContactNames(userId, contacts) {
    try {
      const contactIds = contacts.map(c => c.id.toString());
      const existingAddresses = await ValidatedAddress.findAll({
        where: {
          user_id: userId,
          respond_contact_id: { [Op.in]: contactIds }
        }
      });

      if (existingAddresses.length === 0) return;

      const addressMap = new Map();
      for (const va of existingAddresses) {
        addressMap.set(va.respond_contact_id, va);
      }

      let updatedCount = 0;
      for (const contact of contacts) {
        const contactIdStr = contact.id.toString();
        const existing = addressMap.get(contactIdStr);
        if (!existing) continue;

        const updateFields = {};
        const currentName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Sin nombre';
        if (existing.customer_name && existing.customer_name !== currentName && currentName !== 'Sin nombre') {
          updateFields.customer_name = currentName;
        }

        const orderStatus = this.lifecycleToOrderStatus(contact.lifecycle);
        const excludedLifecycles = ['New Lead', 'Pending', 'Impropos'];
        if (!orderStatus && contact.lifecycle && excludedLifecycles.includes(contact.lifecycle)) {
          if (!existing.route_id) {
            try {
              await ValidatedAddress.destroy({ where: { id: existing.id } });
              console.log(`[AddressScan] Lifecycle sync: "${existing.customer_name}" eliminada (lifecycle=${contact.lifecycle}) (${contactIdStr})`);
              updatedCount++;
            } catch (err) {
              console.error(`[AddressScan] Error eliminando ${contactIdStr}:`, err.message);
            }
          }
          continue;
        }
        if (orderStatus && existing.order_status !== orderStatus) {
          updateFields.order_status = orderStatus;
          console.log(`[AddressScan] Lifecycle sync: "${existing.customer_name}" ${existing.order_status} -> ${orderStatus} (${contactIdStr})`);
        }

        if (Object.keys(updateFields).length > 0) {
          try {
            await ValidatedAddress.update(updateFields, { where: { id: existing.id } });
            if (updateFields.customer_name) {
              console.log(`[AddressScan] Nombre sync: "${existing.customer_name}" -> "${currentName}" (${contactIdStr})`);
            }
            updatedCount++;
          } catch (err) {
            console.error(`[AddressScan] Error sync ${contactIdStr}:`, err.message);
          }
        }
      }

      if (updatedCount > 0) {
        console.log(`[AddressScan] ${updatedCount} contacto(s) sincronizado(s)`);
      }
    } catch (error) {
      console.error(`[AddressScan] Error en syncContactNames:`, error.message);
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
          id: va.id,
          validated: va.validated_address,
          original: va.original_address,
          customer_name: va.customer_name,
          source: va.source
        });
      }

      for (const contact of batch) {
        const contactIdStr = contact.id.toString();
        const existingEntry = addressMap.get(contactIdStr);
        if (existingEntry) {
          const currentName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Sin nombre';
          if (existingEntry.customer_name && existingEntry.customer_name !== currentName && currentName !== 'Sin nombre') {
            try {
              await ValidatedAddress.update(
                { customer_name: currentName },
                { where: { id: existingEntry.id } }
              );
              console.log(`[AddressScan] Nombre actualizado: "${existingEntry.customer_name}" -> "${currentName}" (${contactIdStr})`);
              existingEntry.customer_name = currentName;
            } catch (nameErr) {
              console.error(`[AddressScan] Error actualizando nombre de ${contactIdStr}:`, nameErr.message);
            }
          }
        }
      }

      for (let i = 0; i < batch.length; i++) {
        const contact = batch[i];
        const contactIdStr = contact.id.toString();
        this.addressScannedContacts.add(contactIdStr);

        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CONTACTS_MS));
        }

        try {
          const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();

          let contactFieldAddress = null;
          let contactBilling = null;
          try {
            const contactDetail = await respondio.getContact(contact.id);
            if (contactDetail.success && contactDetail.data) {
              const cData = contactDetail.data;
              const cfAddress = cData.custom_fields?.find(f => 
                f.name?.toLowerCase() === 'address' || f.name?.toLowerCase() === 'direccion'
              );
              if (cfAddress?.value && cfAddress.value.trim().length >= 5) {
                contactFieldAddress = cfAddress.value.trim();
              }
              const cfCost = cData.custom_fields?.find(f => f.name?.toLowerCase() === 'cost');
              const cfDeposit = cData.custom_fields?.find(f => f.name?.toLowerCase() === 'deposit');
              if (cfCost || cfDeposit) {
                const parseBilling = (val) => {
                  if (val === null || val === undefined || val === '') return null;
                  const num = parseFloat(val);
                  return isNaN(num) ? null : num;
                };
                const cost = parseBilling(cfCost?.value);
                const deposit = parseBilling(cfDeposit?.value);
                contactBilling = {
                  cost,
                  deposit,
                  balance: (cost !== null ? cost : 0) - (deposit !== null ? deposit : 0)
                };
              }
            }
          } catch (cfErr) {
            // skip
          }

          const existing = addressMap.get(contactIdStr);

          if (contactBilling && existing) {
            try {
              const dbRecord = await ValidatedAddress.findByPk(existing.id);
              if (dbRecord) {
                const billingUpdate = {};
                if (contactBilling.cost !== null && dbRecord.order_cost !== contactBilling.cost) {
                  billingUpdate.order_cost = contactBilling.cost;
                }
                if (contactBilling.deposit !== null && dbRecord.deposit_amount !== contactBilling.deposit) {
                  billingUpdate.deposit_amount = contactBilling.deposit;
                }
                if (billingUpdate.order_cost !== undefined || billingUpdate.deposit_amount !== undefined) {
                  const finalCost = billingUpdate.order_cost ?? dbRecord.order_cost ?? 0;
                  const finalDeposit = billingUpdate.deposit_amount ?? dbRecord.deposit_amount ?? 0;
                  billingUpdate.total_to_collect = finalCost - finalDeposit;
                }
                if (Object.keys(billingUpdate).length > 0) {
                  await dbRecord.update(billingUpdate);
                  console.log(`[AddressScan] Billing sync ${contactName} (${contact.id}): cost=${billingUpdate.order_cost ?? '-'} deposit=${billingUpdate.deposit_amount ?? '-'} cobrar=${billingUpdate.total_to_collect ?? '-'}`);
                }
              }
            } catch (billErr) {
              console.error(`[AddressScan] Error billing sync ${contact.id}:`, billErr.message);
            }
          }

          if (existing && existing.source === 'contact_corrected') {
            if (contactFieldAddress) {
              const cfNorm = contactFieldAddress.toLowerCase().replace(/[^a-z0-9]/g, '');
              const existValidNorm = (existing.validated || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              if (cfNorm !== existValidNorm) {
                const cfGeocoded = await geocodingService.geocodeAddress(contactFieldAddress);
                if (cfGeocoded.success) {
                  console.log(`[AddressScan] Direccion re-corregida en contacto ${contactName} (${contact.id}): "${cfGeocoded.fullAddress}" [contact_corrected]`);
                  await this.saveValidatedAddress(userId, contact, cfGeocoded.fullAddress, contactFieldAddress, cfGeocoded.zip, cfGeocoded, 'contact_corrected');
                }
              }
            }
            continue;
          }

          if (contactFieldAddress) {
            if (existing) {
              const cfNorm = contactFieldAddress.toLowerCase().replace(/[^a-z0-9]/g, '');
              const existOrigNorm = (existing.original || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              const existValidNorm = (existing.validated || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              if (cfNorm !== existOrigNorm && cfNorm !== existValidNorm) {
                const cfGeocoded = await geocodingService.geocodeAddress(contactFieldAddress);
                if (cfGeocoded.success) {
                  console.log(`[AddressScan] Direccion corregida en contacto ${contactName} (${contact.id}): "${contactFieldAddress}" -> "${cfGeocoded.fullAddress}" [contact_corrected]`);
                  await this.saveValidatedAddress(userId, contact, cfGeocoded.fullAddress, contactFieldAddress, cfGeocoded.zip, cfGeocoded, 'contact_corrected');
                  continue;
                }
              }
            } else {
              const cfGeocoded = await geocodingService.geocodeAddress(contactFieldAddress);
              if (cfGeocoded.success) {
                console.log(`[AddressScan] Direccion desde contacto (sin registro previo) ${contactName} (${contact.id}): "${cfGeocoded.fullAddress}" [contact_corrected]`);
                await this.saveValidatedAddress(userId, contact, cfGeocoded.fullAddress, contactFieldAddress, cfGeocoded.zip, cfGeocoded, 'contact_corrected');
                continue;
              }
            }
          }

          const messagesResult = await respondio.listMessages(contact.id, { limit: messageLimit });
          if (!messagesResult.success || !messagesResult.items) continue;

          const incomingMessages = messagesResult.items.filter(m => m.traffic === 'incoming');
          const outgoingMessages = messagesResult.items.filter(m => m.traffic === 'outgoing');
          let latestExtracted = null;
          let scanMapsLink = null;
          let scanLocationCoords = null;

          for (const msg of incomingMessages) {
            if (msg.message?.type === 'location' && msg.message?.latitude && msg.message?.longitude) {
              scanLocationCoords = { lat: msg.message.latitude, lng: msg.message.longitude };
              break;
            }
            const text = msg.message?.text || '';
            if (!text || text.length < 5) continue;
            const gLink = extractor.extractGoogleMapsLink(text);
            if (gLink) {
              scanMapsLink = gLink;
              break;
            }
            const addr = extractor.extractAddressFromMessage(text);
            if (addr) {
              latestExtracted = addr;
              break;
            }
          }

          if (!scanLocationCoords && !scanMapsLink && !latestExtracted) {
            const confirmPatterns = [
              /(?:esta|esta es|tu|su|la)\s+(?:direccion|dir|address)/i,
              /(?:confirm|verific|correct|bien)\s+.*(?:direccion|dir|address)/i,
              /(?:direccion|address)\s+(?:es|seria|correcta|confirmada)/i,
              /(?:te|le)\s+(?:mando|envio|confirmo)\s+(?:la|tu|su)?\s*(?:direccion|dir|address)/i,
              /(?:entrega|delivery|envio)\s+(?:a|en|para)\s*:?\s*/i
            ];
            for (const msg of outgoingMessages) {
              const text = msg.message?.text || '';
              if (!text || text.length < 10) continue;
              const isConfirmation = confirmPatterns.some(p => p.test(text));
              if (!isConfirmation) continue;
              const gLink = extractor.extractGoogleMapsLink(text);
              if (gLink) {
                scanMapsLink = gLink;
                break;
              }
              const addr = extractor.extractAddressFromMessage(text);
              if (addr) {
                latestExtracted = addr;
                console.log(`[AddressScan] Direccion detectada en mensaje de agente: "${addr}"`);
                break;
              }
            }
          }

          let result;
          if (scanLocationCoords) {
            result = { address: null, googleMapsCoords: scanLocationCoords };
          } else if (scanMapsLink) {
            result = { address: null, googleMapsLink: scanMapsLink };
          } else if (latestExtracted) {
            result = { address: latestExtracted };
          } else {
            result = extractor.extractAddressFromConversation(messagesResult.items);
          }

          if (!result) continue;
          if (!result.address && !result.googleMapsLink && !result.googleMapsCoords) continue;

          let finalAddress = result.address;
          let finalZip = null;
          let geocoded = { success: false };

          if (result.googleMapsCoords) {
            try {
              geocoded = await geocodingService.reverseGeocode(result.googleMapsCoords.lat, result.googleMapsCoords.lng);
              if (geocoded.success) {
                finalAddress = geocoded.fullAddress;
                finalZip = geocoded.zip;
                console.log(`[AddressScan] Ubicacion de ${contactName} (${contact.id}): ${finalAddress}`);
              } else {
                continue;
              }
            } catch (err) {
              console.error(`[AddressScan] Error reverse geocoding:`, err.message);
              continue;
            }
          } else if (result.googleMapsLink) {
            try {
              const resolved = await geocodingService.resolveGoogleMapsLink(result.googleMapsLink);
              if (resolved.success) {
                if (resolved.lat && resolved.lng) {
                  geocoded = await geocodingService.reverseGeocode(resolved.lat, resolved.lng);
                } else if (resolved.address) {
                  geocoded = await geocodingService.geocodeAddress(resolved.address);
                }
                if (geocoded.success) {
                  finalAddress = geocoded.fullAddress;
                  finalZip = geocoded.zip;
                  console.log(`[AddressScan] Google Maps de ${contactName} (${contact.id}): ${finalAddress}`);
                } else {
                  continue;
                }
              } else {
                continue;
              }
            } catch (err) {
              console.error(`[AddressScan] Error resolving maps link:`, err.message);
              continue;
            }
          } else if (result.address) {
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

            geocoded = await geocodingService.geocodeAddress(result.address);

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
          } else {
            continue;
          }

          if (!finalAddress) continue;

          const existingDb = addressMap.get(contactIdStr);
          if (existingDb) {
            const newAddrNorm = finalAddress.toLowerCase().replace(/[^a-z0-9]/g, '');
            const existOrigNorm = (existingDb.original || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const existValidNorm = (existingDb.validated || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (newAddrNorm === existOrigNorm || newAddrNorm === existValidNorm) {
              continue;
            }
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

          await this.saveValidatedAddress(userId, contact, finalAddress, result.address || finalAddress, finalZip, geocoded);
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

  async syncClosedConversationLifecycles(userId, apiToken, openContacts) {
    try {
      const openContactIds = new Set(openContacts.map(c => c.id.toString()));

      const nonTerminalOrders = await ValidatedAddress.findAll({
        where: {
          user_id: userId,
          respond_contact_id: { [Op.ne]: null },
          order_status: { [Op.notIn]: ['delivered', 'ups_shipped'] }
        }
      });

      const closedOrders = nonTerminalOrders.filter(o => !openContactIds.has(o.respond_contact_id));

      if (closedOrders.length === 0) return;

      const respondio = new RespondioService(apiToken);
      let syncedCount = 0;
      const DELAY_MS = 300;

      for (const order of closedOrders) {
        try {
          if (syncedCount > 0) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
          }

          const contactResult = await respondio.getContact(parseInt(order.respond_contact_id));
          if (!contactResult.success || !contactResult.data) continue;

          const contact = contactResult.data;
          const newStatus = this.lifecycleToOrderStatus(contact.lifecycle);

          if (newStatus && newStatus !== order.order_status) {
            await order.update({ order_status: newStatus });
            console.log(`[LifecycleSync] Chat cerrado: "${order.customer_name}" ${order.order_status} -> ${newStatus} (contacto ${order.respond_contact_id})`);
            syncedCount++;
          } else if (!newStatus && contact.lifecycle) {
            const excludedLifecycles = ['New Lead', 'Pending', 'Impropos'];
            if (excludedLifecycles.includes(contact.lifecycle)) {
              console.log(`[LifecycleSync] Chat cerrado: "${order.customer_name}" lifecycle=${contact.lifecycle}, eliminando del dispatch`);
              if (!order.route_id) {
                await order.destroy();
              }
              syncedCount++;
            }
          }
        } catch (err) {
          console.error(`[LifecycleSync] Error consultando contacto ${order.respond_contact_id}:`, err.message);
        }
      }

      if (syncedCount > 0) {
        console.log(`[LifecycleSync] ${syncedCount} orden(es) sincronizada(s) de chats cerrados`);
      }
    } catch (error) {
      console.error(`[LifecycleSync] Error en sync de chats cerrados:`, error.message);
    }
  }

  async cleanupDuplicateAddresses(userId) {
    try {
      const [duplicates] = await ValidatedAddress.sequelize.query(`
        SELECT respond_contact_id, COUNT(*) as cnt
        FROM validated_addresses
        WHERE user_id = :userId AND respond_contact_id IS NOT NULL
        GROUP BY respond_contact_id
        HAVING COUNT(*) > 1
      `, { replacements: { userId } });

      if (duplicates.length === 0) return;

      for (const dup of duplicates) {
        const records = await ValidatedAddress.findAll({
          where: { user_id: userId, respond_contact_id: dup.respond_contact_id },
          order: [['created_at', 'DESC']]
        });
        const toDelete = records.slice(1).filter(r => !r.route_id);
        for (const old of toDelete) {
          await old.destroy();
        }
        if (toDelete.length > 0) {
          console.log(`[AddressScan] Limpiados ${toDelete.length} duplicado(s) para contacto ${dup.respond_contact_id}`);
        }
      }
    } catch (error) {
      console.error(`[AddressScan] Error limpiando duplicados:`, error.message);
    }
  }

  async cleanupDeliveredOrders() {
    try {
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const deleted = await ValidatedAddress.destroy({
        where: {
          order_status: 'delivered',
          updated_at: { [Op.lt]: cutoff }
        }
      });
      if (deleted > 0) {
        console.log(`[Cleanup] ${deleted} orden(es) entregada(s) eliminada(s) (>48h)`);
      }
    } catch (error) {
      console.error(`[Cleanup] Error limpiando órdenes entregadas:`, error.message);
    }
  }

  lifecycleToOrderStatus(lifecycle) {
    const map = {
      'Approved': 'approved',
      'Ordered': 'ordered',
      'On Delivery': 'on_delivery',
      'Delivered': 'delivered',
      'UPS Shipped': 'ups_shipped'
    };
    return map[lifecycle] || null;
  }

  async saveValidatedAddress(userId, contact, finalAddress, originalAddress, finalZip, geocoded, sourceOverride) {
    try {
      const contactIdStr = contact.id.toString();
      const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Sin nombre';
      const lat = geocoded?.success ? geocoded.latitude : null;
      const lng = geocoded?.success ? geocoded.longitude : null;
      const orderStatus = this.lifecycleToOrderStatus(contact.lifecycle);

      if (!lat || !lng) {
        return;
      }

      const [record, created] = await ValidatedAddress.findOrCreate({
        where: {
          user_id: userId,
          respond_contact_id: contactIdStr
        },
        defaults: {
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
          source: sourceOverride || 'scanner',
          order_status: orderStatus || 'approved'
        }
      });

      if (created) {
        console.log(`[ValidatedAddr] Nueva direccion para ${customerName}: "${finalAddress}" (${lat}, ${lng}) [${orderStatus || 'approved'}]`);
      } else {
        const updateData = {
          validated_address: finalAddress,
          original_address: originalAddress,
          address_lat: lat,
          address_lng: lng,
          zip_code: finalZip || record.zip_code,
          city: geocoded.city || record.city,
          state: geocoded.stateShort || geocoded.state || record.state,
          confidence: geocoded.confidence || record.confidence,
          customer_name: customerName,
          customer_phone: contact.phone || record.customer_phone
        };
        if (sourceOverride) {
          updateData.source = sourceOverride;
        }
        if (orderStatus && record.order_status !== orderStatus) {
          updateData.order_status = orderStatus;
          console.log(`[ValidatedAddr] Lifecycle sync: ${customerName} ${record.order_status} -> ${orderStatus}`);
        }
        await record.update(updateData);
        console.log(`[ValidatedAddr] Actualizada para ${customerName}: "${finalAddress}" (${lat}, ${lng})${sourceOverride ? ` [${sourceOverride}]` : ''}`);
      }
    } catch (error) {
      console.error(`[ValidatedAddr] Error guardando direccion validada:`, error.message);
    }
  }
}

const pollingServiceInstance = new PollingService();
export default pollingServiceInstance;
