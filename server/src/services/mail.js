// Outgoing email (sign-in codes, password reset, shipping updates). Configure SMTP in the server environment:
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

// A one-time code: customer sign-in ('login') or the staff two-step code ('staff').
export function codeEmail({ code, minutes, kind = 'login' }) {
  const staff = kind === 'staff';
  const subject = staff ? `${code} is your AL BARAKAH admin sign-in code` : `${code} is your AL BARAKAH LIFESTYLE sign-in code`;
  const lead = staff ? 'Use this code to finish signing in to the admin studio.' : 'Use this code to sign in to your account.';
  const warn = staff
    ? 'If you did not just sign in, someone has your password: change it now and tell the team.'
    : 'If you did not ask for this code, you can ignore this email.';
  return {
    subject,
    text: `${lead}

${code}

It expires in ${minutes} minutes and works once. Never share it: we will never ask you for it.

${warn}

AL BARAKAH LIFESTYLE`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#2a1a17">
<p style="letter-spacing:.2em;color:#8a6424;font-size:12px">AL BARAKAH LIFESTYLE</p>
<h1 style="font-family:Georgia,serif;font-weight:400;color:#4b0e14">${staff ? 'Admin sign-in code' : 'Your sign-in code'}</h1>
<p>${esc(lead)}</p>
<p style="margin:24px 0;font-size:32px;letter-spacing:.35em;font-weight:bold;color:#4b0e14">${esc(code)}</p>
<p style="color:#6b5f57;font-size:13px">It expires in ${Number(minutes)} minutes and works once. Never share it: we will never ask you for it.</p>
<p style="color:#6b5f57;font-size:13px">${esc(warn)}</p>
</div>`,
  };
}

// Order and shipping updates, one per milestone (services/shipping.js makes
// sure each is sent once). Only the order number, the AWB and a link to the
// customer's own order page: no address or payment details.
const SHIP_COPY = {
  confirmed: ['Your order {n} is confirmed', 'Order confirmed', 'Thank you. Your order is confirmed and we are preparing it with care. We will email you again as soon as it is with the courier.'],
  shipment_created: ['Your order {n} is being prepared for dispatch', 'Shipment created', 'Your parcel has been booked with Delhivery and will be picked up shortly.'],
  shipped: ['Your order {n} is on its way', 'On its way', 'Delhivery has picked up your parcel. You can follow every step from your order page.'],
  out_for_delivery: ['Your order {n} arrives today', 'Out for delivery', 'Your parcel is out for delivery today. Please keep your phone nearby for the courier.'],
  delivered: ['Your order {n} has been delivered', 'Delivered', 'Your parcel has been delivered. Thank you for choosing AL BARAKAH LIFESTYLE. We would love to hear what you think.'],
  exception: ['An update on your order {n}', 'A short delay', 'Delhivery could not complete the delivery as planned. They will try again; if anything is needed from you, we will be in touch on WhatsApp.'],
  rto: ['An update on your order {n}', 'Returning to us', 'Your parcel could not be delivered and is on its way back to us. We will contact you to arrange a new delivery or a refund.'],
};
export function shippingEmail(key, order) {
  const [subject, heading, body] = SHIP_COPY[key];
  const n = order.orderNumber;
  const first = String(order.customer?.name || '').split(' ')[0] || 'there';
  const site = String(process.env.SITE_URL || 'https://albarakah.me').replace(/\/$/, '');
  const link = `${site}/profile/orders/${encodeURIComponent(n)}`;
  const awb = order.shipment?.awb ? `Delhivery AWB: ${order.shipment.awb}` : '';
  return {
    subject: subject.replace('{n}', n),
    text: `Hello ${first},\n\n${body}\n\nOrder: ${n}${awb ? `\n${awb}` : ''}\nTrack it: ${link}\n\nAL BARAKAH LIFESTYLE`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#2a1a17">
<p style="letter-spacing:.2em;color:#8a6424;font-size:12px">AL BARAKAH LIFESTYLE</p>
<h1 style="font-family:Georgia,serif;font-weight:400;color:#4b0e14">${esc(heading)}</h1>
<p>Hello ${esc(first)},</p>
<p>${esc(body)}</p>
<p style="color:#6b5f57;font-size:13px">Order ${esc(n)}${awb ? `<br>${esc(awb)}` : ''}</p>
<p style="margin:28px 0"><a href="${esc(link)}" style="background:#4b0e14;color:#f6efe3;padding:14px 26px;text-decoration:none;letter-spacing:.12em;font-size:13px">TRACK YOUR ORDER</a></p>
</div>`,
  };
}
