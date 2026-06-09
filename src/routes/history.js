/**
 * @fileoverview Rutas para el historial de rutas completadas.
 */

import { Router } from 'express';
import { RouteHistory } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * @description Obtiene el historial de rutas del usuario con paginación.
 * @route GET /api/history
 * @access Private (Requiere Auth)
 * @param {number} [req.query.page=1] - Número de página.
 * @param {number} [req.query.per_page=20] - Registros por página.
 * @returns {Object} 200 - Lista de registros históricos y datos de paginación.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 20;
    const offset = (page - 1) * perPage;
    
    const { count, rows } = await RouteHistory.findAndCountAll({
      where: { user_id: req.userId },
      order: [['created_at', 'DESC']],
      limit: perPage,
      offset
    });
    
    res.json({
      history: rows.map(h => h.toDict()),
      total: count,
      page,
      per_page: perPage,
      total_pages: Math.ceil(count / perPage)
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar historial' });
  }
});

/**
 * @description Obtiene el detalle de un registro histórico de ruta.
 * @route GET /api/history/:id
 * @access Private (Requiere Auth)
 * @returns {Object} 200 - Datos del historial.
 * @returns {Object} 404 - Registro no encontrado.
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const history = await RouteHistory.findOne({
      where: { id: req.params.id, user_id: req.userId }
    });
    
    if (!history) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    
    res.json({ history: history.toDict() });
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar registro' });
  }
});

export default router;
