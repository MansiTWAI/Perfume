// Every order update by email, to the customer and to the team. These replace
// the updates the team used to send by hand on WhatsApp.
//
// Customer emails go once per update and order: the update is claimed in the
// database (order.shipment.notified, shared with the Delhivery milestones in
// services/shipping.js) before the email is sent, so retries and parallel
// requests never send it twice.
//
// Team alerts go to ORDER_ALERT_EMAIL (one or more addresses, comma
// separated), else to the sender address in MAIL_FROM.
//
// Sending never blocks or fails the request that caused it: errors are
// logged and the shop carries on.
import Order from '../models/Order.js';
import { mailConfigured, sendMail, shippingEmail, teamAlertEmail } from './mail.js';

const log = (event, data = {}) => console.log(`[email] ${event}`, JSON.stringify(data));
const inFlight = new Set();
// Lets tests wait for the emails a request started.
export const emailsIdle = () => Promise.allSettled([...inFlight]);
function later(job) {
  const p = Promise.resolve().then(job).catch((e) => log('failed', { reason: String(e?.message || e).slice(0, 120) }));
  inFlight.add(p);
  p.finally(() => inFlight.delete(p));
  return p;
}

// The admin's order status → the customer email for it.
export const STATUS_EMAIL = {
  Confirmed: 'confirmed',
  Packed: 'packed',
  Shipped: 'shipped',
  'Out for Delivery': 'out_for_delivery',
  Delivered: 'delivered',
  Cancelled: 'cancelled',
};

// key: received, confirmed, packed, shipped, out_for_delivery, delivered,
// cancelled, refunded (or refunded:<refund id>, one per refund). `note` is the
// message the team wrote for the customer, if any.
export function emailCustomer(order, key, { note = '', amount } = {}) {
  return later(async () => {
    if (!order?.customer?.email || !mailConfigured()) return false;
    const claim = await Order.updateOne({ _id: order._id, 'shipment.notified': { $ne: key } }, { $addToSet: { 'shipment.notified': key } });
    if (!claim.modifiedCount) return false;
    const template = key.startsWith('refunded') ? 'refunded' : key;
    await sendMail({ to: order.customer.email, ...shippingEmail(template, order, { note, amount }) });
    log('customer_sent', { orderNumber: order.orderNumber, update: key });
    return true;
  });
}

export const alertRecipients = () => {
  const list = String(process.env.ORDER_ALERT_EMAIL || '').split(',').map((s) => s.trim()).filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
  if (list.length) return list;
  const from = String(process.env.MAIL_FROM || '').match(/<([^>]+)>/)?.[1] || String(process.env.MAIL_FROM || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from) ? [from] : [];
};

// kind: new_order, paid_order, customer_cancelled, customer_edited,
// payment_issue, enquiry, review. `data` is the order (or the enquiry /
// review) plus anything the alert shows.
export function alertTeam(kind, data = {}) {
  return later(async () => {
    const to = alertRecipients();
    if (!to.length || !mailConfigured()) return false;
    await sendMail({ to: to.join(', '), ...teamAlertEmail(kind, data) });
    log('team_sent', { kind, orderNumber: data.orderNumber || data.order?.orderNumber });
    return true;
  });
}
