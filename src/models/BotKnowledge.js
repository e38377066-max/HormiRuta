/**
 * @fileoverview Definición del modelo de Conocimiento del Bot (BotKnowledge).
 * Almacena documentos, FAQs y reglas de negocio fijas que el bot utiliza como base de conocimientos.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Modelo BotKnowledge para gestionar la base de conocimientos estática de la IA.
 */
const BotKnowledge = sequelize.define('BotKnowledge', {
  /** ID único autoincremental */
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  /** ID del usuario administrador dueño del conocimiento */
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  /** Título o nombre descriptivo del fragmento de conocimiento */
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  /** El contenido textual que el bot debe conocer */
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  /** Clasificación del tipo de conocimiento */
  knowledge_type: {
    type: DataTypes.ENUM('document', 'prompt', 'instruction', 'product_info', 'faq'),
    defaultValue: 'document'
  },
  /** Nombre del archivo original (si fue cargado desde un documento) */
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  /** Indica si esta pieza de conocimiento está activa para ser usada por el bot */
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'bot_knowledge',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default BotKnowledge;
