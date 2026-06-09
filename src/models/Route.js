/**
 * @fileoverview Definición del modelo de Ruta (Route).
 * Representa una secuencia de paradas planificada para un conductor.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Modelo Route para gestionar la planificación de entregas.
 */
const Route = sequelize.define('Route', {
  /** ID único autoincremental */
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  /** ID del usuario que creó o es dueño de la ruta */
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  /** Nombre descriptivo de la ruta */
  name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Indica si la ruta ha sido optimizada algorítmicamente */
  is_optimized: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  /** Distancia total de la ruta en km o millas */
  total_distance: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  /** Duración total estimada en segundos */
  total_duration: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  /** Estado actual de la ruta (ej: 'draft', 'active', 'completed') */
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'draft'
  },
  /** Dirección del punto de partida */
  start_address: {
    type: DataTypes.STRING(300),
    allowNull: true
  },
  /** Latitud del punto de partida */
  start_lat: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  /** Longitud del punto de partida */
  start_lng: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  /** Dirección del punto de llegada (finalización) */
  end_address: {
    type: DataTypes.STRING(300),
    allowNull: true
  },
  /** Latitud del punto de llegada */
  end_lat: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  /** Longitud del punto de llegada */
  end_lng: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  /** Indica si la ruta debe terminar donde empezó */
  return_to_start: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  /** Tipo de vehículo utilizado (ej: 'car', 'van', 'bike') */
  vehicle_type: {
    type: DataTypes.STRING(20),
    defaultValue: 'car'
  },
  /** Modo de optimización (ej: 'fastest', 'shortest') */
  optimization_mode: {
    type: DataTypes.STRING(20),
    defaultValue: 'fastest'
  },
  /** Fecha programada para la ruta */
  scheduled_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  /** Fecha y hora exacta en que inició la ruta */
  started_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** Fecha y hora exacta en que se completó la ruta */
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** ID del conductor asignado a esta ruta */
  assigned_driver_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  /** Indica si el pago de la ruta ya fue entregado al administrador */
  payment_delivered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  /** Método de entrega del dinero (ej: 'cash', 'zelle') */
  payment_delivery_method: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  /** Fecha y hora de entrega del pago */
  payment_delivered_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** Monto total recolectado en esta ruta por el conductor */
  route_total_collected: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  /** Confirmación del administrador de que recibió el dinero */
  admin_confirmed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  /** Monto exacto recibido por el administrador */
  admin_amount_received: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  /** Registros detallados de pagos recibidos por el admin (historial parcial) */
  admin_payment_records: {
    type: DataTypes.JSON,
    defaultValue: []
  }
}, {
  tableName: 'routes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default Route;
