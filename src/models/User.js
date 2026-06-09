/**
 * @fileoverview Definición del modelo de Usuario (User).
 * Representa a los usuarios del sistema, incluyendo administradores, clientes y conductores.
 */

import { DataTypes } from 'sequelize';
import bcrypt from 'bcryptjs';
import sequelize from '../config/database.js';

/**
 * Modelo User para gestionar la autenticación y perfiles.
 */
const User = sequelize.define('User', {
  /** ID único autoincremental */
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  /** Nombre de usuario para mostrar y login */
  username: {
    type: DataTypes.STRING(80),
    allowNull: false
  },
  /** Correo electrónico único */
  email: {
    type: DataTypes.STRING(120),
    unique: true,
    allowNull: false
  },
  /** Hash de la contraseña (bcrypt) */
  password_hash: {
    type: DataTypes.STRING(256),
    allowNull: true
  },
  /** Número de teléfono de contacto */
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  /** Documento de identidad o identificación fiscal */
  document: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  /** Dirección física del usuario */
  address: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  /** ID de Google para autenticación OAuth */
  google_id: {
    type: DataTypes.STRING(100),
    unique: true,
    allowNull: true
  },
  /** URL de la imagen de perfil */
  profile_picture: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  /** Indica si la cuenta está activa */
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  /** Tipo de suscripción (ej: 'free', 'premium') */
  subscription_type: {
    type: DataTypes.STRING(20),
    defaultValue: 'free'
  },
  /** Fecha de expiración de la suscripción */
  subscription_expires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** Rol del usuario en el sistema */
  role: {
    type: DataTypes.ENUM('admin', 'client', 'driver'),
    defaultValue: 'client',
    allowNull: false
  },
  /** Comisión fija por cada parada completada (para conductores) */
  commission_per_stop: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

/**
 * @description Hashea una contraseña y la asigna al campo password_hash.
 * @param {string} password - Contraseña en texto plano.
 * @returns {Promise<void>}
 */
User.prototype.setPassword = async function(password) {
  this.password_hash = await bcrypt.hash(password, 10);
};

/**
 * @description Compara una contraseña en texto plano con el hash almacenado.
 * @param {string} password - Contraseña a verificar.
 * @returns {Promise<boolean>} True si coincide, false en caso contrario.
 */
User.prototype.checkPassword = async function(password) {
  if (!this.password_hash) return false;
  return bcrypt.compare(password, this.password_hash);
};

/**
 * @description Convierte la instancia del usuario a un objeto plano para API, omitiendo datos sensibles.
 * @returns {Object} Diccionario con datos del usuario.
 */
User.prototype.toDict = function() {
  return {
    id: this.id,
    username: this.username,
    email: this.email,
    phone: this.phone,
    document: this.document,
    address: this.address,
    profile_picture: this.profile_picture,
    subscription_type: this.subscription_type,
    subscription_expires: this.subscription_expires,
    role: this.role,
    active: this.active,
    commission_per_stop: this.commission_per_stop,
    created_at: this.created_at
  };
};

export default User;
