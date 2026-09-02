/**
 * Envía una alerta por correo cuando OpenAI informa que la cuenta no tiene
 * créditos disponibles.
 */

import User from '../models/User.js';
import { sendEmail } from './gmailService.js';

const ALERT_RETRY_INTERVAL_MS = 30 * 60 * 1000;

let lastAttemptAt = 0;
let alertSent = false;
let alertInFlight = false;

/**
 * Distingue una cuenta sin saldo de un 429 temporal por exceso de solicitudes.
 *
 * @param {Object} details
 * @param {number|string} [details.status]
 * @param {string} [details.code]
 * @param {string} [details.message]
 * @returns {boolean}
 */
export function isOpenAIQuotaError({ status, code, message } = {}) {
  const normalizedCode = String(code || '').toLowerCase();
  const normalizedMessage = String(message || '');
  const quotaMessage = /(no credits?|credits? remaining|insufficient[_\s-]?quota|quota|billing|balance|saldo)/i.test(normalizedMessage);

  return normalizedCode === 'insufficient_quota'
    || /exceeded.*quota/i.test(normalizedMessage)
    || (Number(status) === 429 && quotaMessage);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Envía una alerta al primer administrador activo.
 *
 * La deduplicación es por ciclo de agotamiento: una respuesta exitosa debe
 * llamar markOpenAIQuotaRestored() para habilitar la siguiente alerta.
 *
 * @param {Object} details
 * @param {number|string} [details.status]
 * @param {string} [details.message]
 * @param {string} [details.source]
 * @returns {Promise<boolean>}
 */
export async function notifyOpenAIQuotaExhausted({ status, message, source = 'AI' } = {}) {
  const now = Date.now();
  if (alertSent || alertInFlight || (now - lastAttemptAt) < ALERT_RETRY_INTERVAL_MS) {
    return false;
  }

  lastAttemptAt = now;
  alertInFlight = true;

  try {
    const admin = await User.findOne({
      where: { role: 'admin', active: true },
      attributes: ['email', 'username'],
      order: [['id', 'ASC']]
    });
    const recipient = process.env.OPENAI_QUOTA_ALERT_EMAIL || admin?.email || process.env.GMAIL_USER;

    if (!recipient) {
      console.warn('[AI Alert] No se pudo enviar la alerta: no hay correo de administrador configurado.');
      return false;
    }

    const detectedAt = new Date(now).toISOString();
    const safeMessage = escapeHtml(message || 'OpenAI informó que no hay créditos disponibles.');
    const subject = '[Area 862] Créditos de OpenAI agotados';
    const text = [
      'Area 862 System',
      '',
      'OpenAI informó que no hay créditos disponibles. El bot puede continuar usando sus respuestas alternativas hasta que se recargue la cuenta.',
      `Detectado: ${detectedAt}`,
      `Origen: ${source}`,
      `HTTP: ${status || 'no disponible'}`,
      `Detalle: ${message || 'No hay créditos disponibles.'}`
    ].join('\n');
    const html = `
      <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">
        <h2 style="color:#b45309">Créditos de OpenAI agotados</h2>
        <p>Area 862 System detectó que la cuenta de OpenAI no tiene créditos disponibles.</p>
        <p>El bot puede continuar usando sus respuestas alternativas hasta que se recargue la cuenta.</p>
        <hr>
        <p><strong>Detectado:</strong> ${detectedAt}</p>
        <p><strong>Origen:</strong> ${escapeHtml(source)}</p>
        <p><strong>Detalle:</strong> ${safeMessage}</p>
      </div>
    `;

    await sendEmail({ to: recipient, subject, text, html });
    alertSent = true;
    console.warn(`[AI Alert] Alerta de créditos agotados enviada a ${recipient}.`);
    return true;
  } catch (error) {
    console.error('[AI Alert] Error enviando alerta de créditos agotados:', error.message);
    return false;
  } finally {
    alertInFlight = false;
  }
}

/**
 * Rearma el envío de alerta después de una respuesta exitosa de OpenAI.
 */
export function markOpenAIQuotaRestored() {
  alertSent = false;
  lastAttemptAt = 0;
}

export default {
  isOpenAIQuotaError,
  notifyOpenAIQuotaExhausted,
  markOpenAIQuotaRestored
};