// Outgoing email (password reset). Configure SMTP in the server environment:
// SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS, MAIL_FROM, and
// SMTP_SECURE=true for port 465. Works with Gmail (app password), Zoho,
// Brevo, Amazon SES and others. MAIL_TRANSPORT=memory keeps messages in
// `outbox` instead of sending them (used by the tests).
import nodemailer from 'nodemailer';

export const outbox = [];
let transport = null;

export const mailConfigured = () => process.env.MAIL_TRANSPORT === 'memory' || !!(process.env.SMTP_HOST && process.env.MAIL_FROM);

function getTransport() {
  if (transport) return transport;
  if (process.env.MAIL_TRANSPORT === 'memory') {
    transport = { sendMail: async (m) => outbox.push(m) };
  } else {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

export async function sendMail({ to, subject, text, html }) {
  return getTransport().sendMail({ from: process.env.MAIL_FROM || 'AL BARAKAH LIFESTYLE <no-reply@example.com>', to, subject, text, html });
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function resetEmail({ name, link }) {
  const first = String(name || '').split(' ')[0] || 'there';
  return {
    subject: 'Reset your AL BARAKAH LIFESTYLE password',
    text: `Hello ${first},\n\nUse this link to choose a new password. It works once and expires in one hour:\n${link}\n\nIf you did not ask for this, you can ignore this email; your password stays the same.\n\nAL BARAKAH LIFESTYLE`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#2a1a17">
<p style="letter-spacing:.2em;color:#8a6424;font-size:12px">AL BARAKAH LIFESTYLE</p>
<h1 style="font-family:Georgia,serif;font-weight:400;color:#4b0e14">Reset your password</h1>
<p>Hello ${esc(first)},</p>
<p>Use the button below to choose a new password. The link works once and expires in one hour.</p>
<p style="margin:28px 0"><a href="${esc(link)}" style="background:#4b0e14;color:#f6efe3;padding:14px 26px;text-decoration:none;letter-spacing:.12em;font-size:13px">CHOOSE A NEW PASSWORD</a></p>
<p style="color:#6b5f57;font-size:13px">If you did not ask for this, you can ignore this email; your password stays the same.</p>
</div>`,
  };
}
