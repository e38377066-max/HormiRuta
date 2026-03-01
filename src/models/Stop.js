import { DataTypes } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import sequelize from '../config/database.js';

const Stop = sequelize.define('Stop', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  unique_id: {
    type: DataTypes.STRING(36),
    unique: true,
    defaultValue: () => uuidv4()
  },
  route_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'routes',
      key: 'id'
    }
  },
  address: {
    type: DataTypes.STRING(300),
    allowNull: false
  },
  lat: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  lng: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  original_order: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  customer_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  time_window_start: {
    type: DataTypes.TIME,
    allowNull: true
  },
  time_window_end: {
    type: DataTypes.TIME,
    allowNull: true
  },
  duration: {
    type: DataTypes.INTEGER,
    defaultValue: 5
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending'
  },
  eta: {
    type: DataTypes.DATE,
    allowNull: true
  },
  distance_from_prev: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  duration_from_prev: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  package_location: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  package_count: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  delivery_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  recipient_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  failed_reason: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  arrived_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  signature_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  photo_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  order_cost: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  deposit_amount: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  total_to_collect: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  payment_method: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  amount_collected: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  payment_status: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'pending'
  }
}, {
  tableName: 'stops',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

Stop.prototype.toDict = function() {
  return {
    id: this.id,
    unique_id: this.unique_id,
    route_id: this.route_id,
    address: this.address,
    lat: this.lat,
    lng: this.lng,
    order: this.order,
    original_order: this.original_order,
    note: this.note,
    phone: this.phone,
    customer_name: this.customer_name,
    priority: this.priority,
    time_window_start: this.time_window_start,
    time_window_end: this.time_window_end,
    duration: this.duration,
    status: this.status,
    eta: this.eta,
    distance_from_prev: this.distance_from_prev,
    duration_from_prev: this.duration_from_prev,
    package_location: this.package_location,
    package_count: this.package_count,
    delivery_notes: this.delivery_notes,
    recipient_name: this.recipient_name,
    failed_reason: this.failed_reason,
    arrived_at: this.arrived_at,
    completed_at: this.completed_at,
    signature_url: this.signature_url,
    photo_url: this.photo_url,
    order_cost: this.order_cost,
    deposit_amount: this.deposit_amount,
    total_to_collect: this.total_to_collect,
    payment_method: this.payment_method,
    amount_collected: this.amount_collected,
    payment_status: this.payment_status
  };
};

export default Stop;
