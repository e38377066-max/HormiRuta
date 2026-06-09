/**
 * @fileoverview Definición del modelo de Perfil de Estilo del Agente (AgentStyleProfile).
 * Almacena el ADN de comunicación de los agentes humanos para que el bot pueda imitarlos.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Modelo AgentStyleProfile para definir la personalidad de la IA.
 */
const AgentStyleProfile = sequelize.define('AgentStyleProfile', {
  /** ID único autoincremental */
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  /** ID del usuario administrador dueño del perfil de estilo */
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  /** Resumen de la personalidad, tono y ritmo de los agentes humanos */
  style_summary: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  /** Listado de frases comunes, saludos y muletillas usadas por los agentes */
  common_phrases: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  /** Descripción del uso de emojis por parte de los agentes humanos */
  emoji_usage: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  /** Técnicas de cierre de ventas detectadas en las conversaciones humanas */
  closing_techniques: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  /** Ejemplos de frases que el bot DEBE decir para sonar humano */
  do_phrases: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  /** Ejemplos de frases que el bot NO DEBE decir por sonar robóticas */
  dont_phrases: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  /** Indica si este perfil de estilo está activo y se aplica a la IA */
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  /** Cantidad total de mensajes analizados para construir este perfil */
  messages_analyzed: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  /** Fecha y hora del último análisis de estilo realizado */
  last_analyzed_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'agent_style_profiles',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default AgentStyleProfile;
