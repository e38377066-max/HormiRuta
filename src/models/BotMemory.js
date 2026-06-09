/**
 * @fileoverview Definición del modelo de Memoria del Bot (BotMemory).
 * Almacena lecciones y patrones aprendidos por la IA para mejorar sus respuestas futuras.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Modelo BotMemory para gestionar el aprendizaje continuo del bot.
 */
const BotMemory = sequelize.define('BotMemory', {
  /** ID único autoincremental */
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  /** ID del usuario administrador dueño de esta lección */
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  /** El contenido de la lección aprendida (qué hacer o evitar) */
  lesson: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  /** Categoría de la lección para organizar el contexto de la IA */
  context_type: {
    type: DataTypes.ENUM('general', 'greeting', 'product', 'zip', 'design', 'frustration', 'correction', 'pattern'),
    defaultValue: 'general'
  },
  /** Mensaje del cliente que provocó el aprendizaje de esta lección */
  trigger_example: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  /** Respuesta original del bot antes de la corrección */
  bot_response_example: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  /** Corrección manual realizada por un agente humano */
  agent_correction: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  /** Origen de la lección (creada manualmente o detectada por IA) */
  source: {
    type: DataTypes.ENUM('manual', 'auto_detected'),
    defaultValue: 'manual'
  },
  /** Indica si la lección ha sido revisada y aprobada por un administrador */
  is_approved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  /** Indica si la lección está activa y se incluye en el prompt de la IA */
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  /** Contador de cuántas veces se ha aplicado esta lección en conversaciones reales */
  times_applied: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  /** ID del contacto de Respond.io asociado al origen de esta lección */
  contact_id: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'bot_memories',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default BotMemory;
