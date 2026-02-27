import express from 'express';
import { Op } from 'sequelize';
import { 
  MessagingOrder, 
  CoverageZone, 
  MessageLog, 
  MessagingSettings,
  ConversationState,
  ServiceAgent,
  User
} from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import RespondioService from '../services/respondio.js';
import respondApiService from '../services/respondApiService.js';
import AddressValidationService from '../services/addressValidation.js';
import ChatbotService from '../services/chatbotService.js';
import pollingService from '../services/pollingService.js';

const router = express.Router();

async function getSettingsForUser(userId) {
  const user = await User.findByPk(userId);
  if (user?.role === 'admin') {
    let settings = await MessagingSettings.findOne({ order: [['created_at', 'ASC']] });
    if (!settings) {
      settings = await MessagingSettings.create({ user_id: userId });
    }
    return { settings, isAdmin: true };
  }
  let settings = await MessagingSettings.findOne({ where: { user_id: userId } });
  if (!settings) {
    settings = await MessagingSettings.create({ user_id: userId });
  }
  return { settings, isAdmin: false };
}

async function isAdminUser(userId) {
  const user = await User.findByPk(userId);
  return user?.role === 'admin';
}

router.get('/settings', requireAuth, async (req, res) => {
  try {
    const { settings } = await getSettingsForUser(req.userId);
    res.json(settings.toDict());
  } catch (error) {
    console.error('Get messaging settings error:', error);
    res.status(500).json({ error: 'Error al obtener configuracion' });
  }
});

router.put('/settings', requireAuth, async (req, res) => {
  try {
    const { settings } = await getSettingsForUser(req.userId);

    const allowedFields = [
      'respond_api_token', 'is_active', 'auto_validate_addresses',
      'auto_respond_coverage', 'auto_respond_no_coverage',
      'no_coverage_message', 'coverage_message', 'order_confirmed_message',
      'driver_assigned_message', 'order_completed_message',
      'default_channel_id', 'attention_mode', 'webhook_secret',
      'business_hours_enabled', 'business_hours_start', 'business_hours_end',
      'business_days', 'timezone', 'out_of_hours_message',
      'default_agent_id', 'default_agent_name',
      'welcome_existing_customer', 'welcome_new_customer', 'welcome_from_ads',
      'has_info_response', 'request_zip_message', 'remind_zip_message',
      'product_menu_message', 'excluded_tags', 'products',
      'test_mode', 'test_contact_id', 'catalog_link', 'products_list',
      'followup_enabled', 'followup_timeout_minutes', 'followup_message', 'followup_message_2'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        settings[field] = req.body[field];
      }
    }

    await settings.save();
    
    // Clear API token cache when settings are updated
    respondApiService.clearTokenCache(req.userId);
    
    res.json(settings.toDict());
  } catch (error) {
    console.error('Update messaging settings error:', error);
    res.status(500).json({ error: 'Error al actualizar configuracion' });
  }
});

router.post('/settings/test-connection', requireAuth, async (req, res) => {
  try {
    console.log('[Test Connection] Iniciando prueba de conexión...');
    
    const { settings } = await getSettingsForUser(req.userId);

    if (!settings?.respond_api_token) {
      console.log('[Test Connection] ERROR: No hay token configurado');
      return res.status(400).json({ error: 'No hay API token configurado' });
    }

    console.log('[Test Connection] Token encontrado, probando conexión...');
    const service = new RespondioService(settings.respond_api_token);
    const result = await service.testConnection();

    console.log('[Test Connection] Resultado:', result);
    res.json(result);
  } catch (error) {
    console.error('[Test Connection] ERROR:', error.message);
    console.error(error.stack);
    res.status(500).json({ error: 'Error al probar conexion: ' + error.message });
  }
});

// Reiniciar historial de prueba
router.post('/settings/reset-test', requireAuth, async (req, res) => {
  try {
    const { settings } = await getSettingsForUser(req.userId);

    if (!settings?.test_contact_id) {
      return res.status(400).json({ error: 'No hay contacto de prueba configurado' });
    }

    // Buscar el contacto por nombre usando listContacts con search
    const service = new RespondioService(settings.respond_api_token);
    const result = await service.listContacts({ search: settings.test_contact_id, limit: 10 });
    
    if (!result.success || !result.items?.length) {
      return res.status(404).json({ error: 'Contacto de prueba no encontrado en Respond.io' });
    }

    const contact = result.items[0];

    // Borrar el estado de conversación
    await ConversationState.destroy({
      where: { 
        user_id: req.userId,
        contact_id: contact.id.toString() 
      }
    });

    // Borrar pedidos del contacto de prueba (para que no lo detecte como cliente existente)
    await MessagingOrder.destroy({
      where: { 
        user_id: req.userId,
        respond_contact_id: contact.id.toString() 
      }
    });

    // Borrar logs de mensajes del contacto
    await MessageLog.destroy({
      where: { 
        user_id: req.userId,
        respond_contact_id: contact.id.toString() 
      }
    });

    console.log(`[Reset Test] Datos eliminados para contacto: ${contact.id} (${contact.firstName} ${contact.lastName})`);
    
    await pollingService.preloadContactMessages(req.userId, contact.id);
    
    res.json({ 
      success: true, 
      message: 'Historial de prueba reiniciado. El flujo iniciará cuando envíes un nuevo mensaje.',
      contact_id: contact.id,
      contact_name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
    });
  } catch (error) {
    console.error('[Reset Test] ERROR:', error.message);
    res.status(500).json({ error: 'Error al reiniciar prueba: ' + error.message });
  }
});

router.get('/orders', requireAuth, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const admin = await isAdminUser(req.userId);
    
    const where = admin ? {} : { user_id: req.userId };
    if (status) where.status = status;

    const orders = await MessagingOrder.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const count = await MessagingOrder.count({ where });

    res.json({
      orders: orders.map(o => o.toDict()),
      total: count
    });
  } catch (error) {
    console.error('Get messaging orders error:', error);
    res.status(500).json({ error: 'Error al obtener ordenes' });
  }
});

router.get('/orders/:id', requireAuth, async (req, res) => {
  try {
    const admin = await isAdminUser(req.userId);
    const where = admin ? { id: req.params.id } : { id: req.params.id, user_id: req.userId };
    const order = await MessagingOrder.findOne({ where });

    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const messages = await MessageLog.findAll({
      where: { order_id: order.id },
      order: [['created_at', 'ASC']]
    });

    res.json({
      ...order.toDict(),
      messages: messages.map(m => m.toDict())
    });
  } catch (error) {
    console.error('Get messaging order error:', error);
    res.status(500).json({ error: 'Error al obtener orden' });
  }
});

router.post('/orders', requireAuth, async (req, res) => {
  try {
    const {
      customer_name, customer_phone, customer_email,
      address, notes, scheduled_date,
      respond_contact_id, respond_conversation_id,
      channel_id, channel_type
    } = req.body;

    const validationService = new AddressValidationService(req.userId);
    const validation = await validationService.validateAddress(address || '');

    const order = await MessagingOrder.create({
      user_id: req.userId,
      customer_name,
      customer_phone,
      customer_email,
      address,
      address_lat: req.body.address_lat,
      address_lng: req.body.address_lng,
      zip_code: validation.zipCode,
      address_type: validation.addressType,
      notes,
      scheduled_date,
      respond_contact_id,
      respond_conversation_id,
      channel_id,
      channel_type,
      status: 'pending',
      validation_status: validation.hasCoverage ? 'valid' : 'no_coverage',
      validation_message: validation.validationMessage
    });

    res.status(201).json(order.toDict());
  } catch (error) {
    console.error('Create messaging order error:', error);
    res.status(500).json({ error: 'Error al crear orden' });
  }
});

router.put('/orders/:id', requireAuth, async (req, res) => {
  try {
    const admin = await isAdminUser(req.userId);
    const where = admin ? { id: req.params.id } : { id: req.params.id, user_id: req.userId };
    const order = await MessagingOrder.findOne({ where });

    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const allowedFields = [
      'customer_name', 'customer_phone', 'customer_email',
      'address', 'address_lat', 'address_lng', 'notes',
      'status', 'scheduled_date', 'scheduled_time_start', 'scheduled_time_end',
      'assigned_driver_id', 'agent_name'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        order[field] = req.body[field];
      }
    }

    if (req.body.address && req.body.address !== order.address) {
      const validationService = new AddressValidationService(req.userId);
      const validation = await validationService.validateAddress(req.body.address);
      order.zip_code = validation.zipCode;
      order.address_type = validation.addressType;
      order.validation_status = validation.hasCoverage ? 'valid' : 'no_coverage';
      order.validation_message = validation.validationMessage;
    }

    await order.save();
    res.json(order.toDict());
  } catch (error) {
    console.error('Update messaging order error:', error);
    res.status(500).json({ error: 'Error al actualizar orden' });
  }
});

router.post('/orders/:id/confirm', requireAuth, async (req, res) => {
  try {
    const admin = await isAdminUser(req.userId);
    const where = admin ? { id: req.params.id } : { id: req.params.id, user_id: req.userId };
    const order = await MessagingOrder.findOne({ where });

    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    order.status = 'confirmed';
    await order.save();
    console.log(`[Confirm] Orden #${order.id} confirmada - Contact: ${order.respond_contact_id}, Channel: ${order.channel_id || 'N/A'}`);

    const { settings } = await getSettingsForUser(req.userId);

    if (settings?.respond_api_token && order.respond_contact_id) {
      // Seleccionar mensaje basado en estado de cobertura
      let message;
      if (order.validation_status === 'covered') {
        message = settings.coverage_message || 'Tu direccion esta dentro de nuestra zona de cobertura.';
      } else if (order.validation_status === 'no_coverage') {
        message = settings.no_coverage_message || 'Lo sentimos, actualmente no tenemos cobertura en tu zona.';
      } else {
        message = settings.order_confirmed_message || 'Tu pedido ha sido confirmado.';
      }
      
      // Reemplazar variables en el mensaje
      message = message.replace('{{zip_code}}', order.zip_code || '');
      
      console.log(`[Confirm] Enviando mensaje (${order.validation_status}) a contacto ${order.respond_contact_id}: "${message.substring(0, 50)}..."`);
      
      const service = new RespondioService(settings.respond_api_token);
      // No pasar channelId - Respond.io usara el ultimo canal de interaccion automaticamente
      const result = await service.sendMessage(
        order.respond_contact_id,
        message,
        null
      );

      console.log(`[Confirm] Resultado envio:`, result);

      if (result.success) {
        await MessageLog.create({
          user_id: req.userId,
          order_id: order.id,
          respond_contact_id: order.respond_contact_id,
          respond_message_id: result.messageId,
          direction: 'outbound',
          content: message,
          channel_type: order.channel_type,
          status: 'sent',
          is_automated: true,
          automation_type: 'order_confirmed'
        });
        console.log(`[Confirm] Mensaje guardado en log - ID: ${result.messageId}`);
      } else {
        console.error(`[Confirm] Error al enviar mensaje:`, result.error);
      }
    } else {
      console.log(`[Confirm] No se envio mensaje - Token: ${!!settings?.respond_api_token}, ContactID: ${order.respond_contact_id || 'N/A'}`);
    }

    res.json(order.toDict());
  } catch (error) {
    console.error('Confirm order error:', error);
    res.status(500).json({ error: 'Error al confirmar orden' });
  }
});

router.post('/orders/:id/cancel', requireAuth, async (req, res) => {
  try {
    const admin = await isAdminUser(req.userId);
    const where = admin ? { id: req.params.id } : { id: req.params.id, user_id: req.userId };
    const order = await MessagingOrder.findOne({ where });

    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    order.status = 'cancelled';
    order.cancelled_at = new Date();
    order.cancel_reason = req.body.reason;
    await order.save();

    res.json(order.toDict());
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ error: 'Error al cancelar orden' });
  }
});

router.post('/orders/:id/complete', requireAuth, async (req, res) => {
  try {
    const admin = await isAdminUser(req.userId);
    const where = admin ? { id: req.params.id } : { id: req.params.id, user_id: req.userId };
    const order = await MessagingOrder.findOne({ where });

    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    order.status = 'completed';
    order.completed_at = new Date();
    await order.save();

    const { settings } = await getSettingsForUser(req.userId);

    if (settings?.respond_api_token && order.respond_contact_id) {
      const service = new RespondioService(settings.respond_api_token);
      // No pasar channelId - Respond.io usara el ultimo canal de interaccion
      const result = await service.sendMessage(
        order.respond_contact_id,
        settings.order_completed_message,
        null
      );

      if (result.success) {
        await MessageLog.create({
          user_id: req.userId,
          order_id: order.id,
          respond_contact_id: order.respond_contact_id,
          respond_message_id: result.messageId,
          direction: 'outbound',
          content: settings.order_completed_message,
          channel_type: order.channel_type,
          status: 'sent',
          is_automated: true,
          automation_type: 'order_completed'
        });
      }
    }

    res.json(order.toDict());
  } catch (error) {
    console.error('Complete order error:', error);
    res.status(500).json({ error: 'Error al completar orden' });
  }
});

router.delete('/orders/:id', requireAuth, async (req, res) => {
  try {
    const admin = await isAdminUser(req.userId);
    const where = admin ? { id: req.params.id } : { id: req.params.id, user_id: req.userId };
    const order = await MessagingOrder.findOne({ where });

    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    await order.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ error: 'Error al eliminar orden' });
  }
});

router.post('/orders/revalidate', requireAuth, async (req, res) => {
  try {
    const admin = await isAdminUser(req.userId);
    if (!admin) return res.status(403).json({ error: 'Solo admin' });

    const noCoverageOrders = await MessagingOrder.findAll({
      where: { validation_status: 'no_coverage' }
    });

    let revalidated = 0;
    for (const order of noCoverageOrders) {
      if (!order.zip_code) continue;
      const zone = await CoverageZone.findOne({
        where: { zip_code: order.zip_code, is_active: true }
      });
      if (zone) {
        await order.update({
          validation_status: 'covered',
          validation_message: `ZIP ${order.zip_code} con cobertura - ${zone.zone_name || zone.city || 'Zona'}`
        });
        revalidated++;
      }
    }

    console.log(`[Coverage] Re-validacion manual: ${revalidated} ordenes actualizadas de ${noCoverageOrders.length} sin cobertura`);
    res.json({ revalidated, total: noCoverageOrders.length });
  } catch (error) {
    console.error('Revalidate orders error:', error);
    res.status(500).json({ error: 'Error al re-validar' });
  }
});

router.post('/orders/:id/send-message', requireAuth, async (req, res) => {
  try {
    const admin = await isAdminUser(req.userId);
    const where = admin ? { id: req.params.id } : { id: req.params.id, user_id: req.userId };
    const order = await MessagingOrder.findOne({ where });

    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const { settings } = await getSettingsForUser(req.userId);

    if (!settings?.respond_api_token) {
      return res.status(400).json({ error: 'No hay API token configurado' });
    }

    if (!order.respond_contact_id) {
      return res.status(400).json({ error: 'Esta orden no tiene contacto de Respond.io' });
    }

    const service = new RespondioService(settings.respond_api_token);
    // No pasar channelId - Respond.io usara el ultimo canal de interaccion
    const result = await service.sendMessage(
      order.respond_contact_id,
      req.body.message,
      null
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    const log = await MessageLog.create({
      user_id: req.userId,
      order_id: order.id,
      respond_contact_id: order.respond_contact_id,
      respond_message_id: result.messageId,
      direction: 'outbound',
      content: req.body.message,
      channel_type: order.channel_type,
      status: 'sent',
      is_automated: false
    });

    res.json({
      success: true,
      message: log.toDict()
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

router.get('/coverage-zones', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    const where = user?.role === 'admin' ? {} : { user_id: req.userId };

    const zones = await CoverageZone.findAll({
      where,
      order: [['zip_code', 'ASC']]
    });

    res.json(zones.map(z => z.toDict()));
  } catch (error) {
    console.error('Get coverage zones error:', error);
    res.status(500).json({ error: 'Error al obtener zonas' });
  }
});

router.post('/coverage-zones', requireAuth, async (req, res) => {
  try {
    const { zip_code, zone_name, city, state, country, is_active,
            delivery_fee, min_order_amount, estimated_delivery_time, notes } = req.body;

    const existing = await CoverageZone.findOne({
      where: {
        user_id: req.userId,
        zip_code
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Ya existe una zona con este codigo postal' });
    }

    const zone = await CoverageZone.create({
      user_id: req.userId,
      zip_code,
      zone_name: zone_name || '',
      city: city || '',
      state: state || '',
      country: country || 'US',
      is_active: is_active !== false,
      delivery_fee: delivery_fee !== '' && delivery_fee != null ? parseFloat(delivery_fee) : null,
      min_order_amount: min_order_amount !== '' && min_order_amount != null ? parseFloat(min_order_amount) : null,
      estimated_delivery_time: estimated_delivery_time || null,
      notes: notes || null
    });

    const updated = await MessagingOrder.update(
      { validation_status: 'covered', validation_message: `ZIP ${zip_code} con cobertura - ${zone_name || city || 'Zona'}` },
      { where: { zip_code, validation_status: 'no_coverage' } }
    );
    if (updated[0] > 0) {
      console.log(`[Coverage] Re-validadas ${updated[0]} ordenes para ZIP ${zip_code}`);
    }

    res.status(201).json(zone.toDict());
  } catch (error) {
    console.error('Create coverage zone error:', error);
    res.status(500).json({ error: 'Error al crear zona' });
  }
});

router.post('/coverage-zones/bulk', requireAuth, async (req, res) => {
  try {
    const { zip_codes, zone_name, city, state } = req.body;
    
    if (!zip_codes || !Array.isArray(zip_codes)) {
      return res.status(400).json({ error: 'Se requiere una lista de codigos postales' });
    }

    const created = [];
    const skipped = [];

    for (const zip_code of zip_codes) {
      const trimmedZip = zip_code.trim();
      const existing = await CoverageZone.findOne({
        where: {
          user_id: req.userId,
          zip_code: trimmedZip
        }
      });

      if (existing) {
        skipped.push(trimmedZip);
        continue;
      }

      let zipCity = city || '';
      let zipState = state || '';
      let zipZoneName = zone_name || '';

      if (!zipCity || !zipState) {
        try {
          const zipResponse = await fetch(`https://api.zippopotam.us/us/${trimmedZip}`);
          if (zipResponse.ok) {
            const zipData = await zipResponse.json();
            if (zipData.places && zipData.places.length > 0) {
              const place = zipData.places[0];
              zipCity = zipCity || place['place name'] || '';
              zipState = zipState || place['state abbreviation'] || '';
              zipZoneName = zipZoneName || place['place name'] || '';
            }
          }
        } catch (e) {}
      }

      const zone = await CoverageZone.create({
        user_id: req.userId,
        zip_code: trimmedZip,
        zone_name: zipZoneName,
        city: zipCity,
        state: zipState,
        is_active: true
      });
      created.push(zone.toDict());
    }

    if (created.length > 0) {
      const createdZips = created.map(z => z.zip_code);
      const revalidated = await MessagingOrder.update(
        { validation_status: 'covered' },
        { where: { zip_code: createdZips, validation_status: 'no_coverage' } }
      );
      if (revalidated[0] > 0) {
        console.log(`[Coverage] Re-validadas ${revalidated[0]} ordenes en bulk para ZIPs: ${createdZips.join(', ')}`);
      }
    }

    res.status(201).json({
      created: created.length,
      skipped: skipped.length,
      zones: created
    });
  } catch (error) {
    console.error('Bulk create coverage zones error:', error);
    res.status(500).json({ error: 'Error al crear zonas' });
  }
});

router.put('/coverage-zones/:id', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    const where = user?.role === 'admin' ? { id: req.params.id } : { id: req.params.id, user_id: req.userId };

    const zone = await CoverageZone.findOne({ where });

    if (!zone) {
      return res.status(404).json({ error: 'Zona no encontrada' });
    }

    const allowedFields = [
      'zone_name', 'city', 'state', 'country', 'is_active',
      'delivery_fee', 'min_order_amount', 'estimated_delivery_time', 'notes'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        zone[field] = req.body[field];
      }
    }

    await zone.save();
    res.json(zone.toDict());
  } catch (error) {
    console.error('Update coverage zone error:', error);
    res.status(500).json({ error: 'Error al actualizar zona' });
  }
});

router.delete('/coverage-zones/:id', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    const where = user?.role === 'admin' ? { id: req.params.id } : { id: req.params.id, user_id: req.userId };

    const zone = await CoverageZone.findOne({ where });

    if (!zone) {
      return res.status(404).json({ error: 'Zona no encontrada' });
    }

    await zone.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete coverage zone error:', error);
    res.status(500).json({ error: 'Error al eliminar zona' });
  }
});

router.post('/geocode-address', requireAuth, async (req, res) => {
  try {
    const { address } = req.body;

    if (!address || !address.trim()) {
      return res.status(400).json({ error: 'Direccion requerida' });
    }

    const geocodingService = (await import('../services/geocodingService.js')).default;
    const result = await geocodingService.geocodeAddress(address.trim());

    if (!result.success) {
      return res.status(404).json({ error: result.error || 'Direccion no encontrada' });
    }

    res.json({
      success: true,
      address: result.fullAddress || result.corrected,
      zip: result.zip || '',
      city: result.city || '',
      state: result.state || '',
      latitude: result.latitude,
      longitude: result.longitude,
      confidence: result.confidence
    });
  } catch (error) {
    console.error('Geocode address error:', error);
    res.status(500).json({ error: 'Error al geocodificar direccion' });
  }
});

router.post('/validate-zip', async (req, res) => {
  try {
    const { zipOrCity } = req.body;
    
    const userId = req.session?.userId || 1;
    console.log('Validate ZIP request:', { zipOrCity, userId });
    
    if (!zipOrCity || !zipOrCity.trim()) {
      return res.status(400).json({ error: 'ZIP code, ciudad o direccion requerido' });
    }

    const cleanInput = zipOrCity.trim();
    let zone = null;
    let searchType = 'unknown';
    let searchValue = cleanInput;
    
    const zipMatch = cleanInput.match(/\b(\d{5})\b/);
    if (zipMatch) {
      const zipCode = zipMatch[1];
      zone = await CoverageZone.findOne({
        where: { 
          zip_code: zipCode,
          is_active: true
        }
      });
      if (zone) {
        searchType = 'zip';
        searchValue = zipCode;
      }
    }
    
    if (!zone) {
      zone = await CoverageZone.findOne({
        where: { 
          city: { [Op.iLike]: cleanInput },
          is_active: true
        }
      });
      if (zone) {
        searchType = 'city';
        searchValue = zone.city;
      }
    }
    
    if (!zone) {
      zone = await CoverageZone.findOne({
        where: { 
          city: { [Op.iLike]: `%${cleanInput}%` },
          is_active: true
        }
      });
      if (zone) {
        searchType = 'city';
        searchValue = zone.city;
      }
    }
    
    if (!zone) {
      zone = await CoverageZone.findOne({
        where: { 
          zone_name: { [Op.iLike]: `%${cleanInput}%` },
          is_active: true
        }
      });
      if (zone) {
        searchType = 'zone';
        searchValue = zone.zone_name || zone.city;
      }
    }

    const valid = !!zone;
    
    console.log('Validation result:', { valid, searchType, searchValue, zone: zone?.city });
    
    const settings = await MessagingSettings.findOne({
      where: { user_id: userId }
    });

    let copyMessage = '';
    if (valid) {
      copyMessage = settings?.coverage_message || 'Tenemos cobertura en tu zona!';
    } else {
      copyMessage = settings?.no_coverage_message || 'Lo sentimos, actualmente no tenemos cobertura en tu zona.';
    }

    let message = '';
    if (valid) {
      if (searchType === 'zip') {
        message = `ZIP ${searchValue} validado - ${zone.city || 'Zona con cobertura'}`;
      } else if (searchType === 'city') {
        message = `Ciudad ${zone.city} validada - ZIP ${zone.zip_code}`;
      } else {
        message = `Zona ${searchValue} validada - ${zone.city}, ZIP ${zone.zip_code}`;
      }
    } else {
      message = `No hay cobertura para "${cleanInput}"`;
    }

    res.json({
      valid,
      type: searchType,
      value: searchValue,
      originalInput: cleanInput,
      zone: zone ? {
        id: zone.id,
        zip_code: zone.zip_code,
        city: zone.city,
        state: zone.state,
        zone_name: zone.zone_name,
        delivery_fee: zone.delivery_fee
      } : null,
      message,
      copyMessage,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Validate ZIP error:', error);
    res.status(500).json({ error: 'Error al validar' });
  }
});

router.post('/validate-address', requireAuth, async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Se requiere una direccion' });
    }

    const validationService = new AddressValidationService(req.userId);
    const result = await validationService.validateAddress(address);

    res.json(result);
  } catch (error) {
    console.error('Validate address error:', error);
    res.status(500).json({ error: 'Error al validar direccion' });
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;
    console.log('Received webhook from Respond.io:', JSON.stringify(event, null, 2));

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Error processing webhook' });
  }
});

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, pending, confirmed, completed, todayOrders] = await Promise.all([
      MessagingOrder.count({ where: { user_id: userId } }),
      MessagingOrder.count({ where: { user_id: userId, status: 'pending' } }),
      MessagingOrder.count({ where: { user_id: userId, status: 'confirmed' } }),
      MessagingOrder.count({ where: { user_id: userId, status: 'completed' } }),
      MessagingOrder.count({ 
        where: { 
          user_id: userId,
          created_at: { [Op.gte]: today }
        } 
      })
    ]);

    const coverageZones = await CoverageZone.count({
      where: { user_id: userId, is_active: true }
    });

    res.json({
      total,
      pending,
      confirmed,
      completed,
      todayOrders,
      coverageZones
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Error al obtener estadisticas' });
  }
});

router.get('/polling/status', requireAuth, async (req, res) => {
  try {
    let status = pollingService.getPollingStatus(req.userId);
    if (!status.active && await isAdminUser(req.userId)) {
      status = pollingService.getAnyActivePollingStatus();
    }
    res.json(status);
  } catch (error) {
    console.error('Get polling status error:', error);
    res.status(500).json({ error: 'Error al obtener estado de polling' });
  }
});

router.post('/polling/start', requireAuth, async (req, res) => {
  try {
    const intervalSeconds = req.body.interval || 30;
    const admin = await isAdminUser(req.userId);
    if (admin) {
      const anyActive = pollingService.getAnyActivePollingStatus();
      if (anyActive.active) {
        return res.json({ success: true, message: 'Polling ya está activo' });
      }
    }
    const result = await pollingService.startPolling(req.userId, intervalSeconds);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Start polling error:', error);
    res.status(500).json({ error: 'Error al iniciar polling' });
  }
});

router.post('/polling/stop', requireAuth, async (req, res) => {
  try {
    let result = pollingService.stopPolling(req.userId);
    if (!result.success && await isAdminUser(req.userId)) {
      result = pollingService.stopAllPolling();
    }
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Stop polling error:', error);
    res.status(500).json({ error: 'Error al detener polling' });
  }
});

router.post('/polling/sync', requireAuth, async (req, res) => {
  try {
    const { settings } = await getSettingsForUser(req.userId);

    if (!settings?.respond_api_token) {
      return res.status(400).json({ error: 'No hay API token configurado' });
    }

    const respondio = new RespondioService(settings.respond_api_token);
    const contactsResult = await respondio.listContacts({ status: 'open', limit: 50 });

    if (!contactsResult.success) {
      return res.status(500).json({ error: contactsResult.error });
    }

    res.json({
      success: true,
      contacts: contactsResult.items.length,
      message: `Se encontraron ${contactsResult.items.length} conversaciones abiertas`
    });
  } catch (error) {
    console.error('Manual sync error:', error);
    res.status(500).json({ error: 'Error al sincronizar' });
  }
});

router.get('/contacts', requireAuth, async (req, res) => {
  try {
    const { settings } = await getSettingsForUser(req.userId);

    if (!settings?.respond_api_token) {
      return res.status(400).json({ error: 'No hay API token configurado' });
    }

    const respondio = new RespondioService(settings.respond_api_token);
    const result = await respondio.listContacts({
      status: req.query.status || null,
      limit: parseInt(req.query.limit) || 50
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      contacts: result.items,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Error al obtener contactos' });
  }
});

router.get('/contacts/:contactId/messages', requireAuth, async (req, res) => {
  try {
    const { settings } = await getSettingsForUser(req.userId);

    if (!settings?.respond_api_token) {
      return res.status(400).json({ error: 'No hay API token configurado' });
    }

    const respondio = new RespondioService(settings.respond_api_token);
    const result = await respondio.listMessages(req.params.contactId, {
      limit: parseInt(req.query.limit) || 50
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      messages: result.items,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get contact messages error:', error);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

router.get('/chatbot/states', requireAuth, async (req, res) => {
  try {
    const admin = await isAdminUser(req.userId);
    const where = admin ? {} : { user_id: req.userId };
    const states = await ConversationState.findAll({
      where,
      order: [['last_interaction', 'DESC']],
      limit: parseInt(req.query.limit) || 50
    });

    res.json({ states: states.map(s => s.toDict()) });
  } catch (error) {
    console.error('Get conversation states error:', error);
    res.status(500).json({ error: 'Error al obtener estados de conversacion' });
  }
});

router.get('/chatbot/state/:contactId', requireAuth, async (req, res) => {
  try {
    const state = await ConversationState.findOne({
      where: {
        user_id: req.userId,
        contact_id: req.params.contactId
      }
    });

    if (!state) {
      return res.json({ state: null });
    }

    res.json({ state: state.toDict() });
  } catch (error) {
    console.error('Get conversation state error:', error);
    res.status(500).json({ error: 'Error al obtener estado de conversacion' });
  }
});

router.post('/chatbot/pause/:contactId', requireAuth, async (req, res) => {
  try {
    const { settings } = await getSettingsForUser(req.userId);

    if (!settings?.respond_api_token) {
      return res.status(400).json({ error: 'No hay configuracion de mensajeria' });
    }

    const chatbot = new ChatbotService(req.userId, settings);
    const result = await chatbot.pauseBot(req.params.contactId);

    res.json(result);
  } catch (error) {
    console.error('Pause chatbot error:', error);
    res.status(500).json({ error: 'Error al pausar chatbot' });
  }
});

router.post('/chatbot/resume/:contactId', requireAuth, async (req, res) => {
  try {
    const { settings } = await getSettingsForUser(req.userId);

    if (!settings?.respond_api_token) {
      return res.status(400).json({ error: 'No hay configuracion de mensajeria' });
    }

    const chatbot = new ChatbotService(req.userId, settings);
    const result = await chatbot.resumeBot(req.params.contactId);

    res.json(result);
  } catch (error) {
    console.error('Resume chatbot error:', error);
    res.status(500).json({ error: 'Error al reanudar chatbot' });
  }
});

router.post('/chatbot/reset/:contactId', requireAuth, async (req, res) => {
  try {
    const { settings } = await getSettingsForUser(req.userId);

    if (!settings?.respond_api_token) {
      return res.status(400).json({ error: 'No hay configuracion de mensajeria' });
    }

    const chatbot = new ChatbotService(req.userId, settings);
    const result = await chatbot.resetConversation(req.params.contactId);

    res.json(result);
  } catch (error) {
    console.error('Reset conversation error:', error);
    res.status(500).json({ error: 'Error al reiniciar conversacion' });
  }
});

router.get('/agents', requireAuth, async (req, res) => {
  try {
    const admin = await isAdminUser(req.userId);
    const where = admin ? {} : { user_id: req.userId };
    const agents = await ServiceAgent.findAll({
      where,
      order: [['service_name', 'ASC'], ['agent_name', 'ASC']]
    });
    res.json(agents.map(a => a.toDict()));
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ error: 'Error al obtener agentes' });
  }
});

router.post('/agents', requireAuth, async (req, res) => {
  try {
    const { agent_id, agent_name, agent_email, service_name, products, is_default } = req.body;

    if (!agent_name || !service_name) {
      return res.status(400).json({ error: 'Nombre del agente y servicio son requeridos' });
    }

    if (is_default) {
      await ServiceAgent.update(
        { is_default: false },
        { where: { user_id: req.userId, service_name } }
      );
    }

    const agent = await ServiceAgent.create({
      user_id: req.userId,
      agent_id: agent_id || null,
      agent_name,
      agent_email: agent_email || null,
      service_name,
      products: products || [],
      is_default: is_default || false,
      is_active: true
    });

    res.status(201).json(agent.toDict());
  } catch (error) {
    console.error('Create agent error:', error);
    res.status(500).json({ error: 'Error al crear agente' });
  }
});

router.put('/agents/:id', requireAuth, async (req, res) => {
  try {
    const admin = await isAdminUser(req.userId);
    const where = admin ? { id: req.params.id } : { id: req.params.id, user_id: req.userId };
    const agent = await ServiceAgent.findOne({ where });

    if (!agent) {
      return res.status(404).json({ error: 'Agente no encontrado' });
    }

    const { agent_id, agent_name, agent_email, service_name, products, is_default, is_active } = req.body;

    if (is_default) {
      await ServiceAgent.update(
        { is_default: false },
        { where: { user_id: req.userId, service_name: service_name || agent.service_name } }
      );
    }

    await agent.update({
      agent_id: agent_id !== undefined ? agent_id : agent.agent_id,
      agent_name: agent_name || agent.agent_name,
      agent_email: agent_email !== undefined ? agent_email : agent.agent_email,
      service_name: service_name || agent.service_name,
      products: products !== undefined ? products : agent.products,
      is_default: is_default !== undefined ? is_default : agent.is_default,
      is_active: is_active !== undefined ? is_active : agent.is_active
    });

    res.json(agent.toDict());
  } catch (error) {
    console.error('Update agent error:', error);
    res.status(500).json({ error: 'Error al actualizar agente' });
  }
});

router.delete('/agents/:id', requireAuth, async (req, res) => {
  try {
    const admin = await isAdminUser(req.userId);
    const where = admin ? { id: req.params.id } : { id: req.params.id, user_id: req.userId };
    const agent = await ServiceAgent.findOne({ where });

    if (!agent) {
      return res.status(404).json({ error: 'Agente no encontrado' });
    }

    await agent.destroy();
    res.json({ success: true, message: 'Agente eliminado' });
  } catch (error) {
    console.error('Delete agent error:', error);
    res.status(500).json({ error: 'Error al eliminar agente' });
  }
});

router.get('/agents/by-service/:serviceName', requireAuth, async (req, res) => {
  try {
    const admin = await isAdminUser(req.userId);
    const where = admin
      ? { service_name: req.params.serviceName, is_active: true }
      : { user_id: req.userId, service_name: req.params.serviceName, is_active: true };
    const agents = await ServiceAgent.findAll({
      where,
      order: [['is_default', 'DESC'], ['agent_name', 'ASC']]
    });
    res.json(agents.map(a => a.toDict()));
  } catch (error) {
    console.error('Get agents by service error:', error);
    res.status(500).json({ error: 'Error al obtener agentes' });
  }
});

router.get('/agents/by-product/:productName', requireAuth, async (req, res) => {
  try {
    const admin = await isAdminUser(req.userId);
    const where = admin ? { is_active: true } : { user_id: req.userId, is_active: true };
    const agents = await ServiceAgent.findAll({ where });

    const productName = req.params.productName.toLowerCase();
    const matchingAgents = agents.filter(a => {
      const products = a.products || [];
      return products.some(p => p.toLowerCase() === productName);
    });

    res.json(matchingAgents.map(a => a.toDict()));
  } catch (error) {
    console.error('Get agents by product error:', error);
    res.status(500).json({ error: 'Error al obtener agentes' });
  }
});

export default router;
