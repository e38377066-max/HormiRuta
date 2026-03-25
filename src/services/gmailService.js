import nodemailer from 'nodemailer';

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

export async function verifyGmailConnection() {
  const transporter = createTransporter();
  await transporter.verify();
  console.log('[Gmail] Conexión verificada correctamente');
  return true;
}

export default { sendEmail, verifyGmailConnection };
