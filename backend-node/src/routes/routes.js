import { Router } from 'express';
import { Route, Stop, RouteHistory } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { optimizeRouteOrder, calculateEtas } from '../services/optimization.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const routes = await Route.findAll({
      where: { user_id: req.session.userId },
      order: [['created_at', 'DESC']]
    });
    
    const routesWithStops = await Promise.all(routes.map(r => r.toDict()));
    res.json({ routes: routesWithStops });
  } catch (error) {
    console.error('Get routes error:', error);
    res.status(500).json({ error: 'Error al cargar rutas' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, stops: stopsData = [] } = req.body;
    
    const route = await Route.create({
      user_id: req.session.userId,
      name: name || `Ruta ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
    });
    
    for (let i = 0; i < stopsData.length; i++) {
      const stopData = stopsData[i];
      await Stop.create({
        route_id: route.id,
        address: stopData.address || '',
        lat: stopData.lat || 0,
        lng: stopData.lng || 0,
        order: i,
        note: stopData.note,
        phone: stopData.phone,
        customer_name: stopData.customer_name,
        priority: stopData.priority || 0,
        duration: stopData.duration || 5,
        time_window_start: stopData.time_window_start,
        time_window_end: stopData.time_window_end
      });
    }
    
    res.status(201).json({
      success: true,
      route: await route.toDict()
    });
  } catch (error) {
    console.error('Create route error:', error);
    res.status(500).json({ error: 'Error al crear ruta' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const route = await Route.findOne({
      where: { id: req.params.id, user_id: req.session.userId }
    });
    
    if (!route) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    
    res.json({ route: await route.toDict() });
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar ruta' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const route = await Route.findOne({
      where: { id: req.params.id, user_id: req.session.userId }
    });
    
    if (!route) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    
    const { name, status } = req.body;
    if (name !== undefined) route.name = name;
    if (status !== undefined) route.status = status;
    
    await route.save();
    
    res.json({
      success: true,
      route: await route.toDict()
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar ruta' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const route = await Route.findOne({
      where: { id: req.params.id, user_id: req.session.userId }
    });
    
    if (!route) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    
    await route.destroy();
    res.json({ success: true, message: 'Ruta eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar ruta' });
  }
});

router.post('/:id/stops', requireAuth, async (req, res) => {
  try {
    const route = await Route.findOne({
      where: { id: req.params.id, user_id: req.session.userId }
    });
    
    if (!route) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    
    const maxOrder = await Stop.max('order', { where: { route_id: route.id } }) || -1;
    
    const stop = await Stop.create({
      route_id: route.id,
      address: req.body.address || '',
      lat: req.body.lat || 0,
      lng: req.body.lng || 0,
      order: maxOrder + 1,
      note: req.body.note,
      phone: req.body.phone,
      customer_name: req.body.customer_name,
      priority: req.body.priority || 0
    });
    
    res.status(201).json({
      success: true,
      stop: stop.toDict()
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al agregar parada' });
  }
});

router.post('/:id/reorder', requireAuth, async (req, res) => {
  try {
    const route = await Route.findOne({
      where: { id: req.params.id, user_id: req.session.userId }
    });
    
    if (!route) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    
    const { stop_order = [] } = req.body;
    
    for (let i = 0; i < stop_order.length; i++) {
      await Stop.update({ order: i }, { where: { id: stop_order[i], route_id: route.id } });
    }
    
    res.json({
      success: true,
      route: await route.toDict()
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al reordenar paradas' });
  }
});

router.post('/:id/optimize', requireAuth, async (req, res) => {
  try {
    const route = await Route.findOne({
      where: { id: req.params.id, user_id: req.session.userId }
    });
    
    if (!route) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    
    const stops = await Stop.findAll({
      where: { route_id: route.id },
      order: [['order', 'ASC']]
    });
    
    if (stops.length < 2) {
      return res.status(400).json({ error: 'Se necesitan al menos 2 paradas para optimizar' });
    }
    
    const { start_lat, start_lng, start_address, return_to_start, start_time, mode } = req.body;
    
    let startLocation = null;
    if (route.start_lat && route.start_lng) {
      startLocation = { lat: route.start_lat, lng: route.start_lng };
    } else if (start_lat && start_lng) {
      startLocation = { lat: start_lat, lng: start_lng };
      route.start_lat = start_lat;
      route.start_lng = start_lng;
      route.start_address = start_address || '';
    }
    
    if (return_to_start !== undefined) {
      route.return_to_start = return_to_start;
    }
    
    const { optimizedStops, totalDistance, totalDuration } = await optimizeRouteOrder(
      stops,
      startLocation,
      route.return_to_start
    );
    
    for (const stop of optimizedStops) {
      await Stop.update({
        order: stop.order,
        distance_from_prev: stop.distance_from_prev,
        duration_from_prev: stop.duration_from_prev
      }, { where: { id: stop.id } });
    }
    
    const startTimeDate = start_time ? new Date(start_time) : new Date();
    const stopsWithEta = calculateEtas(optimizedStops, startTimeDate);
    
    for (const stop of stopsWithEta) {
      await Stop.update({ eta: stop.eta }, { where: { id: stop.id } });
    }
    
    route.is_optimized = true;
    route.total_distance = totalDistance;
    route.total_duration = totalDuration;
    route.optimization_mode = mode || 'fastest';
    await route.save();
    
    res.json({
      success: true,
      route: await route.toDict(),
      total_distance_km: totalDistance,
      total_duration_min: totalDuration
    });
  } catch (error) {
    console.error('Optimize error:', error);
    res.status(500).json({ error: 'Error al optimizar ruta' });
  }
});

router.post('/:id/start', requireAuth, async (req, res) => {
  try {
    const route = await Route.findOne({
      where: { id: req.params.id, user_id: req.session.userId }
    });
    
    if (!route) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    
    route.status = 'in_progress';
    route.started_at = new Date();
    await route.save();
    
    res.json({
      success: true,
      route: await route.toDict()
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al iniciar ruta' });
  }
});

router.post('/:id/complete', requireAuth, async (req, res) => {
  try {
    const route = await Route.findOne({
      where: { id: req.params.id, user_id: req.session.userId }
    });
    
    if (!route) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    
    route.status = 'completed';
    route.completed_at = new Date();
    await route.save();
    
    const stops = await Stop.findAll({ where: { route_id: route.id } });
    
    const history = await RouteHistory.create({
      user_id: req.session.userId,
      route_name: route.name,
      total_stops: stops.length,
      completed_stops: stops.filter(s => s.status === 'completed').length,
      failed_stops: stops.filter(s => s.status === 'failed').length,
      total_distance: route.total_distance,
      total_duration: route.total_duration,
      started_at: route.started_at,
      completed_at: route.completed_at,
      route_data: await route.toDict()
    });
    
    res.json({
      success: true,
      route: await route.toDict(),
      history_id: history.id
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al completar ruta' });
  }
});

router.post('/:id/import-text', requireAuth, async (req, res) => {
  try {
    const route = await Route.findOne({
      where: { id: req.params.id, user_id: req.session.userId }
    });
    
    if (!route) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Contenido vacío' });
    }
    
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    const maxOrder = await Stop.max('order', { where: { route_id: route.id } }) || -1;
    
    let importedCount = 0;
    for (const line of lines) {
      await Stop.create({
        route_id: route.id,
        address: line,
        lat: 0,
        lng: 0,
        order: maxOrder + 1 + importedCount
      });
      importedCount++;
    }
    
    route.is_optimized = false;
    await route.save();
    
    res.json({
      success: true,
      imported_count: importedCount,
      route: await route.toDict(),
      message: `${importedCount} direcciones importadas. Geocodificación pendiente.`
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al importar texto' });
  }
});

export default router;
