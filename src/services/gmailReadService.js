/**
 * @fileoverview Servicio de lectura de Gmail.
 * Este servicio se encarga de conectar con la API de Gmail para buscar y leer
 * correos electrónicos, específicamente aquellos que indican que un pedido está listo para recoger.
 */

import { google } from 'googleapis';

/**
 * Crea y configura un cliente OAuth2 para interactuar con la API de Google.
 * @description Utiliza las variables de entorno para las credenciales y el token de actualización.
 * @returns {google.auth.OAuth2} Cliente OAuth2 configurado.
 */
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

/**
 * Extrae el nombre del cliente del asunto del correo.
 * @description Busca patrones específicos en el asunto para identificar al cliente.
 * @param {string} subject - El asunto del correo.
 * @returns {string|null} El nombre del cliente extraído o null si no se encuentra.
 */
function extractClientNameFromSubject(subject) {
  const match = subject.match(/,\s*(?:bc\s+)?(.+?)(?:\s+-\s+Shipment|\s+-\s+Set|$)/i);
  if (match) {
    return match[1].trim();
  }
  return null;
}

/**
 * Extrae el nombre del cliente del cuerpo del mensaje.
 * @description Busca el campo "Project/PO" en el cuerpo del correo.
 * @param {string} body - El cuerpo del mensaje.
 * @returns {string|null} El nombre del cliente extraído o null.
 */
function extractClientNameFromBody(body) {
  const match = body.match(/Project\/PO:\s*(?:bc\s+)?(.+?)(?:\s+-\s+Shipment|\s+-\s+Set|\n|$)/i);
  if (match) {
    return match[1].trim();
  }
  return null;
}

/**
 * Decodifica una cadena en formato Base64URL a UTF-8.
 * @param {string} data - Los datos codificados.
 * @returns {string} La cadena decodificada.
 */
function decodeBase64Url(data) {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Extrae de forma recursiva el texto plano del payload de un mensaje de Gmail.
 * @param {Object} payload - El payload del mensaje de la API de Gmail.
 * @returns {string} El texto extraído.
 */
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

/**
 * Caché para las órdenes listas para recoger.
 * @type {Array|null}
 */
let cachedPickupReady = null;

/**
 * Marca de tiempo de la última actualización de la caché.
 * @type {number}
 */
let cacheTime = 0;

/**
 * Tiempo de vida de la caché (5 minutos).
 * @type {number}
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Error personalizado para indicar que el token de Gmail no tiene los permisos necesarios.
 * @extends Error
 */
export class GmailScopeError extends Error {
  constructor(detail = '') {
    super(`El token de Gmail no tiene permisos suficientes. Se necesita el scope https://mail.google.com/ para buscar correos.${detail ? ' Detalle: ' + detail : ''}`);
    this.name = 'GmailScopeError';
    this.isScopeError = true;
  }
}

/**
 * Recupera los correos de órdenes que están listas para ser recogidas ("Pickup Ready").
 * @description Consulta la API de Gmail buscando correos de "4over" de los últimos 7 días.
 * Implementa un mecanismo de caché para evitar llamadas excesivas.
 * @param {boolean} [forceRefresh=false] - Si es true, ignora la caché y realiza una nueva consulta.
 * @returns {Promise<Array<{clientName: string, subject: string, date: string, messageId: string}>>} Lista de órdenes encontradas.
 * @throws {GmailScopeError} Si los permisos del token son insuficientes.
 * @throws {Error} Si ocurre un error en la comunicación con la API.
 */
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

/**
 * Limpia la caché de órdenes listas para recoger.
 */
export function clearPickupCache() {
  cachedPickupReady = null;
  cacheTime = 0;
}

export default { getPickupReadyOrders, clearPickupCache };
