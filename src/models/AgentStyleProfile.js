import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AgentStyleProfile = sequelize.define('AgentStyleProfile', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  style_summary: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descripción del estilo de los agentes humanos (tono, formalidad, ritmo)'
  },
  common_phrases: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Frases típicas que usan los agentes (saludos, cierres, transiciones)'
  },
  emoji_usage: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Cómo usan emojis: cuáles, con qué frecuencia, en qué contexto'
  },
  closing_techniques: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Cómo cierran ventas: ofertas, urgencia, llamadas a la acción'
  },
  do_phrases: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Frases ejemplares que el bot debería imitar'
  },
  dont_phrases: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Frases que el bot debería evitar (muy robóticas, formales, etc.)'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  messages_analyzed: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
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
