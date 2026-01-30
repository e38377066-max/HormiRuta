import { Router } from 'express';
import { Op } from 'sequelize';
import { Route, Stop, sequelize } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const stop = await Stop.findByPk(req.params.id, {
      include: [{ model: Route, as: 'route' }]
    });
    
    if (!stop || stop.route.user_id !== req.session.userId) {
      return res.status(404).json({ error: 'Parada no encontrada' });
    }
    
    const fields = ['address', 'lat', 'lng', 'order', 'note', 'phone', 'customer_name', 'priority', 'status', 'signature_url', 'photo_url'];
    
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        stop[field] = req.body[field];
      }
    }
    
    if (req.body.status === 'arrived') {
      stop.arrived_at = new Date();
    } else if (req.body.status === 'completed') {
      stop.completed_at = new Date();
    }
    
    await stop.save();
    
    res.json({
      success: true,
      stop: stop.toDict()
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar parada' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const stop = await Stop.findByPk(req.params.id, {
      include: [{ model: Route, as: 'route' }]
    });
    
    if (!stop || stop.route.user_id !== req.session.userId) {
      return res.status(404).json({ error: 'Parada no encontrada' });
    }
    
    const routeId = stop.route_id;
    const deletedOrder = stop.order;
    
    await stop.destroy();
    
    await Stop.update(
      { order: sequelize.literal('order - 1') },
      { where: { route_id: routeId, order: { [Op.gt]: deletedOrder } } }
    );
    
    res.json({ success: true, message: 'Parada eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar parada' });
  }
});

router.post('/:id/complete', requireAuth, async (req, res) => {
  try {
    const stop = await Stop.findByPk(req.params.id, {
      include: [{ model: Route, as: 'route' }]
    });
    
    if (!stop || stop.route.user_id !== req.session.userId) {
      return res.status(404).json({ error: 'Parada no encontrada' });
    }
    
    stop.status = 'completed';
    stop.completed_at = new Date();
    
    if (req.body.recipient_name) stop.recipient_name = req.body.recipient_name;
    if (req.body.signature_url) stop.signature_url = req.body.signature_url;
    if (req.body.photo_url) stop.photo_url = req.body.photo_url;
    if (req.body.delivery_notes) stop.delivery_notes = req.body.delivery_notes;
    
    await stop.save();
    
    res.json({
      success: true,
      stop: stop.toDict()
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al completar parada' });
  }
});

router.post('/:id/fail', requireAuth, async (req, res) => {
  try {
    const stop = await Stop.findByPk(req.params.id, {
      include: [{ model: Route, as: 'route' }]
    });
    
    if (!stop || stop.route.user_id !== req.session.userId) {
      return res.status(404).json({ error: 'Parada no encontrada' });
    }
    
    stop.status = 'failed';
    stop.completed_at = new Date();
    stop.failed_reason = req.body.reason || 'No especificado';
    
    if (req.body.photo_url) stop.photo_url = req.body.photo_url;
    if (req.body.delivery_notes) stop.delivery_notes = req.body.delivery_notes;
    
    await stop.save();
    
    res.json({
      success: true,
      stop: stop.toDict()
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al marcar parada fallida' });
  }
});

export default router;
