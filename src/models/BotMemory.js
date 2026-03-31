import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const BotMemory = sequelize.define('BotMemory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  lesson: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'La lección aprendida: qué debe hacer o evitar el bot'
  },
  context_type: {
    type: DataTypes.ENUM('general', 'greeting', 'product', 'zip', 'design', 'frustration', 'correction', 'pattern'),
    defaultValue: 'general'
  },
  trigger_example: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Ejemplo del mensaje del cliente que generó esta lección'
  },
  bot_response_example: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Qué respondió el bot (si fue auto-detectado)'
  },
  agent_correction: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Qué escribió el agente para corregir (si aplica)'
  },
  source: {
    type: DataTypes.ENUM('manual', 'auto_detected'),
    defaultValue: 'manual'
  },
  is_approved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Las auto-detectadas requieren aprobación antes de activarse'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  times_applied: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  contact_id: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'ID del contacto de Respond.io donde se originó (si aplica)'
  }
}, {
  tableName: 'bot_memories',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default BotMemory;
