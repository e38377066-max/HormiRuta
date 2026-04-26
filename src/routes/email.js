import express from 'express';
import { Op } from 'sequelize';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { sendEmail, verifyGmailConnection } from '../services/gmailService.js';
import { getPickupReadyOrders, clearPickupCache, GmailScopeError } from '../services/gmailReadService.js';
import { ValidatedAddress, MessagingSettings, WholesaleClient } from '../models/index.js';
import respondApiService from '../services/respondApiService.js';
import geocodingService from '../services/geocodingService.js';

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

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'las', 'los', 'del', 'por', 'con', 'una', 'uno',
  'de', 'la', 'el', 'en', 'bc', 'from', 'to', 'set', 'shipment'
]);

function getSignificantWords(name) {
  return normalizeForMatch(name)
    .split(' ')
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
}

// Matching ESTRICTO entre nombre del email (Gmail/4over) y nombre del cliente
// en el dispatcher. Evita falsos positivos como "MARTINEZ" matcheando "Martin"
// o nombres de una sola palabra comun matcheando multiples clientes.
//
// Reglas (en orden):
//   1. Match normalizado exacto -> true (alta confianza).
//   2. Un nombre contiene al otro como substring CON limites de palabra y
//      el lado corto tiene >= 6 chars -> true (alta confianza).
//   3. Comparacion por palabras significativas SOLO con coincidencia EXACTA
//      de palabras (sin substring). Requiere >= 2 palabras coincidentes
//      cuando ambos lados tienen >= 2 palabras significativas. Un solo
//      match de palabra NO es suficiente (demasiado ambiguo).
function namesMatch(orderName, gmailName) {
  const normOrder = normalizeForMatch(orderName);
  const normGmail = normalizeForMatch(gmailName);

  if (!normOrder || !normGmail) return false;

  if (normOrder === normGmail) return true;

  // Containment con limites de palabra (no medio-palabra) y minimo 6 chars
  // del lado corto. Asi "abc tile co" matchea "maria garcia abc tile co"
  // pero "martin" no matchea "martinez".
  const wordBoundary = (haystack, needle) => {
    const re = new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
    return re.test(haystack);
  };
  if (normGmail.length >= 6 && wordBoundary(normOrder, normGmail)) return true;
  if (normOrder.length >= 6 && wordBoundary(normGmail, normOrder)) return true;

  const orderWords = getSignificantWords(orderName);
  const gmailWords = getSignificantWords(gmailName);

  if (!orderWords.length || !gmailWords.length) return false;

  // Solo coincidencia EXACTA de palabras significativas. Sin substring.
  let matches = 0;
  for (const gw of gmailWords) {
    if (orderWords.includes(gw)) matches++;
  }

  // Una sola palabra coincidente NO es suficiente: demasiado riesgo
  // (ej. "Tamayo" matchea a 5 clientes distintos). Requiere >= 2.
  const minWords = Math.min(orderWords.length, gmailWords.length);
  if (minWords < 2) return false;
  return matches >= 2;
}

function isWholesaleName(name) {
  return /\bMAY\b/i.test(name) || /\-MAY\b/i.test(name) || /\bMAY\-/i.test(name);
}

const ALREADY_PROCESSED_STATUSES = new Set([
  'pickup_ready', 'on_delivery', 'ups_shipped', 'delivered'
]);

router.post('/pickup-ready/sync', requireAdmin, async (req, res) => {
  try {
    clearPickupCache();
    const gmailOrders = await getPickupReadyOrders(true);

    if (!gmailOrders.length) {
      return res.json({ success: true, synced: 0, message: 'No hay correos Pickup Ready en Gmail' });
    }

    const candidates = await ValidatedAddress.findAll({
      where: {
        order_status: { [Op.in]: ['pending', 'approved', 'ordered', 'pickup_ready', 'on_delivery', 'ups_shipped', 'delivered'] },
        dispatch_status: { [Op.ne]: 'archived' }
      }
    });

    const wholesaleClients = await WholesaleClient.findAll({
      where: { is_active: true }
    });

    const settings = await MessagingSettings.findOne({
      where: { respond_api_token: { [Op.ne]: null } }
    });

    const synced = [];
    const skipped = [];
    const alreadyDone = [];
    const wholesaleSynced = [];

    console.log(`[Email Sync] Cotejando ${gmailOrders.length} correos vs ${candidates.length} órdenes en sistema...`);
    console.log(`[Email Sync] Mayoristas registrados: ${wholesaleClients.length}`);

    const processedGmailOrders = new Set();

    for (const gmailOrder of gmailOrders) {
      if (processedGmailOrders.has(gmailOrder.messageId)) continue;

      // Busca TODOS los candidatos que matchean. Si hay ambiguedad (>1),
      // NO actualiza ninguno: prefiere falso negativo (orden queda en su
      // estado actual) que falso positivo (orden equivocada movida a pickup).
      const allMatches = candidates.filter(c =>
        c.customer_name && namesMatch(c.customer_name, gmailOrder.clientName)
      );

      if (allMatches.length > 1) {
        const names = allMatches.map(m => m.customer_name).join(' | ');
        console.warn(`[Email Sync] AMBIGUEDAD ignorada: Gmail="${gmailOrder.clientName}" matchea ${allMatches.length} clientes: ${names}`);
        processedGmailOrders.add(gmailOrder.messageId);
        skipped.push(`${gmailOrder.clientName} (ambiguo: ${allMatches.length} candidatos)`);
        continue;
      }

      const match = allMatches[0];

      if (match) {
        processedGmailOrders.add(gmailOrder.messageId);

        if (ALREADY_PROCESSED_STATUSES.has(match.order_status)) {
          alreadyDone.push(match.customer_name);
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
        continue;
      }

      if (isWholesaleName(gmailOrder.clientName)) {
        // Mismo criterio anti-ambiguedad para mayoristas.
        const wMatches = wholesaleClients.filter(wc =>
          namesMatch(wc.customer_name, gmailOrder.clientName)
        );
        if (wMatches.length > 1) {
          const names = wMatches.map(m => m.customer_name).join(' | ');
          console.warn(`[Email Sync MAY] AMBIGUEDAD ignorada: Gmail="${gmailOrder.clientName}" matchea ${wMatches.length} mayoristas: ${names}`);
          processedGmailOrders.add(gmailOrder.messageId);
          skipped.push(`${gmailOrder.clientName} (MAY ambiguo: ${wMatches.length})`);
          continue;
        }
        const wClient = wMatches[0];

        if (wClient) {
          processedGmailOrders.add(gmailOrder.messageId);

          const activeOrder = await ValidatedAddress.findOne({
            where: {
              customer_name: wClient.customer_name,
              order_status: { [Op.in]: ['pickup_ready', 'on_delivery', 'ordered'] },
              dispatch_status: { [Op.ne]: 'archived' }
            }
          });

          if (activeOrder) {
            alreadyDone.push(`${wClient.customer_name} (MAY)`);
            continue;
          }

          if (!wClient.validated_address) {
            console.log(`[Email Sync MAY] ${wClient.customer_name} no tiene dirección registrada, omitiendo`);
            skipped.push(`${wClient.customer_name} (MAY - sin dirección)`);
            continue;
          }

          await ValidatedAddress.create({
            user_id: settings?.user_id || 1,
            respond_contact_id: null,
            customer_name: wClient.customer_name,
            customer_phone: wClient.customer_phone || null,
            original_address: wClient.validated_address,
            validated_address: wClient.validated_address,
            address_lat: wClient.address_lat || null,
            address_lng: wClient.address_lng || null,
            zip_code: wClient.zip_code || null,
            city: wClient.city || null,
            state: wClient.state || null,
            confidence: 'high',
            source: 'wholesale_email',
            order_status: 'pickup_ready',
            order_cost: null,
            deposit_amount: null,
            total_to_collect: null,
            notes: `Auto-generado desde correo Pickup Ready (${gmailOrder.date || 'sin fecha'})`
          });

          await wClient.update({
            last_pickup_at: new Date(),
            pickup_count: (wClient.pickup_count || 0) + 1
          });

          if (settings?.respond_api_token && wClient.respond_contact_id) {
            try {
              respondApiService.setContext(settings.user_id, settings.respond_api_token);
              await respondApiService.updateLifecycle(wClient.respond_contact_id, 'Pickup Ready');
            } catch (lcErr) {
              console.error(`[Email Sync MAY] Error lifecycle ${wClient.customer_name}:`, lcErr.message);
            }
          }

          console.log(`[Email Sync MAY] Orden creada automáticamente para mayorista: ${wClient.customer_name}`);
          wholesaleSynced.push(wClient.customer_name);
        } else {
          console.log(`[Email Sync] Nombre MAY sin registro de mayorista: "${gmailOrder.clientName}"`);
          skipped.push(`${gmailOrder.clientName} (MAY - no registrado)`);
        }
      } else {
        console.log(`[Email Sync] Sin coincidencia para Gmail: "${gmailOrder.clientName}"`);
        skipped.push(gmailOrder.clientName);
      }
    }

    const totalSynced = synced.length + wholesaleSynced.length;
    console.log(`[Email Sync] Sincronizados: ${totalSynced} (regulares: ${synced.length}, mayoristas: ${wholesaleSynced.length}), Ya procesados: ${alreadyDone.length}, Sin coincidencia real: ${skipped.length}`);

    res.json({
      success: true,
      synced: totalSynced,
      syncedNames: synced,
      wholesaleSynced: wholesaleSynced,
      alreadyProcessed: alreadyDone.length,
      skipped
    });
  } catch (error) {
    console.error('[Email] Error sincronizando pickup-ready:', error);
    if (error instanceof GmailScopeError) {
      return res.json({ success: false, scopeError: true, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
