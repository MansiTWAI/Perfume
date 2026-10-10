// Outgoing email (sign-in codes, password reset, shipping updates). Configure SMTP in the server environment:
// SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS, MAIL_FROM, and
// SMTP_SECURE=true for port 465. Works with Gmail (app password), Zoho,
// Brevo, Amazon SES and others. MAIL_TRANSPORT=sendmail sends through the
// host's own mail server instead (cPanel: no mailbox password needed; MAIL_FROM
// must be an address on a domain of the hosting account). MAIL_TRANSPORT=memory
// keeps messages in `outbox` instead of sending them (used by the tests).
import nodemailer from 'nodemailer';

export const outbox = [];
let transport = null;

export const mailConfigured = () => process.env.MAIL_TRANSPORT === 'memory' || (process.env.MAIL_TRANSPORT === 'sendmail' && !!process.env.MAIL_FROM) || !!(process.env.SMTP_HOST && process.env.MAIL_FROM);

function getTransport() {
  if (transport) return transport;
  if (process.env.MAIL_TRANSPORT === 'memory') {
    transport = { sendMail: async (m) => outbox.push(m) };
  } else if (process.env.MAIL_TRANSPORT === 'sendmail') {
    transport = nodemailer.createTransport({ sendmail: true, newline: 'unix', path: process.env.SENDMAIL_PATH || '/usr/sbin/sendmail' });
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

// A one-time code: customer sign-in ('login'), the staff two-step code
// ('staff') or confirming the email of a new account ('verify').
export function codeEmail({ code, minutes, kind = 'login' }) {
  const staff = kind === 'staff';
  const verify = kind === 'verify';
  const subject = staff ? `${code} is your AL BARAKAH admin sign-in code` : verify ? `${code} is your AL BARAKAH LIFESTYLE verification code` : `${code} is your AL BARAKAH LIFESTYLE sign-in code`;
  const lead = staff ? 'Use this code to finish signing in to the admin studio.' : verify ? 'Welcome to AL BARAKAH LIFESTYLE. Use this code to confirm your email and finish creating your account.' : 'Use this code to sign in to your account.';
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
<h1 style="font-family:Georgia,serif;font-weight:400;color:#4b0e14">${staff ? 'Admin sign-in code' : verify ? 'Confirm your email' : 'Your sign-in code'}</h1>
<p>${esc(lead)}</p>
<p style="margin:24px 0;font-size:32px;letter-spacing:.35em;font-weight:bold;color:#4b0e14">${esc(code)}</p>
<p style="color:#6b5f57;font-size:13px">It expires in ${Number(minutes)} minutes and works once. Never share it: we will never ask you for it.</p>
<p style="color:#6b5f57;font-size:13px">${esc(warn)}</p>
</div>`,
  };
}

// Order and shipping updates, one per update (services/orderEmails.js and
// services/shipping.js make sure each is sent once). Only the order number,
// the items, the AWB and a link to the customer's own order page: no address
// or payment details.
const SHIP_COPY = {
  received: ['We have received your order {n}', 'Order received', 'Thank you for choosing AL BARAKAH LIFESTYLE. We have received your order and will email you as soon as it is confirmed.'],
  packed: ['Your order {n} is packed', 'Packed with care', 'Your fragrances are packed and ready for the courier. We will email you the moment they are on their way.'],
  cancelled: ['Your order {n} is cancelled', 'Order cancelled', 'Your order has been cancelled. If you paid online, the refund goes back to the same account; we will email you when it is sent.'],
  refunded: ['Your refund for order {n} is on its way', 'Refund sent', 'We have sent your refund. Banks usually show it within 5–7 working days.'],
  confirmed: ['Your order {n} is confirmed', 'Order confirmed', 'Thank you. Your order is confirmed and we are preparing it with care. We will email you again as soon as it is with the courier.'],
  shipment_created: ['Your order {n} is being prepared for dispatch', 'Shipment created', 'Your parcel has been booked with Delhivery and will be picked up shortly.'],
  shipped: ['Your order {n} is on its way', 'On its way', 'Delhivery has picked up your parcel. You can follow every step from your order page.'],
  out_for_delivery: ['Your order {n} arrives today', 'Out for delivery', 'Your parcel is out for delivery today. Please keep your phone nearby for the courier.'],
  delivered: ['Your order {n} has been delivered', 'Delivered', 'Your parcel has been delivered. Thank you for choosing AL BARAKAH LIFESTYLE. We would love to hear what you think.'],
  exception: ['An update on your order {n}', 'A short delay', 'Delhivery could not complete the delivery as planned. They will try again; if anything is needed from you, we will email you.'],
  rto: ['An update on your order {n}', 'Returning to us', 'Your parcel could not be delivered and is on its way back to us. We will contact you to arrange a new delivery or a refund.'],
};
export function shippingEmail(key, order, { note = '', amount } = {}) {
  const [subject, heading, body] = SHIP_COPY[key];
  const n = order.orderNumber;
  const first = String(order.customer?.name || '').split(' ')[0] || 'there';
  const site = String(process.env.SITE_URL || 'https://albarakah.me').replace(/\/$/, '');
  const link = `${site}/profile/orders/${encodeURIComponent(n)}`;
  const track = `${site}/track?id=${encodeURIComponent(order.trackingId || '')}&email=${encodeURIComponent(order.customer?.email || '')}`;
  const awb = order.shipment?.awb ? `Delhivery AWB: ${order.shipment.awb}` : '';
  const money = (v) => `${order.currency === 'INR' ? '₹' : `${order.currency} `}${Number(v || 0).toLocaleString('en-IN')}`;
  const items = (order.items || []).map((i) => `${i.name} × ${i.qty}`).join(', ');
  const lines = [
    `Order: ${n}`,
    items && `Items: ${items}`,
    key === 'received' && order.total !== undefined && `Total: ${money(order.total)}`,
    key.startsWith('refunded') && amount && `Refund: ${money(amount)}`,
    awb,
  ].filter(Boolean);
  const msg = String(note || '').trim().slice(0, 300);
  return {
    subject: subject.replace('{n}', n),
    text: `Hello ${first},\n\n${body}${msg ? `\n\n${msg}` : ''}\n\n${lines.join('\n')}\nTrack it: ${order.user ? link : track}\n\nAL BARAKAH LIFESTYLE`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#2a1a17">
<p style="letter-spacing:.2em;color:#8a6424;font-size:12px">AL BARAKAH LIFESTYLE</p>
<h1 style="font-family:Georgia,serif;font-weight:400;color:#4b0e14">${esc(heading)}</h1>
<p>Hello ${esc(first)},</p>
<p>${esc(body)}</p>
${msg ? `<p style="border-left:3px solid #b8955a;padding:4px 0 4px 12px;color:#4b3a33">${esc(msg)}</p>` : ''}
<p style="color:#6b5f57;font-size:13px">${lines.map(esc).join('<br>')}</p>
<p style="margin:28px 0"><a href="${esc(order.user ? link : track)}" style="background:#4b0e14;color:#f6efe3;padding:14px 26px;text-decoration:none;letter-spacing:.12em;font-size:13px">TRACK YOUR ORDER</a></p>
</div>`,
  };
}

// Alerts for the team (services/orderEmails.js). Plain and complete: who,
// what, how much, and a link to the admin studio.
const ALERT = {
  new_order: 'New order',
  paid_order: 'Paid online',
  customer_cancelled: 'Cancelled by the customer',
  customer_edited: 'Changed by the customer',
  payment_issue: 'Payment needs attention',
  enquiry: 'New message from the contact form',
  review: 'New review waiting',
};
const PAY_METHOD = { cod: 'Cash on delivery', online: 'Online (Razorpay)', 'pay-on-confirmation': 'Pay on confirmation' };
const PAY_STATUS = { pending: 'not paid yet', paid: 'paid', partially_refunded: 'partly refunded', refunded: 'refunded' };
export function teamAlertEmail(kind, d = {}) {
  const site = String(process.env.SITE_URL || 'https://albarakah.me').replace(/\/$/, '');
  const money = (v, c) => `${c === 'INR' ? '₹' : `${c || ''} `}${Number(v || 0).toLocaleString('en-IN')}`;
  const label = ALERT[kind] || 'Update';
  let subject;
  let rows;
  let link = `${site}/admin/orders`;
  if (kind === 'enquiry') {
    subject = `${label}: ${d.name || ''}${d.topic ? ` (${d.topic})` : ''}`;
    rows = [['From', d.name], ['Email', d.email], ['Phone', d.phone], ['Topic', d.topic], ['Message', d.message]];
    link = `${site}/admin/enquiries`;
  } else if (kind === 'review') {
    subject = `${label}: ${d.rating}★ for ${String(d.slug || '').toUpperCase()}`;
    rows = [['Order', d.orderNumber], ['From', d.name], ['Rating', `${d.rating} of 5`], ['Title', d.title], ['Review', d.body]];
    link = `${site}/admin/reviews`;
  } else {
    const c = d.customer || {};
    const a = c.address || {};
    subject = `${label}: ${d.orderNumber} · ${money(d.total, d.currency)}`;
    rows = [
      ['Order', d.orderNumber],
      ['Customer', `${c.name || ''} · ${c.email || ''} · ${c.phone || ''}`],
      ['Deliver to', [a.line1, a.line2, a.city, a.state, a.postalCode, a.country].filter(Boolean).join(', ')],
      ['Items', (d.items || []).map((i) => `${i.name} × ${i.qty}`).join(', ')],
      ['Total', money(d.total, d.currency)],
      ['Payment', `${PAY_METHOD[d.paymentMethod] || d.paymentMethod || ''} · ${PAY_STATUS[d.paymentStatus] || d.paymentStatus || ''}`],
      ['Coupon', d.coupon?.code],
      ['Gift card', d.giftNote?.enabled ? `${d.giftNote.name || ''}: ${d.giftNote.message || ''}` : ''],
      ['What changed', d.detail],
    ];
  }
  rows = rows.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '');
  return {
    subject,
    text: `${label}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nOpen the studio: ${link}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#2a1a17">
<p style="letter-spacing:.2em;color:#8a6424;font-size:12px">AL BARAKAH STUDIO</p>
<h1 style="font-family:Georgia,serif;font-weight:400;color:#4b0e14;font-size:24px">${esc(label)}</h1>
<table style="border-collapse:collapse;font-size:14px;width:100%">${rows.map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#6b5f57;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0">${esc(String(v)).replace(/\n/g, '<br>')}</td></tr>`).join('')}</table>
<p style="margin:26px 0"><a href="${esc(link)}" style="background:#4b0e14;color:#f6efe3;padding:12px 22px;text-decoration:none;letter-spacing:.12em;font-size:12px">OPEN THE STUDIO</a></p>
</div>`,
  };
}
