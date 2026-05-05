/**
 * gmailSyncService.js
 * Lógica central del sync Gmail → órdenes del sistema.
 * Puede ser llamada desde el route HTTP (manual) o desde el scheduler
 * automático (cada 15 minutos).
 */

import axios from 'axios';
import { Op } from 'sequelize';
import { getPickupReadyOrders, clearPickupCache, GmailScopeError } from './gmailReadService.js';
import { ValidatedAddress, MessagingSettings, WholesaleClient } from '../models/index.js';
import respondApiService from './respondApiService.js';

// ─── Helpers de normalización y matching ────────────────────────────────────

export function normalizeForMatch(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PREFIX_LABELS = new Set([
  'bc', 'pc', 'fl', 'ma', 'mc', 'st', 'sb', 'pr', 'pos', 'eddm', 'ddm',
  'ys', 'dh', 'bann', 'sn'
]);

export function stripPrefixLabel(name) {
  if (!name) return '';
  let trimmed = String(name).trim();
  const m = trimmed.match(/^([A-Za-z]{2,4})\s+(.+)$/);
  if (m && PREFIX_LABELS.has(m[1].toLowerCase())) return m[2].trim();
  const m2 = trimmed.match(/^([a-z]{2,4})([A-Z].*)$/);
  if (m2 && PREFIX_LABELS.has(m2[1])) return m2[2].trim();
  return trimmed;
}

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

export function stripGenericSuffixes(normName) {
  if (!normName) return '';
  let words = normName.split(' ').filter(Boolean);
  while (words.length > 1 && /^\d+$/.test(words[words.length - 1])) words.pop();
  while (words.length > 1 && SUFFIX_WORDS.has(words[words.length - 1])) words.pop();
  while (words.length > 1 && /^\d+$/.test(words[words.length - 1])) words.pop();
  return words.join(' ');
}

function spanishPhonetic(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/h/g, '')
    .replace(/z/g, 's')
    .replace(/v/g, 'b')
    .replace(/ll/g, 'y')
    .replace(/qu/g, 'k')
    .replace(/c([ei])/g, 's$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function singularizeWord(w) {
  if (!w || w.length < 4) return w;
  if (/ss$/.test(w)) return w;
  if (/s$/.test(w)) return w.slice(0, -1);
  return w;
}

function singularizeName(s) {
  return String(s || '').split(' ').filter(Boolean).map(singularizeWord).join(' ');
}

function tokensOf(s) {
  return String(s || '').split(' ').filter(Boolean);
}

function isDistinctiveToken(t) {
  if (!t || t.length < 3) return false;
  if (SUFFIX_WORDS.has(t)) return false;
  if (PREFIX_LABELS.has(t)) return false;
  return true;
}

export function namesMatch(orderName, gmailName) {
  const normOrder = normalizeForMatch(stripPrefixLabel(orderName));
  const normGmail = normalizeForMatch(stripPrefixLabel(gmailName));

  if (!normOrder || !normGmail) return false;
  if (normOrder === normGmail) return true;

  const cleanOrder = stripGenericSuffixes(normOrder);
  const cleanGmail = stripGenericSuffixes(normGmail);

  if (!cleanOrder || !cleanGmail) return false;
  if (cleanOrder.length >= 3 && cleanGmail.length >= 3) {
    if (cleanOrder === cleanGmail) return true;
    const phonOrder = spanishPhonetic(cleanOrder);
    const phonGmail = spanishPhonetic(cleanGmail);
    if (phonOrder.length >= 3 && phonGmail.length >= 3 && phonOrder === phonGmail) return true;
    const singOrder = spanishPhonetic(singularizeName(cleanOrder));
    const singGmail = spanishPhonetic(singularizeName(cleanGmail));
    if (singOrder.length >= 3 && singGmail.length >= 3 && singOrder === singGmail) return true;
  }

  const toksOrder = tokensOf(spanishPhonetic(singularizeName(normOrder)));
  const toksGmail = tokensOf(spanishPhonetic(singularizeName(normGmail)));
  if (toksOrder.length && toksGmail.length) {
    const setO = new Set(toksOrder);
    const setG = new Set(toksGmail);
    const [small, large] = setO.size <= setG.size ? [setO, setG] : [setG, setO];
    if (small.size >= 2) {
      let allIn = true;
      for (const t of small) { if (!large.has(t)) { allIn = false; break; } }
      if (allIn) {
        let distinctive = 0;
        for (const t of small) if (isDistinctiveToken(t)) distinctive++;
        if (distinctive >= 1) return true;
      }
    }
  }

  return false;
}

export function isWholesaleName(name) {
  return /\bMAY\b/i.test(name) || /\-MAY\b/i.test(name) || /\bMAY\-/i.test(name);
}

export function nameSimilarity(a, b) {
  const tokensA = new Set(normalizeForMatch(stripPrefixLabel(a)).split(' ').filter(w => w.length > 1));
  const tokensB = new Set(normalizeForMatch(stripPrefixLabel(b)).split(' ').filter(w => w.length > 1));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let inter = 0;
  for (const t of tokensA) if (tokensB.has(t)) inter++;
  const union = tokensA.size + tokensB.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function topCandidatesByName(gmailName, candidates, getName, n = 10) {
  return candidates
    .map(c => ({ c, sim: nameSimilarity(getName(c), gmailName) }))
    .filter(x => x.sim > 0)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, n);
}

// ─── Respaldo IA ─────────────────────────────────────────────────────────────

const aiMatchCache = new Map();
const AI_CACHE_TTL_MS = 30 * 60 * 1000;

function aiCacheKey(gmailName, candidateNames) {
  return `${normalizeForMatch(gmailName)}::${candidateNames.slice().sort().join('||')}`;
}

export async function getOpenAIKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  try {
    const settings = await MessagingSettings.findOne({
      where: { openai_api_key: { [Op.ne]: null } }
    });
    return settings?.openai_api_key || null;
  } catch {
    return null;
  }
}

export async function aiNameMatch(gmailName, candidateNames, apiKey) {
  if (!apiKey || !gmailName || !candidateNames?.length) return null;
  const cacheKey = aiCacheKey(gmailName, candidateNames);
  const cached = aiMatchCache.get(cacheKey);
  if (cached && (Date.now() - cached.at) < AI_CACHE_TTL_MS) return cached.result;

  const numbered = candidateNames.map((n, i) => `${i + 1}. ${n}`).join('\n');
  const prompt = `Eres un asistente que decide si un nombre de cliente que aparece en el asunto de un correo de imprenta corresponde al mismo cliente que ya existe en una lista de ordenes activas del sistema.

Nombre en el correo: "${gmailName}"

Candidatos en el sistema:
${numbered}

Reglas:
- Acepta variaciones tipograficas obvias en espanol (Robles=Roble, Vazquez=Vasquez, h muda, ll=y, v=b).
- Acepta sufijos comerciales agregados u omitidos (Services, LLC, Painting, Cleaning, Tree, Lawn Care, Iglesia, etc.).
- Acepta nombre de pila extra u omitido (ej. "Rafael Flyer iglesia" = "Flyer iglesia"; "Marty Alonso" = "Marty Alonso Realtor").
- Acepta orden de palabras invertido si los tokens distintivos coinciden.
- IGNORA prefijos de producto al inicio como "bc", "pc", "dh", "ys", "fl", "ma" (son codigos de imprenta).
- NO inventes coincidencias entre clientes claramente distintos (ej. "Roble Tree" NO es lo mismo que "Vazquez Tree" aunque ambos sean tree services).
- Si dos o mas candidatos podrian ser el correcto, responde "NONE" (preferimos no actualizar a actualizar el cliente equivocado).

Responde SOLO con JSON valido en este formato:
{"match": "NONE o el nombre EXACTO de un candidato copiado letra por letra", "razon": "explicacion breve"}`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 150,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }]
      },
      { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 20000 }
    );
    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) { aiMatchCache.set(cacheKey, { at: Date.now(), result: null }); return null; }
    let parsed;
    try { parsed = JSON.parse(content); } catch { parsed = null; }
    if (!parsed) { aiMatchCache.set(cacheKey, { at: Date.now(), result: null }); return null; }
    const matched = (parsed.match || '').toString().trim();
    if (!matched || matched.toUpperCase() === 'NONE') {
      console.log(`[Email Sync AI] "${gmailName}" -> NONE (${parsed.razon || ''})`);
      aiMatchCache.set(cacheKey, { at: Date.now(), result: null });
      return null;
    }
    const exact = candidateNames.find(n => n === matched)
      || candidateNames.find(n => normalizeForMatch(n) === normalizeForMatch(matched));
    if (!exact) {
      console.warn(`[Email Sync AI] IA respondio "${matched}" pero no existe en lista, descartando.`);
      aiMatchCache.set(cacheKey, { at: Date.now(), result: null });
      return null;
    }
    console.log(`[Email Sync AI] "${gmailName}" -> "${exact}" (${parsed.razon || ''})`);
    aiMatchCache.set(cacheKey, { at: Date.now(), result: exact });
    return exact;
  } catch (err) {
    console.error('[Email Sync AI] Error consultando OpenAI:', err.message);
    return null;
  }
}

// ─── Lógica central del sync ──────────────────────────────────────────────────

export const ALREADY_PROCESSED_STATUSES = new Set([
  'pickup_ready', 'on_delivery', 'ups_shipped', 'delivered'
]);

/**
 * Ejecuta el sync Gmail → órdenes.
 * @param {boolean} forceRefresh  Forzar re-lectura de Gmail (ignora caché)
 * @returns {object} Resultado del sync
 */
export async function runPickupReadySync(forceRefresh = true) {
  clearPickupCache();
  const allGmailOrders = await getPickupReadyOrders(forceRefresh);

  if (!allGmailOrders.length) {
    return { success: true, synced: 0, message: 'No hay correos Pickup Ready en Gmail' };
  }

  const alreadyProcessedRows = await ValidatedAddress.findAll({
    attributes: ['pickup_email_id'],
    where: { pickup_email_id: { [Op.ne]: null } }
  });
  const processedEmailIds = new Set(
    alreadyProcessedRows.map(r => r.pickup_email_id).filter(Boolean)
  );

  const gmailOrders = allGmailOrders.filter(g => !processedEmailIds.has(g.messageId));
  const skippedAsAlreadyProcessed = allGmailOrders.length - gmailOrders.length;

  console.log(`[Email Sync] ${allGmailOrders.length} correos en Gmail, ${skippedAsAlreadyProcessed} ya procesados antes (omitidos), ${gmailOrders.length} por evaluar.`);

  const candidates = await ValidatedAddress.findAll({
    where: {
      order_status: { [Op.in]: ['pending', 'approved', 'ordered', 'pickup_ready', 'on_delivery', 'ups_shipped', 'delivered'] },
      dispatch_status: { [Op.ne]: 'archived' }
    }
  });

  const wholesaleClients = await WholesaleClient.findAll({ where: { is_active: true } });

  const settings = await MessagingSettings.findOne({
    where: { respond_api_token: { [Op.ne]: null } }
  });

  const synced = [];
  const skipped = [];
  const alreadyDone = [];
  const wholesaleSynced = [];
  const aiMatched = [];

  const aiKey = await getOpenAIKey();
  console.log(`[Email Sync] Cotejando ${gmailOrders.length} correos vs ${candidates.length} órdenes en sistema...`);
  console.log(`[Email Sync] Mayoristas registrados: ${wholesaleClients.length}`);
  console.log(`[Email Sync] Respaldo IA: ${aiKey ? 'ACTIVO (gpt-4o-mini)' : 'INACTIVO (sin OPENAI_API_KEY)'}`);

  const processedGmailOrders = new Set();

  for (const gmailOrder of gmailOrders) {
    if (processedGmailOrders.has(gmailOrder.messageId)) continue;

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

    const applyRegularMatch = async (match, viaAI = false) => {
      processedGmailOrders.add(gmailOrder.messageId);
      if (ALREADY_PROCESSED_STATUSES.has(match.order_status)) {
        alreadyDone.push(match.customer_name);
        if (!match.pickup_email_id) {
          match.pickup_email_id = gmailOrder.messageId;
          await match.save();
        }
        return;
      }
      const tag = viaAI ? '(AI)' : '';
      console.log(`[Email Sync] Coincidencia ${tag} Gmail="${gmailOrder.clientName}" -> Sistema="${match.customer_name}"`);
      match.order_status = 'pickup_ready';
      match.pickup_email_id = gmailOrder.messageId;
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
      if (viaAI) aiMatched.push(match.customer_name);
      else synced.push(match.customer_name);
    };

    const match = allMatches[0];
    if (match) { await applyRegularMatch(match, false); continue; }

    if (aiKey) {
      const top = topCandidatesByName(gmailOrder.clientName, candidates, c => c.customer_name, 10);
      if (top.length > 0) {
        const aiName = await aiNameMatch(gmailOrder.clientName, top.map(x => x.c.customer_name), aiKey);
        if (aiName) {
          const aiMatchedRow = top.find(x => x.c.customer_name === aiName)?.c;
          if (aiMatchedRow) { await applyRegularMatch(aiMatchedRow, true); continue; }
        }
      }
    }

    if (isWholesaleName(gmailOrder.clientName)) {
      const wMatches = wholesaleClients.filter(wc => namesMatch(wc.customer_name, gmailOrder.clientName));
      if (wMatches.length > 1) {
        const names = wMatches.map(m => m.customer_name).join(' | ');
        console.warn(`[Email Sync MAY] AMBIGUEDAD ignorada: Gmail="${gmailOrder.clientName}" matchea ${wMatches.length} mayoristas: ${names}`);
        processedGmailOrders.add(gmailOrder.messageId);
        skipped.push(`${gmailOrder.clientName} (MAY ambiguo: ${wMatches.length})`);
        continue;
      }
      let wClient = wMatches[0];

      if (!wClient && aiKey) {
        const wTop = topCandidatesByName(gmailOrder.clientName, wholesaleClients, wc => wc.customer_name, 10);
        if (wTop.length > 0) {
          const aiName = await aiNameMatch(gmailOrder.clientName, wTop.map(x => x.c.customer_name), aiKey);
          if (aiName) {
            wClient = wTop.find(x => x.c.customer_name === aiName)?.c || null;
            if (wClient) console.log(`[Email Sync MAY] (AI) Mayorista identificado: "${gmailOrder.clientName}" -> "${wClient.customer_name}"`);
          }
        }
      }

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
          if (!activeOrder.pickup_email_id) { activeOrder.pickup_email_id = gmailOrder.messageId; await activeOrder.save(); }
          continue;
        }

        const legacyOrder = await ValidatedAddress.findOne({
          where: {
            customer_name: wClient.customer_name,
            order_status: { [Op.in]: Array.from(ALREADY_PROCESSED_STATUSES) },
            pickup_email_id: null,
            dispatch_status: { [Op.ne]: 'archived' }
          },
          order: [['updated_at', 'DESC']]
        });
        if (legacyOrder) {
          legacyOrder.pickup_email_id = gmailOrder.messageId;
          await legacyOrder.save();
          alreadyDone.push(`${wClient.customer_name} (MAY legado)`);
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
          pickup_email_id: gmailOrder.messageId,
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

  const totalSynced = synced.length + wholesaleSynced.length + aiMatched.length;
  console.log(`[Email Sync] Sincronizados: ${totalSynced} (heuristico: ${synced.length}, IA: ${aiMatched.length}, mayoristas: ${wholesaleSynced.length}), Ya procesados: ${alreadyDone.length}, Sin coincidencia real: ${skipped.length}`);

  return {
    success: true,
    synced: totalSynced,
    syncedNames: synced,
    aiMatchedNames: aiMatched,
    wholesaleSynced,
    alreadyProcessed: alreadyDone.length,
    skipped
  };
}

// ─── Scheduler automático ────────────────────────────────────────────────────

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // cada 15 minutos
let syncTimer = null;

function gmailCredentialsAvailable() {
  return !!(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN
  );
}

async function runScheduledSync() {
  if (!gmailCredentialsAvailable()) return;
  try {
    console.log('[GmailSync] Ejecutando sync automático...');
    const result = await runPickupReadySync(true);
    console.log(`[GmailSync] Sync automático finalizado: ${result.synced} sincronizados.`);
  } catch (err) {
    if (err instanceof GmailScopeError) {
      console.warn('[GmailSync] Sync automático detenido: token sin permisos de Gmail. Reautoriza en Configuración.');
      stopScheduler();
      return;
    }
    console.error('[GmailSync] Error en sync automático:', err.message);
  }
}

export function startGmailSyncScheduler() {
  if (!gmailCredentialsAvailable()) {
    console.log('[GmailSync] Scheduler no iniciado: faltan credenciales de Gmail (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN).');
    return;
  }
  if (syncTimer) return;

  // Primera ejecución a los 2 minutos de arrancar para no bloquear el startup
  setTimeout(() => {
    runScheduledSync();
    syncTimer = setInterval(runScheduledSync, SYNC_INTERVAL_MS);
  }, 2 * 60 * 1000);

  console.log(`[GmailSync] Scheduler iniciado: primera ejecución en 2 min, luego cada ${SYNC_INTERVAL_MS / 60000} min.`);
}

export function stopScheduler() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
}

export { GmailScopeError };
