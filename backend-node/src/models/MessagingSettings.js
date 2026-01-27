import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const MessagingSettings = sequelize.define('MessagingSettings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  respond_api_token: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  auto_validate_addresses: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  auto_respond_coverage: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  auto_respond_no_coverage: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  no_coverage_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Lo sentimos, actualmente no tenemos cobertura en tu zona. Te notificaremos cuando ampliemos nuestra area de servicio.'
  },
  coverage_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Tu direccion esta dentro de nuestra zona de cobertura. Tu pedido ha sido registrado y pronto sera asignado a un repartidor.'
  },
  order_confirmed_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Tu pedido ha sido confirmado. Te avisaremos cuando el repartidor este en camino.'
  },
  driver_assigned_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Un repartidor ha sido asignado a tu pedido y esta en camino.'
  },
  order_completed_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Tu pedido ha sido entregado. Gracias por tu preferencia!'
  },
  webhook_secret: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  default_channel_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  attention_mode: {
    type: DataTypes.STRING(20),
    defaultValue: 'assisted'
  }
}, {
  tableName: 'messaging_settings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

MessagingSettings.prototype.toDict = function() {
  return {
    id: this.id,
    user_id: this.user_id,
    is_active: this.is_active,
    auto_validate_addresses: this.auto_validate_addresses,
    auto_respond_coverage: this.auto_respond_coverage,
    auto_respond_no_coverage: this.auto_respond_no_coverage,
    no_coverage_message: this.no_coverage_message,
    coverage_message: this.coverage_message,
    order_confirmed_message: this.order_confirmed_message,
    driver_assigned_message: this.driver_assigned_message,
    order_completed_message: this.order_completed_message,
    default_channel_id: this.default_channel_id,
    attention_mode: this.attention_mode,
    has_api_token: !!this.respond_api_token,
    created_at: this.created_at,
    updated_at: this.updated_at
  };
};

export default MessagingSettings;
