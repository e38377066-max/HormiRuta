import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const WholesaleClient = sequelize.define('WholesaleClient', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  respond_contact_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  customer_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: 'Nombre completo como aparece en Respond (ej: Irelda -MAY Selene)'
  },
  customer_phone: {
    type: DataTypes.STRING(50),
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
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  last_pickup_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Ultima vez que se puso en Pickup Ready'
  },
  pickup_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total historico de veces que ha pasado por Pickup Ready'
  }
}, {
  tableName: 'wholesale_clients',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default WholesaleClient;
