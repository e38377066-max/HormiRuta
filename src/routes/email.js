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
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Etiquetas cortas que 4over antepone al nombre del cliente en el correo
// (ej. "bc Diaz Cleaning" -> bc = business cards, "ys" = yard signs,
// "dh" = door hangers, "bann" = banner). Se eliminan ANTES de comparar.
const PREFIX_LABELS = new Set([
  'bc', 'pc', 'fl', 'ma', 'mc', 'st', 'sb', 'pr', 'pos', 'eddm', 'ddm',
  'ys', 'dh', 'bann', 'sn'
]);

function stripPrefixLabel(name) {
  if (!name) return '';
  let trimmed = String(name).trim();
  // Caso 1: prefijo separado por espacio. Ej: "bc Diaz Cleaning" -> "Diaz Cleaning"
  const m = trimmed.match(/^([A-Za-z]{2,4})\s+(.+)$/);
  if (m && PREFIX_LABELS.has(m[1].toLowerCase())) {
    return m[2].trim();
  }
  // Caso 2: prefijo PEGADO sin espacio antes de letra mayuscula.
  // Ej: "bcLEO-3" -> "LEO-3", "bcIRE-carpinteria" -> "IRE-carpinteria",
  // "bcIRESalon" -> "IRESalon". Solo se quita si las primeras 2-4 letras
  // minusculas estan en el listado de prefijos y luego viene una mayuscula.
  const m2 = trimmed.match(/^([a-z]{2,4})([A-Z].*)$/);
  if (m2 && PREFIX_LABELS.has(m2[1])) {
    return m2[2].trim();
  }
  return trimmed;
}

// Sufijos comerciales que se quitan SIEMPRE que van al final del nombre.
// Como se quitan de AMBOS lados y luego se compara igualdad, no causan
// falsos positivos: "Anita's Cleaning" -> "anitas" vs "Diaz Cleaning" ->
// "diaz" siguen siendo diferentes. La proteccion contra ambiguedad
// (allMatches.length > 1) ademas evita que dos clientes que terminen
// quedando con el mismo nombre limpio se actualicen por error.
const SUFFIX_WORDS = new Set([
  'services', 'service', 'srv', 'srvs',
  'llc', 'inc', 'corp', 'co', 'company', 'ltd',
  'motors', 'motor', 'auto', 'autos',
  'realtor', 'realty',
  'mechanic', 'mechanics',
  'esp',
  'group', 'solutions',
  'shop', 'store',
  'experts', 'expert',
  'taqueria', 'restaurant', 'pizza',
  'lawn', 'care',
  'cleaning',
  'detailing',
  'landscaping',
  'painting',
  'roofing',
  'concrete',
  'plumbing',
  'remodeling',
  'construction',
  'wash',
  'barber', 'salon', 'beauty',
  'tree', 'trees',
  'iglesia', 'church'
]);

function stripGenericSuffixes(normName) {
  if (!normName) return '';
  let words = normName.split(' ').filter(Boolean);
  // Quitar tokens al final que sean SOLO digitos (numero de orden 4over,
  // ej. "Flowers by me -2" -> "flowers by me 2" -> "flowers by me").
  while (words.length > 1 && /^\d+$/.test(words[words.length - 1])) {
    words.pop();
  }
  // Quitar palabras de sufijo comercial generico (services, llc, motors, etc.)
  while (words.length > 1 && SUFFIX_WORDS.has(words[words.length - 1])) {
    words.pop();
  }
  // Volver a quitar digitos finales por si quedaron expuestos despues de
  // remover los sufijos.
  while (words.length > 1 && /^\d+$/.test(words[words.length - 1])) {
    words.pop();
  }
  return words.join(' ');
}

// Normalizacion fonetica para Espanol: aproxima sonidos similares para que
// "Alonzo" y "Alonso" se reconozcan como el mismo apellido (z y s suenan
// igual en LatAm), y "Vasquez" = "Vazquez", "Hernandez" = "Ernandez", etc.
// NO hace proximidad de palabras: solo ajusta letras que suenan igual.
function spanishPhonetic(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/h/g, '')           // h muda
    .replace(/z/g, 's')          // z suena como s
    .replace(/v/g, 'b')          // v suena como b
    .replace(/ll/g, 'y')         // ll suena como y
    .replace(/qu/g, 'k')         // qu suena como k
    .replace(/c([ei])/g, 's$1')  // ce/ci suena se/si
    .replace(/\s+/g, ' ')
    .trim();
}

// Matching CONTROLADO entre el nombre del email (Gmail/4over) y el nombre
// del cliente en el dispatcher. Aplica 3 capas de comparacion estricta:
// 1) Igualdad exacta tras quitar prefijo de 4over.
// 2) Igualdad exacta tras quitar tambien sufijos comerciales (Services,
//    Realtor, ESP, Mechanic, LLC, etc.).
// 3) Igualdad exacta tras normalizar foneticamente (z=s, v=b, h muda,
//    ll=y) - asi "Marty Alonzo" matchea "Marty Alonso Realtor".
// NO acepta coincidencias por proximidad, substring, palabras parciales
// ni palabras compartidas. Si los nombres tienen tipos reales (letras
// faltantes/extra) NO matchean - el usuario debe corregir la ortografia.
function namesMatch(orderName, gmailName) {
  const normOrder = normalizeForMatch(stripPrefixLabel(orderName));
  const normGmail = normalizeForMatch(stripPrefixLabel(gmailName));

  if (!normOrder || !normGmail) return false;
  if (normOrder === normGmail) return true;

  const cleanOrder = stripGenericSuffixes(normOrder);
  const cleanGmail = stripGenericSuffixes(normGmail);

  if (!cleanOrder || !cleanGmail) return false;
  // Minimo 3 caracteres tras la limpieza para evitar matches en nombres muy
  // cortos (ej. "Leo").
  if (cleanOrder.length < 3 || cleanGmail.length < 3) return false;
  if (cleanOrder === cleanGmail) return true;

  const phonOrder = spanishPhonetic(cleanOrder);
  const phonGmail = spanishPhonetic(cleanGmail);
  if (phonOrder.length < 3 || phonGmail.length < 3) return false;

  return phonOrder === phonGmail;
}

function isWholesaleName(name) {
  return /\bMAY\b/i.test(name) || /\-MAY\b/i.test(name) || /\bMAY\-/i.test(name);
}

// Calcula similitud Jaccard entre conjuntos de palabras de dos nombres.
// Retorna entre 0 y 1 (1 = identicos, 0 = sin palabras en comun).
function nameSimilarity(a, b) {
  const tokensA = new Set(normalizeForMatch(stripPrefixLabel(a)).split(' ').filter(w => w.length > 1));
  const tokensB = new Set(normalizeForMatch(stripPrefixLabel(b)).split(' ').filter(w => w.length > 1));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let inter = 0;
  for (const t of tokensA) if (tokensB.has(t)) inter++;
  const union = tokensA.size + tokensB.size - inter;
  return union === 0 ? 0 : inter / union;
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

// Endpoint de diagnostico: lista los correos Pickup Ready de Gmail que NO
// matchean ningun cliente del sistema, junto con las 3 sugerencias mas
// parecidas (por similitud de palabras) tanto del despacho como de mayoristas.
// Sirve para que el usuario alinee manualmente los nombres en Respond.io.
router.post('/pickup-ready/diagnose', requireAdmin, async (req, res) => {
  try {
    // No limpiamos cache: el diagnostico debe usar los mismos correos que ya
    // se intentaron sincronizar, sin forzar otra lectura completa de Gmail.
    const gmailOrders = await getPickupReadyOrders(false);

    if (!gmailOrders.length) {
      return res.json({ success: true, total: 0, unmatched: [] });
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

    const dedupGmail = [];
    const seen = new Set();
    for (const g of gmailOrders) {
      if (seen.has(g.messageId)) continue;
      seen.add(g.messageId);
      dedupGmail.push(g);
    }

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

      unmatched.push({
        gmailName: gmailOrder.clientName,
        date: gmailOrder.date || null,
        suggestions: top.map(s => ({
          name: s.name,
          source: s.source,
          similarity: Math.round(s.similarity * 100)
        }))
      });
    }

    res.json({
      success: true,
      total: dedupGmail.length,
      unmatchedCount: unmatched.length,
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
