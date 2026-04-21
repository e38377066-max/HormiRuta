import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const MessageLog = sequelize.define('MessageLog', {
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
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'messaging_orders',
      key: 'id'
    }
  },
  respond_contact_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  respond_message_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  contact_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  contact_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  contact_phone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  channel: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  direction: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  message_type: {
    type: DataTypes.STRING(30),
    defaultValue: 'text'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  message_content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  processed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  channel_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(30),
    defaultValue: 'sent'
  },
  is_automated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  automation_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  error_message: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'message_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

MessageLog.prototype.toDict = function() {
  return {
    id: this.id,
    user_id: this.user_id,
    order_id: this.order_id,
    respond_contact_id: this.respond_contact_id,
    respond_message_id: this.respond_message_id,
    direction: this.direction,
    message_type: this.message_type,
    content: this.content,
    channel_type: this.channel_type,
    status: this.status,
    is_automated: this.is_automated,
    automation_type: this.automation_type,
    error_message: this.error_message,
    metadata: this.metadata,
    created_at: this.created_at,
    updated_at: this.updated_at
  };
};

export default MessageLog;
