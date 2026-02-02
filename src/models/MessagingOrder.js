import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const MessagingOrder = sequelize.define('MessagingOrder', {
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
  respond_contact_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  respond_conversation_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  channel_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  channel_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  customer_name: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  customer_phone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  customer_email: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  address: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  address_lat: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  address_lng: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  zip_code: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  address_type: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(30),
    defaultValue: 'pending'
  },
  validation_status: {
    type: DataTypes.STRING(30),
    defaultValue: 'pending'
  },
  validation_message: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  assigned_driver_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  route_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'routes',
      key: 'id'
    }
  },
  stop_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'stops',
      key: 'id'
    }
  },
  assigned_agent_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  agent_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  scheduled_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  scheduled_time_start: {
    type: DataTypes.TIME,
    allowNull: true
  },
  scheduled_time_end: {
    type: DataTypes.TIME,
    allowNull: true
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancelled_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancel_reason: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  lifecycle: {
    type: DataTypes.STRING(50),
    allowNull: true
  }
}, {
  tableName: 'messaging_orders',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

MessagingOrder.prototype.toDict = function() {
  return {
    id: this.id,
    user_id: this.user_id,
    respond_contact_id: this.respond_contact_id,
    respond_conversation_id: this.respond_conversation_id,
    channel_id: this.channel_id,
    channel_type: this.channel_type,
    customer_name: this.customer_name,
    customer_phone: this.customer_phone,
    customer_email: this.customer_email,
    address: this.address,
    address_lat: this.address_lat,
    address_lng: this.address_lng,
    zip_code: this.zip_code,
    address_type: this.address_type,
    notes: this.notes,
    status: this.status,
    validation_status: this.validation_status,
    validation_message: this.validation_message,
    assigned_driver_id: this.assigned_driver_id,
    route_id: this.route_id,
    stop_id: this.stop_id,
    assigned_agent_id: this.assigned_agent_id,
    agent_name: this.agent_name,
    scheduled_date: this.scheduled_date,
    scheduled_time_start: this.scheduled_time_start,
    scheduled_time_end: this.scheduled_time_end,
    completed_at: this.completed_at,
    cancelled_at: this.cancelled_at,
    cancel_reason: this.cancel_reason,
    lifecycle: this.lifecycle,
    created_at: this.created_at,
    updated_at: this.updated_at
  };
};

export default MessagingOrder;
