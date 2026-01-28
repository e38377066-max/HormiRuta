import RespondioService from './respondio.js';
import AddressValidationService from './addressValidation.js';
import MessagingSettings from '../models/MessagingSettings.js';
import MessagingOrder from '../models/MessagingOrder.js';
import MessageLog from '../models/MessageLog.js';
import CoverageZone from '../models/CoverageZone.js';

class PollingService {
  constructor() {
    this.activePollers = new Map();
    this.processedMessages = new Map();
  }

  async startPolling(userId, intervalSeconds = 30) {
    if (this.activePollers.has(userId)) {
      console.log(`Polling already active for user ${userId}`);
      return { success: true, message: 'Polling ya está activo' };
    }

    const settings = await MessagingSettings.findOne({ where: { user_id: userId } });
    if (!settings || !settings.respond_api_token) {
      return { success: false, error: 'No se ha configurado el token de API de Respond.io' };
    }

    if (!settings.is_active) {
      return { success: false, error: 'El módulo de mensajería está desactivado' };
    }

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
        await this.pollForNewMessages(userId, settings.respond_api_token, poller);
        poller.lastPoll = new Date();
      } catch (error) {
        console.error(`Polling error for user ${userId}:`, error.message);
      }
    };

    await pollFn();
    
    poller.intervalId = setInterval(pollFn, poller.intervalMs);
    this.activePollers.set(userId, poller);

    console.log(`Started polling for user ${userId} every ${intervalSeconds}s`);
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
    const respondio = new RespondioService(apiToken);
    
    const [pendingContacts, newLeadContacts, approvedContacts] = await Promise.all([
      respondio.listContactsByLifecycle({ lifecycleStage: 'Pending', limit: 50 }),
      respondio.listContactsByLifecycle({ lifecycleStage: 'New Lead', limit: 50 }),
      respondio.listContactsByLifecycle({ lifecycleStage: 'Approved', limit: 50 })
    ]);

    if (!pendingContacts.success && !newLeadContacts.success && !approvedContacts.success) {
      console.error('Failed to fetch contacts:', pendingContacts.error || newLeadContacts.error || approvedContacts.error);
      return;
    }

    const allContacts = [
      ...(pendingContacts.items || []),
      ...(newLeadContacts.items || []),
      ...(approvedContacts.items || [])
    ];
    
    const uniqueContacts = allContacts.filter((contact, index, self) =>
      index === self.findIndex(c => c.id === contact.id)
    );

    console.log(`Found ${uniqueContacts.length} contacts (Pending: ${pendingContacts.items?.length || 0}, New Lead: ${newLeadContacts.items?.length || 0}, Approved: ${approvedContacts.items?.length || 0})`);

    for (const contact of uniqueContacts) {
      await this.processContactMessages(userId, apiToken, contact, poller, respondio);
    }
  }

  async processContactMessages(userId, apiToken, contact, poller, respondio) {
    const messagesResult = await respondio.listMessages(contact.id, { limit: 20 });
    
    if (!messagesResult.success) {
      console.error(`Failed to fetch messages for contact ${contact.id}:`, messagesResult.error);
      return;
    }

    const messages = messagesResult.items || [];
    
    const incomingMessages = messages
      .filter(msg => msg.traffic === 'incoming')
      .filter(msg => !poller.processedMessageIds.has(msg.messageId))
      .reverse();

    for (const message of incomingMessages) {
      await this.processIncomingMessage(userId, contact, message, respondio);
      poller.processedMessageIds.add(message.messageId);
      
      if (poller.processedMessageIds.size > 10000) {
        const idsArray = Array.from(poller.processedMessageIds);
        poller.processedMessageIds = new Set(idsArray.slice(-5000));
      }
    }
  }

  async processIncomingMessage(userId, contact, message, respondio) {
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

      const addressValidation = new AddressValidationService(userId);
      
      const isZipMessage = addressValidation.isZipCodeMessage(messageText);
      const isCityMessage = addressValidation.isCityMessage(messageText);
      
      if (isZipMessage || isCityMessage) {
        const zipValidation = await addressValidation.validateZipOrCity(messageText);
        console.log(`ZIP/City validation for ${contact.firstName}: "${messageText}" - valid: ${zipValidation.valid}, type: ${zipValidation.type}`);
        
        if (settings.attention_mode === 'automatic') {
          if (zipValidation.valid && settings.auto_respond_coverage && settings.coverage_message) {
            const coverageMsg = settings.coverage_message
              .replace('{{zip_code}}', zipValidation.value)
              .replace('{{city}}', zipValidation.zone?.city || '')
              .replace('{{zone}}', zipValidation.zone?.zone_name || '');
            await respondio.sendMessage(contact.id, coverageMsg);
            await this.logOutgoingMessage(userId, contact, coverageMsg, 'auto_zip_valid');
          } else if (!zipValidation.valid && settings.auto_respond_no_coverage && settings.no_coverage_message) {
            const noCoverageMsg = settings.no_coverage_message
              .replace('{{zip_code}}', zipValidation.value)
              .replace('{{city}}', zipValidation.value);
            await respondio.sendMessage(contact.id, noCoverageMsg);
            await this.logOutgoingMessage(userId, contact, noCoverageMsg, 'auto_zip_invalid');
          }
        }
        
        await MessageLog.update(
          { processed: true },
          { where: { respond_message_id: message.messageId?.toString(), user_id: userId } }
        );
        return;
      }
      
      const validation = await addressValidation.validateAddress(messageText);

      console.log(`Message from ${contact.firstName}: "${messageText.substring(0, 50)}..." - isAddress: ${validation.isAddress}`);

      if (validation.isAddress) {
        console.log(`Creating/updating order for address: ${messageText.substring(0, 50)}...`);
        let order = await MessagingOrder.findOne({
          where: {
            user_id: userId,
            respond_contact_id: contact.id.toString(),
            status: ['pending', 'confirmed']
          }
        });

        const customerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Sin nombre';

        if (!order) {
          order = await MessagingOrder.create({
            user_id: userId,
            respond_contact_id: contact.id.toString(),
            customer_name: customerName,
            customer_phone: contact.phone || null,
            channel_type: 'respond.io',
            address: messageText,
            zip_code: validation.zipCode,
            address_type: validation.addressType,
            status: 'pending',
            validation_status: validation.hasCoverage ? 'covered' : 'no_coverage',
            validation_message: validation.validationMessage,
            notes: validation.needsApartmentNumber ? 'Pendiente: Solicitar numero de apartamento' : null
          });
          console.log(`Created new order #${order.id} for ${customerName}`);
        } else {
          await order.update({
            address: messageText,
            zip_code: validation.zipCode,
            address_type: validation.addressType,
            validation_status: validation.hasCoverage ? 'covered' : 'no_coverage',
            validation_message: validation.validationMessage
          });
          console.log(`Updated order #${order.id} with new address`);
        }

        if (settings.attention_mode === 'automatic') {
          if (validation.hasCoverage && settings.auto_respond_coverage && settings.coverage_message) {
            await respondio.sendMessage(contact.id, settings.coverage_message);
            await this.logOutgoingMessage(userId, contact, settings.coverage_message, 'auto_coverage');
          } else if (!validation.hasCoverage && settings.auto_respond_no_coverage && settings.no_coverage_message) {
            await respondio.sendMessage(contact.id, settings.no_coverage_message);
            await this.logOutgoingMessage(userId, contact, settings.no_coverage_message, 'auto_no_coverage');
          }
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
