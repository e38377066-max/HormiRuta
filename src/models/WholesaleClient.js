/**
 * @fileoverview Definición del modelo de Cliente Mayorista (WholesaleClient).
 * Gestiona clientes que realizan pedidos recurrentes o de gran volumen.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Modelo WholesaleClient para rastreo de clientes mayoristas y su actividad.
 */
const WholesaleClient = sequelize.define('WholesaleClient', {
  /** ID único autoincremental */
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  /** ID del usuario (admin) que gestiona este cliente */
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  /** ID del contacto en Respond.io */
  respond_contact_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Nombre completo del cliente mayorista */
  customer_name: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  /** Teléfono de contacto */
  customer_phone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  /** Dirección física validada para entregas mayoristas */
  validated_address: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  /** Latitud geográfica */
  address_lat: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  /** Longitud geográfica */
  address_lng: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  /** Código postal */
  zip_code: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  /** Ciudad */
  city: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Estado/Provincia */
  state: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  /** Notas internas sobre el cliente mayorista */
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  /** Indica si el cliente mayorista está activo en el sistema */
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  /** Fecha y hora de la última vez que tuvo un pedido listo para recogida */
  last_pickup_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** Contador histórico de pedidos procesados para este cliente */
  pickup_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'wholesale_clients',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default WholesaleClient;
