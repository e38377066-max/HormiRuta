/**
 * @fileoverview Definición del modelo de Zona de Cobertura (CoverageZone).
 * Define los códigos postales donde el servicio está disponible y sus costos asociados.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Modelo CoverageZone para gestionar áreas de servicio.
 */
const CoverageZone = sequelize.define('CoverageZone', {
  /** ID único autoincremental */
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  /** ID del usuario (admin) dueño de la zona */
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  /** Código postal que define la zona */
  zip_code: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  /** Nombre amigable de la zona (ej: 'Centro', 'Norte') */
  zone_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Ciudad a la que pertenece el ZIP */
  city: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Estado/Provincia */
  state: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  /** País (por defecto 'US') */
  country: {
    type: DataTypes.STRING(50),
    defaultValue: 'US'
  },
  /** Indica si la zona está activa para recibir pedidos */
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  /** Costo de envío específico para esta zona */
  delivery_fee: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  /** Monto mínimo de pedido para habilitar entrega en esta zona */
  min_order_amount: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  /** Tiempo de entrega estimado en minutos */
  estimated_delivery_time: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  /** Notas internas sobre la zona */
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

/**
 * @description Convierte la instancia de la zona a un objeto plano.
 * @returns {Object} Diccionario con los datos de la zona de cobertura.
 */
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
