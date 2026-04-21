import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CustomerProfile = sequelize.define('CustomerProfile', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  contact_id: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  contact_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Resumen narrativo del cliente (quién es, qué pide, cómo trato darle)'
  },
  preferences: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Preferencias detectadas: tono, idioma, productos favoritos, formas de pago'
  },
  past_products: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Productos que ha comprado o pedido en el pasado'
  },
  zip_code: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notas adicionales para el bot (ej: "siempre pregunta por descuento", "responde tarde")'
  },
  total_conversations: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  last_conversation_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
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
