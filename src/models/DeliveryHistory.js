/**
 * @fileoverview Definición del modelo de Historial de Entregas (DeliveryHistory).
 * Almacena instantáneas de cada entrega realizada para reportes de contabilidad y rendimiento.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Modelo DeliveryHistory para auditoría de entregas finalizadas.
 */
const DeliveryHistory = sequelize.define('DeliveryHistory', {
  /** ID único autoincremental */
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  /** ID de la orden original que generó esta entrega */
  original_order_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  /** Nombre del cliente al momento de la entrega */
  customer_name: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  /** Teléfono del cliente */
  customer_phone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  /** Dirección de entrega final */
  address: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  /** Ciudad de entrega */
  city: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Estado/Provincia */
  state: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  /** ID del conductor que realizó la entrega */
  driver_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  /** Nombre del conductor */
  driver_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Comisión pagada al conductor por esta parada */
  commission_per_stop: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  /** Costo base de la orden */
  order_cost: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  /** Monto de depósito recibido */
  deposit_amount: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  /** Monto total que se debía recolectar */
  total_to_collect: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  /** Monto real recolectado por el conductor */
  amount_collected: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  /** Método de pago utilizado (ej: 'cash', 'zelle') */
  payment_method: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  /** Estado final del pago */
  payment_status: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  /** Fecha y hora exacta de la entrega */
  delivered_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** Periodo de la entrega en formato YYYY-MM para reportes mensuales */
  month_year: {
    type: DataTypes.STRING(7),
    allowNull: false
  },
  /** Indica si el registro ha sido archivado/procesado en contabilidad */
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
