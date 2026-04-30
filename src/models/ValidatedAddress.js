import { DataTypes, Op } from 'sequelize';
import sequelize from '../config/database.js';

const ValidatedAddress = sequelize.define('ValidatedAddress', {
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
  customer_name: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  customer_phone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  original_address: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  validated_address: {
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
  city: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  state: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  confidence: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  source: {
    type: DataTypes.STRING(30),
    defaultValue: 'scanner'
  },
  dispatch_status: {
    type: DataTypes.STRING(30),
    defaultValue: 'available'
  },
  order_status: {
    type: DataTypes.STRING(30),
    defaultValue: 'approved'
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  assigned_driver_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  driver_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  route_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  delivered_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
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
  },
  apartment_number: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null
  },
  pickup_email_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null,
    comment: 'Gmail messageId del correo 4over Pickup Ready que marco esta orden. Se usa para no reprocesar correos ya procesados.'
  }
}, {
  tableName: 'validated_addresses',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'respond_contact_id'],
      where: { respond_contact_id: { [Op.ne]: null } },
      name: 'unique_user_contact'
    }
  ]
});

ValidatedAddress.prototype.toDict = function() {
  return {
    id: this.id,
    user_id: this.user_id,
    respond_contact_id: this.respond_contact_id,
    customer_name: this.customer_name,
    customer_phone: this.customer_phone,
    original_address: this.original_address,
    validated_address: this.validated_address,
    address: this.validated_address,
    address_lat: this.address_lat,
    address_lng: this.address_lng,
    zip_code: this.zip_code,
    city: this.city,
    state: this.state,
    confidence: this.confidence,
    source: this.source,
    dispatch_status: this.dispatch_status,
    order_status: this.order_status,
    amount: this.amount,
    assigned_driver_id: this.assigned_driver_id,
    driver_name: this.driver_name,
    route_id: this.route_id,
    delivered_at: this.delivered_at,
    notes: this.notes,
    order_cost: this.order_cost,
    deposit_amount: this.deposit_amount,
    total_to_collect: this.total_to_collect,
    payment_method: this.payment_method,
    amount_collected: this.amount_collected,
    payment_status: this.payment_status,
    apartment_number: this.apartment_number,
    pickup_email_id: this.pickup_email_id,
    created_at: this.created_at,
    updated_at: this.updated_at
  };
};

export default ValidatedAddress;
