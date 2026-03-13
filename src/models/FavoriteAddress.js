import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const FavoriteAddress = sequelize.define('FavoriteAddress', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  address: { type: DataTypes.STRING(500), allowNull: true },
  lat: { type: DataTypes.FLOAT, allowNull: true },
  lng: { type: DataTypes.FLOAT, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  customer_phone: { type: DataTypes.STRING(50), allowNull: true },
}, {
  tableName: 'favorite_addresses',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

FavoriteAddress.prototype.toDict = function() {
  return {
    id: this.id,
    name: this.name,
    address: this.address,
    lat: this.lat,
    lng: this.lng,
    notes: this.notes,
    customer_phone: this.customer_phone,
    created_at: this.created_at,
    updated_at: this.updated_at,
  };
};

export default FavoriteAddress;
