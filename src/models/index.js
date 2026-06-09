/**
 * @fileoverview Exportación centralizada de todos los modelos de Sequelize y sus asociaciones.
 * Define las relaciones entre usuarios, rutas, paradas, órdenes y demás entidades del sistema.
 */

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
import UserToken from './UserToken.js';
import WholesaleClient from './WholesaleClient.js';
import BotMemory from './BotMemory.js';
import BotKnowledge from './BotKnowledge.js';
import CustomerProfile from './CustomerProfile.js';
import AgentStyleProfile from './AgentStyleProfile.js';

// Relaciones de Usuario y Ruta
User.hasMany(Route, { foreignKey: 'user_id', as: 'routes', onDelete: 'CASCADE' });
Route.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Relaciones de Ruta y Parada (Stop)
Route.hasMany(Stop, { foreignKey: 'route_id', as: 'stops', onDelete: 'CASCADE' });
Stop.belongsTo(Route, { foreignKey: 'route_id', as: 'route' });

// Historial de Rutas por Usuario
User.hasMany(RouteHistory, { foreignKey: 'user_id', as: 'history', onDelete: 'CASCADE' });
RouteHistory.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Órdenes de Mensajería por Usuario
User.hasMany(MessagingOrder, { foreignKey: 'user_id', as: 'messagingOrders', onDelete: 'CASCADE' });
MessagingOrder.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Zonas de Cobertura por Usuario
User.hasMany(CoverageZone, { foreignKey: 'user_id', as: 'coverageZones', onDelete: 'CASCADE' });
CoverageZone.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Logs de Mensajes por Usuario
User.hasMany(MessageLog, { foreignKey: 'user_id', as: 'messageLogs', onDelete: 'CASCADE' });
MessageLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Configuración de Mensajería por Usuario
User.hasOne(MessagingSettings, { foreignKey: 'user_id', as: 'messagingSettings', onDelete: 'CASCADE' });
MessagingSettings.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Mensajes asociados a una Orden de Mensajería
MessagingOrder.hasMany(MessageLog, { foreignKey: 'order_id', as: 'messages', onDelete: 'SET NULL' });
MessageLog.belongsTo(MessagingOrder, { foreignKey: 'order_id', as: 'order' });

// Asociaciones de la Orden de Mensajería con Ruta y Parada
MessagingOrder.belongsTo(Route, { foreignKey: 'route_id', as: 'route' });
MessagingOrder.belongsTo(Stop, { foreignKey: 'stop_id', as: 'stop' });
MessagingOrder.belongsTo(User, { foreignKey: 'assigned_driver_id', as: 'driver' });

// Estados de Conversación por Usuario
User.hasMany(ConversationState, { foreignKey: 'user_id', as: 'conversationStates', onDelete: 'CASCADE' });
ConversationState.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Agentes de Servicio por Usuario
User.hasMany(ServiceAgent, { foreignKey: 'user_id', as: 'serviceAgents', onDelete: 'CASCADE' });
ServiceAgent.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Direcciones Validadas
User.hasMany(ValidatedAddress, { foreignKey: 'user_id', as: 'validatedAddresses', onDelete: 'CASCADE' });
ValidatedAddress.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
ValidatedAddress.belongsTo(User, { foreignKey: 'assigned_driver_id', as: 'driver' });

// Conductor asignado a una Ruta
Route.belongsTo(User, { foreignKey: 'assigned_driver_id', as: 'assignedDriver' });
User.hasMany(Route, { foreignKey: 'assigned_driver_id', as: 'assignedRoutes' });

/**
 * @description Convierte la instancia de la ruta a un diccionario plano, incluyendo sus paradas.
 * @returns {Promise<Object>} Representación en objeto de la ruta con sus paradas.
 */
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

// Memoria del Bot y Conocimiento
User.hasMany(BotMemory, { foreignKey: 'user_id', as: 'botMemories', onDelete: 'CASCADE' });
BotMemory.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(BotKnowledge, { foreignKey: 'user_id', as: 'botKnowledge', onDelete: 'CASCADE' });
BotKnowledge.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Perfiles de Cliente
User.hasMany(CustomerProfile, { foreignKey: 'user_id', as: 'customerProfiles', onDelete: 'CASCADE' });
CustomerProfile.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Perfil de Estilo del Agente (IA)
User.hasOne(AgentStyleProfile, { foreignKey: 'user_id', as: 'agentStyle', onDelete: 'CASCADE' });
AgentStyleProfile.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

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
  FavoriteAddress,
  UserToken,
  WholesaleClient,
  BotMemory,
  BotKnowledge,
  CustomerProfile,
  AgentStyleProfile
};
