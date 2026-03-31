import express from 'express';
import BotMemory from '../models/BotMemory.js';
import { Op } from 'sequelize';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'No autenticado' });
  next();
}

// GET /api/bot-memory — listar todas las memorias
router.get('/', requireAuth, async (req, res) => {
  try {
    const { source, is_approved, context_type } = req.query;
    const where = { user_id: req.session.userId };
    if (source) where.source = source;
    if (is_approved !== undefined) where.is_approved = is_approved === 'true';
    if (context_type) where.context_type = context_type;

    const memories = await BotMemory.findAll({
      where,
      order: [['created_at', 'DESC']]
    });
    res.json(memories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bot-memory/pending — lecciones auto-detectadas pendientes de revisión
router.get('/pending', requireAuth, async (req, res) => {
  try {
    const memories = await BotMemory.findAll({
      where: {
        user_id: req.session.userId,
        source: 'auto_detected',
        is_approved: false,
        is_active: true
      },
      order: [['created_at', 'DESC']]
    });
    res.json(memories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bot-memory/stats
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const total = await BotMemory.count({ where: { user_id: userId, is_active: true } });
    const active = await BotMemory.count({ where: { user_id: userId, is_active: true, is_approved: true } });
    const pending = await BotMemory.count({ where: { user_id: userId, source: 'auto_detected', is_approved: false, is_active: true } });
    const manual = await BotMemory.count({ where: { user_id: userId, source: 'manual', is_active: true } });
    res.json({ total, active, pending, manual });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bot-memory — crear lección manual
router.post('/', requireAuth, async (req, res) => {
  try {
    const { lesson, context_type, trigger_example } = req.body;
    if (!lesson?.trim()) return res.status(400).json({ error: 'La lección no puede estar vacía' });

    const memory = await BotMemory.create({
      user_id: req.session.userId,
      lesson: lesson.trim(),
      context_type: context_type || 'general',
      trigger_example: trigger_example?.trim() || null,
      source: 'manual',
      is_approved: true,
      is_active: true
    });
    res.json(memory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/bot-memory/:id — editar o aprobar/rechazar
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const memory = await BotMemory.findOne({
      where: { id: req.params.id, user_id: req.session.userId }
    });
    if (!memory) return res.status(404).json({ error: 'No encontrado' });

    const { lesson, context_type, trigger_example, is_approved, is_active } = req.body;
    const updates = {};
    if (lesson !== undefined) updates.lesson = lesson.trim();
    if (context_type !== undefined) updates.context_type = context_type;
    if (trigger_example !== undefined) updates.trigger_example = trigger_example?.trim() || null;
    if (is_approved !== undefined) updates.is_approved = is_approved;
    if (is_active !== undefined) updates.is_active = is_active;

    await memory.update(updates);
    res.json(memory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bot-memory/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const memory = await BotMemory.findOne({
      where: { id: req.params.id, user_id: req.session.userId }
    });
    if (!memory) return res.status(404).json({ error: 'No encontrado' });
    await memory.destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
