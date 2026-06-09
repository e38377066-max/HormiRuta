/**
 * @fileoverview Definición del modelo de Historial de Rutas (RouteHistory).
 * Almacena un resumen de las rutas completadas para reportes y estadísticas.
 */

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Modelo RouteHistory para archivar datos de rutas finalizadas.
 */
const RouteHistory = sequelize.define('RouteHistory', {
  /** ID único autoincremental */
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  /** ID del usuario dueño de la ruta */
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  /** Nombre que tenía la ruta al ser archivada */
  route_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  /** Cantidad total de paradas en la ruta */
  total_stops: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  /** Cantidad de paradas marcadas como completadas */
  completed_stops: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  /** Cantidad de paradas marcadas como fallidas */
  failed_stops: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  /** Distancia total recorrida en km o millas */
  total_distance: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  /** Duración total de la ejecución en segundos */
  total_duration: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  /** Fecha y hora de inicio de la ruta */
  started_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** Fecha y hora de finalización de la ruta */
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  /** Snapshot completo de los datos de la ruta y sus paradas en formato JSON */
  route_data: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'route_history',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

/**
 * @description Convierte la instancia del historial a un objeto plano.
 * @returns {Object} Diccionario con los datos del historial de la ruta.
 */
RouteHistory.prototype.toDict = function() {
  return {
    id: this.id,
    user_id: this.user_id,
    route_name: this.route_name,
    total_stops: this.total_stops,
    completed_stops: this.completed_stops,
    failed_stops: this.failed_stops,
    total_distance: this.total_distance,
    total_duration: this.total_duration,
    started_at: this.started_at,
    completed_at: this.completed_at,
    route_data: this.route_data,
    created_at: this.created_at
  };
};

export default RouteHistory;
