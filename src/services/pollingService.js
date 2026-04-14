import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import RespondioService from './respondio.js';
import AddressValidationService from './addressValidation.js';
import AddressExtractorService from './addressExtractorService.js';
import geocodingService from './geocodingService.js';
import ChatbotService from './chatbotService.js';
import AIService from './aiService.js';
import MessagingSettings from '../models/MessagingSettings.js';
import MessagingOrder from '../models/MessagingOrder.js';
import MessageLog from '../models/MessageLog.js';
import CoverageZone from '../models/CoverageZone.js';
import ConversationState from '../models/ConversationState.js';
import ValidatedAddress from '../models/ValidatedAddress.js';
import WholesaleClient from '../models/WholesaleClient.js';
import User from '../models/User.js';

function contactIsWholesale(name) {
  return /\bMAY\b/i.test(name) || /\-MAY\b/i.test(name) || /\bMAY\-/i.test(name);
}

async function getGlobalSettings() {
  return await MessagingSettings.findOne({ order: [['created_at', 'ASC']] });
}

async function getSystemUserId() {
  const settings = await MessagingSettings.findOne({ order: [['created_at', 'ASC']] });
  if (settings?.user_id) return settings.user_id;
  const admin = await User.findOne({ where: { role: 'admin' } });
  return admin?.id || 1;
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
    const sysUserId = await getSystemUserId();
    userId = sysUserId;
    console.log(`[Polling] Iniciando polling (admin global)...`);
    
    if (this.activePollers.has(userId)) {
      console.log(`[Polling] Ya está activo (admin global)`);
      return { success: true, message: 'Polling ya está activo' };
    }

    const settings = await getGlobalSettings();
    
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
      const settings = await getGlobalSettings();
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
    
    const settings = await getGlobalSettings();
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
            where: { contact_id: contact.id.toString() },
            defaults: { user_id: userId, state: 'initial' }
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
        where: { contact_id: contact.id.toString() }
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
          // Antes de retornar, verificar si hay campo reactivar_bot activo
          let botReactivated = false;
          try {
            const contactDetail = await respondio.getContact(contact.id);
            if (contactDetail.success && contactDetail.data) {
              const cData = contactDetail.data;
              const normalizeFieldName = (n) => (n || '').toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
              const cfReactivarBot = cData.custom_fields?.find(f => {
                const fn = normalizeFieldName(f.name);
                return fn === 'reactivar_bot' || fn === 'reactivar bot' || fn === 'reactivarbot' || fn === 'bot_status' || fn === 'bot status';
              });
              if (cfReactivarBot?.value && cfReactivarBot.value.trim().length > 0) {
                const val = cfReactivarBot.value.trim().toLowerCase();
                const isCierreKeyword = val.includes('cierre') || val.includes('cerrar') || val === 'closing';
                const isReactivarKeyword = val === 'si' || val === 'sí' || val === 'yes' || val === 'activo' || val === 'active' || val === '1' || val === 'on' || val === 'reactivar';
                if (isCierreKeyword) {
                  // Limpiar el campo primero
                  try {
                    await respondio.updateContactCustomFields(contact.id, { [cfReactivarBot.name]: '' });
                  } catch (clearErr) {
                    console.log(`[Polling] No se pudo limpiar campo reactivar_bot de ${contact.id}`);
                  }
                  // Asegurarse de que agent_active = false para que el bot pueda actuar
                  await convState.update({ agent_active: false });
                  // Iniciar flujo de cierre
                  const chatbotForClose = new ChatbotService(userId, settings);
                  await chatbotForClose.startClosingFlow(contact, 'tarjetas');
                  console.log(`[Polling] Flujo de cierre iniciado via custom field para ${contact.id}`);
                  botReactivated = true;
                } else if (isReactivarKeyword) {
                  const updateFields = { agent_active: false };
                  if (convState.state === 'assigned') {
                    updateFields.state = 'initial';
                  }
                  await convState.update(updateFields);
                  console.log(`[Polling] Bot reactivado via custom field para ${contact.id} (estado anterior: ${convState.state})`);
                  try {
                    await respondio.updateContactCustomFields(contact.id, { [cfReactivarBot.name]: '' });
                  } catch (clearErr) {
                    console.log(`[Polling] No se pudo limpiar campo reactivar_bot de ${contact.id}`);
                  }
                  botReactivated = true;
                }
              }
            }
          } catch (reactivateErr) {
            console.log(`[Polling] Error verificando reactivar_bot para ${contact.id}:`, reactivateErr.message);
          }

          if (!botReactivated) {
            console.log(`[Polling] Contacto ${contact.id} tiene agent_active=true, extrayendo direcciones sin procesar con bot`);
            for (const msg of incomingMessages) {
              poller.processedMessageIds.add(msg.messageId);
            }
            await this.extractAndSaveAddressFromMessages(userId, contact, incomingMessages, respondio);
            this.addressScannedContacts.delete(contact.id.toString());
            return;
          }
          // Si botReactivated=true, continúa el flujo normal del bot
        }
      }
    }

    this.addressScannedContacts.delete(contact.id.toString());

    const settings = await getGlobalSettings();
    const isAutomatic = settings?.attention_mode === 'automatic';

    const latestMessage = incomingMessages[incomingMessages.length - 1];
    
    for (const msg of incomingMessages) {
      poller.processedMessageIds.add(msg.messageId);
    }
    
    const alreadyProcessed = await MessageLog.findOne({
      where: { 
        respond_message_id: latestMessage.messageId?.toString()
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
            where: { contact_id: contactId },
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
        where: { contact_id: contactId.toString() },
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
        // Auto-aprendizaje: si el bot envió algo recientemente y el agente jumpeó, log para revisión
        if (!state.agent_active && state.last_bot_message_at) {
          const botMsgAt = new Date(state.last_bot_message_at);
          const minutesSinceBotMsg = (Date.now() - botMsgAt.getTime()) / 1000 / 60;
          if (minutesSinceBotMsg <= 3) {
            try {
              const lastBotLog = await MessageLog.findOne({
                where: { contact_id: contactId.toString(), direction: 'outgoing' },
                order: [['created_at', 'DESC']]
              });
              if (lastBotLog?.message_content) {
                await AIService.autoLearnFromCorrection(
                  userId, contactId, lastBotLog.message_content, null
                );
              }
            } catch (learnErr) {
              // No crítico — no interrumpir el flujo principal
            }
          }
        }

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
      const settings = await getGlobalSettings();
      if (!settings) return;

      const msgType = message.message?.type || 'text';
      let messageText = message.message?.text || '';
      let mediaDescription = '';

      // --- Procesar audio (transcribir con Whisper) ---
      if ((msgType === 'audio' || msgType === 'voice') && !messageText) {
        const mediaUrl = message.message?.url || message.message?.attachment?.url;
        if (mediaUrl) {
          const aiKey = settings.openai_api_key || process.env.OPENAI_API_KEY;
          if (aiKey) {
            const ai = new AIService(aiKey, settings, userId);
            const transcription = await ai.transcribeAudio(mediaUrl);
            if (transcription) {
              messageText = transcription;
              mediaDescription = `[Audio transcrito]: ${transcription}`;
              console.log(`[Polling] Audio de ${contact.firstName} transcrito: "${transcription.substring(0, 60)}..."`);
            } else {
              messageText = '[El cliente envió un mensaje de voz]';
            }
          } else {
            messageText = '[El cliente envió un mensaje de voz]';
          }
        }
      }

      // --- Procesar imágenes (describir con GPT-4o vision) ---
      if ((msgType === 'image' || msgType === 'sticker') && !messageText) {
        const mediaUrl = message.message?.url || message.message?.attachment?.url || message.message?.imageUrl;
        if (mediaUrl) {
          const aiKey = settings.openai_api_key || process.env.OPENAI_API_KEY;
          if (aiKey) {
            const ai = new AIService(aiKey, settings, userId);
            const description = await ai.describeImage(mediaUrl);
            if (description) {
              messageText = `[El cliente envió una imagen: ${description}]`;
              mediaDescription = `[Imagen analizada]: ${description}`;
              console.log(`[Polling] Imagen de ${contact.firstName} descrita: "${description.substring(0, 60)}..."`);
            } else {
              messageText = '[El cliente envió una imagen]';
            }
          } else {
            messageText = '[El cliente envió una imagen]';
          }
        }
      }

      await MessageLog.create({
        user_id: userId,
        contact_id: contact.id.toString(),
        contact_name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Sin nombre',
        contact_phone: contact.phone || null,
        channel: 'respond.io',
        direction: 'incoming',
        message_type: msgType,
        message_content: mediaDescription || messageText,
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
          { where: { respond_message_id: message.messageId?.toString() } }
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
          { where: { respond_message_id: message.messageId?.toString() } }
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
        where: { respond_contact_id: contact.id.toString() },
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
    // Actualiza timestamp del último mensaje del bot para auto-aprendizaje
    try {
      await ConversationState.update(
        { last_bot_message_at: new Date() },
        { where: { contact_id: contact.id.toString() } }
      );
    } catch (_) {}
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
          const [archivedCount] = await ValidatedAddress.update(
            { dispatch_status: 'archived' },
            {
              where: {
                respond_contact_id: { [Op.in]: tagExcludedIds },
                dispatch_status: { [Op.ne]: 'archived' }
              }
            }
          );
          if (archivedCount > 0) {
            console.log(`[AddressScan] ${archivedCount} orden(es) archivada(s) del dispatcher por tag excluido (rec)`);
          }
        } catch (err) {
          console.error(`[AddressScan] Error archivando tags excluidos:`, err.message);
        }
      }

      await this.syncContactNames(userId, tagFilteredContacts);
      await this.autoRegisterWholesaleClients(userId, tagFilteredContacts);
      await this.syncClosedConversationLifecycles(userId, apiToken, tagFilteredContacts);
      await this.cleanupDuplicateAddresses(userId);
      await this.cleanupDeliveredOrders();

      const excludedLifecycles = ['new lead', 'impropos', 'iprintpos'];
      const scanContacts = tagFilteredContacts.filter(contact => {
        const lc = (contact.lifecycle || contact.lifecycleStage || '').toLowerCase();
        if (lc && excludedLifecycles.includes(lc)) {
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

        const contactLifecycle = contact.lifecycle || contact.lifecycleStage || '';
        const orderStatus = this.lifecycleToOrderStatus(contactLifecycle);
        const excludedLifecycles = ['New Lead', 'Impropos', 'IprintPOS'];
        const isExcluded = excludedLifecycles.some(ex => ex.toLowerCase() === contactLifecycle.toLowerCase());
        if (!orderStatus && contactLifecycle && isExcluded) {
          if (!existing.route_id) {
            try {
              if (existing.dispatch_status !== 'archived') {
                await ValidatedAddress.update(
                  { dispatch_status: 'archived' },
                  { where: { id: existing.id } }
                );
                console.log(`[AddressScan] Lifecycle sync: "${existing.customer_name}" archivada (lifecycle=${contactLifecycle}) (${contactIdStr})`);
                updatedCount++;
              }
            } catch (err) {
              console.error(`[AddressScan] Error archivando ${contactIdStr}:`, err.message);
            }
          } else {
            console.log(`[AddressScan] Lifecycle sync: "${existing.customer_name}" lifecycle=${contactLifecycle} pero tiene ruta asignada, no se archiva (${contactIdStr})`);
          }
          continue;
        }
        if (orderStatus && existing.order_status !== orderStatus && this.statusCanAdvance(existing.order_status, orderStatus)) {
          updateFields.order_status = orderStatus;
          if (existing.dispatch_status === 'archived') {
            updateFields.dispatch_status = 'available';
          }
          console.log(`[AddressScan] Lifecycle sync: "${existing.customer_name}" ${existing.order_status} -> ${orderStatus} (${contactIdStr})`);
        } else if (orderStatus && existing.dispatch_status === 'archived') {
          updateFields.dispatch_status = 'available';
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
      const RESCAN_INTERVAL_MS = 5 * 60 * 1000;
      const DELAY_BETWEEN_CONTACTS_MS = 300;

      let contactsToScan = allContacts.filter((contact, index, self) =>
        index === self.findIndex(c => c.id === contact.id)
      );

      const allContactIds = contactsToScan.map(c => c.id.toString());
      const existingRecords = allContactIds.length > 0
        ? await ValidatedAddress.findAll({
            where: { respond_contact_id: { [Op.in]: allContactIds } },
            attributes: ['respond_contact_id', 'validated_address', 'source']
          })
        : [];
      const needsAddressSet = new Set();
      for (const rec of existingRecords) {
        if (!rec.validated_address || rec.source === 'placeholder') {
          needsAddressSet.add(rec.respond_contact_id);
        }
      }

      contactsToScan = contactsToScan.filter(c => {
        if (needsAddressSet.has(c.id.toString())) return true;
        return !this.addressScannedContacts.has(c.id.toString());
      });

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

      contactsToScan.sort((a, b) => {
        const aNeeds = needsAddressSet.has(a.id.toString()) ? 0 : 1;
        const bNeeds = needsAddressSet.has(b.id.toString()) ? 0 : 1;
        return aNeeds - bNeeds;
      });

      console.log(`[AddressScan] Escaneando ${contactsToScan.length} contactos (${needsAddressSet.size} sin direccion)`);

      const batch = contactsToScan;

      const batchContactIds = batch.map(c => c.id.toString());
      const existingAddresses = await ValidatedAddress.findAll({
        where: {
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

        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CONTACTS_MS));
        }

        try {
          const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();

          let contactFieldAddress = null;
          let contactBilling = null;
          let cfApartment = null;
          try {
            const contactDetail = await respondio.getContact(contact.id);
            if (contactDetail.success && contactDetail.data) {
              const cData = contactDetail.data;
              const normalizeFieldName = (n) => (n || '').toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
              const cfAddress = cData.custom_fields?.find(f => {
                const fn = normalizeFieldName(f.name);
                return fn === 'address' || fn === 'direccion' ||
                  fn === 'delivery address' || fn === 'delivery' ||
                  fn === 'address line 1' || fn === 'direccion de entrega';
              });
              if (cfAddress?.value && cfAddress.value.trim().length >= 5) {
                contactFieldAddress = cfAddress.value.trim();
              }
              cfApartment = cData.custom_fields?.find(f => 
                f.name?.toLowerCase() === 'apartment' || f.name?.toLowerCase() === 'apartamento' || f.name?.toLowerCase() === 'apt' || f.name?.toLowerCase() === 'unit'
              );
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

              const cfReactivarBot = cData.custom_fields?.find(f => {
                const fn = normalizeFieldName(f.name);
                return fn === 'reactivar_bot' || fn === 'reactivar bot' || fn === 'reactivarbot' || fn === 'bot_status' || fn === 'bot status';
              });
              if (cfReactivarBot?.value && cfReactivarBot.value.trim().length > 0) {
                const val = cfReactivarBot.value.trim().toLowerCase();
                const isCierreKw = val.includes('cierre') || val.includes('cerrar') || val === 'closing';
                const isReactivarKw = val === 'si' || val === 'sí' || val === 'yes' || val === 'activo' || val === 'active' || val === '1' || val === 'on' || val === 'reactivar';
                // Limpiar campo siempre antes de actuar
                try {
                  await respondio.updateContactCustomFields(contact.id, { [cfReactivarBot.name]: '' });
                } catch (clearErr) {
                  console.log(`[AddressScan] No se pudo limpiar campo reactivar_bot de ${contactName}`);
                }
                if (isCierreKw) {
                  // Asegurar que el bot pueda enviar
                  const convState = await ConversationState.findOne({ where: { contact_id: contactIdStr } });
                  if (convState) {
                    await convState.update({ agent_active: false });
                  }
                  const chatbotForClose = new ChatbotService(userId, settings);
                  await chatbotForClose.startClosingFlow(contact, 'tarjetas');
                  console.log(`[AddressScan] Flujo de cierre iniciado via custom field para ${contactName} (contacto ${contact.id})`);
                } else if (isReactivarKw) {
                  const convState = await ConversationState.findOne({ where: { contact_id: contactIdStr } });
                  if (convState && (convState.agent_active || convState.state === 'assigned')) {
                    const updateFields = { agent_active: false };
                    if (convState.state === 'assigned') {
                      updateFields.state = 'initial';
                    }
                    await convState.update(updateFields);
                    console.log(`[AddressScan] Bot reactivado via custom field para ${contactName} (contacto ${contact.id}), estado: ${convState.state}`);
                  }
                }
              }
            }
          } catch (cfErr) {
            // skip
          }

          const existing = addressMap.get(contactIdStr);

          if (existing) {
            try {
              const dbRecord = await ValidatedAddress.findByPk(existing.id);
              if (dbRecord) {
                const fieldUpdate = {};
                if (contactBilling) {
                  if (contactBilling.cost !== null && dbRecord.order_cost !== contactBilling.cost) {
                    fieldUpdate.order_cost = contactBilling.cost;
                  }
                  if (contactBilling.deposit !== null && dbRecord.deposit_amount !== contactBilling.deposit) {
                    fieldUpdate.deposit_amount = contactBilling.deposit;
                  }
                  if (fieldUpdate.order_cost !== undefined || fieldUpdate.deposit_amount !== undefined) {
                    const finalCost = fieldUpdate.order_cost ?? dbRecord.order_cost ?? 0;
                    const finalDeposit = fieldUpdate.deposit_amount ?? dbRecord.deposit_amount ?? 0;
                    fieldUpdate.total_to_collect = finalCost - finalDeposit;
                  }
                }
                if (cfApartment?.value && cfApartment.value.trim() && dbRecord.apartment_number !== cfApartment.value.trim()) {
                  fieldUpdate.apartment_number = cfApartment.value.trim();
                }
                if (Object.keys(fieldUpdate).length > 0) {
                  await dbRecord.update(fieldUpdate);
                  if (fieldUpdate.order_cost !== undefined || fieldUpdate.deposit_amount !== undefined) {
                    console.log(`[AddressScan] Billing sync ${contactName} (${contact.id}): cost=${fieldUpdate.order_cost ?? '-'} deposit=${fieldUpdate.deposit_amount ?? '-'} cobrar=${fieldUpdate.total_to_collect ?? '-'}`);
                  }
                  if (fieldUpdate.apartment_number) {
                    console.log(`[AddressScan] Apt sync ${contactName} (${contact.id}): apt=${fieldUpdate.apartment_number}`);
                  }
                }
              }
            } catch (syncErr) {
              console.error(`[AddressScan] Error field sync ${contact.id}:`, syncErr.message);
            }
          }

          if (existing && existing.source === 'contact_corrected') {
            if (contactFieldAddress) {
              const cfNorm = contactFieldAddress.toLowerCase().replace(/[^a-z0-9]/g, '');
              const existOrigNorm = (existing.original || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              if (cfNorm !== existOrigNorm) {
                const cfGeocoded = await geocodingService.geocodeAddress(contactFieldAddress);
                if (cfGeocoded.success) {
                  console.log(`[AddressScan] Direccion re-corregida en contacto ${contactName} (${contact.id}): "${cfGeocoded.fullAddress}" [contact_corrected]`);
                  await this.saveValidatedAddress(userId, contact, cfGeocoded.fullAddress, contactFieldAddress, cfGeocoded.zip, cfGeocoded, 'contact_corrected');
                }
              }
            }
            this.addressScannedContacts.add(contactIdStr);
            continue;
          }

          if (contactFieldAddress) {
            if (existing) {
              const cfNorm = contactFieldAddress.toLowerCase().replace(/[^a-z0-9]/g, '');
              const existOrigNorm = (existing.original || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              const existValidNorm = (existing.validated || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              if (cfNorm !== existOrigNorm && cfNorm !== existValidNorm) {
                const cfGeocoded = await geocodingService.geocodeAddress(contactFieldAddress);
                const addressToSave = cfGeocoded.success ? cfGeocoded.fullAddress : contactFieldAddress;
                console.log(`[AddressScan] Direccion corregida en contacto ${contactName} (${contact.id}): "${contactFieldAddress}"${cfGeocoded.success ? ` -> "${cfGeocoded.fullAddress}"` : ' (geocodificacion fallida, guardando igualmente)'} [contact_corrected]`);
                await this.saveValidatedAddress(userId, contact, addressToSave, contactFieldAddress, cfGeocoded.zip || null, cfGeocoded, 'contact_corrected');
                this.addressScannedContacts.add(contactIdStr);
                continue;
              } else {
                this.addressScannedContacts.add(contactIdStr);
                continue;
              }
            } else {
              const cfGeocoded = await geocodingService.geocodeAddress(contactFieldAddress);
              const addressToSave = cfGeocoded.success ? cfGeocoded.fullAddress : contactFieldAddress;
              console.log(`[AddressScan] Direccion desde contacto (sin registro previo) ${contactName} (${contact.id}): "${addressToSave}"${cfGeocoded.success ? '' : ' (geocodificacion fallida, guardando igualmente)'} [contact_corrected]`);
              await this.saveValidatedAddress(userId, contact, addressToSave, contactFieldAddress, cfGeocoded.zip || null, cfGeocoded, 'contact_corrected');
              this.addressScannedContacts.add(contactIdStr);
              continue;
            }
          }

          if (existing && existing.validated) {
            this.addressScannedContacts.add(contactIdStr);
            continue;
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
              /(?:direccion|address)\s+(?:es|seria|correcta|confirmada|de\s+entrega)/i,
              /(?:te|le)\s+(?:mando|envio|confirmo)\s+(?:la|tu|su)?\s*(?:direccion|dir|address)/i,
              /(?:entrega|delivery|envio)\s+(?:a|en|para)\s*:?\s*/i,
              /direccion\s+de\s+entrega/i,
              /dir(?:eccion)?[\s:]+\d+/i
            ];
            for (const msg of outgoingMessages) {
              const text = msg.message?.text || '';
              if (!text || text.length < 5) continue;

              const gLink = extractor.extractGoogleMapsLink(text);
              if (gLink) {
                scanMapsLink = gLink;
                console.log(`[AddressScan] Google Maps link detectado en mensaje de agente`);
                break;
              }

              const isConfirmation = confirmPatterns.some(p => p.test(text));
              if (isConfirmation) {
                const addr = extractor.extractAddressFromMessage(text);
                if (addr) {
                  latestExtracted = addr;
                  console.log(`[AddressScan] Direccion detectada en mensaje de agente (confirmacion): "${addr}"`);
                  break;
                }
              }

              const lines = text.split('\n').map(l => l.trim()).filter(l => l.length >= 8);
              for (const line of lines) {
                if (/^\d+\s+\w/.test(line) && /\b(st|ave|rd|dr|blvd|ln|ct|way|pl|pkwy|hwy|cir|trail|loop)\b/i.test(line)) {
                  const addr = extractor.extractAddressFromMessage(line);
                  if (addr) {
                    latestExtracted = addr;
                    console.log(`[AddressScan] Direccion detectada en mensaje de agente (standalone): "${addr}"`);
                    break;
                  }
                }
              }
              if (latestExtracted) break;
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
          this.addressScannedContacts.add(contactIdStr);
        } catch (contactError) {
          console.error(`[AddressScan] Error procesando contacto ${contact.id}:`, contactError.message);
        }
      }

      if (updatedCount > 0) {
        console.log(`[AddressScan] === ${updatedCount} contactos actualizados con direccion ===`);
      }

      const validLifecycles = ['approved', 'ordered', 'on delivery', 'pickup ready'];
      let placeholderCount = 0;
      for (const contact of batch) {
        const contactIdStr = contact.id.toString();
        const existing = addressMap.get(contactIdStr);
        if (existing) continue;

        const contactLifecycle = (contact.lifecycle || contact.lifecycleStage || '').toLowerCase();
        if (!validLifecycles.includes(contactLifecycle)) continue;

        const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Sin nombre';

        const isRecName = /\bREC\b/i.test(customerName) || /-REC/i.test(customerName);
        if (isRecName) continue;

        const orderStatus = this.lifecycleToOrderStatus(contact.lifecycle || contact.lifecycleStage || '');
        if (!orderStatus) continue;

        try {
          const existingAny = await ValidatedAddress.findOne({
            where: { respond_contact_id: contactIdStr }
          });
          if (existingAny) continue;

          let placeholderAddress = null;
          let placeholderLat = null;
          let placeholderLng = null;
          let placeholderZip = null;
          let placeholderCity = null;
          let placeholderState = null;
          let placeholderSource = 'placeholder';

          try {
            const contactDetail = await respondio.getContact(contact.id);
            if (contactDetail.success && contactDetail.data) {
              const cData = contactDetail.data;
              const normalizeFieldName = (n) => (n || '').toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
              const cfAddress = cData.custom_fields?.find(f => {
                const fn = normalizeFieldName(f.name);
                return fn === 'address' || fn === 'direccion' ||
                  fn === 'delivery address' || fn === 'delivery' ||
                  fn === 'address line 1' || fn === 'direccion de entrega';
              });
              if (cfAddress?.value && cfAddress.value.trim().length >= 5) {
                const addressText = cfAddress.value.trim();
                const geocoded = await geocodingService.geocodeAddress(addressText);
                if (geocoded.success) {
                  placeholderAddress = geocoded.fullAddress;
                  placeholderLat = geocoded.latitude;
                  placeholderLng = geocoded.longitude;
                  placeholderZip = geocoded.zip;
                  placeholderCity = geocoded.city;
                  placeholderState = geocoded.stateShort || geocoded.state;
                  placeholderSource = 'contact_corrected';
                  console.log(`[AddressScan] Placeholder con dirección de contacto para ${customerName}: "${placeholderAddress}"`);

                  try {
                    await respondio.updateContactCustomFields(contact.id, {
                      address: placeholderAddress,
                      ...(placeholderZip ? { zip_code: placeholderZip } : {})
                    });
                  } catch (updateErr) {}
                } else {
                  placeholderAddress = addressText;
                  placeholderSource = 'contact_corrected';
                  console.log(`[AddressScan] Placeholder con dirección sin geocodificar para ${customerName}: "${addressText}"`);
                }
              }
            }
          } catch (cfErr) {}

          await ValidatedAddress.create({
            user_id: userId,
            respond_contact_id: contactIdStr,
            customer_name: customerName,
            customer_phone: contact.phone || null,
            original_address: placeholderAddress,
            validated_address: placeholderAddress,
            address_lat: placeholderLat,
            address_lng: placeholderLng,
            zip_code: placeholderZip,
            city: placeholderCity,
            state: placeholderState,
            source: placeholderSource,
            order_status: orderStatus
          });
          placeholderCount++;
          if (placeholderAddress) {
            console.log(`[AddressScan] Placeholder con dirección creado para ${customerName} (${contactIdStr}) [${orderStatus}]: "${placeholderAddress}"`);
          } else {
            console.log(`[AddressScan] Placeholder creado para ${customerName} (${contactIdStr}) [${orderStatus}] - sin direccion detectada`);
          }
        } catch (phErr) {
          console.error(`[AddressScan] Error creando placeholder ${contactIdStr}:`, phErr.message);
        }
      }
      if (placeholderCount > 0) {
        console.log(`[AddressScan] === ${placeholderCount} placeholders creados para contactos sin direccion ===`);
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

      const allOrders = await ValidatedAddress.findAll({
        where: {
          respond_contact_id: { [Op.ne]: null }
        }
      });

      const closedOrders = allOrders.filter(o => !openContactIds.has(o.respond_contact_id));

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
          if (!contactResult.success || !contactResult.data) {
            if (!order.route_id) {
              console.log(`[LifecycleSync] Chat cerrado: "${order.customer_name}" contacto no encontrado en Respond.io, eliminando del dispatch`);
              await order.destroy();
              syncedCount++;
            }
            continue;
          }

          const contact = contactResult.data;
          const contactLifecycle = contact.lifecycle || contact.lifecycleStage || '';
          const newStatus = this.lifecycleToOrderStatus(contactLifecycle);

          if (newStatus === 'delivered' || newStatus === 'ups_shipped') {
            console.log(`[LifecycleSync] Chat cerrado: "${order.customer_name}" lifecycle=${contactLifecycle}, eliminando (terminal, route_id=${order.route_id || 'ninguna'})`);
            await order.destroy();
            syncedCount++;
          } else if (newStatus) {
            const closedUpdateFields = {};
            if (newStatus !== order.order_status && this.statusCanAdvance(order.order_status, newStatus)) {
              closedUpdateFields.order_status = newStatus;
            }
            if (order.dispatch_status === 'archived') {
              closedUpdateFields.dispatch_status = 'available';
            }
            if (Object.keys(closedUpdateFields).length > 0) {
              await order.update(closedUpdateFields);
              console.log(`[LifecycleSync] Chat cerrado: "${order.customer_name}" ${order.order_status} -> ${newStatus} (contacto ${order.respond_contact_id})`);
              syncedCount++;
            } else if (!order.route_id && order.dispatch_status !== 'archived' && !['delivered', 'ups_shipped'].includes(order.order_status)) {
              await order.update({ dispatch_status: 'archived' });
              console.log(`[LifecycleSync] Chat cerrado: "${order.customer_name}" lifecycle=${contactLifecycle}, archivada del dispatch (estado ${order.order_status} sin avance)`);
              syncedCount++;
            }
          } else if (!newStatus && contactLifecycle) {
            const archiveLifecycles = ['new lead'];
            const deleteLifecycles = ['impropos', 'closed'];
            const lcNorm = contactLifecycle.toLowerCase();
            if (archiveLifecycles.some(ex => ex === lcNorm)) {
              if (!order.route_id && order.dispatch_status !== 'archived') {
                await order.update({ dispatch_status: 'archived' });
                console.log(`[LifecycleSync] Chat cerrado: "${order.customer_name}" lifecycle=${contactLifecycle}, archivada del dispatch`);
                syncedCount++;
              }
            } else if (deleteLifecycles.some(ex => ex === lcNorm)) {
              console.log(`[LifecycleSync] Chat cerrado: "${order.customer_name}" lifecycle=${contactLifecycle}, eliminando del dispatch`);
              if (!order.route_id) {
                await order.destroy();
              }
              syncedCount++;
            }
          } else if (!newStatus && !contactLifecycle) {
            if (!order.route_id) {
              console.log(`[LifecycleSync] Chat cerrado: "${order.customer_name}" sin lifecycle, eliminando del dispatch`);
              await order.destroy();
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
      let totalCleaned = 0;

      const [contactDups] = await ValidatedAddress.sequelize.query(`
        SELECT respond_contact_id, COUNT(*) as cnt
        FROM validated_addresses
        WHERE respond_contact_id IS NOT NULL
        GROUP BY respond_contact_id
        HAVING COUNT(*) > 1
      `, { replacements: {} });

      for (const dup of contactDups) {
        const records = await ValidatedAddress.findAll({
          where: { respond_contact_id: dup.respond_contact_id },
          order: [['created_at', 'DESC']]
        });
        const keeper = records.find(r => r.route_id) || records[0];
        for (const old of records.filter(r => r.id !== keeper.id)) {
          if (keeper.id !== old.id) {
            const mergeFields = {};
            if (!keeper.order_cost && old.order_cost) mergeFields.order_cost = old.order_cost;
            if (!keeper.deposit_amount && old.deposit_amount) mergeFields.deposit_amount = old.deposit_amount;
            if (!keeper.total_to_collect && old.total_to_collect) mergeFields.total_to_collect = old.total_to_collect;
            if (!keeper.notes && old.notes) mergeFields.notes = old.notes;
            if (!keeper.apartment_number && old.apartment_number) mergeFields.apartment_number = old.apartment_number;
            if (!keeper.validated_address && old.validated_address) mergeFields.validated_address = old.validated_address;
            if (!keeper.route_id && old.route_id) mergeFields.route_id = old.route_id;
            if (Object.keys(mergeFields).length > 0) await keeper.update(mergeFields);
            try {
              await old.destroy();
              totalCleaned++;
              console.log(`[AddressScan] Duplicado eliminado: ${old.customer_name} (id=${old.id}), conservado id=${keeper.id}`);
            } catch (destroyErr) {
              console.error(`[AddressScan] No se pudo eliminar duplicado id=${old.id}:`, destroyErr.message);
            }
          }
        }
      }

      const [nameDups] = await ValidatedAddress.sequelize.query(`
        SELECT customer_name, validated_address, COUNT(*) as cnt
        FROM validated_addresses
        GROUP BY customer_name, validated_address
        HAVING COUNT(*) > 1
      `, { replacements: {} });

      for (const dup of nameDups) {
        const records = await ValidatedAddress.findAll({
          where: { customer_name: dup.customer_name, validated_address: dup.validated_address },
          order: [['created_at', 'DESC']]
        });
        const keeper = records.find(r => r.respond_contact_id) || records[0];
        const donor = records.find(r => r.id !== keeper.id && (r.order_cost || r.notes || r.apartment_number));
        if (donor) {
          await keeper.update({
            order_cost: keeper.order_cost ?? donor.order_cost,
            deposit_amount: keeper.deposit_amount ?? donor.deposit_amount,
            total_to_collect: keeper.total_to_collect ?? donor.total_to_collect,
            notes: keeper.notes || donor.notes,
            apartment_number: keeper.apartment_number || donor.apartment_number,
            respond_contact_id: keeper.respond_contact_id || donor.respond_contact_id
          });
        }
        for (const old of records.filter(r => r.id !== keeper.id)) {
          await old.destroy();
          totalCleaned++;
        }
      }

      const [allWithPhone] = await ValidatedAddress.sequelize.query(`
        SELECT id, customer_phone,
               REGEXP_REPLACE(customer_phone, '[^0-9]', '', 'g') as phone_digits
        FROM validated_addresses
        WHERE customer_phone IS NOT NULL AND customer_phone != ''
      `, { replacements: {} });

      const phoneDigitGroups = {};
      for (const row of allWithPhone) {
        const digits = (row.phone_digits || '').slice(-10);
        if (!digits || digits.length < 7) continue;
        if (!phoneDigitGroups[digits]) phoneDigitGroups[digits] = [];
        phoneDigitGroups[digits].push(row.id);
      }

      for (const [digits, ids] of Object.entries(phoneDigitGroups)) {
        if (ids.length < 2) continue;
        const records = await ValidatedAddress.findAll({
          where: { id: { [Op.in]: ids } },
          order: [['created_at', 'DESC']]
        });
        if (records.length < 2) continue;
        const keeper = records.find(r => r.respond_contact_id && r.validated_address)
          || records.find(r => r.respond_contact_id)
          || records.find(r => r.validated_address)
          || records[0];
        const mergeFields = {
          order_cost: keeper.order_cost,
          deposit_amount: keeper.deposit_amount,
          total_to_collect: keeper.total_to_collect,
          notes: keeper.notes,
          apartment_number: keeper.apartment_number,
          respond_contact_id: keeper.respond_contact_id,
          validated_address: keeper.validated_address,
          original_address: keeper.original_address,
          address_lat: keeper.address_lat,
          address_lng: keeper.address_lng,
          zip_code: keeper.zip_code,
          city: keeper.city,
          state: keeper.state
        };
        for (const donor of records.filter(r => r.id !== keeper.id)) {
          mergeFields.order_cost = mergeFields.order_cost ?? donor.order_cost;
          mergeFields.deposit_amount = mergeFields.deposit_amount ?? donor.deposit_amount;
          mergeFields.total_to_collect = mergeFields.total_to_collect ?? donor.total_to_collect;
          mergeFields.notes = mergeFields.notes || donor.notes;
          mergeFields.apartment_number = mergeFields.apartment_number || donor.apartment_number;
          mergeFields.respond_contact_id = mergeFields.respond_contact_id || donor.respond_contact_id;
          mergeFields.validated_address = mergeFields.validated_address || donor.validated_address;
          mergeFields.original_address = mergeFields.original_address || donor.original_address;
          mergeFields.address_lat = mergeFields.address_lat ?? donor.address_lat;
          mergeFields.address_lng = mergeFields.address_lng ?? donor.address_lng;
          mergeFields.zip_code = mergeFields.zip_code || donor.zip_code;
          mergeFields.city = mergeFields.city || donor.city;
          mergeFields.state = mergeFields.state || donor.state;
        }
        await keeper.update(mergeFields);
        for (const old of records.filter(r => r.id !== keeper.id)) {
          await old.destroy();
          totalCleaned++;
          console.log(`[AddressScan] Duplicado por tel ${digits}: eliminado ${old.customer_name} (id=${old.id}), keeper id=${keeper.id}`);
        }
      }

      if (totalCleaned > 0) {
        console.log(`[AddressScan] Limpiados ${totalCleaned} duplicado(s) total`);
      }
    } catch (error) {
      console.error(`[AddressScan] Error limpiando duplicados:`, error.message);
    }
  }

  async cleanupDeliveredOrders() {
    try {
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const ordersToArchive = await ValidatedAddress.findAll({
        where: {
          order_status: 'delivered',
          dispatch_status: { [Op.ne]: 'archived' },
          updated_at: { [Op.lt]: cutoff }
        }
      });

      if (ordersToArchive.length === 0) return;

      await this.archiveDeliveredOrders(ordersToArchive);

      const [updated] = await ValidatedAddress.update(
        { dispatch_status: 'archived' },
        {
          where: {
            id: { [Op.in]: ordersToArchive.map(o => o.id) }
          }
        }
      );
      if (updated > 0) {
        console.log(`[Cleanup] ${updated} orden(es) entregada(s) archivadas en base de datos (>48h) — NO eliminadas`);
      }
    } catch (error) {
      console.error(`[Cleanup] Error archivando órdenes entregadas:`, error.message);
    }
  }

  async archiveDeliveredOrders(orders) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const archiver = (await import('archiver')).default;

      const archiveDir = path.default.join(process.cwd(), 'uploads', 'archives');
      if (!fs.default.existsSync(archiveDir)) {
        fs.default.mkdirSync(archiveDir, { recursive: true });
      }

      const now = new Date();
      const dateStr = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`;
      const timeStr = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}_${now.getMilliseconds()}`;
      const zipName = `entregas_${dateStr}_${timeStr}.zip`;
      const zipPath = path.default.join(archiveDir, zipName);

      const { default: Stop } = await import('../models/Stop.js');
      const { default: Route } = await import('../models/Route.js');

      const routeIds = [...new Set(orders.map(o => o.route_id).filter(Boolean))];
      const routes = routeIds.length > 0 ? await Route.findAll({ where: { id: { [Op.in]: routeIds } } }) : [];
      const routeMap = {};
      routes.forEach(r => { routeMap[r.id] = r.toJSON(); });

      const stops = routeIds.length > 0 ? await Stop.findAll({ where: { route_id: { [Op.in]: routeIds } } }) : [];
      const stopsMap = {};
      stops.forEach(s => {
        if (!stopsMap[s.route_id]) stopsMap[s.route_id] = [];
        stopsMap[s.route_id].push(s.toJSON());
      });

      const output = fs.default.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      await new Promise((resolve, reject) => {
        output.on('close', resolve);
        archive.on('error', reject);
        archive.pipe(output);

        const archiveData = orders.map(order => {
          const o = order.toJSON();
          const route = o.route_id ? routeMap[o.route_id] : null;
          const routeStops = o.route_id ? (stopsMap[o.route_id] || []) : [];
          return {
            order: o,
            route: route ? { id: route.id, name: route.name, status: route.status } : null,
            stops: routeStops.map(s => ({
              id: s.id, address: s.address, customer_name: s.customer_name,
              phone: s.phone, order_cost: s.order_cost, deposit_amount: s.deposit_amount,
              total_to_collect: s.total_to_collect, payment_method: s.payment_method,
              amount_collected: s.amount_collected, payment_status: s.payment_status,
              photo_url: s.photo_url, status: s.status, completed_at: s.completed_at
            }))
          };
        });

        archive.append(JSON.stringify(archiveData, null, 2), { name: 'datos_entregas.json' });

        const uploadsDir = process.cwd();
        for (const stop of stops) {
          if (stop.photo_url) {
            const photoPath = path.default.join(uploadsDir, stop.photo_url.replace(/^\//, ''));
            if (fs.default.existsSync(photoPath)) {
              const fileName = path.default.basename(photoPath);
              archive.file(photoPath, { name: `evidencia/${fileName}` });
            }
          }
        }

        archive.finalize();
      });

      console.log(`[Archive] ZIP creado: ${zipName} (${orders.length} órdenes)`);

      const archiveFiles = fs.default.readdirSync(archiveDir)
        .filter(f => f.endsWith('.zip'))
        .sort();
      if (archiveFiles.length > 30) {
        const toDelete = archiveFiles.slice(0, archiveFiles.length - 30);
        for (const f of toDelete) {
          fs.default.unlinkSync(path.default.join(archiveDir, f));
        }
        console.log(`[Archive] Limpiados ${toDelete.length} archivos antiguos`);
      }

      return true;
    } catch (error) {
      console.error(`[Archive] Error archivando entregas:`, error.message);
      return false;
    }
  }

  statusCanAdvance(currentStatus, newStatus) {
    const STATUS_ORDER = ['pending', 'approved', 'ordered', 'pickup_ready', 'on_delivery', 'ups_shipped', 'delivered'];
    const currentIdx = STATUS_ORDER.indexOf(currentStatus);
    const newIdx = STATUS_ORDER.indexOf(newStatus);
    if (currentIdx === -1 || newIdx === -1) return newIdx !== -1;
    return newIdx > currentIdx;
  }

  lifecycleToOrderStatus(lifecycle) {
    if (!lifecycle) return null;
    const lc = lifecycle.toLowerCase();
    const map = {
      'pending': 'pending',
      'approved': 'approved',
      'ordered': 'ordered',
      'pickup ready': 'pickup_ready',
      'on delivery': 'on_delivery',
      'delivered': 'delivered',
      'ups shipped': 'ups_shipped'
    };
    return map[lc] || null;
  }

  async saveValidatedAddress(userId, contact, finalAddress, originalAddress, finalZip, geocoded, sourceOverride) {
    try {
      const contactIdStr = contact.id.toString();
      const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Sin nombre';
      const lat = geocoded?.success ? geocoded.latitude : null;
      const lng = geocoded?.success ? geocoded.longitude : null;
      const orderStatus = this.lifecycleToOrderStatus(contact.lifecycle);

      // Only skip if no coordinates AND no manually-entered address (contact_corrected)
      // If an agent wrote the address in Respond.io, save it even if geocoding failed
      if (!lat || !lng) {
        if (sourceOverride !== 'contact_corrected') {
          return;
        }
        // For contact_corrected without coords: save the record so it shows in dispatch
        // The dispatcher can edit/re-geocode the address manually
      }

      let record = await ValidatedAddress.findOne({
        where: { respond_contact_id: contactIdStr }
      });

      let created = false;

      if (!record && contact.phone) {
        const phoneNorm = contact.phone.replace(/\D/g, '');
        const byPhone = await ValidatedAddress.findAll({
          where: { customer_phone: { [Op.ne]: null } }
        });
        const phoneMatch = byPhone.find(r => r.customer_phone && r.customer_phone.replace(/\D/g, '') === phoneNorm) || null;
        if (phoneMatch) {
          record = phoneMatch;
          if (!record.respond_contact_id) {
            await record.update({ respond_contact_id: contactIdStr });
            console.log(`[ValidatedAddr] Vinculado registro manual de ${customerName} al contacto ${contactIdStr}`);
          } else {
            console.log(`[ValidatedAddr] Reutilizando registro existente de ${customerName} (mismo teléfono, evitando duplicado)`);
          }
        }
      }

      if (!record) {
        const byName = await ValidatedAddress.findOne({
          where: {
            respond_contact_id: null,
            customer_name: customerName
          }
        });
        if (byName) {
          record = byName;
          await record.update({ respond_contact_id: contactIdStr });
          console.log(`[ValidatedAddr] Vinculado registro manual de ${customerName} (por nombre) al contacto ${contactIdStr}`);
        }
      }

      const geocodedState = geocoded?.stateShort || geocoded?.state || null;
      if (geocodedState && geocodedState.toUpperCase() !== 'TX') {
        console.log(`[ValidatedAddr] Dirección de ${customerName} fuera de TX (${geocodedState}): "${finalAddress}" — ignorada`);
        return null;
      }

      const isRecByName = /\bREC\b/i.test(customerName) || /-REC/i.test(customerName);

      if (!record) {
        record = await ValidatedAddress.create({
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
          source: sourceOverride || 'scanner',
          order_status: orderStatus || 'approved',
          dispatch_status: isRecByName ? 'archived' : 'available'
        });
        if (isRecByName) console.log(`[ValidatedAddr] Orden de ${customerName} archivada del dispatcher (nombre contiene -REC)`);
        created = true;
      } else if (isRecByName && record.dispatch_status !== 'archived') {
        await record.update({ dispatch_status: 'archived' });
        console.log(`[ValidatedAddr] Orden de ${customerName} archivada del dispatcher (nombre contiene -REC)`);
      }

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
        if (orderStatus && record.order_status !== orderStatus && this.statusCanAdvance(record.order_status, orderStatus)) {
          updateData.order_status = orderStatus;
          console.log(`[ValidatedAddr] Lifecycle sync: ${customerName} ${record.order_status} -> ${orderStatus}`);
        }
        await record.update(updateData);
        console.log(`[ValidatedAddr] Actualizada para ${customerName}: "${finalAddress}" (${lat}, ${lng})${sourceOverride ? ` [${sourceOverride}]` : ''}`);
      }

      if (contactIsWholesale(customerName)) {
        await this.updateWholesaleClientAddress(userId, contact, finalAddress, geocoded);
      }
    } catch (error) {
      console.error(`[ValidatedAddr] Error guardando direccion validada:`, error.message);
    }
  }

  async autoRegisterWholesaleClients(userId, contacts) {
    try {
      const mayContacts = contacts.filter(c => {
        const name = `${c.firstName || ''} ${c.lastName || ''}`.trim();
        return contactIsWholesale(name);
      });

      if (mayContacts.length === 0) return;

      for (const contact of mayContacts) {
        const contactIdStr = contact.id.toString();
        const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
        const customerPhone = contact.phone || null;

        const existingById = await WholesaleClient.findOne({
          where: { respond_contact_id: contactIdStr }
        });
        if (existingById) {
          const updateFields = {};
          if (existingById.customer_name !== customerName && customerName !== 'Sin nombre') {
            updateFields.customer_name = customerName;
          }
          if (customerPhone && existingById.customer_phone !== customerPhone) {
            updateFields.customer_phone = customerPhone;
          }
          if (Object.keys(updateFields).length > 0) {
            await existingById.update(updateFields);
            console.log(`[Wholesale] Mayorista actualizado desde Pecky: ${customerName} (id=${contactIdStr})`);
          }
          continue;
        }

        const existingByName = await WholesaleClient.findOne({
          where: { customer_name: customerName }
        });
        if (existingByName) {
          if (!existingByName.respond_contact_id) {
            await existingByName.update({
              respond_contact_id: contactIdStr,
              customer_phone: customerPhone || existingByName.customer_phone
            });
            console.log(`[Wholesale] Mayorista vinculado a contacto Pecky: ${customerName} (id=${contactIdStr})`);
          }
          continue;
        }

        const adminUser = await User.findOne({ where: { role: 'admin' } });
        await WholesaleClient.create({
          user_id: adminUser?.id || userId,
          respond_contact_id: contactIdStr,
          customer_name: customerName,
          customer_phone: customerPhone,
          is_active: true
        });
        console.log(`[Wholesale] Nuevo mayorista detectado y registrado: ${customerName} (id=${contactIdStr})`);
      }
    } catch (error) {
      console.error(`[Wholesale] Error en autoRegisterWholesaleClients:`, error.message);
    }
  }

  async updateWholesaleClientAddress(userId, contact, finalAddress, geocoded) {
    try {
      const contactIdStr = contact.id.toString();
      const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();

      const wClient = await WholesaleClient.findOne({
        where: {
          [Op.or]: [
            { respond_contact_id: contactIdStr },
            { customer_name: customerName }
          ]
        }
      });

      if (!wClient) return;

      const updateData = {
        validated_address: finalAddress,
        address_lat: geocoded?.latitude || null,
        address_lng: geocoded?.longitude || null,
        zip_code: geocoded?.zip || wClient.zip_code,
        city: geocoded?.city || wClient.city,
        state: geocoded?.stateShort || geocoded?.state || wClient.state
      };

      if (!wClient.respond_contact_id) {
        updateData.respond_contact_id = contactIdStr;
      }
      if (!wClient.customer_phone && contact.phone) {
        updateData.customer_phone = contact.phone;
      }

      await wClient.update(updateData);
      console.log(`[Wholesale] Dirección actualizada para mayorista ${customerName}: "${finalAddress}"`);
    } catch (error) {
      console.error(`[Wholesale] Error actualizando dirección de mayorista:`, error.message);
    }
  }
}

const pollingServiceInstance = new PollingService();
export default pollingServiceInstance;
