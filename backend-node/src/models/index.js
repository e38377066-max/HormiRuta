import sequelize from '../config/database.js';
import User from './User.js';
import Route from './Route.js';
import Stop from './Stop.js';
import RouteHistory from './RouteHistory.js';

User.hasMany(Route, { foreignKey: 'user_id', as: 'routes', onDelete: 'CASCADE' });
Route.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Route.hasMany(Stop, { foreignKey: 'route_id', as: 'stops', onDelete: 'CASCADE' });
Stop.belongsTo(Route, { foreignKey: 'route_id', as: 'route' });

User.hasMany(RouteHistory, { foreignKey: 'user_id', as: 'history', onDelete: 'CASCADE' });
RouteHistory.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

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

export { sequelize, User, Route, Stop, RouteHistory };
