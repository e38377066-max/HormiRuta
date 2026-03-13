import sequelize from '../config/database.js';
import User from './User.js';
import Route from './Route.js';
import Stop from './Stop.js';
import RouteHistory from './RouteHistory.js';
import MessagingOrder from './MessagingOrder.js';
import CoverageZone from './CoverageZone.js';
import MessageLog from './MessageLog.js';
import MessagingSettings from './MessagingSettings.js';
import ConversationState from './ConversationState.js';
import ServiceAgent from './ServiceAgent.js';
import ValidatedAddress from './ValidatedAddress.js';
import DeliveryHistory from './DeliveryHistory.js';
import FavoriteAddress from './FavoriteAddress.js';

User.hasMany(Route, { foreignKey: 'user_id', as: 'routes', onDelete: 'CASCADE' });
Route.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Route.hasMany(Stop, { foreignKey: 'route_id', as: 'stops', onDelete: 'CASCADE' });
Stop.belongsTo(Route, { foreignKey: 'route_id', as: 'route' });

User.hasMany(RouteHistory, { foreignKey: 'user_id', as: 'history', onDelete: 'CASCADE' });
RouteHistory.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(MessagingOrder, { foreignKey: 'user_id', as: 'messagingOrders', onDelete: 'CASCADE' });
MessagingOrder.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(CoverageZone, { foreignKey: 'user_id', as: 'coverageZones', onDelete: 'CASCADE' });
CoverageZone.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(MessageLog, { foreignKey: 'user_id', as: 'messageLogs', onDelete: 'CASCADE' });
MessageLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasOne(MessagingSettings, { foreignKey: 'user_id', as: 'messagingSettings', onDelete: 'CASCADE' });
MessagingSettings.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

MessagingOrder.hasMany(MessageLog, { foreignKey: 'order_id', as: 'messages', onDelete: 'SET NULL' });
MessageLog.belongsTo(MessagingOrder, { foreignKey: 'order_id', as: 'order' });

MessagingOrder.belongsTo(Route, { foreignKey: 'route_id', as: 'route' });
MessagingOrder.belongsTo(Stop, { foreignKey: 'stop_id', as: 'stop' });
MessagingOrder.belongsTo(User, { foreignKey: 'assigned_driver_id', as: 'driver' });

User.hasMany(ConversationState, { foreignKey: 'user_id', as: 'conversationStates', onDelete: 'CASCADE' });
ConversationState.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(ServiceAgent, { foreignKey: 'user_id', as: 'serviceAgents', onDelete: 'CASCADE' });
ServiceAgent.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(ValidatedAddress, { foreignKey: 'user_id', as: 'validatedAddresses', onDelete: 'CASCADE' });
ValidatedAddress.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
ValidatedAddress.belongsTo(User, { foreignKey: 'assigned_driver_id', as: 'driver' });

Route.belongsTo(User, { foreignKey: 'assigned_driver_id', as: 'assignedDriver' });
User.hasMany(Route, { foreignKey: 'assigned_driver_id', as: 'assignedRoutes' });

Route.prototype.toDict = async function() {
  const stops = await Stop.findAll({
    where: { route_id: this.id },
    order: [['order', 'ASC']]
  });
  
  return {
    id: this.id,
    user_id: this.user_id,
    name: this.name,
    is_optimized: this.is_optimized,
    total_distance: this.total_distance,
    total_duration: this.total_duration,
    status: this.status,
    assigned_driver_id: this.assigned_driver_id,
    start_address: this.start_address,
    start_lat: this.start_lat,
    start_lng: this.start_lng,
    end_address: this.end_address,
    end_lat: this.end_lat,
    end_lng: this.end_lng,
    return_to_start: this.return_to_start,
    vehicle_type: this.vehicle_type,
    optimization_mode: this.optimization_mode,
    scheduled_date: this.scheduled_date,
    started_at: this.started_at,
    completed_at: this.completed_at,
    stops: stops.map(s => s.toDict()),
    stops_count: stops.length,
    completed_stops: stops.filter(s => s.status === 'completed').length,
    created_at: this.created_at,
    updated_at: this.updated_at
  };
};

export { 
  sequelize, 
  User, 
  Route, 
  Stop, 
  RouteHistory,
  MessagingOrder,
  CoverageZone,
  MessageLog,
  MessagingSettings,
  ConversationState,
  ServiceAgent,
  ValidatedAddress,
  DeliveryHistory,
  FavoriteAddress
};
