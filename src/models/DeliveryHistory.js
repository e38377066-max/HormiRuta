import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const DeliveryHistory = sequelize.define('DeliveryHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  original_order_id: {
    type: DataTypes.INTEGER,
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
  address: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  state: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  driver_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  driver_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  commission_per_stop: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  order_cost: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  deposit_amount: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  total_to_collect: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  amount_collected: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  payment_method: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  payment_status: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  delivered_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  month_year: {
    type: DataTypes.STRING(7),
    allowNull: false
  },
  archived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'delivery_history',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default DeliveryHistory;
