import express from 'express';
import { Op } from 'sequelize';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { sendEmail, verifyGmailConnection } from '../services/gmailService.js';
import { getPickupReadyOrders, clearPickupCache, GmailScopeError } from '../services/gmailReadService.js';
import { ValidatedAddress, MessagingSettings } from '../models/index.js';
import respondApiService from '../services/respondApiService.js';

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
    if (error instanceof GmailScopeError) {
      return res.json({ success: false, scopeError: true, error: error.message, orders: [] });
    }
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
    if (error instanceof GmailScopeError) {
      return res.json({ success: false, scopeError: true, error: error.message, orders: [] });
    }
    res.status(500).json({ success: false, error: error.message, orders: [] });
  }
});

function normalizeForMatch(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function namesMatch(orderName, gmailName) {
  const normOrder = normalizeForMatch(orderName);
  const normGmail = normalizeForMatch(gmailName);

  if (!normOrder || !normGmail) return false;

  if (normOrder.includes(normGmail) || normGmail.includes(normOrder)) return true;

  const orderWords = normOrder.split(' ').filter(w => w.length >= 2);
  const gmailWords = normGmail.split(' ').filter(w => w.length >= 2);
  if (!orderWords.length || !gmailWords.length) return false;

  let matches = 0;
  for (const gw of gmailWords) {
    for (const ow of orderWords) {
      if (gw === ow || gw.startsWith(ow) || ow.startsWith(gw)) {
        matches++;
        break;
      }
    }
  }
  const minWords = Math.min(orderWords.length, gmailWords.length);
  return minWords > 0 && matches >= Math.max(1, Math.ceil(minWords * 0.5));
}

router.post('/pickup-ready/sync', requireAdmin, async (req, res) => {
  try {
    clearPickupCache();
    const gmailOrders = await getPickupReadyOrders(true);

    if (!gmailOrders.length) {
      return res.json({ success: true, synced: 0, message: 'No hay correos Pickup Ready en Gmail' });
    }

    const candidates = await ValidatedAddress.findAll({
      where: { order_status: 'ordered' }
    });

    const settings = await MessagingSettings.findOne({
      where: { respond_api_token: { [Op.ne]: null } }
    });

    const synced = [];
    const skipped = [];

    console.log(`[Email Sync] Cotejando ${gmailOrders.length} correos vs ${candidates.length} ordenes en sistema...`);

    for (const gmailOrder of gmailOrders) {
      const match = candidates.find(c =>
        c.customer_name && namesMatch(c.customer_name, gmailOrder.clientName)
      );

      if (!match) {
        console.log(`[Email Sync] Sin coincidencia para Gmail: "${gmailOrder.clientName}"`);
        skipped.push(gmailOrder.clientName);
        continue;
      }

      if (match.order_status === 'pickup_ready') {
        skipped.push(match.customer_name + ' (ya estaba listo)');
        continue;
      }

      console.log(`[Email Sync] Coincidencia encontrada: Gmail="${gmailOrder.clientName}" -> Sistema="${match.customer_name}"`);
      match.order_status = 'pickup_ready';
      await match.save();

      if (settings?.respond_api_token) {
        try {
          respondApiService.setContext(settings.user_id, settings.respond_api_token);
          let identifier = match.respond_contact_id || null;
          if (!identifier && match.customer_phone) {
            const phone = match.customer_phone.replace(/\s+/g, '');
            identifier = `phone:${phone.startsWith('+') ? phone : '+' + phone}`;
          }
          if (identifier) {
            await respondApiService.updateLifecycle(identifier, 'Pickup Ready');
            console.log(`[Email Sync] Lifecycle Pickup Ready: ${match.customer_name}`);
          }
        } catch (lcErr) {
          console.error(`[Email Sync] Error lifecycle ${match.customer_name}:`, lcErr.message);
        }
      }

      synced.push(match.customer_name);
    }

    console.log(`[Email Sync] Sincronizados: ${synced.length}, Omitidos: ${skipped.length}`);
    res.json({ success: true, synced: synced.length, syncedNames: synced, skipped });
  } catch (error) {
    console.error('[Email] Error sincronizando pickup-ready:', error);
    if (error instanceof GmailScopeError) {
      return res.json({ success: false, scopeError: true, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
