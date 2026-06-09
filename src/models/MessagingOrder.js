/**
 * @fileoverview Definición del modelo de Orden de Mensajería (MessagingOrder).
 * Representa un pedido extraído de conversaciones de chat (Respond.io) o correos.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Modelo MessagingOrder para gestionar pedidos desde canales de mensajería.
 */
const MessagingOrder = sequelize.define('MessagingOrder', {
  /** ID único autoincremental */
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  /** ID del usuario dueño de la orden */
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  /** ID del contacto en la plataforma Respond.io */
  respond_contact_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** ID de la conversación en Respond.io */
  respond_conversation_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** ID del canal de mensajería (WhatsApp, FB, etc.) */
  channel_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Tipo de canal (ej: 'whatsapp', 'instagram') */
  channel_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  /** Nombre del cliente extraído del chat */
  customer_name: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  /** Teléfono del cliente */
  customer_phone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  /** Email del cliente */
  customer_email: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  /** Dirección de entrega original (tal como se recibió) */
  address: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  /** Latitud geográfica de la dirección validada */
  address_lat: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  /** Longitud geográfica de la dirección validada */
  address_lng: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  /** Código postal detectado */
  zip_code: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  /** Tipo de dirección (ej: 'residential', 'commercial') */
  address_type: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  /** Notas adicionales del pedido */
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  /** Estado del procesamiento del pedido (ej: 'pending', 'confirmed') */
  status: {
    type: DataTypes.STRING(30),
    defaultValue: 'pending'
  },
  /** Estado de validación de la dirección (ej: 'valid', 'invalid') */
  validation_status: {
    type: DataTypes.STRING(30),
    defaultValue: 'pending'
  },
  /** Mensaje de error o éxito de la validación de dirección */
  validation_message: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  /** ID del conductor asignado */
  assigned_driver_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  /** ID de la ruta a la que se integró esta orden */
  route_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'routes',
      key: 'id'
    }
  },
  /** ID de la parada creada en la ruta para esta orden */
  stop_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'stops',
      key: 'id'
    }
  },
  /** ID del agente de Respond.io asignado originalmente */
  assigned_agent_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  /** Nombre del agente asignado */
  agent_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Fecha programada para la entrega */
  scheduled_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  /** Inicio de la ventana horaria de entrega */
  scheduled_time_start: {
    type: DataTypes.TIME,
    allowNull: true
  },
  /** Fin de la ventana horaria de entrega */
  scheduled_time_end: {
    type: DataTypes.TIME,
    allowNull: true
  },
  /** Fecha y hora en que se marcó como completada */
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** Fecha y hora en que se canceló la orden */
  cancelled_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** Razón de la cancelación */
  cancel_reason: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  /** Etapa del ciclo de vida (ej: 'new', 'in_route', 'delivered') */
  lifecycle: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  /** Estado de aprobación de la orden (ej: 'approved', 'rejected') */
  order_status: {
    type: DataTypes.STRING(30),
    defaultValue: 'approved'
  },
  /** Monto total de la orden */
  amount: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  /** Fecha y hora real de entrega (desde el repartidor) */
  delivered_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** Nombre del conductor asignado (cacheado) */
  driver_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  }
}, {
  tableName: 'messaging_orders',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

/**
 * @description Convierte la instancia de la orden a un objeto plano.
 * @returns {Object} Diccionario con los datos de la orden de mensajería.
 */
MessagingOrder.prototype.toDict = function() {
  return {
    id: this.id,
    user_id: this.user_id,
    respond_contact_id: this.respond_contact_id,
    respond_conversation_id: this.respond_conversation_id,
    channel_id: this.channel_id,
    channel_type: this.channel_type,
    customer_name: this.customer_name,
    customer_phone: this.customer_phone,
    customer_email: this.customer_email,
    address: this.address,
    address_lat: this.address_lat,
    address_lng: this.address_lng,
    zip_code: this.zip_code,
    address_type: this.address_type,
    notes: this.notes,
    status: this.status,
    validation_status: this.validation_status,
    validation_message: this.validation_message,
    assigned_driver_id: this.assigned_driver_id,
    route_id: this.route_id,
    stop_id: this.stop_id,
    assigned_agent_id: this.assigned_agent_id,
    agent_name: this.agent_name,
    scheduled_date: this.scheduled_date,
    scheduled_time_start: this.scheduled_time_start,
    scheduled_time_end: this.scheduled_time_end,
    completed_at: this.completed_at,
    cancelled_at: this.cancelled_at,
    cancel_reason: this.cancel_reason,
    lifecycle: this.lifecycle,
    order_status: this.order_status,
    amount: this.amount,
    delivered_at: this.delivered_at,
    driver_name: this.driver_name,
    created_at: this.created_at,
    updated_at: this.updated_at
  };
};

export default MessagingOrder;
