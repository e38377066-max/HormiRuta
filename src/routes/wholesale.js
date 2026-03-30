import express from 'express';
import { Op } from 'sequelize';
import { requireAdmin } from '../middleware/auth.js';
import { WholesaleClient, ValidatedAddress, User } from '../models/index.js';
import geocodingService from '../services/geocodingService.js';

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
  try {
    const clients = await WholesaleClient.findAll({
      order: [['customer_name', 'ASC']]
    });

    const clientsWithStatus = await Promise.all(clients.map(async (wc) => {
      const activeOrder = await ValidatedAddress.findOne({
        where: {
          customer_name: wc.customer_name,
          order_status: { [Op.in]: ['pickup_ready', 'on_delivery', 'ordered'] },
          dispatch_status: { [Op.ne]: 'archived' }
        },
        order: [['created_at', 'DESC']]
      });

      return {
        id: wc.id,
        user_id: wc.user_id,
        respond_contact_id: wc.respond_contact_id,
        customer_name: wc.customer_name,
        customer_phone: wc.customer_phone,
        validated_address: wc.validated_address,
        address_lat: wc.address_lat,
        address_lng: wc.address_lng,
        zip_code: wc.zip_code,
        city: wc.city,
        state: wc.state,
        notes: wc.notes,
        is_active: wc.is_active,
        last_pickup_at: wc.last_pickup_at,
        pickup_count: wc.pickup_count,
        active_order_status: activeOrder?.order_status || null,
        active_order_id: activeOrder?.id || null,
        created_at: wc.created_at,
        updated_at: wc.updated_at
      };
    }));

    res.json({ success: true, clients: clientsWithStatus });
  } catch (error) {
    console.error('[Wholesale] Error listando clientes:', error);
    res.status(500).json({ error: 'Error al obtener clientes mayoristas' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { customer_name, customer_phone, validated_address, respond_contact_id, notes } = req.body;

    if (!customer_name) {
      return res.status(400).json({ error: 'El nombre del cliente es requerido' });
    }

    const existing = await WholesaleClient.findOne({
      where: { customer_name: customer_name.trim() }
    });
    if (existing) {
      return res.status(409).json({ error: 'Ya existe un mayorista con ese nombre' });
    }

    const user = await User.findOne({ where: { role: 'admin' } });
    const userId = user?.id || req.userId;

    let geoData = {};
    if (validated_address) {
      try {
        const geo = await geocodingService.geocodeAddress(validated_address);
        if (geo.success) {
          geoData = {
            validated_address: geo.fullAddress || validated_address,
            address_lat: geo.latitude,
            address_lng: geo.longitude,
            zip_code: geo.zip || null,
            city: geo.city || null,
            state: geo.stateShort || geo.state || null
          };
        } else {
          geoData = { validated_address };
        }
      } catch {
        geoData = { validated_address };
      }
    }

    const client = await WholesaleClient.create({
      user_id: userId,
      respond_contact_id: respond_contact_id?.trim() || null,
      customer_name: customer_name.trim(),
      customer_phone: customer_phone?.trim() || null,
      notes: notes?.trim() || null,
      is_active: true,
      ...geoData
    });

    console.log(`[Wholesale] Mayorista creado: ${client.customer_name}`);
    res.status(201).json({ success: true, client });
  } catch (error) {
    console.error('[Wholesale] Error creando cliente:', error);
    res.status(500).json({ error: 'Error al crear cliente mayorista' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const client = await WholesaleClient.findByPk(req.params.id);
    if (!client) return res.status(404).json({ error: 'Mayorista no encontrado' });

    const { customer_name, customer_phone, validated_address, respond_contact_id, notes, is_active } = req.body;

    if (customer_name !== undefined) client.customer_name = customer_name.trim();
    if (customer_phone !== undefined) client.customer_phone = customer_phone?.trim() || null;
    if (respond_contact_id !== undefined) client.respond_contact_id = respond_contact_id?.trim() || null;
    if (notes !== undefined) client.notes = notes?.trim() || null;
    if (is_active !== undefined) client.is_active = is_active;

    if (validated_address && validated_address !== client.validated_address) {
      try {
        const geo = await geocodingService.geocodeAddress(validated_address);
        if (geo.success) {
          client.validated_address = geo.fullAddress || validated_address;
          client.address_lat = geo.latitude;
          client.address_lng = geo.longitude;
          client.zip_code = geo.zip || client.zip_code;
          client.city = geo.city || client.city;
          client.state = geo.stateShort || geo.state || client.state;
        } else {
          client.validated_address = validated_address;
        }
      } catch {
        client.validated_address = validated_address;
      }
    }

    await client.save();
    console.log(`[Wholesale] Mayorista actualizado: ${client.customer_name}`);
    res.json({ success: true, client });
  } catch (error) {
    console.error('[Wholesale] Error actualizando cliente:', error);
    res.status(500).json({ error: 'Error al actualizar cliente mayorista' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const client = await WholesaleClient.findByPk(req.params.id);
    if (!client) return res.status(404).json({ error: 'Mayorista no encontrado' });

    const name = client.customer_name;
    await client.destroy();
    console.log(`[Wholesale] Mayorista eliminado: ${name}`);
    res.json({ success: true, message: `Mayorista "${name}" eliminado` });
  } catch (error) {
    console.error('[Wholesale] Error eliminando cliente:', error);
    res.status(500).json({ error: 'Error al eliminar cliente mayorista' });
  }
});

router.post('/:id/dispatch-now', requireAdmin, async (req, res) => {
  try {
    const client = await WholesaleClient.findByPk(req.params.id);
    if (!client) return res.status(404).json({ error: 'Mayorista no encontrado' });

    if (!client.validated_address) {
      return res.status(400).json({ error: 'El mayorista no tiene dirección registrada' });
    }

    const activeOrder = await ValidatedAddress.findOne({
      where: {
        customer_name: client.customer_name,
        order_status: { [Op.in]: ['pickup_ready', 'on_delivery', 'ordered'] },
        dispatch_status: { [Op.ne]: 'archived' }
      }
    });

    if (activeOrder) {
      return res.status(409).json({
        error: `Ya tiene una orden activa en estado "${activeOrder.order_status}"`,
        active_order_id: activeOrder.id
      });
    }

    const settings = await (await import('../models/MessagingSettings.js')).default.findOne({
      where: { respond_api_token: { [Op.ne]: null } }
    });

    const newOrder = await ValidatedAddress.create({
      user_id: settings?.user_id || client.user_id,
      respond_contact_id: client.respond_contact_id || null,
      customer_name: client.customer_name,
      customer_phone: client.customer_phone || null,
      original_address: client.validated_address,
      validated_address: client.validated_address,
      address_lat: client.address_lat || null,
      address_lng: client.address_lng || null,
      zip_code: client.zip_code || null,
      city: client.city || null,
      state: client.state || null,
      confidence: 'high',
      source: 'wholesale_manual',
      order_status: 'pickup_ready',
      notes: client.notes || null
    });

    await client.update({
      last_pickup_at: new Date(),
      pickup_count: (client.pickup_count || 0) + 1
    });

    console.log(`[Wholesale] Orden manual creada para mayorista: ${client.customer_name}`);
    res.json({ success: true, order: newOrder.toDict() });
  } catch (error) {
    console.error('[Wholesale] Error creando orden manual:', error);
    res.status(500).json({ error: 'Error al crear orden para mayorista' });
  }
});

export default router;
