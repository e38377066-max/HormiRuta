/**
 * @fileoverview Rutas para la integración con Gmail.
 * Permite verificar la conexión, enviar correos y sincronizar pedidos "Pickup Ready".
 */

import express from 'express';
import { Op } from 'sequelize';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { sendEmail, verifyGmailConnection } from '../services/gmailService.js';
import { getPickupReadyOrders, GmailScopeError } from '../services/gmailReadService.js';
import { ValidatedAddress, MessagingSettings, WholesaleClient } from '../models/index.js';
import geocodingService from '../services/geocodingService.js';
import {
  runPickupReadySync,
  namesMatch,
  isWholesaleName,
  nameSimilarity,
  normalizeForMatch,
  stripPrefixLabel,
  stripGenericSuffixes,
  getOpenAIKey,
  aiNameMatch,
  topCandidatesByName,
  ALREADY_PROCESSED_STATUSES
} from '../services/gmailSyncService.js';

const router = express.Router();

/**
 * @description Verifica si la conexión con Gmail es válida usando las credenciales configuradas.
 * @route GET /api/email/verify
 * @access Private (Admin)
 * @returns {Object} 200 - Estado de la conexión.
 */
router.get('/verify', requireAdmin, async (req, res) => {
  try {
    await verifyGmailConnection();
    res.json({ success: true, message: 'Conexión con Gmail verificada correctamente', user: process.env.GMAIL_USER });
  } catch (error) {
    console.error('[Email] Error verificando conexión:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Envía un correo electrónico a través de Gmail.
 * @route POST /api/email/send
 * @access Private (Admin)
 * @param {string} req.body.to - Destinatario.
 * @param {string} req.body.subject - Asunto.
 * @param {string} [req.body.text] - Cuerpo en texto plano.
 * @param {string} [req.body.html] - Cuerpo en HTML.
 * @returns {Object} 200 - Éxito con ID del mensaje.
 */
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

/**
 * @description Obtiene la lista de pedidos marcados como "Pickup Ready" en Gmail.
 * @route GET /api/email/pickup-ready
 * @access Private (Requiere Auth)
 * @param {boolean} [req.query.refresh=false] - Forzar actualización desde Gmail.
 * @returns {Object} 200 - Lista de pedidos.
 */
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

/**
 * @description Limpia la caché y refresca la lista de pedidos "Pickup Ready" desde Gmail.
 * @route POST /api/email/pickup-ready/refresh
 * @access Private (Admin)
 * @returns {Object} 200 - Lista de pedidos actualizada.
 */
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


/**
 * @description Sincroniza los pedidos "Pickup Ready" de Gmail con el sistema de despacho.
 * @route POST /api/email/pickup-ready/sync
 * @access Private (Admin)
 * @returns {Object} 200 - Resultado de la sincronización.
 */
router.post('/pickup-ready/sync', requireAdmin, async (req, res) => {
  try {
    const result = await runPickupReadySync(true);
    res.json(result);
  } catch (error) {
    console.error('[Email] Error sincronizando pickup-ready:', error);
    if (error instanceof GmailScopeError) {
      return res.json({ success: false, scopeError: true, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @description Diagnostica pedidos de Gmail que no coinciden con clientes del sistema.
 * Proporciona sugerencias basadas en similitud y razonamiento de IA.
 * @route POST /api/email/pickup-ready/diagnose
 * @access Private (Admin)
 * @returns {Object} 200 - Lista de pedidos sin coincidencia y sus sugerencias.
 */
router.post('/pickup-ready/diagnose', requireAdmin, async (req, res) => {
  try {
    // No limpiamos cache: el diagnostico debe usar los mismos correos que ya
    // se intentaron sincronizar, sin forzar otra lectura completa de Gmail.
    const allGmailOrders = await getPickupReadyOrders(false);

    if (!allGmailOrders.length) {
      return res.json({ success: true, total: 0, unmatched: [] });
    }

    // Saltar correos cuyo messageId ya esta asociado a una orden procesada.
    const alreadyProcessedRows = await ValidatedAddress.findAll({
      attributes: ['pickup_email_id'],
      where: { pickup_email_id: { [Op.ne]: null } }
    });
    const processedEmailIds = new Set(
      alreadyProcessedRows.map(r => r.pickup_email_id).filter(Boolean)
    );
    const gmailOrders = allGmailOrders.filter(g => !processedEmailIds.has(g.messageId));

    const candidates = await ValidatedAddress.findAll({
      where: {
        order_status: { [Op.in]: ['pending', 'approved', 'ordered', 'pickup_ready', 'on_delivery', 'ups_shipped', 'delivered'] },
        dispatch_status: { [Op.ne]: 'archived' }
      }
    });

    const wholesaleClients = await WholesaleClient.findAll({
      where: { is_active: true }
    });

    const dedupGmail = [];
    const seen = new Set();
    for (const g of gmailOrders) {
      if (seen.has(g.messageId)) continue;
      seen.add(g.messageId);
      dedupGmail.push(g);
    }

    const aiKey = await getOpenAIKey();
    const unmatched = [];
    for (const gmailOrder of dedupGmail) {
      const exact = candidates.some(c =>
        c.customer_name && namesMatch(c.customer_name, gmailOrder.clientName)
      );
      if (exact) continue;

      const wholesaleExact = isWholesaleName(gmailOrder.clientName) &&
        wholesaleClients.some(wc => namesMatch(wc.customer_name, gmailOrder.clientName));
      if (wholesaleExact) continue;

      const scored = [];
      for (const c of candidates) {
        if (!c.customer_name) continue;
        const sim = nameSimilarity(c.customer_name, gmailOrder.clientName);
        if (sim > 0) scored.push({ name: c.customer_name, source: 'despacho', similarity: sim });
      }
      for (const wc of wholesaleClients) {
        if (!wc.customer_name) continue;
        const sim = nameSimilarity(wc.customer_name, gmailOrder.clientName);
        if (sim > 0) scored.push({ name: wc.customer_name, source: 'mayorista', similarity: sim });
      }

      scored.sort((a, b) => b.similarity - a.similarity);
      const seenSug = new Set();
      const top = [];
      for (const s of scored) {
        const key = s.name.toLowerCase();
        if (seenSug.has(key)) continue;
        seenSug.add(key);
        top.push(s);
        if (top.length >= 3) break;
      }

      // Sugerencia con razonamiento IA: usa los 10 candidatos mas
      // parecidos (combinando despacho + mayorista). Si la IA identifica
      // una coincidencia, la marcamos para que el usuario decida.
      let aiSuggestion = null;
      if (aiKey) {
        const top10 = scored.slice(0, 10);
        const seenTop = new Set();
        const topNames = [];
        for (const s of top10) {
          const k = s.name.toLowerCase();
          if (seenTop.has(k)) continue;
          seenTop.add(k);
          topNames.push(s.name);
        }
        if (topNames.length > 0) {
          try {
            const aiName = await aiNameMatch(gmailOrder.clientName, topNames, aiKey);
            if (aiName) {
              const fromList = scored.find(s => s.name === aiName);
              aiSuggestion = {
                name: aiName,
                source: fromList?.source || 'desconocido'
              };
            }
          } catch (e) {
            console.error('[Email Diagnose AI] Error:', e.message);
          }
        }
      }

      unmatched.push({
        gmailName: gmailOrder.clientName,
        date: gmailOrder.date || null,
        suggestions: top.map(s => ({
          name: s.name,
          source: s.source,
          similarity: Math.round(s.similarity * 100)
        })),
        aiSuggestion
      });
    }

    res.json({
      success: true,
      total: dedupGmail.length,
      unmatchedCount: unmatched.length,
      aiEnabled: !!aiKey,
      unmatched
    });
  } catch (error) {
    console.error('[Email] Error diagnosticando pickup-ready:', error);
    if (error instanceof GmailScopeError) {
      return res.json({ success: false, scopeError: true, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
