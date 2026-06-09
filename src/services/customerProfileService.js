/**
 * @fileoverview Servicio para la gestión de perfiles de clientes.
 * Proporciona funcionalidades para obtener perfiles existentes y actualizarlos o crearlos
 * basándose en el análisis de conversaciones recientes mediante inteligencia artificial.
 */

import CustomerProfile from '../models/CustomerProfile.js';
import MessageLog from '../models/MessageLog.js';
import MessagingSettings from '../models/MessagingSettings.js';
import AIService from './aiService.js';

/**
 * Clase CustomerProfileService para gestionar perfiles de clientes y su enriquecimiento con IA.
 */
class CustomerProfileService {
  /**
   * Obtiene el perfil de un cliente.
   * @description Busca un perfil de cliente específico por su userId y contactId.
   * @param {number|string} userId - ID del usuario/empresa.
   * @param {number|string} contactId - ID del contacto en Respond.io.
   * @returns {Promise<Object|null>} El modelo CustomerProfile encontrado o null si no existe.
   */
  static async get(userId, contactId) {
    if (!userId || !contactId) return null;
    try {
      return await CustomerProfile.findOne({
        where: { user_id: userId, contact_id: contactId.toString() }
      });
    } catch (e) {
      console.error('[CustomerProfile] get error:', e.message);
      return null;
    }
  }

  /**
   * Crea o actualiza el perfil basado en la conversación reciente del cliente.
   * @description Analiza los últimos mensajes (hasta 60) usando OpenAI para generar un resumen,
   * extraer preferencias, productos pasados y ubicación. Tiene un límite de re-análisis de 6 horas.
   * @param {number|string} userId - ID del usuario/empresa.
   * @param {Object} contact - Objeto del contacto con id, firstName y lastName.
   * @returns {Promise<Object|null>} El perfil de cliente actualizado o creado, o null en caso de error.
   */
  static async refreshFromConversation(userId, contact) {
    if (!userId || !contact?.id) return null;
    const contactId = contact.id.toString();
    try {
      const settings = await MessagingSettings.findOne({ where: { user_id: userId } });
      if (!settings?.ai_enabled || !settings?.openai_api_key) return null;

      // Si fue resumido en las últimas 6 horas, lo dejamos
      const existing = await this.get(userId, contactId);
      if (existing?.last_summarized_at) {
        const hours = (Date.now() - new Date(existing.last_summarized_at).getTime()) / 3600000;
        if (hours < 6) return existing;
      }

      // Trae los últimos mensajes intercambiados con este contacto
      const recent = await MessageLog.findAll({
        where: { user_id: userId, contact_id: contactId },
        order: [['created_at', 'DESC']],
        limit: 60
      });
      if (!recent.length) return existing;

      const transcript = recent
        .reverse()
        .map(m => {
          const role = m.direction === 'outgoing'
            ? (m.message_type === 'bot' ? 'BOT' : 'AGENTE')
            : 'CLIENTE';
          return `${role}: ${m.message_content || ''}`;
        })
        .join('\n')
        .slice(-6000);

      const ai = new AIService(settings.openai_api_key, settings, userId);
      const summary = await ai.summarizeCustomer(contact, transcript, existing);
      if (!summary) return existing;

      const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || existing?.contact_name || null;

      const data = {
        user_id: userId,
        contact_id: contactId,
        contact_name: contactName,
        summary: summary.summary || existing?.summary || null,
        preferences: summary.preferences || existing?.preferences || {},
        past_products: summary.past_products || existing?.past_products || [],
        zip_code: summary.zip_code || existing?.zip_code || null,
        city: summary.city || existing?.city || null,
        notes: summary.notes || existing?.notes || null,
        total_conversations: (existing?.total_conversations || 0) + 1,
        last_conversation_at: new Date(),
        last_summarized_at: new Date()
      };

      if (existing) {
        await existing.update(data);
        return existing;
      } else {
        return await CustomerProfile.create(data);
      }
    } catch (e) {
      console.error('[CustomerProfile] refresh error:', e.message);
      return null;
    }
  }
}

export default CustomerProfileService;

