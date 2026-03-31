import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const BotKnowledge = sequelize.define('BotKnowledge', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  knowledge_type: {
    type: DataTypes.ENUM('document', 'prompt', 'instruction', 'product_info', 'faq'),
    defaultValue: 'document'
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
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
