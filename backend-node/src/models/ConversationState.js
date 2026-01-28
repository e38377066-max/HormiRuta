import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ConversationState = sequelize.define('ConversationState', {
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
  contact_id: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  state: {
    type: DataTypes.STRING(50),
    defaultValue: 'initial'
  },
  awaiting_response: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  has_prior_info: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  selected_product: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  validated_zip: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  is_existing_customer: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  out_of_hours_notified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  assigned_agent_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  bot_paused: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  last_interaction: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  context_data: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'conversation_states',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'contact_id']
    }
  ]
});

ConversationState.prototype.toDict = function() {
  return {
    id: this.id,
    user_id: this.user_id,
    contact_id: this.contact_id,
    state: this.state,
    awaiting_response: this.awaiting_response,
    has_prior_info: this.has_prior_info,
    selected_product: this.selected_product,
    validated_zip: this.validated_zip,
    is_existing_customer: this.is_existing_customer,
    out_of_hours_notified: this.out_of_hours_notified,
    assigned_agent_id: this.assigned_agent_id,
    bot_paused: this.bot_paused,
    last_interaction: this.last_interaction,
    context_data: this.context_data
  };
};

export default ConversationState;
