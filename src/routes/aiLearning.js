import express from 'express';
import CustomerProfile from '../models/CustomerProfile.js';
import AgentStyleProfile from '../models/AgentStyleProfile.js';
import StyleLearningService from '../services/styleLearningService.js';
import CustomerProfileService from '../services/customerProfileService.js';
import { Op } from 'sequelize';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'No autenticado' });
  next();
}

// ===== Customer profiles =====
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
router.get('/style', requireAuth, async (req, res) => {
  try {
    const style = await AgentStyleProfile.findOne({ where: { user_id: req.session.userId } });
    res.json(style);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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
