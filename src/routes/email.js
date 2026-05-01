import express from 'express';
import axios from 'axios';
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

// Singulariza una palabra quitando 's' final cuando aplica (sin tocar
// palabras cortas o terminadas en 'ss'). Permite que "robles" matchee
// "roble", "veras" con "vera", "trees" con "tree".
function singularizeWord(w) {
  if (!w || w.length < 4) return w;
  if (/ss$/.test(w)) return w;
  if (/s$/.test(w)) return w.slice(0, -1);
  return w;
}

function singularizeName(s) {
  return String(s || '')
    .split(' ')
    .filter(Boolean)
    .map(singularizeWord)
    .join(' ');
}

// Devuelve los tokens utiles del nombre normalizado (incluye digitos),
// sin limitar por longitud. Sirve para evaluar contencion de conjuntos.
function tokensOf(s) {
  return String(s || '').split(' ').filter(Boolean);
}

// Conjuntos auxiliares para token-subset
function isDistinctiveToken(t) {
  if (!t || t.length < 3) return false;
  if (SUFFIX_WORDS.has(t)) return false;
  if (PREFIX_LABELS.has(t)) return false;
  return true;
}

// Matching CONTROLADO entre el nombre del email (Gmail/4over) y el nombre
// del cliente en el dispatcher. Aplica capas de comparacion estricta:
// 1) Igualdad exacta tras quitar prefijo de 4over.
// 2) Igualdad exacta tras quitar tambien sufijos comerciales (Services,
//    Realtor, ESP, Mechanic, LLC, etc.).
// 3) Igualdad exacta tras normalizar foneticamente (z=s, v=b, h muda,
//    ll=y) - asi "Marty Alonzo" matchea "Marty Alonso Realtor".
// 4) Igualdad tras singularizar palabras (Robles=Roble, Trees=Tree).
// 5) Token-subset: si todos los tokens utiles del nombre mas corto estan
//    contenidos en el mas largo y hay al menos 1 token distintivo de
//    >=3 letras que no es sufijo/prefijo (ej. "Rafael Flyer Iglesia"
//    matchea "Flyer Iglesia" porque {flyer, iglesia} ⊂ {rafael, flyer,
//    iglesia} y "flyer" es distintivo).
// La proteccion contra ambiguedad (allMatches.length > 1) en el sync
// evita que dos clientes con nombres limpios coincidentes se actualicen
// por error.
function namesMatch(orderName, gmailName) {
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
    if (phonOrder.length >= 3 && phonGmail.length >= 3 && phonOrder === phonGmail) {
      return true;
    }

    // Layer 4: singularizar tokens despues del strip foneticamente.
    const singOrder = spanishPhonetic(singularizeName(cleanOrder));
    const singGmail = spanishPhonetic(singularizeName(cleanGmail));
    if (singOrder.length >= 3 && singGmail.length >= 3 && singOrder === singGmail) {
      return true;
    }
  }

  // Layer 5: token-subset sobre tokens normalizados+foneticamente
  // singularizados (sin strip de sufijos para conservar palabras como
  // "iglesia" que distinguen al cliente).
  const toksOrder = tokensOf(spanishPhonetic(singularizeName(normOrder)));
  const toksGmail = tokensOf(spanishPhonetic(singularizeName(normGmail)));
  if (toksOrder.length && toksGmail.length) {
    const setO = new Set(toksOrder);
    const setG = new Set(toksGmail);
    const [small, large] = setO.size <= setG.size ? [setO, setG] : [setG, setO];
    if (small.size >= 2) {
      let allIn = true;
      for (const t of small) {
        if (!large.has(t)) { allIn = false; break; }
      }
      if (allIn) {
        let distinctive = 0;
        for (const t of small) if (isDistinctiveToken(t)) distinctive++;
        if (distinctive >= 1) return true;
      }
    }
  }

  return false;
}

// ===== Respaldo con razonamiento IA =====
// Cache en memoria para evitar repetir llamadas a OpenAI sobre el mismo
// nombre de Gmail con la misma lista de candidatos. TTL: 30 min.
const aiMatchCache = new Map();
const AI_CACHE_TTL_MS = 30 * 60 * 1000;

function aiCacheKey(gmailName, candidateNames) {
  const sortedHash = candidateNames.slice().sort().join('||');
  return `${normalizeForMatch(gmailName)}::${sortedHash}`;
}

async function getOpenAIKey() {
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

// Pregunta a GPT-4o-mini si el nombre del correo corresponde a alguno de
// los candidatos. Devuelve el nombre exacto del candidato (tal como
// aparece en la lista) o null. Es CONSERVADOR: si hay ambiguedad o no
// esta seguro, devuelve null.
async function aiNameMatch(gmailName, candidateNames, apiKey) {
  if (!apiKey || !gmailName || !candidateNames || candidateNames.length === 0) return null;

  const cacheKey = aiCacheKey(gmailName, candidateNames);
  const cached = aiMatchCache.get(cacheKey);
  if (cached && (Date.now() - cached.at) < AI_CACHE_TTL_MS) {
    return cached.result;
  }

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
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) {
      aiMatchCache.set(cacheKey, { at: Date.now(), result: null });
      return null;
    }

    let parsed;
    try { parsed = JSON.parse(content); } catch { parsed = null; }
    if (!parsed) {
      aiMatchCache.set(cacheKey, { at: Date.now(), result: null });
      return null;
    }

    const matched = (parsed.match || '').toString().trim();
    if (!matched || matched.toUpperCase() === 'NONE') {
      console.log(`[Email Sync AI] "${gmailName}" -> NONE (${parsed.razon || ''})`);
      aiMatchCache.set(cacheKey, { at: Date.now(), result: null });
      return null;
    }

    // Validar que el match retornado este EXACTAMENTE en la lista
    // (la IA debe copiar letra por letra; si no esta, descartamos).
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

// Top N candidatos mas parecidos por Jaccard, para acotar el prompt a IA.
function topCandidatesByName(gmailName, candidates, getName, n = 10) {
  return candidates
    .map(c => ({ c, sim: nameSimilarity(getName(c), gmailName) }))
    .filter(x => x.sim > 0)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, n);
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
    const allGmailOrders = await getPickupReadyOrders(true);

    if (!allGmailOrders.length) {
      return res.json({ success: true, synced: 0, message: 'No hay correos Pickup Ready en Gmail' });
    }

    // Carga los messageIds que ya fueron procesados antes (asociados a una
    // orden ya marcada como pickup_ready/on_delivery/etc) para saltarlos.
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
    const aiMatched = [];

    const aiKey = await getOpenAIKey();
    console.log(`[Email Sync] Cotejando ${gmailOrders.length} correos vs ${candidates.length} órdenes en sistema...`);
    console.log(`[Email Sync] Mayoristas registrados: ${wholesaleClients.length}`);
    console.log(`[Email Sync] Respaldo IA: ${aiKey ? 'ACTIVO (gpt-4o-mini)' : 'INACTIVO (sin OPENAI_API_KEY)'}`);

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

      // Helper local para aplicar el match a una orden encontrada (heuristico o IA)
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

      if (match) {
        await applyRegularMatch(match, false);
        continue;
      }

      // Heuristico fallo. Si hay clave de OpenAI, pedimos a la IA que
      // razone con los 10 candidatos mas parecidos (ahorra tokens y evita
      // que la IA invente nombres). Solo aceptamos respuestas que copien
      // un candidato EXACTO de la lista.
      if (aiKey) {
        const top = topCandidatesByName(gmailOrder.clientName, candidates, c => c.customer_name, 10);
        if (top.length > 0) {
          const aiName = await aiNameMatch(
            gmailOrder.clientName,
            top.map(x => x.c.customer_name),
            aiKey
          );
          if (aiName) {
            const aiMatchedRow = top.find(x => x.c.customer_name === aiName)?.c;
            if (aiMatchedRow) {
              await applyRegularMatch(aiMatchedRow, true);
              continue;
            }
          }
        }
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
        let wClient = wMatches[0];

        // Si el heuristico no encontro mayorista pero hay clave IA, intentamos
        // con razonamiento sobre los 10 mayoristas mas parecidos.
        if (!wClient && aiKey) {
          const wTop = topCandidatesByName(gmailOrder.clientName, wholesaleClients, wc => wc.customer_name, 10);
          if (wTop.length > 0) {
            const aiName = await aiNameMatch(
              gmailOrder.clientName,
              wTop.map(x => x.c.customer_name),
              aiKey
            );
            if (aiName) {
              wClient = wTop.find(x => x.c.customer_name === aiName)?.c || null;
              if (wClient) {
                console.log(`[Email Sync MAY] (AI) Mayorista identificado: "${gmailOrder.clientName}" -> "${wClient.customer_name}"`);
              }
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
            if (!activeOrder.pickup_email_id) {
              activeOrder.pickup_email_id = gmailOrder.messageId;
              await activeOrder.save();
            }
            continue;
          }

          // Si existe una orden ya completada (delivered, ups_shipped) con este
          // nombre y SIN pickup_email_id, asumimos que ese correo ya fue
          // procesado antes (legado) y solo registramos el messageId para que
          // futuros syncs lo salten. Evita crear duplicados de mayoristas.
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

    res.json({
      success: true,
      synced: totalSynced,
      syncedNames: synced,
      aiMatchedNames: aiMatched,
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
