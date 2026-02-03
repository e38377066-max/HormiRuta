import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ServiceAgent = sequelize.define('ServiceAgent', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  agent_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'ID del agente en Respond.io'
  },
  agent_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  agent_email: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  service_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Nombre del servicio: Area 862, IprintPOS, etc.'
  },
  products: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Lista de productos que maneja este agente'
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
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
