import { DataTypes } from 'sequelize';
import bcrypt from 'bcryptjs';
import sequelize from '../config/database.js';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(80),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(120),
    unique: true,
    allowNull: false
  },
  password_hash: {
    type: DataTypes.STRING(256),
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  document: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  address: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  google_id: {
    type: DataTypes.STRING(100),
    unique: true,
    allowNull: true
  },
  profile_picture: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  subscription_type: {
    type: DataTypes.STRING(20),
    defaultValue: 'free'
  },
  subscription_expires: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

User.prototype.setPassword = async function(password) {
  this.password_hash = await bcrypt.hash(password, 10);
};

User.prototype.checkPassword = async function(password) {
  if (!this.password_hash) return false;
  return bcrypt.compare(password, this.password_hash);
};

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
    created_at: this.created_at
  };
};

export default User;
