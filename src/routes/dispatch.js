import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { ValidatedAddress, Route, Stop, User, MessagingSettings } from '../models/index.js';
import { requireAuth, requireAdmin, requireRole } from '../middleware/auth.js';
import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import RespondioService from '../services/respondio.js';
import respondApiService from '../services/respondApiService.js';
import { optimizeRouteOrder } from '../services/optimization.js';
import geocodingService from '../services/geocodingService.js';

const ORDER_STATUS_TO_LIFECYCLE = {
  approved: 'Approved',
  ordered: 'Ordered',
  on_delivery: 'On Delivery',
  ups_shipped: 'UPS Shipped',
  delivered: 'Delivered'
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'uploads', 'evidence'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `stop_${req.params.id}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imagenes'), false);
    }
  }
});

const router = Router();

const VALID_ORDER_STATUSES = ['approved', 'ordered', 'on_delivery', 'ups_shipped', 'delivered'];
const ADMIN_STATUSES = ['approved', 'ordered', 'on_delivery', 'ups_shipped', 'delivered'];
const DRIVER_STATUSES = ['delivered'];

const VALID_TRANSITIONS = {
  approved: ['ordered'],
  ordered: ['on_delivery'],
  on_delivery: ['ups_shipped', 'delivered'],
  ups_shipped: ['delivered'],
  delivered: []
};

router.get('/orders', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    let where = {};

    if (user.role === 'driver') {
      where.assigned_driver_id = user.id;
      where.order_status = { [Op.in]: ['on_delivery', 'delivered'] };
    } else if (user.role === 'admin') {
      if (req.query.status) {
        where.order_status = req.query.status;
      } else {
        where.order_status = { [Op.ne]: 'delivered' };
      }
      if (req.query.available === 'true') {
        where.route_id = { [Op.is]: null };
      }
    } else {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    const orders = await ValidatedAddress.findAll({
      where,
      order: [['customer_name', 'ASC'], ['created_at', 'DESC']]
    });

    res.json({ orders: orders.map(o => o.toDict()) });
  } catch (error) {
    console.error('Error fetching dispatch orders:', error);
    res.status(500).json({ error: 'Error al cargar ordenes' });
  }
});

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [total, approved, ordered, onDelivery, upsShipped, delivered] = await Promise.all([
      ValidatedAddress.count(),
      ValidatedAddress.count({ where: { order_status: 'approved' } }),
      ValidatedAddress.count({ where: { order_status: 'ordered' } }),
      ValidatedAddress.count({ where: { order_status: 'on_delivery' } }),
      ValidatedAddress.count({ where: { order_status: 'ups_shipped' } }),
      ValidatedAddress.count({ where: { order_status: 'delivered' } })
    ]);

    res.json({
      total,
      approved,
      ordered,
      on_delivery: onDelivery,
      ups_shipped: upsShipped,
      delivered
    });
  } catch (error) {
    console.error('Error fetching dispatch stats:', error);
    res.status(500).json({ error: 'Error al cargar estadisticas' });
  }
});

router.get('/orders/delivered', requireAdmin, async (req, res) => {
  try {
    const deliveredOrders = await ValidatedAddress.findAll({
      where: { order_status: 'delivered' },
      order: [['delivered_at', 'DESC']]
    });

    const routeIds = [...new Set(deliveredOrders.filter(o => o.route_id).map(o => o.route_id))];
    const allStops = routeIds.length > 0
      ? await Stop.findAll({ where: { route_id: { [Op.in]: routeIds } } })
      : [];
    const stopsByRoute = {};
    allStops.forEach(s => {
      if (!stopsByRoute[s.route_id]) stopsByRoute[s.route_id] = [];
      stopsByRoute[s.route_id].push(s);
    });

    const ordersWithEvidence = deliveredOrders.map(order => {
      const orderData = order.toDict();
      orderData.evidence_photos = [];

      if (order.route_id && stopsByRoute[order.route_id]) {
        const stops = stopsByRoute[order.route_id];
        const matchingStop = stops.find(s =>
          (Math.abs(s.lat - order.address_lat) < 0.0001 && Math.abs(s.lng - order.address_lng) < 0.0001)
        ) || stops.find(s => s.address === order.validated_address);

        if (matchingStop) {
          if (matchingStop.photo_url) {
            orderData.evidence_photos.push({
              photo_url: matchingStop.photo_url,
              completed_at: matchingStop.completed_at,
              recipient_name: matchingStop.recipient_name
            });
          }
          orderData.payment_method = matchingStop.payment_method || orderData.payment_method;
          orderData.amount_collected = matchingStop.amount_collected ?? orderData.amount_collected;
          orderData.payment_status = matchingStop.payment_status || orderData.payment_status;
        }
      }

      return orderData;
    });

    res.json({ orders: ordersWithEvidence });
  } catch (error) {
    console.error('Error fetching delivered orders:', error);
    res.status(500).json({ error: 'Error al cargar historial de entregas' });
  }
});

router.put('/orders/:id/status', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
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

    if (order.respond_contact_id) {
      try {
        const settings = await MessagingSettings.findOne({ where: { user_id: order.user_id } });
        if (settings?.respond_api_token) {
          respondApiService.setContext(order.user_id, settings.respond_api_token);
          const lifecycleName = ORDER_STATUS_TO_LIFECYCLE[order_status];
          if (lifecycleName) {
            await respondApiService.updateLifecycle(order.respond_contact_id, lifecycleName);
            console.log(`[Dispatch] Lifecycle actualizado en Respond.io: ${order.customer_name} -> ${lifecycleName}`);
          }
        }
      } catch (lcError) {
        console.error(`[Dispatch] Error actualizando lifecycle en Respond.io:`, lcError.message);
      }
    }

    res.json({ success: true, order: order.toDict() });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

router.put('/orders/:id/notes', requireAuth, async (req, res) => {
  try {
    const order = await ValidatedAddress.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    order.notes = req.body.notes || '';
    await order.save();

    res.json({ success: true, order: order.toDict() });
  } catch (error) {
    console.error('Error updating order notes:', error);
    res.status(500).json({ error: 'Error al actualizar notas' });
  }
});

router.put('/orders/:id/billing', requireAdmin, async (req, res) => {
  try {
    const order = await ValidatedAddress.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    const { order_cost, deposit_amount, total_to_collect } = req.body;
    if (order_cost !== undefined) order.order_cost = order_cost;
    if (deposit_amount !== undefined) order.deposit_amount = deposit_amount;

    if (total_to_collect !== undefined) {
      order.total_to_collect = total_to_collect;
    } else if (order_cost !== undefined || deposit_amount !== undefined) {
      const cost = order_cost !== undefined ? order_cost : (order.order_cost || 0);
      const deposit = deposit_amount !== undefined ? deposit_amount : (order.deposit_amount || 0);
      order.total_to_collect = Math.max(0, cost - deposit);
    }

    await order.save();

    if (order.route_id) {
      const stops = await Stop.findAll({ where: { route_id: order.route_id } });
      const matchStop = stops.find(s =>
        (Math.abs(s.lat - order.address_lat) < 0.0001 && Math.abs(s.lng - order.address_lng) < 0.0001)
      ) || stops.find(s => s.address === order.validated_address);
      if (matchStop) {
        matchStop.order_cost = order.order_cost;
        matchStop.deposit_amount = order.deposit_amount;
        matchStop.total_to_collect = order.total_to_collect;
        await matchStop.save();
      }
    }

    res.json({ success: true, order: order.toDict() });
  } catch (error) {
    console.error('Error updating billing:', error);
    res.status(500).json({ error: 'Error al actualizar cobranza' });
  }
});

router.get('/geocode-address', requireAdmin, async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'Dirección requerida' });

    const result = await geocodingService.geocodeAddress(address);
    if (!result.success) {
      return res.status(422).json({ error: 'No se pudo geocodificar la dirección', details: result.error });
    }

    res.json({
      success: true,
      formatted_address: result.fullAddress,
      lat: result.latitude,
      lng: result.longitude,
      zip_code: result.zip,
      city: result.city,
      state: result.stateShort || result.state
    });
  } catch (error) {
    console.error('Error geocoding address:', error);
    res.status(500).json({ error: 'Error al geocodificar' });
  }
});

router.post('/orders', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    const { customer_name, customer_phone, validated_address, order_cost, deposit_amount, notes, apartment_number } = req.body;

    if (!customer_name || !validated_address) {
      return res.status(400).json({ error: 'Nombre y dirección son requeridos' });
    }

    const geo = await geocodingService.geocodeAddress(validated_address);
    if (!geo.success) {
      return res.status(422).json({ error: 'No se pudo validar la dirección. Verifica que sea correcta.' });
    }

    const cost = parseFloat(order_cost) || 0;
    const deposit = parseFloat(deposit_amount) || 0;
    const total = Math.max(0, cost - deposit);

    const newOrder = await ValidatedAddress.create({
      user_id: user.id,
      respond_contact_id: null,
      customer_name: customer_name.trim(),
      customer_phone: customer_phone?.trim() || null,
      original_address: validated_address,
      validated_address: geo.fullAddress || validated_address,
      address_lat: geo.latitude,
      address_lng: geo.longitude,
      zip_code: geo.zip || null,
      city: geo.city || null,
      state: geo.stateShort || geo.state || null,
      confidence: geo.confidence || 'high',
      source: 'manual',
      order_status: 'approved',
      order_cost: cost || null,
      deposit_amount: deposit || null,
      total_to_collect: total || null,
      notes: notes?.trim() || null,
      apartment_number: apartment_number?.trim() || null
    });

    console.log(`[Dispatch] Orden manual creada: ${customer_name} - ${geo.fullAddress}`);
    res.status(201).json({ success: true, order: newOrder.toDict() });
  } catch (error) {
    console.error('Error creating manual order:', error);
    res.status(500).json({ error: 'Error al crear orden' });
  }
});

router.put('/orders/:id/edit', requireAdmin, async (req, res) => {
  try {
    const order = await ValidatedAddress.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    const { customer_name, customer_phone, validated_address, order_cost, deposit_amount, notes, apartment_number } = req.body;

    if (customer_name !== undefined) order.customer_name = customer_name.trim();
    if (customer_phone !== undefined) order.customer_phone = customer_phone?.trim() || null;
    if (notes !== undefined) order.notes = notes?.trim() || null;
    if (apartment_number !== undefined) order.apartment_number = apartment_number?.trim() || null;

    if (validated_address && validated_address !== order.validated_address) {
      const geo = await geocodingService.geocodeAddress(validated_address);
      if (!geo.success) {
        return res.status(422).json({ error: 'No se pudo validar la nueva dirección' });
      }
      order.validated_address = geo.fullAddress || validated_address;
      order.original_address = validated_address;
      order.address_lat = geo.latitude;
      order.address_lng = geo.longitude;
      order.zip_code = geo.zip || order.zip_code;
      order.city = geo.city || order.city;
      order.state = geo.stateShort || geo.state || order.state;
      order.confidence = geo.confidence || order.confidence;
    }

    if (order_cost !== undefined) order.order_cost = parseFloat(order_cost) || null;
    if (deposit_amount !== undefined) order.deposit_amount = parseFloat(deposit_amount) || null;

    const cost = order.order_cost || 0;
    const deposit = order.deposit_amount || 0;
    order.total_to_collect = Math.max(0, cost - deposit);

    await order.save();
    console.log(`[Dispatch] Orden #${order.id} editada: ${order.customer_name}`);
    res.json({ success: true, order: order.toDict() });
  } catch (error) {
    console.error('Error editing order:', error);
    res.status(500).json({ error: 'Error al editar orden' });
  }
});

router.get('/accounting', requireAdmin, async (req, res) => {
  try {
    const { driver_id, date_from, date_to } = req.query;

    const whereOrder = { order_status: 'delivered', assigned_driver_id: { [Op.ne]: null } };
    if (date_from || date_to) {
      whereOrder.delivered_at = {};
      if (date_from) whereOrder.delivered_at[Op.gte] = new Date(date_from + 'T00:00:00');
      if (date_to) whereOrder.delivered_at[Op.lte] = new Date(date_to + 'T23:59:59');
    }
    if (driver_id) whereOrder.assigned_driver_id = parseInt(driver_id);

    const orders = await ValidatedAddress.findAll({ where: whereOrder });

    const driverIds = [...new Set(orders.map(o => o.assigned_driver_id))];
    const drivers = await User.findAll({ where: { id: { [Op.in]: driverIds } } });
    const driverMap = {};
    drivers.forEach(d => { driverMap[d.id] = d; });

    const routeIds = [...new Set(orders.filter(o => o.route_id).map(o => o.route_id))];
    const allStops = routeIds.length > 0
      ? await Stop.findAll({ where: { route_id: { [Op.in]: routeIds } } })
      : [];

    const stopsByRoute = {};
    allStops.forEach(s => {
      if (!stopsByRoute[s.route_id]) stopsByRoute[s.route_id] = [];
      stopsByRoute[s.route_id].push(s);
    });

    const grouped = {};
    for (const order of orders) {
      const did = order.assigned_driver_id;
      if (!grouped[did]) {
        const driver = driverMap[did];
        grouped[did] = {
          driver_id: did,
          driver_name: driver?.username || order.driver_name || `Chofer #${did}`,
          commission_per_stop: driver?.commission_per_stop || 0,
          stops_count: 0,
          total_order_cost: 0,
          total_deposit: 0,
          total_collected: 0,
          orders: []
        };
      }

      let collected = order.amount_collected || 0;
      if (order.route_id && stopsByRoute[order.route_id]) {
        const stops = stopsByRoute[order.route_id];
        const matchStop = stops.find(s =>
          Math.abs(s.lat - order.address_lat) < 0.0001 && Math.abs(s.lng - order.address_lng) < 0.0001
        ) || stops.find(s => s.address === order.validated_address);
        if (matchStop?.amount_collected != null) collected = matchStop.amount_collected;
      }

      grouped[did].stops_count += 1;
      grouped[did].total_order_cost += order.order_cost || 0;
      grouped[did].total_deposit += order.deposit_amount || 0;
      grouped[did].total_collected += collected;
      grouped[did].orders.push({
        id: order.id,
        customer_name: order.customer_name,
        order_cost: order.order_cost,
        deposit_amount: order.deposit_amount,
        total_to_collect: order.total_to_collect,
        amount_collected: collected,
        payment_method: order.payment_method,
        delivered_at: order.delivered_at
      });
    }

    const report = Object.values(grouped).map(g => ({
      ...g,
      total_commission: g.stops_count * (g.commission_per_stop || 0),
      balance: g.total_collected - g.stops_count * (g.commission_per_stop || 0)
    }));

    report.sort((a, b) => a.driver_name.localeCompare(b.driver_name));

    res.json({ success: true, report, generated_at: new Date() });
  } catch (error) {
    console.error('Error fetching accounting report:', error);
    res.status(500).json({ error: 'Error al generar reporte' });
  }
});

router.get('/deliveries-report', requireAdmin, async (req, res) => {
  try {
    const { driver_id, date_from, date_to, search } = req.query;

    const where = { order_status: 'delivered' };
    if (driver_id) where.assigned_driver_id = parseInt(driver_id);
    if (date_from || date_to) {
      where.delivered_at = {};
      if (date_from) where.delivered_at[Op.gte] = new Date(date_from + 'T00:00:00');
      if (date_to) where.delivered_at[Op.lte] = new Date(date_to + 'T23:59:59');
    }
    if (search) {
      where[Op.or] = [
        { customer_name: { [Op.iLike]: `%${search}%` } },
        { customer_phone: { [Op.iLike]: `%${search}%` } },
        { validated_address: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const orders = await ValidatedAddress.findAll({ where, order: [['delivered_at', 'DESC']] });

    const driverIds = [...new Set(orders.filter(o => o.assigned_driver_id).map(o => o.assigned_driver_id))];
    const drivers = driverIds.length > 0 ? await User.findAll({ where: { id: { [Op.in]: driverIds } } }) : [];
    const driverMap = {};
    drivers.forEach(d => { driverMap[d.id] = d; });

    const routeIds = [...new Set(orders.filter(o => o.route_id).map(o => o.route_id))];
    const allStops = routeIds.length > 0
      ? await Stop.findAll({ where: { route_id: { [Op.in]: routeIds } } })
      : [];
    const stopsByRoute = {};
    allStops.forEach(s => {
      if (!stopsByRoute[s.route_id]) stopsByRoute[s.route_id] = [];
      stopsByRoute[s.route_id].push(s);
    });

    const deliveries = orders.map(order => {
      const driver = driverMap[order.assigned_driver_id];
      const commissionPerStop = driver?.commission_per_stop || 0;

      let collected = order.amount_collected || 0;
      if (order.route_id && stopsByRoute[order.route_id]) {
        const stops = stopsByRoute[order.route_id];
        const matchStop = stops.find(s =>
          Math.abs(s.lat - order.address_lat) < 0.0001 && Math.abs(s.lng - order.address_lng) < 0.0001
        ) || stops.find(s => s.address === order.validated_address);
        if (matchStop?.amount_collected != null) collected = matchStop.amount_collected;
      }

      return {
        id: order.id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        address: order.validated_address,
        city: order.city,
        state: order.state,
        driver_id: order.assigned_driver_id,
        driver_name: driver?.username || order.driver_name || (order.assigned_driver_id ? `Chofer #${order.assigned_driver_id}` : 'Sin asignar'),
        commission_per_stop: commissionPerStop,
        order_cost: order.order_cost || 0,
        deposit_amount: order.deposit_amount || 0,
        total_to_collect: order.total_to_collect || 0,
        amount_collected: collected,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        delivered_at: order.delivered_at,
        created_at: order.created_at
      };
    });

    res.json({ success: true, deliveries, total: deliveries.length });
  } catch (error) {
    console.error('Error fetching deliveries report:', error);
    res.status(500).json({ error: 'Error al generar reporte de entregas' });
  }
});

router.put('/orders/bulk-status', requireAdmin, async (req, res) => {
  try {
    const { order_ids, order_status } = req.body;
    if (!order_ids?.length || !ADMIN_STATUSES.includes(order_status)) {
      return res.status(400).json({ error: 'Datos invalidos' });
    }

    const ordersToUpdate = await ValidatedAddress.findAll({
      where: { id: { [Op.in]: order_ids } }
    });

    await ValidatedAddress.update(
      { order_status },
      { where: { id: { [Op.in]: order_ids } } }
    );

    const lifecycleName = ORDER_STATUS_TO_LIFECYCLE[order_status];
    if (lifecycleName) {
      for (const o of ordersToUpdate) {
        if (!o.respond_contact_id) continue;
        try {
          const settings = await MessagingSettings.findOne({ where: { user_id: o.user_id } });
          if (settings?.respond_api_token) {
            respondApiService.setContext(o.user_id, settings.respond_api_token);
            await respondApiService.updateLifecycle(o.respond_contact_id, lifecycleName);
            console.log(`[Dispatch] Lifecycle bulk: ${o.customer_name} -> ${lifecycleName}`);
          }
        } catch (lcErr) {
          console.error(`[Dispatch] Error lifecycle bulk ${o.customer_name}:`, lcErr.message);
        }
      }
    }

    res.json({ success: true, updated: order_ids.length });
  } catch (error) {
    console.error('Error bulk updating:', error);
    res.status(500).json({ error: 'Error al actualizar ordenes' });
  }
});

router.post('/routes', requireAdmin, async (req, res) => {
  try {
    const { name, order_ids, pre_optimized } = req.body;
    if (!order_ids?.length) {
      return res.status(400).json({ error: 'Selecciona al menos una orden' });
    }

    const ordersMap = new Map();
    const dbOrders = await ValidatedAddress.findAll({
      where: { id: { [Op.in]: order_ids } }
    });
    dbOrders.forEach(o => ordersMap.set(o.id, o));

    if (ordersMap.size === 0) {
      return res.status(400).json({ error: 'No se encontraron ordenes con direccion' });
    }

    const route = await Route.create({
      user_id: req.userId,
      name: name || `Ruta ${new Date().toLocaleDateString('es', { day: '2-digit', month: 'short' })} - ${ordersMap.size} paradas`,
      status: 'draft',
      is_optimized: !!pre_optimized
    });

    for (let i = 0; i < order_ids.length; i++) {
      const order = ordersMap.get(order_ids[i]);
      if (!order) continue;

      await Stop.create({
        route_id: route.id,
        address: order.validated_address,
        lat: order.address_lat,
        lng: order.address_lng,
        order: i,
        customer_name: order.customer_name,
        phone: order.customer_phone,
        note: order.notes,
        order_cost: order.order_cost,
        deposit_amount: order.deposit_amount,
        total_to_collect: order.total_to_collect,
        apartment_number: order.apartment_number
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

router.put('/drivers/global-commission', requireAdmin, async (req, res) => {
  try {
    const { commission_per_stop } = req.body;
    if (commission_per_stop === undefined || commission_per_stop === null || isNaN(commission_per_stop) || commission_per_stop < 0) {
      return res.status(400).json({ error: 'Comisión inválida' });
    }
    const [updated] = await User.update(
      { commission_per_stop: parseFloat(commission_per_stop) },
      { where: { role: 'driver' } }
    );
    res.json({ success: true, updated, commission_per_stop: parseFloat(commission_per_stop) });
  } catch (error) {
    console.error('Error setting global commission:', error);
    res.status(500).json({ error: 'Error al actualizar comisión global' });
  }
});

router.get('/routes', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
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

    const driverIds = [...new Set(routes.map(r => r.assigned_driver_id).filter(Boolean))];
    const drivers = driverIds.length > 0 ? await User.findAll({ where: { id: { [Op.in]: driverIds } }, attributes: ['id', 'commission_per_stop'] }) : [];
    const driverCommissionMap = {};
    drivers.forEach(d => { driverCommissionMap[d.id] = d.commission_per_stop || 0; });

    const routesWithDetails = await Promise.all(routes.map(async (r) => {
      const routeDict = await r.toDict();
      const routeOrders = await ValidatedAddress.findAll({
        where: { route_id: r.id }
      });
      routeDict.orders = routeOrders.map(o => o.toDict());
      routeDict.total_amount = routeOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
      routeDict.driver_commission_per_stop = r.assigned_driver_id ? (driverCommissionMap[r.assigned_driver_id] || 0) : 0;
      routeDict.driver_commission_total = routeDict.driver_commission_per_stop * (routeDict.stops_count || 0);
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
      if (order.order_status !== 'ups_shipped') {
        order.order_status = 'on_delivery';
      }
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
    let settings = await MessagingSettings.findOne({ where: { user_id: req.userId } });
    if (!settings?.respond_api_token) {
      settings = await MessagingSettings.findOne({
        where: { respond_api_token: { [Op.ne]: null } },
        order: [['id', 'ASC']]
      });
    }
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
      const fullName = u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Sin nombre';
      return {
        respond_id: u.id,
        name: fullName,
        email: u.email || '',
        role: u.role || '',
        team: u.team?.name || null,
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
    const { users, password } = req.body;
    if (!users?.length) {
      return res.status(400).json({ error: 'Selecciona al menos un miembro' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
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

      const passwordHash = await bcrypt.hash(password, 10);

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

router.post('/stops/:id/evidence', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    const stop = await Stop.findByPk(req.params.id);
    if (!stop) return res.status(404).json({ error: 'Parada no encontrada' });

    const route = await Route.findByPk(stop.route_id);
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });

    if (route.assigned_driver_id !== req.userId) {
      const user = await User.findByPk(req.userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'No tienes permisos para esta parada' });
      }
    }

    if (req.file) {
      stop.photo_url = `/uploads/evidence/${req.file.filename}`;
    }

    if (req.body.payment_method) stop.payment_method = req.body.payment_method;
    if (req.body.amount_collected !== undefined && req.body.amount_collected !== '') {
      stop.amount_collected = parseFloat(req.body.amount_collected) || 0;
    }

    if (req.body.payment_method) {
      const collected = stop.amount_collected || 0;
      const toCollect = stop.total_to_collect || 0;
      if (toCollect <= 0 || collected >= toCollect) {
        stop.payment_status = 'paid';
      } else if (collected > 0) {
        stop.payment_status = 'partial';
      } else {
        stop.payment_status = 'pending';
      }
    }

    stop.status = 'completed';
    stop.completed_at = new Date();
    await stop.save();

    const routeOrders = await ValidatedAddress.findAll({ where: { route_id: stop.route_id } });
    const matchOrder = routeOrders.find(o =>
      (Math.abs(o.address_lat - stop.lat) < 0.0001 && Math.abs(o.address_lng - stop.lng) < 0.0001)
    ) || routeOrders.find(o => o.validated_address === stop.address);

    if (matchOrder) {
      if (req.body.payment_method) matchOrder.payment_method = req.body.payment_method;
      if (stop.amount_collected !== null) matchOrder.amount_collected = stop.amount_collected;
      if (stop.payment_status) matchOrder.payment_status = stop.payment_status;
      await matchOrder.save();
    }

    res.json({ success: true, stop: stop.toDict() });
  } catch (error) {
    console.error('Error uploading evidence:', error);
    res.status(500).json({ error: 'Error al subir evidencia' });
  }
});

router.put('/routes/:id/complete', requireAuth, async (req, res) => {
  try {
    const route = await Route.findByPk(req.params.id);
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });

    if (route.assigned_driver_id !== req.userId) {
      const user = await User.findByPk(req.userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'No tienes permisos' });
      }
    }

    const allStops = await Stop.findAll({ where: { route_id: route.id } });
    const allCompleted = allStops.every(s => s.status === 'completed');
    if (!allCompleted) {
      return res.status(400).json({ error: 'Todas las paradas deben estar completadas antes de finalizar' });
    }

    route.status = 'completed';
    route.completed_at = new Date();
    await route.save();

    const orders = await ValidatedAddress.findAll({ where: { route_id: route.id } });
    for (const order of orders) {
      order.order_status = 'delivered';
      order.delivered_at = new Date();
      await order.save();

      if (order.respond_contact_id) {
        try {
          const settings = await MessagingSettings.findOne({ where: { user_id: order.user_id } });
          if (settings?.respond_api_token) {
            respondApiService.setContext(order.user_id, settings.respond_api_token);
            await respondApiService.updateLifecycle(order.respond_contact_id, 'Delivered');
            console.log(`[Dispatch] Ruta completada - Lifecycle: ${order.customer_name} -> Delivered`);
          }
        } catch (lcErr) {
          console.error(`[Dispatch] Error lifecycle ruta completada ${order.customer_name}:`, lcErr.message);
        }
      }
    }

    res.json({ success: true, route: await route.toDict() });
  } catch (error) {
    console.error('Error completing route:', error);
    res.status(500).json({ error: 'Error al finalizar ruta' });
  }
});

router.get('/routes/:id/detail', requireAuth, async (req, res) => {
  try {
    const route = await Route.findByPk(req.params.id);
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });

    const routeDict = await route.toDict();
    const driver = route.assigned_driver_id ? await User.findByPk(route.assigned_driver_id) : null;
    routeDict.driver_name = driver?.username || null;

    const orders = await ValidatedAddress.findAll({ where: { route_id: route.id } });
    routeDict.orders = orders.map(o => o.toDict());
    routeDict.total_amount = orders.reduce((sum, o) => sum + (o.amount || 0), 0);

    res.json({ route: routeDict });
  } catch (error) {
    console.error('Error fetching route detail:', error);
    res.status(500).json({ error: 'Error al cargar detalle' });
  }
});

router.get('/routes/history', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    const routes = await Route.findAll({
      where: { status: { [Op.in]: ['completed', 'assigned'] } },
      order: [['completed_at', 'DESC'], ['created_at', 'DESC']]
    });

    const routesWithDetails = await Promise.all(routes.map(async (r) => {
      const routeDict = await r.toDict();
      const driver = r.assigned_driver_id ? await User.findByPk(r.assigned_driver_id) : null;
      routeDict.driver_name = driver?.username || null;
      const orders = await ValidatedAddress.findAll({ where: { route_id: r.id } });
      routeDict.total_amount = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
      return routeDict;
    }));

    res.json({ routes: routesWithDetails });
  } catch (error) {
    console.error('Error fetching route history:', error);
    res.status(500).json({ error: 'Error al cargar historial' });
  }
});

router.put('/orders/:id/delivered', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
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

router.get('/templates', requireAuth, async (req, res) => {
  try {
    const settings = await MessagingSettings.findOne({ where: { user_id: req.userId } });
    if (!settings) {
      const adminSettings = await MessagingSettings.findOne();
      if (!adminSettings || !adminSettings.respond_api_token || !adminSettings.default_channel_id) {
        return res.json({ templates: [] });
      }
      respondApiService.setContext(adminSettings.user_id, adminSettings.respond_api_token);
      const result = await respondApiService.listMessageTemplates(adminSettings.default_channel_id, 50);
      return res.json({ templates: result?.data || [] });
    }

    if (!settings.respond_api_token || !settings.default_channel_id) {
      const adminSettings = await MessagingSettings.findOne({ where: { respond_api_token: { [Op.ne]: null } } });
      if (!adminSettings || !adminSettings.default_channel_id) {
        return res.json({ templates: [] });
      }
      respondApiService.setContext(adminSettings.user_id, adminSettings.respond_api_token);
      const result = await respondApiService.listMessageTemplates(adminSettings.default_channel_id, 50);
      return res.json({ templates: result?.data || [] });
    }

    respondApiService.setContext(req.userId, settings.respond_api_token);
    const result = await respondApiService.listMessageTemplates(settings.default_channel_id, 50);
    res.json({ templates: result?.data || [] });
  } catch (error) {
    console.error('Error fetching templates:', error.message);
    res.json({ templates: [] });
  }
});

router.post('/orders/:id/send-template', requireAuth, async (req, res) => {
  try {
    const { templateName, languageCode, components } = req.body;
    if (!templateName) return res.status(400).json({ error: 'Template requerido' });

    const order = await ValidatedAddress.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    if (!order.respond_contact_id) return res.status(400).json({ error: 'Este cliente no tiene contacto en Respond.io' });

    let settings = await MessagingSettings.findOne({ where: { user_id: req.userId } });
    if (!settings || !settings.respond_api_token) {
      settings = await MessagingSettings.findOne({ where: { respond_api_token: { [Op.ne]: null } } });
    }
    if (!settings || !settings.respond_api_token) {
      return res.status(400).json({ error: 'API de Respond.io no configurada' });
    }

    respondApiService.setContext(settings.user_id, settings.respond_api_token);
    const identifier = `id:${order.respond_contact_id}`;
    const channelId = settings.default_channel_id || null;

    const result = await respondApiService.sendWhatsAppTemplate(
      identifier, 
      templateName, 
      languageCode || 'es', 
      components || [],
      channelId
    );

    console.log(`[Dispatch] Template "${templateName}" enviado a ${order.customer_name} (contacto ${order.respond_contact_id})`);
    res.json({ success: true, message: 'Template enviado', result });
  } catch (error) {
    console.error('Error sending template:', error.message);
    res.status(500).json({ error: error.message || 'Error al enviar template' });
  }
});

router.post('/orders/:id/send-message', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Mensaje requerido' });

    const order = await ValidatedAddress.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    if (!order.respond_contact_id) return res.status(400).json({ error: 'Este cliente no tiene contacto en Respond.io' });

    let settings = await MessagingSettings.findOne({ where: { user_id: req.userId } });
    if (!settings || !settings.respond_api_token) {
      settings = await MessagingSettings.findOne({ where: { respond_api_token: { [Op.ne]: null } } });
    }
    if (!settings || !settings.respond_api_token) {
      return res.status(400).json({ error: 'API de Respond.io no configurada' });
    }

    respondApiService.setContext(settings.user_id, settings.respond_api_token);
    const identifier = `id:${order.respond_contact_id}`;
    const channelId = settings.default_channel_id || null;

    const result = await respondApiService.sendMessage(identifier, text, channelId);

    console.log(`[Dispatch] Mensaje enviado a ${order.customer_name} (contacto ${order.respond_contact_id})`);
    res.json({ success: true, message: 'Mensaje enviado', result });
  } catch (error) {
    console.error('Error sending message:', error.message);
    res.status(500).json({ error: error.message || 'Error al enviar mensaje' });
  }
});

router.post('/stops/:id/send-template', requireAuth, async (req, res) => {
  try {
    const { templateName, languageCode, components } = req.body;
    if (!templateName) return res.status(400).json({ error: 'Template requerido' });

    const stop = await Stop.findByPk(req.params.id);
    if (!stop) return res.status(404).json({ error: 'Parada no encontrada' });

    const routeOrders = await ValidatedAddress.findAll({ where: { route_id: stop.route_id } });
    const order = routeOrders.find(o =>
      (Math.abs(o.address_lat - stop.lat) < 0.0001 && Math.abs(o.address_lng - stop.lng) < 0.0001)
    ) || routeOrders.find(o => o.validated_address === stop.address);

    if (!order) return res.status(404).json({ error: 'Orden no encontrada para esta parada' });
    if (!order.respond_contact_id) return res.status(400).json({ error: 'Este cliente no tiene contacto en Respond.io' });

    let settings = await MessagingSettings.findOne({ where: { user_id: req.userId } });
    if (!settings || !settings.respond_api_token) {
      settings = await MessagingSettings.findOne({ where: { respond_api_token: { [Op.ne]: null } } });
    }
    if (!settings || !settings.respond_api_token) {
      return res.status(400).json({ error: 'API de Respond.io no configurada' });
    }

    respondApiService.setContext(settings.user_id, settings.respond_api_token);
    const identifier = `id:${order.respond_contact_id}`;
    const channelId = settings.default_channel_id || null;

    const result = await respondApiService.sendWhatsAppTemplate(
      identifier, templateName, languageCode || 'es', components || [], channelId
    );

    console.log(`[Dispatch] Template "${templateName}" enviado a ${order.customer_name} (contacto ${order.respond_contact_id}) via stop`);
    res.json({ success: true, message: 'Template enviado', result });
  } catch (error) {
    console.error('Error sending template via stop:', error.message);
    res.status(500).json({ error: error.message || 'Error al enviar template' });
  }
});

router.post('/stops/:id/send-message', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Mensaje requerido' });

    const stop = await Stop.findByPk(req.params.id);
    if (!stop) return res.status(404).json({ error: 'Parada no encontrada' });

    const routeOrders = await ValidatedAddress.findAll({ where: { route_id: stop.route_id } });
    const order = routeOrders.find(o =>
      (Math.abs(o.address_lat - stop.lat) < 0.0001 && Math.abs(o.address_lng - stop.lng) < 0.0001)
    ) || routeOrders.find(o => o.validated_address === stop.address);

    if (!order) return res.status(404).json({ error: 'Orden no encontrada para esta parada' });
    if (!order.respond_contact_id) return res.status(400).json({ error: 'Este cliente no tiene contacto en Respond.io' });

    let settings = await MessagingSettings.findOne({ where: { user_id: req.userId } });
    if (!settings || !settings.respond_api_token) {
      settings = await MessagingSettings.findOne({ where: { respond_api_token: { [Op.ne]: null } } });
    }
    if (!settings || !settings.respond_api_token) {
      return res.status(400).json({ error: 'API de Respond.io no configurada' });
    }

    respondApiService.setContext(settings.user_id, settings.respond_api_token);
    const identifier = `id:${order.respond_contact_id}`;
    const channelId = settings.default_channel_id || null;

    const result = await respondApiService.sendMessage(identifier, text, channelId);

    console.log(`[Dispatch] Mensaje enviado a ${order.customer_name} (contacto ${order.respond_contact_id}) via stop`);
    res.json({ success: true, message: 'Mensaje enviado', result });
  } catch (error) {
    console.error('Error sending message via stop:', error.message);
    res.status(500).json({ error: error.message || 'Error al enviar mensaje' });
  }
});

export default router;
