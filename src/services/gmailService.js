/**
 * @fileoverview Servicio para el envío y verificación de correos electrónicos a través de Gmail.
 * Utiliza Nodemailer con transporte OAuth2 para una comunicación segura.
 */

import nodemailer from 'nodemailer';

/**
 * Crea y configura un transportador de Nodemailer para Gmail.
 * @description Configura OAuth2 utilizando las credenciales de entorno para Gmail.
 * @returns {Object} Instancia del transportador de Nodemailer.
 * @private
 */
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.GMAIL_USER,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    },
  });
}

/**
 * Envía un correo electrónico utilizando Gmail.
 * @param {Object} options - Opciones del correo.
 * @param {string} options.to - Destinatario del correo.
 * @param {string} options.subject - Asunto del correo.
 * @param {string} options.text - Contenido en texto plano.
 * @param {string} options.html - Contenido en formato HTML.
 * @returns {Promise<Object>} Resultado del envío del correo.
 */
export async function sendEmail({ to, subject, text, html }) {
  const transporter = createTransporter();

  const mailOptions = {
    from: `Area 862 System <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  };

  const result = await transporter.sendMail(mailOptions);
  console.log(`[Gmail] Email enviado a ${to} | MessageId: ${result.messageId}`);
  return result;
}

/**
 * Verifica la conexión y autenticación con el servicio de Gmail.
 * @description Comprueba si las credenciales de OAuth2 son válidas y si el servicio está disponible.
 * @returns {Promise<boolean>} True si la conexión es exitosa.
 */
export async function verifyGmailConnection() {
  const transporter = createTransporter();
  await transporter.verify();
  console.log('[Gmail] Conexión verificada correctamente');
  return true;
}

export default { sendEmail, verifyGmailConnection };

