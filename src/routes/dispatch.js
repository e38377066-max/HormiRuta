import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { ValidatedAddress, Route, Stop, User, MessagingSettings, DeliveryHistory, FavoriteAddress } from '../models/index.js';
import { saveToDeliveryHistory } from '../utils/deliveryHistory.js';
import { requireAuth, requireAdmin, requireRole } from '../middleware/auth.js';
import { Op, literal } from 'sequelize';
import bcrypt from 'bcryptjs';
import RespondioService from '../services/respondio.js';
import respondApiService from '../services/respondApiService.js';
import { optimizeRouteOrder } from '../services/optimization.js';
import geocodingService from '../services/geocodingService.js';
import AddressExtractorService from '../services/addressExtractorService.js';

const ORDER_STATUS_TO_LIFECYCLE = {
  approved: 'Approved',
  ordered: 'Ordered',
  pickup_ready: 'Pickup Ready',
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

const VALID_ORDER_STATUSES = ['approved', 'ordered', 'pickup_ready', 'on_delivery', 'ups_shipped', 'delivered'];
const ADMIN_STATUSES = ['approved', 'ordered', 'pickup_ready', 'on_delivery', 'ups_shipped', 'delivered'];
const DRIVER_STATUSES = ['delivered'];

const VALID_TRANSITIONS = {
  approved: ['ordered'],
  ordered: ['pickup_ready', 'on_delivery'],
  pickup_ready: ['on_delivery'],
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
        where.order_status = { [Op.notIn]: ['delivered'] };
      }
      if (req.query.available === 'true') {
        where.route_id = { [Op.is]: null };
        where[Op.or] = [
          { order_status: { [Op.notIn]: ['delivered', 'pending'] } },
          {
            order_status: 'pending',
            address_lat: { [Op.ne]: null },
            address_lng: { [Op.ne]: null }
          }
        ];
      }
    } else {
      return res.status(403).json({ error: 'No tienes permisos' });
    }

    where.dispatch_status = { [Op.ne]: 'archived' };
    where[Op.and] = [
      ...(where[Op.and] || []),
      literal("\"customer_name\" !~* '(^|[\\s\\-])REC([\\s\\-]|$)'")
    ];

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
    // Excluye archivadas en TODOS los contadores (las archivadas no se muestran
    // en la grilla principal del dispatcher, asi que tampoco deben contarse).
    const notArchived = { dispatch_status: { [Op.ne]: 'archived' } };
    const [total, approved, ordered, pickupReady, onDelivery, upsShipped, delivered] = await Promise.all([
      ValidatedAddress.count({ where: notArchived }),
      ValidatedAddress.count({ where: { ...notArchived, order_status: 'approved' } }),
      ValidatedAddress.count({ where: { ...notArchived, order_status: 'ordered' } }),
      ValidatedAddress.count({ where: { ...notArchived, order_status: 'pickup_ready' } }),
      ValidatedAddress.count({ where: { ...notArchived, order_status: 'on_delivery' } }),
      ValidatedAddress.count({ where: { ...notArchived, order_status: 'ups_shipped' } }),
      ValidatedAddress.count({ where: { ...notArchived, order_status: 'delivered' } })
    ]);

    res.json({
      total,
      approved,
      ordered,
      pickup_ready: pickupReady,
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

    if (order_status === 'delivered') {
      saveToDeliveryHistory(order);
    }

    const lifecycleName = ORDER_STATUS_TO_LIFECYCLE[order_status];
    if (lifecycleName && (order.respond_contact_id || order.customer_phone)) {
      try {
        // Solo usar el token del dueño de la orden (sin fallback cross-tenant)
        const settings = await MessagingSettings.findOne({ where: { user_id: order.user_id } });
        if (settings?.respond_api_token) {
          respondApiService.setContext(settings.user_id, settings.respond_api_token);
          let identifier = order.respond_contact_id || null;
          if (!identifier && order.customer_phone) {
            const phone = order.customer_phone.replace(/\s+/g, '');
            identifier = `phone:${phone.startsWith('+') ? phone : '+' + phone}`;
          }
          if (identifier) {
            await respondApiService.updateLifecycle(identifier, lifecycleName);
            console.log(`[Dispatch] Lifecycle actualizado en Respond.io: ${order.customer_name} -> ${lifecycleName} (id: ${identifier})`);
          }
        } else {
          console.warn(`[Dispatch] No se encontro MessagingSettings con token valido para actualizar lifecycle de ${order.customer_name}`);
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
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    const order = await ValidatedAddress.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    // Solo admin o el chofer asignado a esta orden pueden editar notas
    if (user.role !== 'admin' && !(user.role === 'driver' && order.assigned_driver_id === user.id)) {
      return res.status(403).json({ error: 'No tienes permisos para editar esta orden' });
    }

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

router.post('/orders/:id/refresh', requireAdmin, async (req, res) => {
  try {
    const order = await ValidatedAddress.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    if (order.route_id) {
      return res.status(400).json({ error: 'No se puede refrescar una orden que está en una ruta activa.' });
    }
    const name = order.customer_name;
    const contactId = order.respond_contact_id;

    if (!contactId) {
      return res.status(400).json({ error: 'Esta orden fue creada manualmente. Usa el botón de editar para cambiar la dirección.' });
    }

    // Solo usar el token del dueño de la orden (sin fallback cross-tenant)
    const settings = await MessagingSettings.findOne({ where: { user_id: order.user_id } });
    if (!settings?.respond_api_token) {
      return res.status(400).json({ error: 'No se encontró token de Respond.io para leer mensajes.' });
    }

    const respondio = new RespondioService(settings.respond_api_token);
    const extractor = new AddressExtractorService();
    const messageLimit = settings.message_history_limit || 50;

    console.log(`[Refresh] Escaneando mensajes de ${name} (contacto ${contactId})...`);

    const messagesResult = await respondio.listMessages(contactId, { limit: messageLimit });
    if (!messagesResult.success || !messagesResult.items || messagesResult.items.length === 0) {
      return res.status(400).json({ error: `No se encontraron mensajes para ${name}. Verifica que el contacto tenga conversación en Respond.io.` });
    }

    const incomingMessages = messagesResult.items.filter(m => m.traffic === 'incoming');
    const outgoingMessages = messagesResult.items.filter(m => m.traffic === 'outgoing');
    let latestExtracted = null;
    let scanMapsLink = null;
    let scanLocationCoords = null;

    for (const msg of incomingMessages) {
      if (msg.message?.type === 'location' && msg.message?.latitude && msg.message?.longitude) {
        scanLocationCoords = { lat: msg.message.latitude, lng: msg.message.longitude };
        break;
      }
      const text = msg.message?.text || '';
      if (!text || text.length < 5) continue;
      const gLink = extractor.extractGoogleMapsLink(text);
      if (gLink) { scanMapsLink = gLink; break; }
      const addr = extractor.extractAddressFromMessage(text);
      if (addr) { latestExtracted = addr; break; }
    }

    if (!scanLocationCoords && !scanMapsLink && !latestExtracted) {
      const confirmPatterns = [
        /(?:esta|esta es|tu|su|la)\s+(?:direccion|dir|address)/i,
        /(?:confirm|verific|correct|bien)\s+.*(?:direccion|dir|address)/i,
        /(?:direccion|address)\s+(?:es|seria|correcta|confirmada|de\s+entrega)/i,
        /(?:te|le)\s+(?:mando|envio|confirmo)\s+(?:la|tu|su)?\s*(?:direccion|dir|address)/i,
        /(?:entrega|delivery|envio)\s+(?:a|en|para)\s*:?\s*/i,
        /direccion\s+de\s+entrega/i,
        /dir(?:eccion)?[\s:]+\d+/i
      ];
      for (const msg of outgoingMessages) {
        const text = msg.message?.text || '';
        if (!text || text.length < 5) continue;
        const gLink = extractor.extractGoogleMapsLink(text);
        if (gLink) { scanMapsLink = gLink; break; }
        const isConfirmation = confirmPatterns.some(p => p.test(text));
        if (isConfirmation) {
          const addr = extractor.extractAddressFromMessage(text);
          if (addr) { latestExtracted = addr; break; }
        }
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length >= 8);
        for (const line of lines) {
          if (/^\d+\s+\w/.test(line) && /\b(st|ave|rd|dr|blvd|ln|ct|way|pl|pkwy|hwy|cir|trail|loop)\b/i.test(line)) {
            const addr = extractor.extractAddressFromMessage(line);
            if (addr) { latestExtracted = addr; break; }
          }
        }
        if (latestExtracted) break;
      }
    }

    let result;
    if (scanLocationCoords) {
      result = { address: null, googleMapsCoords: scanLocationCoords };
    } else if (scanMapsLink) {
      result = { address: null, googleMapsLink: scanMapsLink };
    } else if (latestExtracted) {
      result = { address: latestExtracted };
    } else {
      result = extractor.extractAddressFromConversation(messagesResult.items);
    }

    if (!result || (!result.address && !result.googleMapsLink && !result.googleMapsCoords)) {
      await order.update({
        validated_address: null, original_address: null,
        address_lat: null, address_lng: null,
        zip_code: null, city: null, state: null,
        source: 'placeholder', confidence: null
      });
      const pollingService = (await import('../services/pollingService.js')).default;
      pollingService.addressScannedContacts.delete(contactId);
      console.log(`[Refresh] No se encontró dirección en el chat de ${name}`);
      return res.json({ success: true, message: `No se encontró dirección en el chat de ${name}. Se reintentará automáticamente.`, addressFound: false });
    }

    let finalAddress = result.address;
    let finalZip = null;
    let geocoded = { success: false };

    if (result.googleMapsCoords) {
      geocoded = await geocodingService.reverseGeocode(result.googleMapsCoords.lat, result.googleMapsCoords.lng);
      if (geocoded.success) {
        finalAddress = geocoded.fullAddress;
        finalZip = geocoded.zip;
      }
    } else if (result.googleMapsLink) {
      const resolved = await geocodingService.resolveGoogleMapsLink(result.googleMapsLink);
      if (resolved.success) {
        if (resolved.lat && resolved.lng) {
          geocoded = await geocodingService.reverseGeocode(resolved.lat, resolved.lng);
        } else if (resolved.address) {
          geocoded = await geocodingService.geocodeAddress(resolved.address);
        }
        if (geocoded.success) {
          finalAddress = geocoded.fullAddress;
          finalZip = geocoded.zip;
        }
      }
    } else if (result.address) {
      geocoded = await geocodingService.geocodeAddress(result.address);
      if (geocoded.success) {
        finalAddress = geocoded.fullAddress;
        finalZip = geocoded.zip;
      } else {
        const components = extractor.extractFullAddressComponents(result.address);
        finalZip = components.zip;
      }
    }

    if (!finalAddress) {
      return res.json({ success: true, message: `Se encontró información pero no se pudo resolver la dirección de ${name}.`, addressFound: false });
    }

    const lat = geocoded?.success ? geocoded.latitude : null;
    const lng = geocoded?.success ? geocoded.longitude : null;

    await order.update({
      validated_address: finalAddress,
      original_address: result.address || finalAddress,
      address_lat: lat,
      address_lng: lng,
      zip_code: finalZip,
      city: geocoded?.city || null,
      state: geocoded?.state || null,
      source: 'chat_scan',
      confidence: geocoded?.confidence || null
    });

    const pollingService = (await import('../services/pollingService.js')).default;
    pollingService.addressScannedContacts.add(contactId);

    try {
      const customFieldsUpdate = { address: finalAddress };
      if (finalZip) customFieldsUpdate.zip_code = finalZip;
      await respondio.updateContactCustomFields(contactId, customFieldsUpdate);
    } catch (cfErr) {
      console.log(`[Refresh] No se pudo actualizar custom fields de ${name}, pero la dirección local sí se guardó`);
    }

    console.log(`[Refresh] Dirección actualizada para ${name}: "${finalAddress}"`);
    res.json({ success: true, message: `Dirección actualizada: ${finalAddress}`, addressFound: true, address: finalAddress });
  } catch (error) {
    console.error('Error refreshing order:', error);
    res.status(500).json({ error: 'Error al refrescar orden' });
  }
});

router.delete('/orders/:id', requireAdmin, async (req, res) => {
  try {
    const order = await ValidatedAddress.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    if (order.route_id) {
      return res.status(400).json({ error: 'No se puede borrar una orden que está en una ruta activa. Primero remuévela de la ruta.' });
    }
    const name = order.customer_name;
    await order.destroy();
    console.log(`[Dispatch] Orden #${req.params.id} eliminada: ${name}`);
    res.json({ success: true, message: `Orden de ${name} eliminada` });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Error al eliminar orden' });
  }
});

router.get('/accounting', requireAdmin, async (req, res) => {
  try {
    const { driver_id, date_from, date_to } = req.query;

    // Fuente: DeliveryHistory (snapshot permanente). Esto garantiza que el
    // resumen NO desaparezca cuando una orden se reactiva (cliente vuelve a
    // pedir) o se archiva por el cleanup. Cada entrega real queda contada.
    const whereDel = { driver_id: { [Op.ne]: null } };
    if (driver_id) whereDel.driver_id = parseInt(driver_id);
    if (date_from || date_to) {
      whereDel.delivered_at = {};
      if (date_from) whereDel.delivered_at[Op.gte] = new Date(date_from + 'T00:00:00');
      if (date_to) whereDel.delivered_at[Op.lte] = new Date(date_to + 'T23:59:59');
    }

    const deliveries = await DeliveryHistory.findAll({
      where: whereDel,
      order: [['delivered_at', 'DESC']]
    });

    const driverIds = [...new Set(deliveries.map(d => d.driver_id).filter(Boolean))];
    const drivers = driverIds.length > 0
      ? await User.findAll({ where: { id: { [Op.in]: driverIds } } })
      : [];
    const driverMap = {};
    drivers.forEach(d => { driverMap[d.id] = d; });

    const grouped = {};
    for (const del of deliveries) {
      const did = del.driver_id;
      if (!grouped[did]) {
        const driver = driverMap[did];
        grouped[did] = {
          driver_id: did,
          driver_name: driver?.username || del.driver_name || `Chofer #${did}`,
          // Comision por parada actual del chofer (para mostrar en columna).
          // El total se calcula con el snapshot de cada entrega.
          commission_per_stop: driver?.commission_per_stop || del.commission_per_stop || 0,
          stops_count: 0,
          total_order_cost: 0,
          total_deposit: 0,
          total_collected: 0,
          total_commission: 0,
          orders: []
        };
      }

      grouped[did].stops_count += 1;
      grouped[did].total_order_cost += Number(del.order_cost) || 0;
      grouped[did].total_deposit += Number(del.deposit_amount) || 0;
      grouped[did].total_collected += Number(del.amount_collected) || 0;
      grouped[did].total_commission += Number(del.commission_per_stop) || 0;
      grouped[did].orders.push({
        // Usamos el id del snapshot (DeliveryHistory.id) como key para evitar
        // colisiones cuando la misma orden se reactiva y se vuelve a entregar.
        id: del.id,
        original_order_id: del.original_order_id,
        customer_name: del.customer_name,
        order_cost: del.order_cost,
        deposit_amount: del.deposit_amount,
        total_to_collect: del.total_to_collect,
        amount_collected: del.amount_collected,
        payment_method: del.payment_method,
        delivered_at: del.delivered_at
      });
    }

    const report = Object.values(grouped).map(g => ({
      ...g,
      balance: g.total_collected - g.total_commission
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
    const { driver_id, date_from, date_to, search, month_year } = req.query;

    const where = {};
    if (driver_id) where.driver_id = parseInt(driver_id);
    if (month_year) {
      where.month_year = month_year;
    } else if (date_from || date_to) {
      where.delivered_at = {};
      if (date_from) where.delivered_at[Op.gte] = new Date(date_from + 'T00:00:00');
      if (date_to) where.delivered_at[Op.lte] = new Date(date_to + 'T23:59:59');
    }
    if (search) {
      where[Op.or] = [
        { customer_name: { [Op.iLike]: `%${search}%` } },
        { customer_phone: { [Op.iLike]: `%${search}%` } },
        { address: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const deliveries = await DeliveryHistory.findAll({ where, order: [['delivered_at', 'DESC']] });

    const availableMonths = await DeliveryHistory.findAll({
      attributes: ['month_year'],
      group: ['month_year'],
      order: [['month_year', 'DESC']]
    });

    res.json({
      success: true,
      deliveries: deliveries.map(d => ({
        id: d.id,
        original_order_id: d.original_order_id,
        customer_name: d.customer_name,
        customer_phone: d.customer_phone,
        address: d.address,
        city: d.city,
        state: d.state,
        driver_id: d.driver_id,
        driver_name: d.driver_name,
        commission_per_stop: d.commission_per_stop || 0,
        order_cost: d.order_cost || 0,
        deposit_amount: d.deposit_amount || 0,
        total_to_collect: d.total_to_collect || 0,
        amount_collected: d.amount_collected || 0,
        payment_method: d.payment_method,
        payment_status: d.payment_status,
        delivered_at: d.delivered_at,
        month_year: d.month_year,
        archived: d.archived
      })),
      total: deliveries.length,
      available_months: availableMonths.map(m => m.month_year)
    });
  } catch (error) {
    console.error('Error fetching deliveries report:', error);
    res.status(500).json({ error: 'Error al generar reporte de entregas' });
  }
});

router.post('/deliveries-report/archive-month', requireAdmin, async (req, res) => {
  try {
    const { month_year } = req.body;
    if (!month_year || !/^\d{4}-\d{2}$/.test(month_year)) {
      return res.status(400).json({ error: 'Formato de mes inválido. Use YYYY-MM' });
    }

    const deliveries = await DeliveryHistory.findAll({ where: { month_year, archived: false } });
    if (deliveries.length === 0) {
      return res.status(400).json({ error: 'No hay entregas sin archivar en ese mes' });
    }

    const xlsx = (await import('xlsx')).default;

    const [year, month] = month_year.split('-');
    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const monthLabel = `${monthNames[parseInt(month) - 1]} ${year}`;

    const rows = deliveries.map(d => ({
      'ID': d.original_order_id || d.id,
      'Cliente': d.customer_name || '',
      'Teléfono': d.customer_phone || '',
      'Dirección': d.address || '',
      'Ciudad': d.city || '',
      'Estado': d.state || '',
      'Chofer': d.driver_name || '',
      'Costo Orden': d.order_cost || 0,
      'Depósito': d.deposit_amount || 0,
      'A Cobrar': d.total_to_collect || 0,
      'Cobrado': d.amount_collected || 0,
      'Método Pago': d.payment_method || '',
      'Comisión/Parada': d.commission_per_stop || 0,
      'Fecha Entrega': d.delivered_at ? new Date(d.delivered_at).toLocaleDateString('es') : ''
    }));

    const totalsRow = {
      'ID': 'TOTALES',
      'Cliente': `${deliveries.length} entregas`,
      'Teléfono': '',
      'Dirección': '',
      'Ciudad': '',
      'Estado': '',
      'Chofer': '',
      'Costo Orden': deliveries.reduce((s, d) => s + (d.order_cost || 0), 0),
      'Depósito': deliveries.reduce((s, d) => s + (d.deposit_amount || 0), 0),
      'A Cobrar': deliveries.reduce((s, d) => s + (d.total_to_collect || 0), 0),
      'Cobrado': deliveries.reduce((s, d) => s + (d.amount_collected || 0), 0),
      'Método Pago': '',
      'Comisión/Parada': deliveries.reduce((s, d) => s + (d.commission_per_stop || 0), 0),
      'Fecha Entrega': ''
    };

    rows.push(totalsRow);

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(rows);

    const colWidths = [
      { wch: 8 }, { wch: 22 }, { wch: 14 }, { wch: 35 }, { wch: 14 }, { wch: 10 },
      { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 16 }
    ];
    ws['!cols'] = colWidths;

    xlsx.utils.book_append_sheet(wb, ws, monthLabel);

    const { default: fs } = await import('fs');
    const { default: pathMod } = await import('path');
    const archiveDir = pathMod.join(process.cwd(), 'uploads', 'monthly_reports');
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

    const filename = `reporte_${month_year}.xlsx`;
    const filepath = pathMod.join(archiveDir, filename);
    xlsx.writeFile(wb, filepath);

    await DeliveryHistory.update({ archived: true }, { where: { month_year, archived: false } });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(filepath).pipe(res);
  } catch (error) {
    console.error('Error archiving month:', error);
    res.status(500).json({ error: 'Error al archivar mes' });
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
      const settingsCache = new Map();
      for (const o of ordersToUpdate) {
        if (!o.respond_contact_id && !o.customer_phone) continue;
        try {
          // Solo usar el token del dueño de la orden (sin fallback cross-tenant)
          let settings = settingsCache.get(o.user_id);
          if (settings === undefined) {
            settings = await MessagingSettings.findOne({ where: { user_id: o.user_id } });
            settingsCache.set(o.user_id, settings);
          }
          if (settings?.respond_api_token) {
            respondApiService.setContext(settings.user_id, settings.respond_api_token);
            let identifier = o.respond_contact_id || null;
            if (!identifier && o.customer_phone) {
              const phone = o.customer_phone.replace(/\s+/g, '');
              identifier = `phone:${phone.startsWith('+') ? phone : '+' + phone}`;
            }
            if (identifier) {
              await respondApiService.updateLifecycle(identifier, lifecycleName);
              console.log(`[Dispatch] Lifecycle bulk: ${o.customer_name} -> ${lifecycleName}`);
            }
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
    const { name, order_ids, pre_optimized, favorite_stops } = req.body;
    const hasOrders = Array.isArray(order_ids) && order_ids.length > 0;
    const hasFavs = Array.isArray(favorite_stops) && favorite_stops.length > 0;

    if (!hasOrders && !hasFavs) {
      return res.status(400).json({ error: 'Selecciona al menos una orden o favorita' });
    }

    const ordersMap = new Map();
    if (hasOrders) {
      const dbOrders = await ValidatedAddress.findAll({
        where: { id: { [Op.in]: order_ids } }
      });
      dbOrders.forEach(o => ordersMap.set(o.id, o));
    }

    const totalStops = ordersMap.size + (hasFavs ? favorite_stops.length : 0);
    const route = await Route.create({
      user_id: req.userId,
      name: name || `Ruta ${new Date().toLocaleDateString('es', { day: '2-digit', month: 'short' })} - ${totalStops} paradas`,
      status: 'draft',
      is_optimized: !!pre_optimized
    });

    let stopOrder = 0;
    if (hasOrders) {
      for (let i = 0; i < order_ids.length; i++) {
        const order = ordersMap.get(order_ids[i]);
        if (!order) continue;
        await Stop.create({
          route_id: route.id,
          address: order.validated_address,
          lat: order.address_lat,
          lng: order.address_lng,
          order: stopOrder++,
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
    }

    if (hasFavs) {
      for (const fav of favorite_stops) {
        await Stop.create({
          route_id: route.id,
          address: fav.address || fav.name,
          lat: fav.lat,
          lng: fav.lng,
          order: stopOrder++,
          customer_name: fav.name,
          phone: fav.customer_phone || '',
          note: fav.notes || ''
        });
      }
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

router.delete('/routes/:id', requireAdmin, async (req, res) => {
  try {
    const route = await Route.findByPk(req.params.id);
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });

    await ValidatedAddress.update({ route_id: null }, { where: { route_id: route.id } });
    await Stop.destroy({ where: { route_id: route.id } });
    await route.destroy();

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting route:', error);
    res.status(500).json({ error: 'Error al eliminar ruta' });
  }
});

router.delete('/routes/:id/stops/:stopId', requireAdmin, async (req, res) => {
  try {
    const stop = await Stop.findOne({ where: { id: req.params.stopId, route_id: req.params.id } });
    if (!stop) return res.status(404).json({ error: 'Parada no encontrada' });

    await ValidatedAddress.update({ route_id: null }, { where: { route_id: req.params.id, validated_address: stop.address } });
    await stop.destroy();

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing stop:', error);
    res.status(500).json({ error: 'Error al quitar parada' });
  }
});

router.post('/routes/:id/orders', requireAdmin, async (req, res) => {
  try {
    const { order_ids, favorite_stops } = req.body;
    const route = await Route.findByPk(req.params.id);
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });

    const existingStops = await Stop.count({ where: { route_id: route.id } });
    let stopOrder = existingStops;

    if (Array.isArray(order_ids) && order_ids.length > 0) {
      const dbOrders = await ValidatedAddress.findAll({ where: { id: { [Op.in]: order_ids } } });
      for (const order of dbOrders) {
        if (order.route_id === route.id) continue;
        await Stop.create({
          route_id: route.id,
          address: order.validated_address,
          lat: order.address_lat,
          lng: order.address_lng,
          order: stopOrder++,
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
    }

    if (Array.isArray(favorite_stops) && favorite_stops.length > 0) {
      for (const fav of favorite_stops) {
        await Stop.create({
          route_id: route.id,
          address: fav.address || fav.name,
          lat: fav.lat,
          lng: fav.lng,
          order: stopOrder++,
          customer_name: fav.name,
          phone: fav.customer_phone || '',
          note: fav.notes || ''
        });
      }
    }

    res.json({ success: true, route: await route.toDict() });
  } catch (error) {
    console.error('Error adding orders to route:', error);
    res.status(500).json({ error: 'Error al agregar paradas' });
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
      const routeAllStops = await Stop.findAll({
        where: { route_id: r.id },
        order: [['order', 'ASC']]
      });
      routeDict.orders = routeOrders.map(o => o.toDict());
      routeDict.route_stops = routeAllStops.map(s => s.toDict());
      routeDict.total_amount = routeOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
      routeDict.driver_commission_per_stop = r.assigned_driver_id ? (driverCommissionMap[r.assigned_driver_id] || 0) : 0;
      routeDict.driver_commission_total = routeDict.driver_commission_per_stop * (routeDict.stops_count || 0);
      routeDict.route_total_collected = routeAllStops.reduce((sum, s) => sum + (Number(s.amount_collected) || 0), 0);
      routeDict.payment_delivered = r.payment_delivered || false;
      routeDict.payment_delivery_method = r.payment_delivery_method || null;
      routeDict.payment_delivered_at = r.payment_delivered_at || null;
      return routeDict;
    }));

    res.json({ routes: routesWithDetails });
  } catch (error) {
    console.error('Error fetching dispatch routes:', error);
    res.status(500).json({ error: 'Error al cargar rutas' });
  }
});

router.get('/routes/payment-status', requireAdmin, async (req, res) => {
  try {
    const { driver_id, date_from, date_to } = req.query;

    const where = { status: 'completed' };
    if (driver_id) where.assigned_driver_id = parseInt(driver_id);
    if (date_from || date_to) {
      where.completed_at = {};
      if (date_from) where.completed_at[Op.gte] = new Date(date_from + 'T00:00:00');
      if (date_to) where.completed_at[Op.lte] = new Date(date_to + 'T23:59:59');
    }

    const routes = await Route.findAll({ where, order: [['completed_at', 'DESC']] });

    const driverIds = [...new Set(routes.map(r => r.assigned_driver_id).filter(Boolean))];
    const drivers = driverIds.length > 0
      ? await User.findAll({ where: { id: { [Op.in]: driverIds } }, attributes: ['id', 'username', 'email', 'commission_per_stop'] })
      : [];
    const driverMap = {};
    drivers.forEach(d => { driverMap[d.id] = d; });

    const routeIds = routes.map(r => r.id);
    const stopCounts = routeIds.length > 0
      ? await Stop.findAll({
          attributes: ['route_id', [Stop.sequelize.fn('COUNT', Stop.sequelize.col('id')), 'cnt']],
          where: { route_id: { [Op.in]: routeIds } },
          group: ['route_id'],
          raw: true
        })
      : [];
    const stopCountMap = {};
    stopCounts.forEach(s => { stopCountMap[s.route_id] = parseInt(s.cnt || 0); });

    const result = routes.map(r => {
      const driver = r.assigned_driver_id ? driverMap[r.assigned_driver_id] : null;
      const grossCollected = Number(r.route_total_collected || 0);
      const stopCount = stopCountMap[r.id] || 0;
      const commissionPerStop = Number(driver?.commission_per_stop || 0);
      const totalCommission = commissionPerStop * stopCount;
      const netToCompany = Math.max(0, grossCollected - totalCommission);
      const received = Number(r.admin_amount_received || 0);
      return {
        id: r.id,
        name: r.name,
        driver_id: r.assigned_driver_id,
        driver_name: driver ? (driver.username || driver.email) : 'Sin chofer',
        completed_at: r.completed_at,
        stops_count: stopCount,
        route_gross_collected: grossCollected,
        route_total_commission: totalCommission,
        commission_per_stop: commissionPerStop,
        route_total_collected: netToCompany,
        payment_delivered: r.payment_delivered || false,
        payment_delivery_method: r.payment_delivery_method || null,
        payment_delivered_at: r.payment_delivered_at || null,
        admin_confirmed: r.admin_confirmed || false,
        admin_amount_received: received,
        admin_payment_records: Array.isArray(r.admin_payment_records) ? r.admin_payment_records : [],
        admin_remaining: Math.max(0, netToCompany - received)
      };
    });

    res.json({ routes: result });
  } catch (error) {
    console.error('Error fetching route payment status:', error);
    res.status(500).json({ error: 'Error al cargar pagos de rutas' });
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

    const settingsCache = new Map();
    for (const order of orders) {
      order.assigned_driver_id = driver_id;
      order.driver_name = driver.username;
      const prevStatus = order.order_status;
      const willChangeToOnDelivery = prevStatus !== 'ups_shipped' && prevStatus !== 'on_delivery';
      if (prevStatus !== 'ups_shipped') {
        order.order_status = 'on_delivery';
      }
      await order.save();

      // Sincronizar lifecycle en Respond.io solo cuando realmente hubo
      // transicion a on_delivery (evita llamadas redundantes y desyncs como
      // dispatch="En Entrega" / Respond="Pending").
      if (willChangeToOnDelivery && order.respond_contact_id) {
        try {
          let settings = settingsCache.get(order.user_id);
          if (settings === undefined) {
            settings = await MessagingSettings.findOne({ where: { user_id: order.user_id } });
            settingsCache.set(order.user_id, settings);
          }
          if (settings?.respond_api_token) {
            respondApiService.setContext(order.user_id, settings.respond_api_token);
            await respondApiService.updateLifecycle(order.respond_contact_id, 'On Delivery');
            console.log(`[Dispatch] Ruta asignada - Lifecycle: ${order.customer_name} -> On Delivery`);
          }
        } catch (lcErr) {
          console.error(`[Dispatch] Error lifecycle asignacion ${order.customer_name}:`, lcErr.message);
        }
      }
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
    // Solo usar el token del admin autenticado (sin fallback cross-tenant)
    const settings = await MessagingSettings.findOne({ where: { user_id: req.userId } });
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

router.put('/stops/:id/skip', requireAuth, async (req, res) => {
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

    stop.status = 'skipped';
    stop.completed_at = new Date();
    await stop.save();

    const routeOrders = await ValidatedAddress.findAll({ where: { route_id: stop.route_id } });
    const orderMatch = routeOrders.find(o =>
      (Math.abs(o.address_lat - stop.lat) < 0.0001 && Math.abs(o.address_lng - stop.lng) < 0.0001)
    ) || routeOrders.find(o => o.validated_address === stop.address);

    if (orderMatch) {
      orderMatch.route_id = null;
      orderMatch.order_status = 'approved';
      await orderMatch.save();
    }

    res.json({ success: true, stop: stop.toDict() });
  } catch (error) {
    console.error('Error skipping stop:', error);
    res.status(500).json({ error: 'Error al saltar parada' });
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
    const allDone = allStops.every(s => s.status === 'completed' || s.status === 'skipped');
    if (!allDone) {
      return res.status(400).json({ error: 'Todas las paradas deben estar completadas o saltadas antes de finalizar' });
    }

    route.status = 'completed';
    route.completed_at = new Date();
    await route.save();

    const orders = await ValidatedAddress.findAll({ where: { route_id: route.id } });
    for (const order of orders) {
      order.order_status = 'delivered';
      order.delivered_at = new Date();
      await order.save();

      saveToDeliveryHistory(order);

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

router.put('/routes/:id/deliver-payment', requireAuth, async (req, res) => {
  try {
    const route = await Route.findByPk(req.params.id);
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });

    if (route.assigned_driver_id !== req.userId) {
      const user = await User.findByPk(req.userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'No tienes permisos' });
      }
    }

    if (route.status !== 'completed') {
      return res.status(400).json({ error: 'La ruta debe estar completada primero' });
    }

    const { payment_method } = req.body;
    if (!payment_method) return res.status(400).json({ error: 'Selecciona un método de pago' });

    const allStops = await Stop.findAll({ where: { route_id: route.id } });
    const totalCollected = allStops.reduce((sum, s) => sum + (Number(s.amount_collected) || 0), 0);

    route.payment_delivered = true;
    route.payment_delivery_method = payment_method;
    route.payment_delivered_at = new Date();
    route.route_total_collected = totalCollected;
    await route.save();

    res.json({ success: true, total_collected: totalCollected, payment_delivery_method: payment_method });
  } catch (error) {
    console.error('Error registrando entrega de pago:', error);
    res.status(500).json({ error: 'Error al registrar entrega de pago' });
  }
});

router.put('/routes/:id/admin-confirm-payment', requireAdmin, async (req, res) => {
  try {
    const route = await Route.findByPk(req.params.id);
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });
    if (!route.payment_delivered) {
      return res.status(400).json({ error: 'El chofer aún no ha marcado el pago como entregado' });
    }

    const { type, amount, method } = req.body;
    if (!method) return res.status(400).json({ error: 'Selecciona un método de pago' });

    const total = Number(route.route_total_collected || 0);
    const alreadyReceived = Number(route.admin_amount_received || 0);
    const records = Array.isArray(route.admin_payment_records) ? [...route.admin_payment_records] : [];

    let amountToAdd;
    if (type === 'full') {
      amountToAdd = total - alreadyReceived;
    } else {
      amountToAdd = Number(amount);
      if (isNaN(amountToAdd) || amountToAdd <= 0) {
        return res.status(400).json({ error: 'Ingresa un monto válido mayor a 0' });
      }
    }

    const newTotal = alreadyReceived + amountToAdd;
    records.push({ amount: amountToAdd, method, date: new Date().toISOString() });

    route.admin_amount_received = newTotal;
    route.admin_payment_records = records;
    route.payment_delivery_method = method;

    if (newTotal >= total) {
      route.admin_confirmed = true;
    }

    await route.save();

    res.json({
      success: true,
      admin_confirmed: route.admin_confirmed,
      admin_amount_received: Number(route.admin_amount_received),
      admin_payment_records: route.admin_payment_records,
      remaining: Math.max(0, total - Number(route.admin_amount_received))
    });
  } catch (error) {
    console.error('Error confirmando pago admin:', error);
    res.status(500).json({ error: 'Error al confirmar pago' });
  }
});

router.get('/routes/:id/detail', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    const route = await Route.findByPk(req.params.id);
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });

    // Solo admin o el chofer asignado pueden ver el detalle de la ruta
    if (user.role !== 'admin' && route.assigned_driver_id !== user.id) {
      return res.status(403).json({ error: 'No tienes permisos para ver esta ruta' });
    }

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

    // Solo admin o el chofer asignado pueden marcar la orden como entregada
    if (user.role !== 'admin' && !(user.role === 'driver' && order.assigned_driver_id === user.id)) {
      return res.status(403).json({ error: 'No tienes permisos para esta orden' });
    }

    order.order_status = 'delivered';
    order.delivered_at = new Date();
    await order.save();

    saveToDeliveryHistory(order);

    res.json({ success: true, order: order.toDict() });
  } catch (error) {
    console.error('Error marking delivered:', error);
    res.status(500).json({ error: 'Error al marcar como entregado' });
  }
});

router.get('/templates', requireAuth, async (req, res) => {
  try {
    // Solo usar el token del usuario autenticado (sin fallback cross-tenant)
    const settings = await MessagingSettings.findOne({ where: { user_id: req.userId } });
    if (!settings || !settings.respond_api_token || !settings.default_channel_id) {
      return res.json({ templates: [] });
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

    const user = await User.findByPk(req.userId);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    const order = await ValidatedAddress.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    if (!order.respond_contact_id) return res.status(400).json({ error: 'Este cliente no tiene contacto en Respond.io' });

    // Solo admin o el chofer asignado pueden enviar mensajes por esta orden
    if (user.role !== 'admin' && !(user.role === 'driver' && order.assigned_driver_id === user.id)) {
      return res.status(403).json({ error: 'No tienes permisos para enviar mensajes por esta orden' });
    }

    // Buscar token del dueño de la orden. Sin fallback cross-tenant para evitar
    // que un chofer use credenciales de otro tenant.
    const settings = await MessagingSettings.findOne({ where: { user_id: order.user_id } });
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

    const user = await User.findByPk(req.userId);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    const order = await ValidatedAddress.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    if (!order.respond_contact_id) return res.status(400).json({ error: 'Este cliente no tiene contacto en Respond.io' });

    if (user.role !== 'admin' && !(user.role === 'driver' && order.assigned_driver_id === user.id)) {
      return res.status(403).json({ error: 'No tienes permisos para enviar mensajes por esta orden' });
    }

    const settings = await MessagingSettings.findOne({ where: { user_id: order.user_id } });
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

    const user = await User.findByPk(req.userId);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    const stop = await Stop.findByPk(req.params.id);
    if (!stop) return res.status(404).json({ error: 'Parada no encontrada' });

    const route = await Route.findByPk(stop.route_id);
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });

    if (user.role !== 'admin' && route.assigned_driver_id !== user.id) {
      return res.status(403).json({ error: 'No tienes permisos para esta ruta' });
    }

    const routeOrders = await ValidatedAddress.findAll({ where: { route_id: stop.route_id } });
    const order = routeOrders.find(o =>
      (Math.abs(o.address_lat - stop.lat) < 0.0001 && Math.abs(o.address_lng - stop.lng) < 0.0001)
    ) || routeOrders.find(o => o.validated_address === stop.address);

    if (!order) return res.status(404).json({ error: 'Orden no encontrada para esta parada' });
    if (!order.respond_contact_id) return res.status(400).json({ error: 'Este cliente no tiene contacto en Respond.io' });

    const settings = await MessagingSettings.findOne({ where: { user_id: order.user_id } });
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

    const user = await User.findByPk(req.userId);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    const stop = await Stop.findByPk(req.params.id);
    if (!stop) return res.status(404).json({ error: 'Parada no encontrada' });

    const route = await Route.findByPk(stop.route_id);
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });

    if (user.role !== 'admin' && route.assigned_driver_id !== user.id) {
      return res.status(403).json({ error: 'No tienes permisos para esta ruta' });
    }

    const routeOrders = await ValidatedAddress.findAll({ where: { route_id: stop.route_id } });
    const order = routeOrders.find(o =>
      (Math.abs(o.address_lat - stop.lat) < 0.0001 && Math.abs(o.address_lng - stop.lng) < 0.0001)
    ) || routeOrders.find(o => o.validated_address === stop.address);

    if (!order) return res.status(404).json({ error: 'Orden no encontrada para esta parada' });
    if (!order.respond_contact_id) return res.status(400).json({ error: 'Este cliente no tiene contacto en Respond.io' });

    const settings = await MessagingSettings.findOne({ where: { user_id: order.user_id } });
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

router.get('/my-accounting', requireAuth, async (req, res) => {
  try {
    const { month_year, date_from, date_to } = req.query;

    const where = { driver_id: req.userId };
    if (month_year) {
      where.month_year = month_year;
    } else {
      if (date_from) where.delivered_at = { ...where.delivered_at, [Op.gte]: new Date(date_from) };
      if (date_to) where.delivered_at = { ...where.delivered_at, [Op.lte]: new Date(date_to + 'T23:59:59') };
    }

    const deliveries = await DeliveryHistory.findAll({
      where,
      order: [['delivered_at', 'DESC']]
    });

    const allMonths = await DeliveryHistory.findAll({
      where: { driver_id: req.userId },
      attributes: ['month_year'],
      group: ['month_year'],
      order: [['month_year', 'DESC']]
    });

    const byMonth = {};
    for (const d of deliveries) {
      const my = d.month_year || 'Sin fecha';
      if (!byMonth[my]) {
        byMonth[my] = {
          month_year: my,
          deliveries: [],
          total_collected: 0,
          total_commission: 0,
          total_to_collect: 0,
          stops_count: 0
        };
      }
      byMonth[my].deliveries.push({
        id: d.id,
        customer_name: d.customer_name,
        customer_phone: d.customer_phone,
        address: d.address,
        order_cost: Number(d.order_cost || 0),
        deposit_amount: Number(d.deposit_amount || 0),
        total_to_collect: Number(d.total_to_collect || 0),
        amount_collected: Number(d.amount_collected || 0),
        commission_per_stop: Number(d.commission_per_stop || 0),
        payment_method: d.payment_method,
        payment_status: d.payment_status,
        delivered_at: d.delivered_at,
        archived: d.archived
      });
      byMonth[my].total_collected += Number(d.amount_collected || 0);
      byMonth[my].total_commission += Number(d.commission_per_stop || 0);
      byMonth[my].total_to_collect += Number(d.total_to_collect || 0);
      byMonth[my].stops_count += 1;
    }

    const months = Object.values(byMonth).map(m => ({
      ...m,
      to_deliver: m.total_collected - m.total_commission
    }));

    const totals = deliveries.reduce((acc, d) => ({
      stops: acc.stops + 1,
      collected: acc.collected + Number(d.amount_collected || 0),
      commission: acc.commission + Number(d.commission_per_stop || 0),
      to_collect: acc.to_collect + Number(d.total_to_collect || 0)
    }), { stops: 0, collected: 0, commission: 0, to_collect: 0 });

    // Calcular to_deliver usando la misma lógica que las tarjetas individuales de rutas
    // para que el total sea consistente con lo que se muestra por ruta
    const allDriverRoutes = await Route.findAll({
      where: { assigned_driver_id: req.userId, status: 'completed' },
      attributes: ['id', 'route_total_collected', 'admin_amount_received']
    });
    const allRouteIds = allDriverRoutes.map(r => r.id);
    const allRouteStops = allRouteIds.length > 0
      ? await Stop.findAll({ where: { route_id: { [Op.in]: allRouteIds } }, attributes: ['route_id', 'amount_collected'] })
      : [];
    const stopCountMap = {};
    const stopCollectedMap = {};
    allRouteStops.forEach(s => {
      stopCountMap[s.route_id] = (stopCountMap[s.route_id] || 0) + 1;
      stopCollectedMap[s.route_id] = (stopCollectedMap[s.route_id] || 0) + Number(s.amount_collected || 0);
    });
    const driverUser = await User.findByPk(req.userId, { attributes: ['commission_per_stop'] });
    const driverCommission = Number(driverUser?.commission_per_stop || 0);

    let pendingStops = 0;
    totals.to_deliver = allDriverRoutes.reduce((sum, r) => {
      // Mismo fallback que /my-completed-routes: si route_total_collected aun no esta seteado
      // (chofer no marco como entregado), sumar desde los stops
      const collected = Number(r.route_total_collected || 0) || (stopCollectedMap[r.id] || 0);
      const stopCount = stopCountMap[r.id] || 0;
      const commission = driverCommission * stopCount;
      const grossToDeliver = collected - commission;
      const received = Number(r.admin_amount_received || 0);
      const pending = Math.max(0, grossToDeliver - received);
      if (pending > 0) pendingStops += stopCount;
      return sum + pending;
    }, 0);
    totals.stops_pending = pendingStops;

    res.json({
      months,
      totals,
      deliveries: deliveries.map(d => ({
        id: d.id,
        customer_name: d.customer_name,
        customer_phone: d.customer_phone,
        address: d.address,
        order_cost: Number(d.order_cost || 0),
        deposit_amount: Number(d.deposit_amount || 0),
        total_to_collect: Number(d.total_to_collect || 0),
        amount_collected: Number(d.amount_collected || 0),
        commission_per_stop: Number(d.commission_per_stop || 0),
        payment_method: d.payment_method,
        payment_status: d.payment_status,
        delivered_at: d.delivered_at,
        month_year: d.month_year,
        archived: d.archived
      })),
      available_months: allMonths.map(m => m.month_year).filter(Boolean)
    });
  } catch (error) {
    console.error('Error my-accounting:', error);
    res.status(500).json({ error: 'Error al cargar tu contabilidad' });
  }
});

router.get('/my-completed-routes', requireAuth, async (req, res) => {
  try {
    const routes = await Route.findAll({
      where: {
        assigned_driver_id: req.userId,
        status: 'completed'
      },
      order: [['completed_at', 'DESC']],
      limit: 60
    });

    if (routes.length === 0) {
      return res.json({ routes: [] });
    }

    const routeIds = routes.map(r => r.id);
    const stops = await Stop.findAll({ where: { route_id: { [Op.in]: routeIds } } });

    const driver = await User.findByPk(req.userId, { attributes: ['commission_per_stop'] });
    const commissionPerStop = Number(driver?.commission_per_stop || 0);

    const stopMap = {};
    stops.forEach(s => {
      if (!stopMap[s.route_id]) stopMap[s.route_id] = [];
      stopMap[s.route_id].push(s);
    });

    const result = routes.map(r => {
      const routeStops = (stopMap[r.id] || [])
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      const totalCollected = Number(r.route_total_collected || 0) || routeStops.reduce((sum, s) => sum + Number(s.amount_collected || 0), 0);
      const commission = commissionPerStop * routeStops.length;
      const grossToDeliver = totalCollected - commission;
      const received = Number(r.admin_amount_received || 0);
      const pendingToDeliver = Math.max(0, grossToDeliver - received);
      return {
        id: r.id,
        name: r.name,
        completed_at: r.completed_at,
        stops_count: routeStops.length,
        total_collected: totalCollected,
        commission,
        to_deliver: pendingToDeliver,
        payment_delivered: r.payment_delivered || false,
        payment_delivery_method: r.payment_delivery_method || null,
        payment_delivered_at: r.payment_delivered_at || null,
        admin_confirmed: r.admin_confirmed || false,
        admin_amount_received: received,
        admin_remaining: pendingToDeliver,
        stops: routeStops.map(s => ({
          id: s.id,
          order: s.order,
          status: s.status,
          customer_name: s.customer_name,
          address: s.address,
          apartment_number: s.apartment_number,
          phone: s.phone,
          completed_at: s.completed_at,
          amount_collected: s.amount_collected,
          payment_method: s.payment_method,
          total_to_collect: s.total_to_collect,
          failed_reason: s.failed_reason
        }))
      };
    });

    res.json({ routes: result });
  } catch (error) {
    console.error('Error my-completed-routes:', error);
    res.status(500).json({ error: 'Error al cargar rutas completadas' });
  }
});

router.get('/favorites', requireAdmin, async (req, res) => {
  try {
    const favorites = await FavoriteAddress.findAll({ order: [['created_at', 'DESC']] });
    res.json({ favorites: favorites.map(f => f.toDict()) });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Error al cargar favoritos' });
  }
});

router.post('/favorites', requireAdmin, async (req, res) => {
  try {
    const { name, address, lat, lng, notes, customer_phone } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });

    let resolvedLat = lat;
    let resolvedLng = lng;
    let resolvedAddress = address;

    if (address && (!lat || !lng)) {
      const geo = await geocodingService.geocodeAddress(address);
      if (geo.success) {
        resolvedLat = geo.latitude;
        resolvedLng = geo.longitude;
        resolvedAddress = geo.fullAddress || address;
      }
    }

    const fav = await FavoriteAddress.create({
      name: name.trim(),
      address: resolvedAddress || null,
      lat: resolvedLat || null,
      lng: resolvedLng || null,
      notes: notes?.trim() || null,
      customer_phone: customer_phone?.trim() || null,
    });

    res.status(201).json({ success: true, favorite: fav.toDict() });
  } catch (error) {
    console.error('Error creating favorite:', error);
    res.status(500).json({ error: 'Error al guardar favorito' });
  }
});

router.delete('/favorites/:id', requireAdmin, async (req, res) => {
  try {
    const fav = await FavoriteAddress.findByPk(req.params.id);
    if (!fav) return res.status(404).json({ error: 'Favorito no encontrado' });
    await fav.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting favorite:', error);
    res.status(500).json({ error: 'Error al eliminar favorito' });
  }
});

// Auditoria autoritativa: para cada orden activa del dispatcher consulta el
// lifecycle ACTUAL en Respond.io via getContact (no el campo cacheado del
// listado masivo) y reporta diferencias. Usar antes de aplicar resync.
router.get('/lifecycle-audit', requireAdmin, async (req, res) => {
  try {
    const settings = await MessagingSettings.findOne({ order: [['created_at', 'ASC']] });
    if (!settings?.respond_api_token) {
      return res.status(400).json({ error: 'No hay token activo de Respond.io' });
    }

    const orders = await ValidatedAddress.findAll({
      where: {
        respond_contact_id: { [Op.ne]: null },
        dispatch_status: { [Op.ne]: 'archived' }
      },
      order: [['customer_name', 'ASC']]
    });

    const respondio = new RespondioService(settings.respond_api_token);
    const lifecycleToOrderStatus = (lifecycle) => {
      if (!lifecycle) return null;
      const map = {
        'pending': 'pending',
        'approved': 'approved',
        'ordered': 'ordered',
        'pickup ready': 'pickup_ready',
        'on delivery': 'on_delivery',
        'delivered': 'delivered',
        'ups shipped': 'ups_shipped'
      };
      return map[lifecycle.toLowerCase()] || null;
    };

    const mismatches = [];
    let matchCount = 0;
    let errorCount = 0;
    const DELAY_MS = 250;

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      if (i > 0) await new Promise(r => setTimeout(r, DELAY_MS));

      try {
        const contactRes = await respondio.getContact(parseInt(order.respond_contact_id));
        if (!contactRes.success || !contactRes.data) {
          mismatches.push({
            id: order.id,
            customer_name: order.customer_name,
            respond_contact_id: order.respond_contact_id,
            dispatcher_status: order.order_status,
            respond_lifecycle: null,
            expected_status: null,
            route_id: order.route_id,
            action: 'NOT_FOUND_IN_RESPOND',
            note: contactRes.notFound ? 'Contacto no existe en Respond.io' : 'Error consultando Respond.io'
          });
          errorCount++;
          continue;
        }

        const contact = contactRes.data;
        const lifecycle = contact.lifecycle || contact.lifecycleStage || '';
        const expectedStatus = lifecycleToOrderStatus(lifecycle);
        const lcLow = (lifecycle || '').toLowerCase();
        const tags = (contact.tags || []).map(t => (typeof t === 'string' ? t : t.name || '').toLowerCase());
        const isExcludedTag = tags.includes('rec') || tags.includes('iprintpos-chats');
        const isExcludedLifecycle = ['new lead', 'impropos', 'iprintpos'].includes(lcLow);
        const isUpsShipped = lcLow === 'ups shipped';

        let action = 'OK';
        let note = '';

        if (isExcludedTag) {
          action = 'SHOULD_ARCHIVE_TAG';
          note = `Tag excluido (${tags.find(t => t === 'rec' || t === 'iprintpos-chats')})`;
        } else if (isExcludedLifecycle) {
          action = 'SHOULD_ARCHIVE_LIFECYCLE';
          note = `Lifecycle excluido: ${lifecycle}`;
        } else if (isUpsShipped) {
          action = 'SHOULD_ARCHIVE_UPS';
          note = 'UPS Shipped (flujo paqueteria)';
        } else if (expectedStatus && expectedStatus !== order.order_status) {
          action = 'WRONG_COLUMN';
          note = `Dispatcher dice "${order.order_status}", Respond dice "${lifecycle}"`;
        } else if (!expectedStatus) {
          action = 'UNKNOWN_LIFECYCLE';
          note = `Lifecycle no mapeado: "${lifecycle || '(vacio)'}"`;
        }

        if (action === 'OK') {
          matchCount++;
        } else {
          mismatches.push({
            id: order.id,
            customer_name: order.customer_name,
            respond_contact_id: order.respond_contact_id,
            dispatcher_status: order.order_status,
            respond_lifecycle: lifecycle,
            expected_status: expectedStatus,
            route_id: order.route_id,
            action,
            note
          });
        }
      } catch (err) {
        console.error(`[LifecycleAudit] Error en ${order.respond_contact_id}:`, err.message);
        errorCount++;
      }
    }

    res.json({
      total: orders.length,
      ok: matchCount,
      mismatches: mismatches.length,
      errors: errorCount,
      details: mismatches
    });
  } catch (error) {
    console.error('Error en lifecycle audit:', error);
    res.status(500).json({ error: 'Error al auditar lifecycles' });
  }
});

// Aplica las correcciones detectadas por la auditoria. Respeta route_id
// (ordenes con chofer asignado NO se tocan). Si action es WRONG_COLUMN
// y respond.lifecycle es 'delivered', la orden tambien se respeta porque
// marcar como entregada disparara el flujo de DeliveryHistory en su sitio.
router.post('/lifecycle-resync', requireAdmin, async (req, res) => {
  try {
    const settings = await MessagingSettings.findOne({ order: [['created_at', 'ASC']] });
    if (!settings?.respond_api_token) {
      return res.status(400).json({ error: 'No hay token activo de Respond.io' });
    }

    const orders = await ValidatedAddress.findAll({
      where: {
        respond_contact_id: { [Op.ne]: null },
        dispatch_status: { [Op.ne]: 'archived' }
      }
    });

    const respondio = new RespondioService(settings.respond_api_token);
    const lifecycleToOrderStatus = (lifecycle) => {
      if (!lifecycle) return null;
      const map = {
        'pending': 'pending', 'approved': 'approved', 'ordered': 'ordered',
        'pickup ready': 'pickup_ready', 'on delivery': 'on_delivery',
        'delivered': 'delivered', 'ups shipped': 'ups_shipped'
      };
      return map[lifecycle.toLowerCase()] || null;
    };

    const result = {
      archived: 0, updated: 0, skipped_route: 0, errors: 0, deleted: 0,
      skipped_delivered: 0, reactivated: 0, advanced_to_delivered: 0,
      total: orders.length
    };
    const DELAY_MS = 250;
    const TERMINAL = ['delivered', 'ups_shipped'];
    const ACTIVE = ['pending', 'approved', 'ordered', 'pickup_ready', 'on_delivery'];

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      if (i > 0) await new Promise(r => setTimeout(r, DELAY_MS));

      try {
        // Validacion estricta: solo IDs numericos puros. Evita id:NaN -> notFound -> destroy().
        const contactIdNum = /^\d+$/.test(String(order.respond_contact_id))
          ? parseInt(order.respond_contact_id, 10)
          : null;
        if (contactIdNum === null) {
          result.errors++;
          console.log(`[LifecycleResync] ID invalido, no se toca: "${order.customer_name}" id=${order.respond_contact_id}`);
          continue;
        }

        const contactRes = await respondio.getContact(contactIdNum);
        if (!contactRes.success || !contactRes.data) {
          if (contactRes.notFound) {
            // Borrado atomico: solo si sigue sin ruta (evita race con asignacion concurrente).
            const destroyed = await ValidatedAddress.destroy({
              where: { id: order.id, route_id: null }
            });
            if (destroyed > 0) {
              result.deleted++;
              console.log(`[LifecycleResync] Eliminada (no existe en Respond): "${order.customer_name}"`);
            } else {
              result.skipped_route++;
            }
          } else {
            result.errors++;
          }
          continue;
        }

        const contact = contactRes.data;
        const lifecycle = contact.lifecycle || contact.lifecycleStage || '';
        const lcLow = (lifecycle || '').toLowerCase();
        const tags = (contact.tags || []).map(t => (typeof t === 'string' ? t : t.name || '').toLowerCase());
        const isExcludedTag = tags.includes('rec') || tags.includes('iprintpos-chats');
        const isExcludedLifecycle = ['new lead', 'impropos', 'iprintpos'].includes(lcLow);
        const isUpsShipped = lcLow === 'ups shipped';
        const expectedStatus = lifecycleToOrderStatus(lifecycle);

        // Re-fetch para obtener el estado actual (otra request puede haber asignado ruta).
        const fresh = await ValidatedAddress.findByPk(order.id);
        if (!fresh) continue;

        const isInTerminal = TERMINAL.includes(fresh.order_status);
        const expectedIsActive = expectedStatus && ACTIVE.includes(expectedStatus);
        const expectedIsDelivered = expectedStatus === 'delivered';

        // Reactivacion (terminal->activo): nuevo ciclo. Limpia route_id viejo.
        // Permitida AUN con route_id (la ruta vieja ya termino). Snapshot
        // defensivo + update atomico (route_id=fresh.route_id) para no pisar
        // un reasignamiento concurrente.
        if (expectedIsActive && isInTerminal && expectedStatus !== fresh.order_status) {
          await saveToDeliveryHistory(fresh);
          const [reUpd] = await ValidatedAddress.update(
            {
              order_status: expectedStatus,
              delivered_at: null,
              route_id: null,
              assigned_driver_id: null,
              driver_name: null,
              payment_status: 'pending',
              amount_collected: null,
              payment_method: null,
              dispatch_status: 'available'
            },
            { where: { id: fresh.id, route_id: fresh.route_id } }
          );
          if (reUpd > 0) {
            result.reactivated++;
            const reactNote = fresh.route_id ? ` (ruta vieja ${fresh.route_id} liberada)` : '';
            console.log(`[LifecycleResync] Reactivada: "${fresh.customer_name}" ${fresh.order_status} -> ${expectedStatus} (nuevo ciclo)${reactNote}`);
          } else {
            result.skipped_route++;
            console.log(`[LifecycleResync] SKIP reactivacion (route_id cambio): "${fresh.customer_name}"`);
          }
          continue;
        }

        // Avance a delivered con ruta asignada: chofer completo, snapshot a history.
        if (expectedIsDelivered && fresh.route_id && fresh.order_status !== 'delivered') {
          await saveToDeliveryHistory(fresh);
          const [adUpd] = await ValidatedAddress.update(
            { order_status: 'delivered', delivered_at: fresh.delivered_at || new Date() },
            { where: { id: fresh.id, route_id: fresh.route_id } }
          );
          if (adUpd > 0) {
            result.advanced_to_delivered++;
            console.log(`[LifecycleResync] Avance a delivered: "${fresh.customer_name}" ${fresh.order_status} -> delivered (route=${fresh.route_id})`);
          } else {
            result.skipped_route++;
            console.log(`[LifecycleResync] SKIP avance delivered (route_id cambio): "${fresh.customer_name}"`);
          }
          continue;
        }

        // Respond es fuente de verdad ABSOLUTA. Cualquier cambio se aplica
        // aqui sin excepcion. Cuando hay ruta activa:
        //  - Excluido/UPS: archiva y libera ruta (ya no es entrega local).
        //  - Activo->activo: actualiza order_status, MANTIENE route_id (chofer
        //    sigue con la parada hasta terminar).

        if (isExcludedTag || isExcludedLifecycle || isUpsShipped) {
          if (fresh.dispatch_status !== 'archived' || fresh.route_id) {
            const updateData = { dispatch_status: 'archived' };
            if (isUpsShipped) updateData.order_status = 'ups_shipped';
            if (fresh.route_id) updateData.route_id = null;
            await ValidatedAddress.update(updateData, { where: { id: fresh.id } });
            result.archived++;
            const note = fresh.route_id ? ` (ruta vieja ${fresh.route_id} liberada)` : '';
            console.log(`[LifecycleResync] Archivada: "${fresh.customer_name}" (${isExcludedTag ? 'tag' : isUpsShipped ? 'ups' : 'lifecycle'})${note}`);
          }
          continue;
        }

        if (expectedStatus && expectedStatus !== fresh.order_status) {
          // delivered sin ruta: tambien guarda snapshot por consistencia.
          if (expectedStatus === 'delivered' && !fresh.route_id) {
            await saveToDeliveryHistory(fresh);
            await ValidatedAddress.update(
              { order_status: 'delivered', delivered_at: fresh.delivered_at || new Date() },
              { where: { id: fresh.id } }
            );
            result.updated++;
            console.log(`[LifecycleResync] Marcada delivered: "${fresh.customer_name}" ${fresh.order_status} -> delivered`);
            continue;
          }
          // Activo->activo (con o sin ruta). NO se toca route_id.
          await ValidatedAddress.update(
            { order_status: expectedStatus },
            { where: { id: fresh.id } }
          );
          result.updated++;
          const routeNote = fresh.route_id ? ` (ruta=${fresh.route_id} mantenida)` : '';
          console.log(`[LifecycleResync] Sync: "${fresh.customer_name}" ${fresh.order_status} -> ${expectedStatus}${routeNote}`);
        }
      } catch (err) {
        console.error(`[LifecycleResync] Error en ${order.respond_contact_id}:`, err.message);
        result.errors++;
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Error en lifecycle resync:', error);
    res.status(500).json({ error: 'Error al resincronizar lifecycles' });
  }
});

router.post('/cleanup-duplicates', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
    const userId = user.id;
    let totalCleaned = 0;

    const [contactDups] = await ValidatedAddress.sequelize.query(`
      SELECT respond_contact_id, COUNT(*) as cnt
      FROM validated_addresses
      WHERE user_id = :userId AND respond_contact_id IS NOT NULL
      GROUP BY respond_contact_id
      HAVING COUNT(*) > 1
    `, { replacements: { userId } });

    for (const dup of contactDups) {
      const records = await ValidatedAddress.findAll({
        where: { user_id: userId, respond_contact_id: dup.respond_contact_id },
        order: [['created_at', 'DESC']]
      });
      for (const old of records.slice(1)) {
        await old.destroy();
        totalCleaned++;
      }
    }

    const [allWithPhone] = await ValidatedAddress.sequelize.query(`
      SELECT id, customer_phone,
             REGEXP_REPLACE(customer_phone, '[^0-9]', '', 'g') as phone_digits
      FROM validated_addresses
      WHERE user_id = :userId AND customer_phone IS NOT NULL AND customer_phone != ''
    `, { replacements: { userId } });

    const phoneDigitGroups = {};
    for (const row of allWithPhone) {
      const digits = (row.phone_digits || '').slice(-10);
      if (!digits || digits.length < 7) continue;
      if (!phoneDigitGroups[digits]) phoneDigitGroups[digits] = [];
      phoneDigitGroups[digits].push(row.id);
    }

    for (const [, ids] of Object.entries(phoneDigitGroups)) {
      if (ids.length < 2) continue;
      const records = await ValidatedAddress.findAll({
        where: { user_id: userId, id: { [Op.in]: ids } },
        order: [['created_at', 'DESC']]
      });
      if (records.length < 2) continue;
      const keeper = records.find(r => r.respond_contact_id && r.validated_address)
        || records.find(r => r.respond_contact_id)
        || records.find(r => r.validated_address)
        || records[0];
      const mergeFields = {
        order_cost: keeper.order_cost,
        deposit_amount: keeper.deposit_amount,
        total_to_collect: keeper.total_to_collect,
        notes: keeper.notes,
        apartment_number: keeper.apartment_number,
        respond_contact_id: keeper.respond_contact_id,
        validated_address: keeper.validated_address,
        original_address: keeper.original_address,
        address_lat: keeper.address_lat,
        address_lng: keeper.address_lng,
        zip_code: keeper.zip_code,
        city: keeper.city,
        state: keeper.state
      };
      for (const donor of records.filter(r => r.id !== keeper.id)) {
        mergeFields.order_cost = mergeFields.order_cost ?? donor.order_cost;
        mergeFields.deposit_amount = mergeFields.deposit_amount ?? donor.deposit_amount;
        mergeFields.total_to_collect = mergeFields.total_to_collect ?? donor.total_to_collect;
        mergeFields.notes = mergeFields.notes || donor.notes;
        mergeFields.apartment_number = mergeFields.apartment_number || donor.apartment_number;
        mergeFields.respond_contact_id = mergeFields.respond_contact_id || donor.respond_contact_id;
        mergeFields.validated_address = mergeFields.validated_address || donor.validated_address;
        mergeFields.original_address = mergeFields.original_address || donor.original_address;
        mergeFields.address_lat = mergeFields.address_lat ?? donor.address_lat;
        mergeFields.address_lng = mergeFields.address_lng ?? donor.address_lng;
        mergeFields.zip_code = mergeFields.zip_code || donor.zip_code;
        mergeFields.city = mergeFields.city || donor.city;
        mergeFields.state = mergeFields.state || donor.state;
      }
      await keeper.update(mergeFields);
      for (const old of records.filter(r => r.id !== keeper.id)) {
        await old.destroy();
        totalCleaned++;
      }
    }

    console.log(`[Dispatch] Limpieza manual: ${totalCleaned} duplicado(s) eliminado(s)`);
    res.json({ success: true, cleaned: totalCleaned });
  } catch (error) {
    console.error('Error en limpieza de duplicados:', error);
    res.status(500).json({ error: 'Error al limpiar duplicados' });
  }
});

// POST /api/dispatch/bot/initiate-closing/:contactId
// Inicia el flujo de cierre de venta manualmente desde el panel de despacho
router.post('/bot/initiate-closing/:contactId', requireAuth, async (req, res) => {
  try {
    const { contactId } = req.params;
    const product = req.body.product || 'tarjetas';

    // Solo usar la configuración del usuario autenticado (sin fallback cross-tenant)
    const settings = await MessagingSettings.findOne({ where: { user_id: req.userId } });
    if (!settings) return res.status(400).json({ success: false, error: 'No hay configuración de mensajería' });
    if (!settings.respond_api_token) return res.status(400).json({ success: false, error: 'Token de API no configurado' });

    const ChatbotService = (await import('../services/chatbotService.js')).default;
    const bot = new ChatbotService(settings.user_id, settings);

    respondApiService.setContext(settings.user_id, settings.respond_api_token);
    const contactResult = await respondApiService.getContact(`id:${contactId}`);
    const contact = (contactResult.success && contactResult.data)
      ? contactResult.data
      : { id: contactId, firstName: '', lastName: '' };

    await bot.getOrCreateConversationState(contactId);
    const result = await bot.startClosingFlow(contact, product);

    console.log(`[Dispatch] Flujo de cierre iniciado manualmente para contacto ${contactId}`);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Dispatch] Error iniciando flujo de cierre:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
