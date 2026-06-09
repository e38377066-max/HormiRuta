/**
 * @fileoverview Rutas para el aprendizaje de IA y perfiles de clientes.
 * Gestiona el almacenamiento de perfiles de clientes y el perfil de estilo del agente.
 */

import express from 'express';
import CustomerProfile from '../models/CustomerProfile.js';
import AgentStyleProfile from '../models/AgentStyleProfile.js';
import StyleLearningService from '../services/styleLearningService.js';
import CustomerProfileService from '../services/customerProfileService.js';
import { Op } from 'sequelize';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// ===== Customer profiles =====
/**
 * @description Lista los perfiles de clientes del usuario autenticado.
 * @route GET /api/ai-learning/customers
 * @access Private (Requiere Auth)
 * @param {string} [req.query.search] - Término de búsqueda para nombre, resumen o ID.
 * @returns {Array} 200 - Lista de perfiles de clientes.
 */
router.get('/customers', requireAuth, async (req, res) => {
  try {
    const { search } = req.query;
    const where = { user_id: req.session.userId };
    if (search) {
      where[Op.or] = [
        { contact_name: { [Op.iLike]: `%${search}%` } },
        { summary: { [Op.iLike]: `%${search}%` } },
        { contact_id: { [Op.iLike]: `%${search}%` } }
      ];
    }
    const list = await CustomerProfile.findAll({
      where,
      order: [['last_conversation_at', 'DESC']],
      limit: 200
    });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @description Obtiene un perfil de cliente específico por su ID de contacto.
 * @route GET /api/ai-learning/customers/:contactId
 * @access Private (Requiere Auth)
 * @returns {Object} 200 - Perfil del cliente.
 * @returns {Object} 404 - Perfil no encontrado.
 */
router.get('/customers/:contactId', requireAuth, async (req, res) => {
  try {
    const profile = await CustomerProfile.findOne({
      where: { user_id: req.session.userId, contact_id: req.params.contactId }
    });
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });
    res.json(profile);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @description Refresca/actualiza un perfil de cliente analizando su historial de conversación más reciente.
 * @route POST /api/ai-learning/customers/:contactId/refresh
 * @access Private (Requiere Auth)
 * @param {string} [req.body.firstName] - Nombre del contacto.
 * @param {string} [req.body.lastName] - Apellido del contacto.
 * @returns {Object} 200 - Perfil actualizado.
 */
router.post('/customers/:contactId/refresh', requireAuth, async (req, res) => {
  try {
    const profile = await CustomerProfileService.refreshFromConversation(
      req.session.userId,
      { id: req.params.contactId, firstName: req.body?.firstName, lastName: req.body?.lastName }
    );
    res.json(profile);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @description Actualiza manualmente los campos de un perfil de cliente.
 * @route PUT /api/ai-learning/customers/:contactId
 * @access Private (Requiere Auth)
 * @param {string} [req.body.summary] - Resumen de la relación.
 * @param {string} [req.body.notes] - Notas adicionales.
 * @param {string} [req.body.preferences] - Preferencias del cliente.
 * @param {string} [req.body.past_products] - Productos comprados anteriormente.
 * @returns {Object} 200 - Perfil actualizado.
 * @returns {Object} 404 - Perfil no encontrado.
 */
router.put('/customers/:contactId', requireAuth, async (req, res) => {
  try {
    const profile = await CustomerProfile.findOne({
      where: { user_id: req.session.userId, contact_id: req.params.contactId }
    });
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });
    const { summary, notes, preferences, past_products } = req.body || {};
    const update = {};
    if (summary !== undefined) update.summary = summary;
    if (notes !== undefined) update.notes = notes;
    if (preferences !== undefined) update.preferences = preferences;
    if (past_products !== undefined) update.past_products = past_products;
    await profile.update(update);
    res.json(profile);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @description Elimina el perfil de un cliente.
 * @route DELETE /api/ai-learning/customers/:contactId
 * @access Private (Requiere Auth)
 * @returns {Object} 200 - Confirmación de eliminación.
 */
router.delete('/customers/:contactId', requireAuth, async (req, res) => {
  try {
    await CustomerProfile.destroy({
      where: { user_id: req.session.userId, contact_id: req.params.contactId }
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== Agent style =====
/**
 * @description Obtiene el perfil de estilo del agente para el usuario autenticado.
 * @route GET /api/ai-learning/style
 * @access Private (Requiere Auth)
 * @returns {Object} 200 - Perfil de estilo.
 */
router.get('/style', requireAuth, async (req, res) => {
  try {
    const style = await AgentStyleProfile.findOne({ where: { user_id: req.session.userId } });
    res.json(style);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @description Refresca el perfil de estilo analizando conversaciones pasadas con IA.
 * @route POST /api/ai-learning/style/refresh
 * @access Private (Requiere Auth)
 * @returns {Object} 200 - Perfil de estilo actualizado.
 */
router.post('/style/refresh', requireAuth, async (req, res) => {
  try {
    // Forzar re-análisis aunque sea reciente
    const existing = await AgentStyleProfile.findOne({ where: { user_id: req.session.userId } });
    if (existing) {
      await existing.update({ last_analyzed_at: null });
    }
    const style = await StyleLearningService.refreshStyleProfile(req.session.userId);
    res.json(style);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * @description Actualiza manualmente los parámetros del perfil de estilo.
 * @route PUT /api/ai-learning/style
 * @access Private (Requiere Auth)
 * @param {Object} req.body - Campos: style_summary, common_phrases, emoji_usage, closing_techniques, do_phrases, dont_phrases, is_active.
 * @returns {Object} 200 - Perfil de estilo actualizado.
 * @returns {Object} 404 - Perfil no encontrado.
 */
router.put('/style', requireAuth, async (req, res) => {
  try {
    const style = await AgentStyleProfile.findOne({ where: { user_id: req.session.userId } });
    if (!style) return res.status(404).json({ error: 'Perfil de estilo no existe aún' });
    const { style_summary, common_phrases, emoji_usage, closing_techniques, do_phrases, dont_phrases, is_active } = req.body || {};
    const update = {};
    if (style_summary !== undefined) update.style_summary = style_summary;
    if (common_phrases !== undefined) update.common_phrases = common_phrases;
    if (emoji_usage !== undefined) update.emoji_usage = emoji_usage;
    if (closing_techniques !== undefined) update.closing_techniques = closing_techniques;
    if (do_phrases !== undefined) update.do_phrases = do_phrases;
    if (dont_phrases !== undefined) update.dont_phrases = dont_phrases;
    if (is_active !== undefined) update.is_active = is_active;
    await style.update(update);
    res.json(style);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
