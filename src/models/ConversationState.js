/**
 * @fileoverview Definición del modelo de Estado de Conversación (ConversationState).
 * Mantiene el estado de la máquina de estados del bot para cada contacto.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Modelo ConversationState para persistir el progreso de una charla con el bot.
 */
const ConversationState = sequelize.define('ConversationState', {
  /** ID único autoincremental */
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  /** ID del usuario (admin) al que pertenece esta conversación */
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  /** ID del contacto en Respond.io */
  contact_id: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  /** Estado actual en el flujo conversacional (ej: 'initial', 'awaiting_zip') */
  state: {
    type: DataTypes.STRING(50),
    defaultValue: 'initial'
  },
  /** Qué tipo de respuesta está esperando el bot del cliente */
  awaiting_response: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  /** Indica si el cliente confirmó tener información previa de precios/servicios */
  has_prior_info: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  /** Producto seleccionado por el cliente durante la charla */
  selected_product: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Código postal validado durante la conversación */
  validated_zip: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  /** Indica si es un cliente que ya ha comprado anteriormente */
  is_existing_customer: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  /** Indica si la conversación fue reabierta recientemente */
  is_reopened: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  /** Indica si ya se le notificó al cliente que está fuera de horario */
  out_of_hours_notified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  /** ID del agente humano asignado a esta conversación */
  assigned_agent_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Indica si el bot está pausado para este contacto (intervención humana) */
  bot_paused: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  /** Fecha y hora de la última interacción general */
  last_interaction: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  /** Fecha y hora del último mensaje enviado por el bot */
  last_bot_message_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** Fecha y hora del último mensaje enviado por un agente humano */
  last_agent_message_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** Fecha y hora del último mensaje enviado por el cliente */
  last_customer_message_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** Indica si hay un agente humano activamente chateando */
  agent_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  /** Indica si ya se envió el saludo inicial */
  greeting_sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  /** Fecha y hora en que se cerró la conversación */
  conversation_closed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** Última vez que se vio la conversación en estado 'abierto' */
  last_seen_open_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** Datos de contexto adicionales en formato JSON */
  context_data: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  /** Contador de mensajes de seguimiento (followup) enviados */
  followup_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  /** Fecha y hora del último mensaje de seguimiento enviado */
  followup_last_sent_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'conversation_states',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'contact_id']
    }
  ]
});

/**
 * @description Convierte la instancia del estado a un objeto plano.
 * @returns {Object} Diccionario con los datos del estado de conversación.
 */
ConversationState.prototype.toDict = function() {
  return {
    id: this.id,
    user_id: this.user_id,
    contact_id: this.contact_id,
    state: this.state,
    awaiting_response: this.awaiting_response,
    has_prior_info: this.has_prior_info,
    selected_product: this.selected_product,
    validated_zip: this.validated_zip,
    is_existing_customer: this.is_existing_customer,
    is_reopened: this.is_reopened,
    out_of_hours_notified: this.out_of_hours_notified,
    assigned_agent_id: this.assigned_agent_id,
    bot_paused: this.bot_paused,
    last_interaction: this.last_interaction,
    last_bot_message_at: this.last_bot_message_at,
    last_agent_message_at: this.last_agent_message_at,
    last_customer_message_at: this.last_customer_message_at,
    agent_active: this.agent_active,
    greeting_sent: this.greeting_sent,
    conversation_closed_at: this.conversation_closed_at,
    last_seen_open_at: this.last_seen_open_at,
    context_data: this.context_data,
    followup_count: this.followup_count,
    followup_last_sent_at: this.followup_last_sent_at
  };
};

export default ConversationState;
