import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

const UserToken = sequelize.define('UserToken', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  token: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
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
