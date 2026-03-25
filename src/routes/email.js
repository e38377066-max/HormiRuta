import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { sendEmail, verifyGmailConnection } from '../services/gmailService.js';
import { getPickupReadyOrders, clearPickupCache } from '../services/gmailReadService.js';

const router = express.Router();

router.get('/verify', requireAdmin, async (req, res) => {
  try {
    await verifyGmailConnection();
    res.json({ success: true, message: 'Conexión con Gmail verificada correctamente', user: process.env.GMAIL_USER });
  } catch (error) {
    console.error('[Email] Error verificando conexión:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/send', requireAdmin, async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;
    if (!to || !subject) {
      return res.status(400).json({ error: 'Se requiere destinatario y asunto' });
    }
    const result = await sendEmail({ to, subject, text, html });
    res.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error('[Email] Error enviando correo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/pickup-ready', requireAuth, async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const orders = await getPickupReadyOrders(forceRefresh);
    res.json({ success: true, orders });
  } catch (error) {
    console.error('[Email] Error obteniendo pickup-ready:', error);
    res.status(500).json({ success: false, error: error.message, orders: [] });
  }
});

router.post('/pickup-ready/refresh', requireAdmin, async (req, res) => {
  try {
    clearPickupCache();
    const orders = await getPickupReadyOrders(true);
    res.json({ success: true, orders });
  } catch (error) {
    console.error('[Email] Error refrescando pickup-ready:', error);
    res.status(500).json({ success: false, error: error.message, orders: [] });
  }
});

export default router;
