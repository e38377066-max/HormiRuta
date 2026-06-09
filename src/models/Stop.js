/**
 * @fileoverview Definición del modelo de Parada (Stop).
 * Representa un punto de entrega específico dentro de una ruta.
 */

import { DataTypes } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import sequelize from '../config/database.js';

/**
 * Modelo Stop para gestionar los destinos de una ruta.
 */
const Stop = sequelize.define('Stop', {
  /** ID único autoincremental */
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  /** Identificador único universal (UUID) para uso externo/cliente */
  unique_id: {
    type: DataTypes.STRING(36),
    unique: true,
    defaultValue: () => uuidv4()
  },
  /** ID de la ruta a la que pertenece esta parada */
  route_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'routes',
      key: 'id'
    }
  },
  /** Dirección completa de la parada */
  address: {
    type: DataTypes.STRING(300),
    allowNull: false
  },
  /** Latitud geográfica */
  lat: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  /** Longitud geográfica */
  lng: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  /** Orden de visita dentro de la ruta (0-indexed) */
  order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  /** Posición original antes de la optimización */
  original_order: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  /** Nota general sobre la parada */
  note: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  /** Teléfono de contacto del cliente en esta parada */
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  /** Nombre del cliente */
  customer_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Prioridad de la parada (valores altos = mayor prioridad) */
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  /** Inicio de la ventana de tiempo de entrega */
  time_window_start: {
    type: DataTypes.TIME,
    allowNull: true
  },
  /** Fin de la ventana de tiempo de entrega */
  time_window_end: {
    type: DataTypes.TIME,
    allowNull: true
  },
  /** Tiempo estimado de estancia en la parada (minutos) */
  duration: {
    type: DataTypes.INTEGER,
    defaultValue: 5
  },
  /** Estado de la entrega (ej: 'pending', 'arrived', 'completed', 'failed') */
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending'
  },
  /** Hora estimada de llegada (ETA) calculada */
  eta: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** Distancia desde la parada anterior (km/millas) */
  distance_from_prev: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  /** Tiempo de viaje desde la parada anterior (segundos) */
  duration_from_prev: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  /** Ubicación física del paquete (ej: 'asiento trasero') */
  package_location: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Cantidad de paquetes a entregar */
  package_count: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  /** Notas específicas tomadas durante la entrega */
  delivery_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  /** Nombre de quien recibió el paquete */
  recipient_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Razón por la cual falló la entrega */
  failed_reason: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  /** Fecha y hora de llegada al punto */
  arrived_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** Fecha y hora de finalización de la parada */
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** URL de la imagen de la firma del cliente */
  signature_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  /** URL de la foto de evidencia de entrega */
  photo_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  /** Costo del producto/servicio */
  order_cost: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  /** Monto ya pagado por adelantado */
  deposit_amount: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  /** Monto total que el conductor debe cobrar */
  total_to_collect: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  /** Método de pago (ej: 'cash', 'zelle', 'card') */
  payment_method: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  /** Monto real recolectado por el conductor */
  amount_collected: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  /** Estado del pago (ej: 'pending', 'paid', 'partially_paid') */
  payment_status: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'pending'
  },
  /** Número de apartamento o suite */
  apartment_number: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'stops',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

/**
 * @description Convierte la instancia de la parada a un objeto plano.
 * @returns {Object} Diccionario con los datos de la parada.
 */
Stop.prototype.toDict = function() {
  return {
    id: this.id,
    unique_id: this.unique_id,
    route_id: this.route_id,
    address: this.address,
    lat: this.lat,
    lng: this.lng,
    order: this.order,
    original_order: this.original_order,
    note: this.note,
    phone: this.phone,
    customer_name: this.customer_name,
    priority: this.priority,
    time_window_start: this.time_window_start,
    time_window_end: this.time_window_end,
    duration: this.duration,
    status: this.status,
    eta: this.eta,
    distance_from_prev: this.distance_from_prev,
    duration_from_prev: this.duration_from_prev,
    package_location: this.package_location,
    package_count: this.package_count,
    delivery_notes: this.delivery_notes,
    recipient_name: this.recipient_name,
    failed_reason: this.failed_reason,
    arrived_at: this.arrived_at,
    completed_at: this.completed_at,
    signature_url: this.signature_url,
    photo_url: this.photo_url,
    order_cost: this.order_cost,
    deposit_amount: this.deposit_amount,
    total_to_collect: this.total_to_collect,
    payment_method: this.payment_method,
    amount_collected: this.amount_collected,
    payment_status: this.payment_status,
    apartment_number: this.apartment_number
  };
};

export default Stop;
