import { google } from 'googleapis';

function getOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    scope: 'https://mail.google.com/'
  });
  return oauth2Client;
}

function extractClientNameFromSubject(subject) {
  // Subject format: "Pickup Ready: 4over order 014983094, bc Andrews Renovation - Shipment 1 - Set 1"
  // Also could be without "bc " prefix
  const match = subject.match(/,\s*(?:bc\s+)?(.+?)(?:\s+-\s+Shipment|\s+-\s+Set|$)/i);
  if (match) {
    return match[1].trim();
  }
  return null;
}

function extractClientNameFromBody(body) {
  // Body has: Project/PO: bc Andrews Renovation - Shipment 1 - Set 1
  const match = body.match(/Project\/PO:\s*(?:bc\s+)?(.+?)(?:\s+-\s+Shipment|\s+-\s+Set|\n|$)/i);
  if (match) {
    return match[1].trim();
  }
  return null;
}

function decodeBase64Url(data) {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

function extractTextFromPayload(payload) {
  if (!payload) return '';
  if (payload.body && payload.body.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractTextFromPayload(part);
      if (text) return text;
    }
  }
  return '';
}

let cachedPickupReady = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class GmailScopeError extends Error {
  constructor() {
    super('El token de Gmail no tiene permisos suficientes. Se necesita el scope https://mail.google.com/ para buscar correos. Por favor regenera el GMAIL_REFRESH_TOKEN con el scope completo.');
    this.name = 'GmailScopeError';
    this.isScopeError = true;
  }
}

export async function getPickupReadyOrders(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedPickupReady && (now - cacheTime) < CACHE_TTL_MS) {
    return cachedPickupReady;
  }

  const auth = getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth });

  // Search for Pickup Ready emails from 4over in the last 7 days
  const query = 'subject:"Pickup Ready" from:4over newer_than:7d';

  let listRes;
  try {
    listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 100
    });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('Metadata scope does not support') || msg.includes('insufficient authentication scopes')) {
      throw new GmailScopeError();
    }
    throw err;
  }

  const messages = listRes.data.messages || [];
  const readyOrders = [];

  for (const msg of messages) {
    try {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full'
      });

      const headers = detail.data.payload?.headers || [];
      const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';

      let clientName = extractClientNameFromSubject(subject);

      if (!clientName) {
        const body = extractTextFromPayload(detail.data.payload);
        clientName = extractClientNameFromBody(body);
      }

      if (clientName) {
        const dateHeader = headers.find(h => h.name.toLowerCase() === 'date')?.value;
        readyOrders.push({
          clientName,
          subject,
          date: dateHeader || null,
          messageId: msg.id
        });
      }
    } catch (err) {
      console.error('[GmailRead] Error leyendo mensaje:', msg.id, err.message);
    }
  }

  cachedPickupReady = readyOrders;
  cacheTime = now;
  console.log(`[GmailRead] ${readyOrders.length} órdenes listas encontradas en Gmail`);
  return readyOrders;
}

export function clearPickupCache() {
  cachedPickupReady = null;
  cacheTime = 0;
}

export default { getPickupReadyOrders, clearPickupCache };
