/**
 * @fileoverview Definición del modelo de Dirección Favorita (FavoriteAddress).
 * Permite a los usuarios guardar direcciones frecuentes para un acceso rápido.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Modelo FavoriteAddress para gestionar marcadores de direcciones.
 */
const FavoriteAddress = sequelize.define('FavoriteAddress', {
  /** ID único autoincremental */
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  /** Nombre descriptivo del favorito (ej: 'Casa', 'Oficina') */
  name: { type: DataTypes.STRING(200), allowNull: false },
  /** Dirección completa almacenada */
  address: { type: DataTypes.STRING(500), allowNull: true },
  /** Latitud geográfica */
  lat: { type: DataTypes.FLOAT, allowNull: true },
  /** Longitud geográfica */
  lng: { type: DataTypes.FLOAT, allowNull: true },
  /** Notas adicionales sobre la dirección */
  notes: { type: DataTypes.TEXT, allowNull: true },
  /** Teléfono del cliente asociado a esta dirección favorita */
  customer_phone: { type: DataTypes.STRING(50), allowNull: true },
}, {
  tableName: 'favorite_addresses',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

/**
 * @description Convierte la instancia del favorito a un objeto plano.
 * @returns {Object} Diccionario con los datos de la dirección favorita.
 */
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
