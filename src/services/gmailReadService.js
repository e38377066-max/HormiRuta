import { google } from 'googleapis';

function getOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN
  });
  return oauth2Client;
}

function extractClientNameFromSubject(subject) {
  const match = subject.match(/,\s*(?:bc\s+)?(.+?)(?:\s+-\s+Shipment|\s+-\s+Set|$)/i);
  if (match) {
    return match[1].trim();
  }
  return null;
}

function extractClientNameFromBody(body) {
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
const CACHE_TTL_MS = 5 * 60 * 1000;

export class GmailScopeError extends Error {
  constructor(detail = '') {
    super(`El token de Gmail no tiene permisos suficientes. Se necesita el scope https://mail.google.com/ para buscar correos.${detail ? ' Detalle: ' + detail : ''}`);
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

  const tokenResponse = await auth.getAccessToken();
  const accessToken = tokenResponse.token;

  const tokenInfoRes = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);
  const tokenInfo = await tokenInfoRes.json();
  const grantedScope = tokenInfo.scope || '';
  console.log(`[GmailRead] Access token scope: ${grantedScope}`);

  if (!grantedScope.includes('mail.google.com') && !grantedScope.includes('gmail.readonly')) {
    console.error(`[GmailRead] Scope insuficiente detectado: ${grantedScope}`);
    throw new GmailScopeError(`scope recibido: ${grantedScope}`);
  }

  const query = encodeURIComponent('subject:"Pickup Ready" from:4over newer_than:7d');
  const listApiRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listApiRes.ok) {
    const errBody = await listApiRes.text();
    console.error(`[GmailRead] Error en lista de mensajes: ${listApiRes.status} ${errBody}`);
    if (errBody.includes('Metadata scope') || errBody.includes('insufficient')) {
      throw new GmailScopeError(errBody);
    }
    throw new Error(`Gmail API error ${listApiRes.status}: ${errBody}`);
  }

  const listData = await listApiRes.json();
  const messages = listData.messages || [];
  const readyOrders = [];

  for (const msg of messages) {
    try {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!detailRes.ok) continue;
      const detail = await detailRes.json();

      const headers = detail.payload?.headers || [];
      const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';

      let clientName = extractClientNameFromSubject(subject);

      if (!clientName) {
        const body = extractTextFromPayload(detail.payload);
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
