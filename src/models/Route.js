import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Route = sequelize.define('Route', {
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
  name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  is_optimized: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  total_distance: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  total_duration: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'draft'
  },
  start_address: {
    type: DataTypes.STRING(300),
    allowNull: true
  },
  start_lat: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  start_lng: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  end_address: {
    type: DataTypes.STRING(300),
    allowNull: true
  },
  end_lat: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  end_lng: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  return_to_start: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  vehicle_type: {
    type: DataTypes.STRING(20),
    defaultValue: 'car'
  },
  optimization_mode: {
    type: DataTypes.STRING(20),
    defaultValue: 'fastest'
  },
  scheduled_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'routes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default Route;
