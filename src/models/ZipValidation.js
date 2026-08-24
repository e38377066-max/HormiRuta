import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Historial persistente de validaciones realizadas desde el validador SMS
 * público o desde la pantalla administrativa.
 */
const ZipValidation = sequelize.define('ZipValidation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: true },
  contact_id: { type: DataTypes.STRING(100), allowNull: true },
  contact_name: { type: DataTypes.STRING(255), allowNull: true },
  contact_phone: { type: DataTypes.STRING(50), allowNull: true },
  source: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'unknown' },
  input: { type: DataTypes.STRING(500), allowNull: false },
  value: { type: DataTypes.STRING(100), allowNull: true },
  validation_type: { type: DataTypes.STRING(30), allowNull: true },
  valid: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  zone_id: { type: DataTypes.INTEGER, allowNull: true },
  zone_snapshot: { type: DataTypes.JSON, allowNull: true },
  message: { type: DataTypes.STRING(500), allowNull: true },
  copy_message: { type: DataTypes.TEXT, allowNull: true },
  metadata: { type: DataTypes.JSON, allowNull: true }
}, {
  tableName: 'zip_validations',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['contact_id'] },
    { fields: ['source'] },
    { fields: ['created_at'] }
  ]
});

ZipValidation.prototype.toDict = function() {
  return {
    id: this.id,
    contact_id: this.contact_id,
    contact_name: this.contact_name,
    contact_phone: this.contact_phone,
    source: this.source,
    input: this.input,
    value: this.value,
    type: this.validation_type,
    valid: this.valid,
    covered: this.valid,
    zone: this.zone_snapshot,
    message: this.message,
    copyMessage: this.copy_message,
    metadata: this.metadata,
    created_at: this.created_at,
    updated_at: this.updated_at
  };
};

export default ZipValidation;