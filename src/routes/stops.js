/**
 * @fileoverview Rutas para la gestión individual de paradas de una ruta.
 */

import { Router } from 'express';
import { Op } from 'sequelize';
import { Route, Stop, sequelize } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * @description Actualiza los datos de una parada específica.
 * @route PUT /api/stops/:id
 * @access Private (Requiere Auth)
 * @param {Object} req.body - Campos: address, lat, lng, order, note, phone, customer_name, priority, status, signature_url, photo_url.
 * @returns {Object} 200 - Parada actualizada.
 * @returns {Object} 404 - Parada no encontrada.
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const stop = await Stop.findByPk(req.params.id, {
      include: [{ model: Route, as: 'route' }]
    });
    
    if (!stop || stop.route.user_id !== req.userId) {
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

/**
 * @description Elimina una parada y reordena las paradas restantes de la ruta.
 * @route DELETE /api/stops/:id
 * @access Private (Requiere Auth)
 * @returns {Object} 200 - Mensaje de éxito.
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const stop = await Stop.findByPk(req.params.id, {
      include: [{ model: Route, as: 'route' }]
    });
    
    if (!stop || stop.route.user_id !== req.userId) {
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

/**
 * @description Marca una parada como completada, permitiendo adjuntar evidencias.
 * @route POST /api/stops/:id/complete
 * @access Private (Requiere Auth)
 * @param {string} [req.body.recipient_name] - Nombre de quien recibe.
 * @param {string} [req.body.signature_url] - URL de la firma.
 * @param {string} [req.body.photo_url] - URL de la foto de entrega.
 * @param {string} [req.body.delivery_notes] - Notas finales de la entrega.
 * @returns {Object} 200 - Parada completada.
 */
router.post('/:id/complete', requireAuth, async (req, res) => {
  try {
    const stop = await Stop.findByPk(req.params.id, {
      include: [{ model: Route, as: 'route' }]
    });
    
    if (!stop || stop.route.user_id !== req.userId) {
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

/**
 * @description Marca una parada como fallida indicando el motivo.
 * @route POST /api/stops/:id/fail
 * @access Private (Requiere Auth)
 * @param {string} req.body.reason - Razón del fallo.
 * @param {string} [req.body.photo_url] - URL de la foto como evidencia del fallo.
 * @returns {Object} 200 - Parada marcada como fallida.
 */
router.post('/:id/fail', requireAuth, async (req, res) => {
  try {
    const stop = await Stop.findByPk(req.params.id, {
      include: [{ model: Route, as: 'route' }]
    });
    
    if (!stop || stop.route.user_id !== req.userId) {
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
