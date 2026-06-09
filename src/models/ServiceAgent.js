/**
 * @fileoverview Definición del modelo de Agente de Servicio (ServiceAgent).
 * Define a los agentes humanos disponibles en la plataforma de mensajería y sus especialidades.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Modelo ServiceAgent para mapear agentes humanos de Respond.io.
 */
const ServiceAgent = sequelize.define('ServiceAgent', {
  /** ID único autoincremental */
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  /** ID del usuario administrador dueño del agente */
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  /** ID del agente en la plataforma externa Respond.io */
  agent_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Nombre completo del agente */
  agent_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  /** Correo electrónico del agente */
  agent_email: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  /** Nombre del servicio o marca que representa (ej: 'Area 862') */
  service_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  /** Lista de productos o categorías que este agente maneja (JSON) */
  products: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  /** Indica si es el agente por defecto para nuevas asignaciones */
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  /** Indica si el agente está activo para recibir asignaciones */
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'service_agents',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

/**
 * @description Convierte la instancia del agente a un objeto plano.
 * @returns {Object} Diccionario con los datos del agente de servicio.
 */
ServiceAgent.prototype.toDict = function() {
  return {
    id: this.id,
    user_id: this.user_id,
    agent_id: this.agent_id,
    agent_name: this.agent_name,
    agent_email: this.agent_email,
    service_name: this.service_name,
    products: this.products,
    is_default: this.is_default,
    is_active: this.is_active,
    created_at: this.created_at,
    updated_at: this.updated_at
  };
};

export default ServiceAgent;
