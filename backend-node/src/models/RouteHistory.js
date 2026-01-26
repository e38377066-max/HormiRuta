import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const RouteHistory = sequelize.define('RouteHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  route_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  total_stops: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  completed_stops: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  failed_stops: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  total_distance: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  total_duration: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
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
