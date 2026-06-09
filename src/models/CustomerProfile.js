/**
 * @fileoverview Definición del modelo de Perfil de Cliente (CustomerProfile).
 * Almacena un resumen histórico, preferencias y comportamiento detectado para cada cliente.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Modelo CustomerProfile para personalización de la atención mediante IA.
 */
const CustomerProfile = sequelize.define('CustomerProfile', {
  /** ID único autoincremental */
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  /** ID del usuario administrador dueño del perfil */
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  /** ID del contacto en Respond.io */
  contact_id: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  /** Nombre completo del cliente */
  contact_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  /** Resumen narrativo generado por IA sobre quién es el cliente y cómo tratarlo */
  summary: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  /** Preferencias detectadas (tono, idioma, métodos de pago, etc.) en formato JSON */
  preferences: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  /** Historial resumido de productos pedidos anteriormente */
  past_products: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  /** Código postal principal del cliente */
  zip_code: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  /** Ciudad de residencia del cliente */
  city: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Notas internas adicionales sobre el comportamiento del cliente */
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  /** Contador total de conversaciones tenidas con este cliente */
  total_conversations: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  /** Fecha y hora de la última conversación registrada */
  last_conversation_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** Última vez que el perfil fue analizado y resumido por la IA */
  last_summarized_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'customer_profiles',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['user_id', 'contact_id'], unique: true }
  ]
});

export default CustomerProfile;
