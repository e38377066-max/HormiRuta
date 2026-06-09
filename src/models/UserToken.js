/**
 * @fileoverview Definición del modelo de Token de Usuario (UserToken).
 * Almacena los tokens de sesión activos para la autenticación persistente.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/** Tiempo máximo de vida de un token (1 año) */
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Modelo UserToken para gestionar sesiones de usuario.
 */
const UserToken = sequelize.define('UserToken', {
  /** ID único autoincremental */
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  /** El string del token aleatorio */
  token: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true
  },
  /** ID del usuario dueño del token */
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  /** Fecha de creación en milisegundos (Unix timestamp) */
  created_at_ms: {
    type: DataTypes.BIGINT,
    allowNull: false
  }
}, {
  tableName: 'user_tokens',
  timestamps: false
});

UserToken.MAX_AGE_MS = MAX_AGE_MS;

export default UserToken;
