/**
 * @fileoverview Definición del modelo de Dirección Validada (ValidatedAddress).
 * Almacena direcciones que han pasado por el proceso de geocodificación y validación de cobertura.
 */

import { DataTypes, Op } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Modelo ValidatedAddress para gestionar el despacho de órdenes validadas.
 */
const ValidatedAddress = sequelize.define('ValidatedAddress', {
  /** ID único autoincremental */
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  /** ID del usuario (admin) que posee el registro */
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  /** ID del contacto en Respond.io (si se originó de un chat) */
  respond_contact_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Nombre del cliente */
  customer_name: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  /** Teléfono del cliente */
  customer_phone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  /** Dirección tal cual fue ingresada por el cliente/agente */
  original_address: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  /** Dirección normalizada devuelta por el servicio de geocoding */
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
  /** Código postal detectado */
  zip_code: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  /** Ciudad detectada */
  city: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Estado/Provincia detectado */
  state: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  /** Nivel de confianza de la validación (ej: 'high', 'medium') */
  confidence: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  /** Fuente de donde se extrajo la dirección (ej: 'scanner', 'manual', 'respond') */
  source: {
    type: DataTypes.STRING(30),
    defaultValue: 'scanner'
  },
  /** Estado de despacho (ej: 'available', 'assigned', 'delivered') */
  dispatch_status: {
    type: DataTypes.STRING(30),
    defaultValue: 'available'
  },
  /** Estado de aprobación de la orden (ej: 'approved', 'pending') */
  order_status: {
    type: DataTypes.STRING(30),
    defaultValue: 'approved'
  },
  /** Monto del pedido */
  amount: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  /** ID del conductor asignado para el despacho */
  assigned_driver_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  /** Nombre del conductor asignado (cache) */
  driver_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** ID de la ruta en la que se incluyó esta dirección */
  route_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  /** Fecha y hora de entrega real */
  delivered_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** Notas adicionales para el repartidor */
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  /** Costo del producto */
  order_cost: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  /** Monto de depósito previo */
  deposit_amount: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  /** Monto total a recolectar en sitio */
  total_to_collect: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  /** Método de pago preferido/usado */
  payment_method: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  /** Monto real recolectado por el repartidor */
  amount_collected: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  },
  /** Estado del pago del pedido */
  payment_status: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'pending'
  },
  /** Número de departamento o suite */
  apartment_number: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: null
  },
  /** ID del mensaje de Gmail que originó este registro (para órdenes de 4over) */
  pickup_email_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null
  },
  /** Disposición actual del paquete (ej: 'normal', 'held_by_driver', 'returned_to_office') */
  package_disposition: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'normal'
  },
  /** ID del conductor que retiene el paquete si no se pudo entregar */
  held_by_driver_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' }
  },
  /** Razón por la cual se saltó esta entrega */
  skip_reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  /** Fecha y hora en que se marcó como saltada */
  skipped_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** Fecha y hora en que el paquete fue devuelto a la oficina */
  returned_at: {
    type: DataTypes.DATE,
    allowNull: true
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

/**
 * @description Convierte la instancia de la dirección validada a un objeto plano.
 * @returns {Object} Diccionario con los datos de la dirección validada.
 */
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
    package_disposition: this.package_disposition,
    held_by_driver_id: this.held_by_driver_id,
    skip_reason: this.skip_reason,
    skipped_at: this.skipped_at,
    returned_at: this.returned_at,
    created_at: this.created_at,
    updated_at: this.updated_at
  };
};

export default ValidatedAddress;
