import { Router } from 'express';
import { ValidatedAddress, Route, Stop, User, MessagingSettings } from '../models/index.js';
import { requireAuth, requireAdmin, requireRole } from '../middleware/auth.js';
import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import RespondioService from '../services/respondio.js';
import { optimizeRouteOrder } from '../services/optimization.js';

const router = Router();

const VALID_ORDER_STATUSES = ['approved', 'on_production', 'production_finished', 'order_picked_up', 'on_delivery', 'delivered'];
const ADMIN_STATUSES = ['on_production', 'production_finished', 'order_picked_up'];
const DRIVER_STATUSES = ['delivered'];

const VALID_TRANSITIONS = {
  approved: ['on_production'],
  on_production: ['production_finished'],
  production_finished: ['order_picked_up'],
  order_picked_up: ['on_delivery'],
  on_delivery: ['delivered'],
  delivered: []
};

router.get('/orders', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    let where = {};

    if (user.role === 'driver') {
      where.assigned_driver_id = user.id;
      where.order_status = { [Op.in]: ['on_delivery', 'delivered'] };
    } else if (user.role === 'admin') {
      if (req.query.status) {
        where.order_status = req.query.status;
      }
    } else {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    const orders = await ValidatedAddress.findAll({
      where,
      order: [['created_at', 'DESC']]
    });

    res.json({ orders: orders.map(o => o.toDict()) });
  } catch (error) {
    console.error('Error fetching dispatch orders:', error);
    res.status(500).json({ error: 'Error al cargar ordenes' });
  }
});

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [total, onProduction, productionFinished, pickedUp, onDelivery, delivered] = await Promise.all([
      ValidatedAddress.count(),
      ValidatedAddress.count({ where: { order_status: 'on_production' } }),
      ValidatedAddress.count({ where: { order_status: 'production_finished' } }),
      ValidatedAddress.count({ where: { order_status: 'order_picked_up' } }),
      ValidatedAddress.count({ where: { order_status: 'on_delivery' } }),
      ValidatedAddress.count({ where: { order_status: 'delivered' } })
    ]);

    res.json({
      total,
      on_production: onProduction,
      production_finished: productionFinished,
      order_picked_up: pickedUp,
      on_delivery: onDelivery,
      delivered
    });
  } catch (error) {
    console.error('Error fetching dispatch stats:', error);
    res.status(500).json({ error: 'Error al cargar estadisticas' });
  }
});

router.put('/orders/:id/status', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    const order = await ValidatedAddress.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    const { order_status } = req.body;
    if (!VALID_ORDER_STATUSES.includes(order_status)) {
      return res.status(400).json({ error: 'Estado no valido' });
    }

    const currentStatus = order.order_status || 'approved';
    const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(order_status)) {
      return res.status(400).json({ error: `No se puede cambiar de "${currentStatus}" a "${order_status}"` });
    }

    if (user.role === 'admin') {
      if (!ADMIN_STATUSES.includes(order_status)) {
        return res.status(403).json({ error: 'No puedes cambiar a ese estado' });
      }
    } else if (user.role === 'driver') {
      if (!DRIVER_STATUSES.includes(order_status)) {
        return res.status(403).json({ error: 'Solo puedes marcar como entregado' });
      }
      if (order.assigned_driver_id !== user.id) {
        return res.status(403).json({ error: 'Esta orden no te fue asignada' });
      }
    } else {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    order.order_status = order_status;
    if (order_status === 'delivered') {
      order.delivered_at = new Date();
    }
    await order.save();

    res.json({ success: true, order: order.toDict() });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

router.put('/orders/:id/amount', requireAdmin, async (req, res) => {
  try {
    const order = await ValidatedAddress.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    order.amount = req.body.amount || 0;
    await order.save();

    res.json({ success: true, order: order.toDict() });
  } catch (error) {
    console.error('Error updating order amount:', error);
    res.status(500).json({ error: 'Error al actualizar monto' });
  }
});

router.put('/orders/bulk-status', requireAdmin, async (req, res) => {
  try {
    const { order_ids, order_status } = req.body;
    if (!order_ids?.length || !ADMIN_STATUSES.includes(order_status)) {
      return res.status(400).json({ error: 'Datos invalidos' });
    }

    await ValidatedAddress.update(
      { order_status },
      { where: { id: { [Op.in]: order_ids } } }
    );

    res.json({ success: true, updated: order_ids.length });
  } catch (error) {
    console.error('Error bulk updating:', error);
    res.status(500).json({ error: 'Error al actualizar ordenes' });
  }
});

router.post('/routes', requireAdmin, async (req, res) => {
  try {
    const { name, order_ids } = req.body;
    if (!order_ids?.length) {
      return res.status(400).json({ error: 'Selecciona al menos una orden' });
    }

    const orders = await ValidatedAddress.findAll({
      where: { id: { [Op.in]: order_ids } }
    });

    if (orders.length === 0) {
      return res.status(400).json({ error: 'No se encontraron ordenes con direccion' });
    }

    const route = await Route.create({
      user_id: req.session.userId,
      name: name || `Ruta ${new Date().toLocaleDateString('es', { day: '2-digit', month: 'short' })} - ${orders.length} paradas`,
      status: 'draft'
    });

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      await Stop.create({
        route_id: route.id,
        address: order.validated_address,
        lat: order.address_lat,
        lng: order.address_lng,
        order: i,
        customer_name: order.customer_name,
        phone: order.customer_phone,
        note: order.notes
      });

      order.route_id = route.id;
      await order.save();
    }

    res.status(201).json({
      success: true,
      route: await route.toDict()
    });
  } catch (error) {
    console.error('Error creating dispatch route:', error);
    res.status(500).json({ error: 'Error al crear ruta' });
  }
});

router.get('/routes', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    let where = {};
    if (user.role === 'driver') {
      where.assigned_driver_id = user.id;
    } else if (user.role === 'admin') {
    } else {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    const routes = await Route.findAll({
      where,
      order: [['created_at', 'DESC']]
    });

    const routesWithDetails = await Promise.all(routes.map(async (r) => {
      const routeDict = await r.toDict();
      const routeOrders = await ValidatedAddress.findAll({
        where: { route_id: r.id }
      });
      routeDict.orders = routeOrders.map(o => o.toDict());
      routeDict.total_amount = routeOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
      return routeDict;
    }));

    res.json({ routes: routesWithDetails });
  } catch (error) {
    console.error('Error fetching dispatch routes:', error);
    res.status(500).json({ error: 'Error al cargar rutas' });
  }
});

router.post('/routes/:id/optimize', requireAdmin, async (req, res) => {
  try {
    const route = await Route.findByPk(req.params.id);
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });

    const stops = await Stop.findAll({
      where: { route_id: route.id },
      order: [['order', 'ASC']]
    });

    if (stops.length < 2) {
      return res.status(400).json({ error: 'Se necesitan al menos 2 paradas para optimizar' });
    }

    const startLocation = route.start_lat && route.start_lng
      ? { lat: route.start_lat, lng: route.start_lng }
      : null;

    const result = await optimizeRouteOrder(stops, startLocation, route.return_to_start);

    for (const optimizedStop of result.optimizedStops) {
      await Stop.update(
        {
          order: optimizedStop.order,
          original_order: optimizedStop.original_order ?? optimizedStop.order,
          distance_from_prev: optimizedStop.distance_from_prev,
          duration_from_prev: optimizedStop.duration_from_prev
        },
        { where: { id: optimizedStop.id } }
      );
    }

    route.is_optimized = true;
    route.total_distance = result.totalDistance;
    route.total_duration = result.totalDuration;
    await route.save();

    res.json({
      success: true,
      route: await route.toDict(),
      total_distance: result.totalDistance,
      total_duration: result.totalDuration
    });
  } catch (error) {
    console.error('Error optimizing route:', error);
    res.status(500).json({ error: 'Error al optimizar ruta' });
  }
});

router.put('/routes/:id/assign', requireAdmin, async (req, res) => {
  try {
    const { driver_id } = req.body;
    if (!driver_id) return res.status(400).json({ error: 'Selecciona un chofer' });

    const driver = await User.findByPk(driver_id);
    if (!driver) return res.status(404).json({ error: 'Chofer no encontrado' });

    const route = await Route.findByPk(req.params.id);
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });

    route.status = 'assigned';
    route.assigned_driver_id = driver_id;
    await route.save();

    const orders = await ValidatedAddress.findAll({
      where: { route_id: route.id }
    });

    for (const order of orders) {
      order.assigned_driver_id = driver_id;
      order.driver_name = driver.username;
      order.order_status = 'on_delivery';
      await order.save();
    }

    res.json({
      success: true,
      route: await route.toDict(),
      message: `Ruta asignada a ${driver.username}`
    });
  } catch (error) {
    console.error('Error assigning route:', error);
    res.status(500).json({ error: 'Error al asignar ruta' });
  }
});

router.get('/drivers', requireAdmin, async (req, res) => {
  try {
    const drivers = await User.findAll({
      where: { role: 'driver', active: true },
      attributes: ['id', 'username', 'email', 'phone']
    });
    res.json({ drivers: drivers.map(d => d.toDict()) });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Error al cargar choferes' });
  }
});

router.get('/respond-users', requireAdmin, async (req, res) => {
  try {
    const settings = await MessagingSettings.findOne({ where: { user_id: req.session.userId } });
    if (!settings?.respond_api_token) {
      return res.status(400).json({ error: 'No hay token de API de Respond.io configurado' });
    }

    const respondio = new RespondioService(settings.respond_api_token);
    const result = await respondio.listUsers();

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Error al conectar con Respond.io' });
    }

    const existingUsers = await User.findAll({
      attributes: ['email', 'role']
    });
    const existingByEmail = new Map(existingUsers.map(u => [u.email.toLowerCase(), u.role]));

    const users = (Array.isArray(result.users) ? result.users : []).map(u => {
      const email = (u.email || '').toLowerCase();
      const existingRole = email ? existingByEmail.get(email) : null;
      return {
        respond_id: u.id,
        name: u.name || u.firstName || `${u.firstName || ''} ${u.lastName || ''}`.trim(),
        email: u.email || '',
        role: u.role || u.accessLevel || '',
        already_exists: !!existingRole,
        existing_role: existingRole || null
      };
    });

    res.json({ users });
  } catch (error) {
    console.error('Error fetching Respond.io users:', error);
    res.status(500).json({ error: 'Error al cargar miembros de Respond.io' });
  }
});

router.post('/sync-drivers', requireAdmin, async (req, res) => {
  try {
    const { users } = req.body;
    if (!users?.length) {
      return res.status(400).json({ error: 'Selecciona al menos un miembro' });
    }

    const created = [];
    const skipped = [];

    for (const userData of users) {
      const email = (userData.email || '').toLowerCase().trim();
      if (!email) {
        skipped.push({ name: userData.name, reason: 'Sin email' });
        continue;
      }

      const existing = await User.findOne({ where: { email } });
      if (existing) {
        skipped.push({ name: userData.name, reason: `Ya existe como ${existing.role}` });
        continue;
      }

      const tempPassword = `driver_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      await User.create({
        username: userData.name || email.split('@')[0],
        email,
        password_hash: passwordHash,
        role: 'driver',
        active: true
      });

      created.push({ name: userData.name, email, action: 'created' });
    }

    res.json({
      success: true,
      created,
      skipped,
      message: `${created.length} chofer(es) sincronizado(s), ${skipped.length} omitido(s)`
    });
  } catch (error) {
    console.error('Error syncing drivers:', error);
    res.status(500).json({ error: 'Error al sincronizar choferes' });
  }
});

router.put('/orders/:id/delivered', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    const order = await ValidatedAddress.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    if (user.role === 'driver' && order.assigned_driver_id !== user.id) {
      return res.status(403).json({ error: 'Esta orden no te fue asignada' });
    }

    order.order_status = 'delivered';
    order.delivered_at = new Date();
    await order.save();

    res.json({ success: true, order: order.toDict() });
  } catch (error) {
    console.error('Error marking delivered:', error);
    res.status(500).json({ error: 'Error al marcar como entregado' });
  }
});

export default router;
