/**
 * @fileoverview Definición del modelo de Log de Mensajes (MessageLog).
 * Registra todos los mensajes enviados y recibidos a través de la API de mensajería.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Modelo MessageLog para auditoría y seguimiento de la comunicación con clientes.
 */
const MessageLog = sequelize.define('MessageLog', {
  /** ID único autoincremental */
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  /** ID del usuario dueño del log */
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  /** ID de la orden de mensajería asociada (si aplica) */
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'messaging_orders',
      key: 'id'
    }
  },
  /** ID del contacto en Respond.io */
  respond_contact_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** ID único del mensaje en la plataforma externa */
  respond_message_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** ID alternativo del contacto */
  contact_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Nombre del contacto al momento del mensaje */
  contact_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  /** Teléfono del contacto */
  contact_phone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  /** Nombre del canal (ej: 'WhatsApp') */
  channel: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  /** Dirección del mensaje ('inbound' o 'outbound') */
  direction: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  /** Tipo de contenido (ej: 'text', 'image', 'location') */
  message_type: {
    type: DataTypes.STRING(100),
    defaultValue: 'text'
  },
  /** Contenido textual del mensaje */
  content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  /** Campo alternativo para el contenido del mensaje */
  message_content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  /** Indica si el mensaje ya fue procesado por el bot */
  processed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  /** Tipo de canal (ej: 'whatsapp', 'facebook') */
  channel_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  /** Estado de entrega del mensaje */
  status: {
    type: DataTypes.STRING(30),
    defaultValue: 'sent'
  },
  /** Indica si el mensaje fue generado por un proceso automático */
  is_automated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  /** Tipo de automatización que generó el mensaje */
  automation_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  /** Mensaje de error en caso de fallo en el envío */
  error_message: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  /** Datos adicionales del mensaje en formato JSON */
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'message_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

/**
 * @description Convierte la instancia del log a un objeto plano.
 * @returns {Object} Diccionario con los datos del log de mensaje.
 */
MessageLog.prototype.toDict = function() {
  return {
    id: this.id,
    user_id: this.user_id,
    order_id: this.order_id,
    respond_contact_id: this.respond_contact_id,
    respond_message_id: this.respond_message_id,
    direction: this.direction,
    message_type: this.message_type,
    content: this.content,
    channel_type: this.channel_type,
    status: this.status,
    is_automated: this.is_automated,
    automation_type: this.automation_type,
    error_message: this.error_message,
    metadata: this.metadata,
    created_at: this.created_at,
    updated_at: this.updated_at
  };
};

export default MessageLog;
