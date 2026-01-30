import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CoverageZone = sequelize.define('CoverageZone', {
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
  zip_code: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  zone_name: {
    type: DataTypes.STRING(100),
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
  country: {
    type: DataTypes.STRING(50),
    defaultValue: 'US'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  delivery_fee: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  min_order_amount: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  estimated_delivery_time: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'coverage_zones',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'zip_code']
    }
  ]
});

CoverageZone.prototype.toDict = function() {
  return {
    id: this.id,
    user_id: this.user_id,
    zip_code: this.zip_code,
    zone_name: this.zone_name,
    city: this.city,
    state: this.state,
    country: this.country,
    is_active: this.is_active,
    delivery_fee: this.delivery_fee,
    min_order_amount: this.min_order_amount,
    estimated_delivery_time: this.estimated_delivery_time,
    notes: this.notes,
    created_at: this.created_at,
    updated_at: this.updated_at
  };
};

export default CoverageZone;
