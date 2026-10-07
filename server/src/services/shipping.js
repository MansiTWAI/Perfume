// Shipments with Delhivery: created once an order is ready to ship, tracked
// by scan push (webhook) and by polling, and kept apart from the order status
// and the payment status. The webhook, polling, the admin buttons and the
// payment hook all come here, so a scan or a creation is applied the same way
// whichever arrives first, and only once.
import crypto from 'crypto';
import Order from '../models/Order.js';
import { ORDER_STAGES, ORDER_CANCELLED, SHIPMENT_LABELS, SHIPMENT_FINAL } from '../config/commerce.js';
import { trackingUrl } from '../../../shared/couriers.js';
import {
  delhiveryConfigured, createShipment, trackShipments, cancelShipment, shipLog, clean, AWB_RX,
} from './delhivery.js';
import { mailConfigured, sendMail, shippingEmail } from './mail.js';

const CARRIER = 'Delhivery';
const LOCK_MS = 2 * 60 * 1000;
const MAX_AUTO_ATTEMPTS = 6;
const MAX_EVENTS = 200;
export const autoCreateOn = () => process.env.DELHIVERY_AUTO_CREATE !== 'false';
const pollMinutes = () => Math.max(Number(process.env.DELHIVERY_POLL_MINUTES) || 30, 5);

// ----- readiness -----
// Why an order cannot get a Delhivery shipment right now ('' when it can).
// Automatic creation is stricter than the admin button: COD orders wait
// for the house to confirm them, and orders already given another courier's
// tracking number are left alone.
export function notReady(o, { manual = false } = {}) {
  if (!delhiveryConfigured()) return 'Delhivery is not set up on the server yet.';
  if (!o) return 'Order not found.';
  if (o.currency !== 'INR') return 'Delhivery ships within India only. Use another courier for this order.';
  if (o.status === ORDER_CANCELLED) return 'This order is cancelled.';
  if (o.status === 'Delivered') return 'This order is already delivered.';
  if (o.shipment?.awb && o.shipment.status !== 'cancelled') return 'This order already has a Delhivery shipment.';
  const cod = o.paymentMethod === 'cod' && o.paymentStatus === 'pending';
  if (o.paymentStatus !== 'paid' && !cod) return 'The payment has not been received yet.';
  if (cod && o.status === 'Order Placed' && !manual) return 'Cash on delivery orders ship once they are confirmed.';
  if (!manual && o.trackingNumber && o.shipment?.provider !== 'delhivery') return 'This order already has another courier\'s tracking number.';
  if (!/^[1-9][0-9]{5}$/.test(String(o.customer?.address?.postalCode || '').replace(/\s/g, ''))) return 'The delivery PIN code must be 6 digits.';
  if (String(o.customer?.phone || '').replace(/\D/g, '').length < 10) return 'The customer\'s phone number must have 10 digits.';
  return '';
}

// The order reference sent to Delhivery: the order number, then -R2, -R3…
// for a new shipment after one was cancelled (Delhivery refuses a reused
// order id without a waybill).
function nextRef(o) {
  const cur = o.shipment?.orderRef;
  if (!cur) return o.orderNumber;
  if (o.shipment.status !== 'cancelled') return cur;
  const n = Number((cur.match(/-R(\d+)$/) || [])[1] || 1);
  return `${o.orderNumber}-R${n + 1}`;
}

// ----- creation -----
// Creates the order's shipment if it is ready. Safe to call any number of
// times from anywhere: one caller claims the order, the others step back.
// Returns { ok, order, reason?, busy? }.
export async function ensureShipment(orderId, { manual = false, by = 'system' } = {}) {
  const order = await Order.findById(orderId);
  // Retrying a failed attempt carries on what was already decided.
  const why = notReady(order, { manual: manual || order?.shipment?.status === 'failed' });
  if (why) return { ok: false, reason: why, order };

  const now = new Date();
  const claimed = await Order.findOneAndUpdate(
    {
      _id: order._id,
      $and: [
        { $or: [{ 'shipment.awb': { $in: [null, ''] } }, { 'shipment.status': 'cancelled' }] },
        { $or: [{ 'shipment.lockAt': null }, { 'shipment.lockAt': { $lt: new Date(now - LOCK_MS) } }] },
      ],
    },
    { $set: { 'shipment.lockAt': now, 'shipment.provider': 'delhivery' } },
    { new: true }
  );
  if (!claimed) return { ok: false, busy: true, reason: 'A shipment is already being created for this order.', order };

  const ref = nextRef(claimed);
  const log = { orderNumber: claimed.orderNumber, source: by === 'system' ? 'auto' : 'admin' };
  try {
    let awb = null;
    let reference = '';
    // A previous attempt may have reached Delhivery without us hearing back:
    // look the order up before creating anything.
    if (claimed.shipment?.unknownSince || (claimed.shipment?.attempts > 0 && claimed.shipment?.orderRef === ref)) {
      awb = (await trackShipments({ ref })).map((s) => String(s.AWB || '')).find((w) => AWB_RX.test(w)) || null;
    }
    if (!awb) {
      try {
        ({ awb, reference } = await createShipment(claimed, ref));
      } catch (e) {
        if (!e.duplicate) throw e;
        awb = (await trackShipments({ ref })).map((s) => String(s.AWB || '')).find((w) => AWB_RX.test(w)) || null;
        if (!awb) throw Object.assign(new Error('Delhivery already has this order but did not return its waybill yet.'), { retryable: true });
      }
    }
    const previous = claimed.shipment?.status === 'cancelled' ? claimed.shipment.awb : null;
    const events = [
      { key: `created:${ref}`, status: 'created', note: previous ? `New shipment (replaces cancelled AWB ${previous}).` : 'Shipment created with Delhivery.', at: now, source: 'system' },
      { key: `awb:${awb}`, status: 'awb_assigned', note: `AWB ${awb} assigned.`, at: new Date(now.getTime() + 1), source: 'system' },
    ];
    const done = await Order.findOneAndUpdate(
      { _id: claimed._id, 'shipment.lockAt': now },
      {
        $set: {
          'shipment.status': 'awb_assigned',
          'shipment.awb': awb,
          'shipment.reference': reference,
          'shipment.orderRef': ref,
          'shipment.courierStatus': 'Manifested',
          'shipment.createdAt': now,
          'shipment.lastTrackingUpdate': now,
          'shipment.lastEventAt': now,
          'shipment.error': '',
          'shipment.nextAttemptAt': null,
          'shipment.unknownSince': null,
          'shipment.cancelledAt': null,
          carrier: CARRIER,
          trackingNumber: awb,
          carrierUrl: trackingUrl(CARRIER, awb),
        },
        $unset: { 'shipment.lockAt': 1 },
        $push: { 'shipment.events': { $each: events, $slice: -MAX_EVENTS } },
        $inc: { 'shipment.rev': 1 },
      },
      { new: true }
    );
    if (!done) throw Object.assign(new Error('The shipment was created but the order changed meanwhile. Check the order.'), { retryable: false });
    shipLog('shipment_created', { ...log, awb, outcome: 'created' });
    await notify(done, 'awb_assigned');
    return { ok: true, order: done };
  } catch (e) {
    const attempts = (claimed.shipment?.attempts || 0) + 1;
    const retry = e.retryable && attempts < MAX_AUTO_ATTEMPTS;
    const wait = Math.min(5 * 60 * 1000 * 2 ** (attempts - 1), 6 * 60 * 60 * 1000);
    const failed = await Order.findOneAndUpdate(
      { _id: claimed._id, 'shipment.lockAt': now },
      {
        $set: {
          'shipment.status': 'failed',
          'shipment.error': clean(e.message, 300),
          'shipment.errorAt': new Date(),
          'shipment.attempts': attempts,
          'shipment.orderRef': ref,
          'shipment.nextAttemptAt': retry ? new Date(Date.now() + wait) : null,
          ...(e.unknown && { 'shipment.unknownSince': claimed.shipment?.unknownSince || new Date() }),
        },
        $unset: { 'shipment.lockAt': 1 },
        $inc: { 'shipment.rev': 1 },
      },
      { new: true }
    );
    shipLog('shipment_failed', { ...log, outcome: retry ? 'will_retry' : 'needs_admin', reason: clean(e.message, 120) });
    return { ok: false, reason: clean(e.message, 300), order: failed || claimed };
  }
}

// An order just became ready to ship (paid online, or confirmed by the
// house). Runs after the response, never failing the caller.
const inFlight = new Set();
// Resolves when background shipping work started by orderReady has finished.
export const shippingIdle = () => Promise.allSettled([...inFlight]);
export function orderReady(orderId) {
  const job = (async () => {
    const o = await Order.findById(orderId).lean();
    if (!o || o.status === ORDER_CANCELLED) return;
    await notify(o, 'confirmed');
    if (delhiveryConfigured() && autoCreateOn()) await ensureShipment(orderId);
  })().catch((e) => shipLog('shipment_error', { reason: clean(e.message, 120) }));
  inFlight.add(job);
  job.finally(() => inFlight.delete(job));
}

// ----- scans -----
// Delhivery times have no zone; they are India time.
export function courierTime(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/);
  const d = m ? new Date(`${m[1]}T${m[2].length === 5 ? `${m[2]}:00` : m[2]}${m[3] ? m[3].slice(0, 4) : ''}${m[4] || '+05:30'}`) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Delhivery status + status type (+ the scan's instructions) → ours.
// Returns null for a scan that should be kept but not change the status.
export function mapScan(courierStatus, statusType, instructions = '') {
  const s = String(courierStatus || '').trim().toLowerCase();
  const t = String(statusType || '').trim().toUpperCase();
  const n = String(instructions || '').toLowerCase();
  if (!s) return null;
  if (['rto', 'dto', 'returned'].includes(s) || (t === 'RT' && s === 'delivered') || (t === 'DL' && s.includes('rto'))) return 'returned';
  if (s === 'delivered') return 'delivered';
  if (s.startsWith('cancel') || s === 'canceled' || t === 'CN') return 'cancelled';
  if (s === 'lost' || s.includes('damage')) return 'exception';
  if (t === 'RT' || s.includes('rto')) return 'rto';
  if (['manifested', 'not picked', 'open'].includes(s)) return 'awb_assigned';
  if (s === 'dispatched' || n.includes('out for delivery')) return 'out_for_delivery';
  if (s === 'picked up' || t === 'PU') return 'picked_up';
  if (s === 'in transit') return /picked up|pickup completed|shipment picked/.test(n) ? 'picked_up' : 'in_transit';
  if (s === 'pending' || s === 'scheduled') {
    return /attempt|unavailable|refus|not reachable|unreachable|incomplete address|address|closed|reschedul|not available|ndr/.test(n) ? 'exception' : 'in_transit';
  }
  return null;
}

const FORWARD = ['awb_assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
const eventKey = (awb, e) => crypto.createHash('sha1').update([awb, e.courierStatus, e.statusType, e.at.toISOString().slice(0, 19), String(e.location || '').toLowerCase()].join('|')).digest('hex').slice(0, 24);

// A Delhivery scan (webhook Status or tracking ScanDetail) → our event.
export function scanEvent(awb, raw, source) {
  const courierStatus = clean(raw?.Status ?? raw?.Scan, 60);
  const statusType = clean(raw?.StatusType ?? raw?.ScanType, 10).toUpperCase();
  const at = courierTime(raw?.StatusDateTime || raw?.ScanDateTime);
  if (!courierStatus || !at) return null;
  if (at.getTime() > Date.now() + 24 * 60 * 60 * 1000 || at.getFullYear() < 2015) return null; // nonsense clock
  const location = clean(raw?.StatusLocation ?? raw?.ScannedLocation, 120);
  const note = clean(raw?.Instructions, 200);
  const e = { courierStatus, statusType, location, note, at, source, status: mapScan(courierStatus, statusType, note) };
  e.key = eventKey(awb, e);
  return e;
}

// The shipment's state from all its events, in the courier's time order, so
// a late or repeated scan never moves it backwards. A journey's end
// (delivered, returned, cancelled) stands over later noise.
export function summarize(shipment) {
  // Our own "created / AWB assigned" markers only count until Delhivery
  // reports something (its clock and ours can differ by a few minutes).
  const courier = (shipment.events || []).some((e) => e.status && e.source !== 'system');
  const evs = (shipment.events || []).filter((e) => e.status && !(courier && e.source === 'system' && ['created', 'awb_assigned'].includes(e.status))).sort((a, b) => new Date(a.at) - new Date(b.at) || FORWARD.indexOf(a.status) - FORWARD.indexOf(b.status));
  if (!evs.length) return {};
  const final = evs.filter((e) => SHIPMENT_FINAL.includes(e.status)).at(-1);
  let cur = final || evs.at(-1);
  // A shipment we cancelled before pickup shows up as "Returned" at Delhivery.
  const picked = evs.find((e) => ['picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'rto'].includes(e.status) && e.source !== 'system');
  if (cur.status === 'returned' && shipment.cancelledAt && !picked) cur = { ...cur, status: 'cancelled' };
  const firstAt = (st) => evs.find((e) => st.includes(e.status))?.at || null;
  const lastAt = (st) => evs.filter((e) => st.includes(e.status)).at(-1)?.at || null;
  return {
    status: cur.status,
    courierStatus: cur.courierStatus || shipment.courierStatus || '',
    location: cur.location || '',
    lastEventAt: evs.at(-1).at,
    pickedUpAt: picked?.at || null,
    outForDeliveryAt: lastAt(['out_for_delivery']),
    deliveredAt: firstAt(['delivered']),
    returnedAt: firstAt(['returned']),
  };
}

// The order status follows the shipment forwards only, never backwards, and
// never reopens a cancelled order.
const ORDER_FOR = { picked_up: 'Shipped', in_transit: 'Shipped', out_for_delivery: 'Out for Delivery', delivered: 'Delivered' };
const ORDER_NOTE = {
  Shipped: 'Picked up by Delhivery and on its way to you.',
  'Out for Delivery': 'Out for delivery with Delhivery today.',
  Delivered: 'Delivered by Delhivery. Thank you for choosing AL BARAKAH LIFESTYLE.',
};
async function syncOrderStatus(order, shipStatus) {
  const target = ORDER_FOR[shipStatus];
  if (!target) return;
  const earlier = ORDER_STAGES.slice(0, ORDER_STAGES.indexOf(target));
  await Order.updateOne(
    { _id: order._id, status: { $in: earlier } },
    { $set: { status: target }, $push: { history: { status: target, note: ORDER_NOTE[target] } } }
  );
}

// Stores new scans for one order and brings its state up to date. Repeated
// scans (webhook retries, the same scan from polling) are ignored.
// Returns { added, status, changed }.
export async function ingest(orderId, events, extra = {}) {
  let added = 0;
  for (const e of events.filter(Boolean)) {
    const r = await Order.updateOne(
      { _id: orderId, 'shipment.events.key': { $ne: e.key } },
      { $push: { 'shipment.events': { $each: [e], $slice: -MAX_EVENTS } }, $inc: { 'shipment.rev': 1 } }
    );
    added += r.modifiedCount;
  }
  // Recompute from the stored events; retry if another scan landed meanwhile.
  for (let i = 0; i < 5; i++) {
    const o = await Order.findById(orderId).lean();
    if (!o?.shipment) return { added, status: null, changed: false };
    const before = o.shipment.status;
    const sum = summarize(o.shipment);
    const set = { 'shipment.lastCheckedAt': new Date() };
    if (sum.status) {
      Object.assign(set, {
        'shipment.status': sum.status,
        'shipment.courierStatus': sum.courierStatus,
        'shipment.location': sum.location,
        'shipment.lastEventAt': sum.lastEventAt,
        'shipment.pickedUpAt': sum.pickedUpAt,
        'shipment.outForDeliveryAt': sum.outForDeliveryAt,
        'shipment.deliveredAt': sum.deliveredAt,
        'shipment.returnedAt': sum.returnedAt,
      });
    }
    if (added) set['shipment.lastTrackingUpdate'] = new Date();
    if (extra.expectedDelivery) set['shipment.expectedDelivery'] = extra.expectedDelivery;
    const r = await Order.updateOne({ _id: orderId, 'shipment.rev': o.shipment.rev ?? null }, { $set: set });
    if (!r.matchedCount) continue;
    const changed = !!sum.status && sum.status !== before;
    if (changed) {
      await syncOrderStatus(o, sum.status);
      await notify({ ...o, shipment: { ...o.shipment, ...sum } }, sum.status);
    }
    return { added, status: sum.status || before, changed };
  }
  return { added, status: null, changed: false };
}

// One Shipment object from the tracking API → the order's events.
async function applyTracked(order, sh, source) {
  const awb = order.shipment.awb;
  const scans = (Array.isArray(sh.Scans) ? sh.Scans : []).map((x) => scanEvent(awb, x?.ScanDetail || x, source));
  const latest = scanEvent(awb, sh.Status, source);
  const expectedDelivery = courierTime(sh.ExpectedDeliveryDate || sh.PromisedDeliveryDate || sh.ExpectedDeliveryDateTime);
  return ingest(order._id, [...scans, latest], { expectedDelivery });
}

// Asks Delhivery about these orders' shipments (one call per 50 waybills).
export async function refreshTracking(orders, source = 'poll') {
  const list = orders.filter((o) => AWB_RX.test(String(o.shipment?.awb || '')));
  let updated = 0;
  for (let i = 0; i < list.length; i += 50) {
    const chunk = list.slice(i, i + 50);
    const found = await trackShipments({ awbs: chunk.map((o) => o.shipment.awb), refs: chunk.map((o) => o.shipment.orderRef || o.orderNumber) });
    const byAwb = new Map(found.map((s) => [String(s.AWB), s]));
    for (const o of chunk) {
      // Matched by waybill only: an order reference alone could point at an
      // older, cancelled shipment of the same order.
      const sh = byAwb.get(o.shipment.awb);
      if (sh) {
        const r = await applyTracked(o, sh, source);
        updated += r.added ? 1 : 0;
      } else {
        await Order.updateOne({ _id: o._id }, { $set: { 'shipment.lastCheckedAt': new Date() } });
      }
    }
  }
  return { checked: list.length, updated };
}

// ----- webhook (scan push) -----
// Validates one pushed scan and applies it to the order that owns the
// waybill. The waybill must belong to one of our shipments, and when
// Delhivery sends the order reference it must match too.
export async function applyPushedScan(body) {
  const sh = body?.Shipment;
  if (!sh || typeof sh !== 'object' || Array.isArray(sh)) return { status: 400, outcome: 'malformed' };
  const awb = String(sh.AWB ?? sh.Waybill ?? '').trim();
  if (!AWB_RX.test(awb)) return { status: 400, outcome: 'bad_awb' };
  if (!sh.Status || typeof sh.Status !== 'object') return { status: 400, outcome: 'malformed' };
  const e = scanEvent(awb, sh.Status, 'webhook');
  if (!e) return { status: 400, outcome: 'malformed' };
  const order = await Order.findOne({ 'shipment.awb': awb }).select('_id orderNumber shipment.orderRef').lean();
  if (!order) {
    shipLog('webhook_unknown_awb', { awb, outcome: 'ignored' });
    return { status: 202, outcome: 'unknown_awb' };
  }
  const ref = String(sh.ReferenceNo ?? '').trim();
  if (ref && ![order.orderNumber, order.shipment?.orderRef].includes(ref.toUpperCase())) {
    shipLog('webhook_ref_mismatch', { orderNumber: order.orderNumber, awb, outcome: 'rejected' });
    return { status: 409, outcome: 'ref_mismatch' };
  }
  const r = await ingest(order._id, [e]);
  shipLog('webhook_scan', { orderNumber: order.orderNumber, awb, courierStatus: e.courierStatus, status: r.status, outcome: r.added ? 'applied' : 'duplicate' });
  return { status: 200, outcome: r.added ? 'applied' : 'duplicate' };
}

// ----- cancellation -----
// Cancels the order's Delhivery shipment (allowed by Delhivery until it is
// out for delivery). Returns { ok, reason?, order }.
export async function cancelShipmentFor(orderId, { by = 'system' } = {}) {
  const o = await Order.findById(orderId);
  if (!o?.shipment?.awb || ['cancelled', 'delivered', 'returned'].includes(o.shipment.status)) return { ok: false, reason: 'There is no active Delhivery shipment to cancel.', order: o };
  if (['out_for_delivery', 'rto'].includes(o.shipment.status)) return { ok: false, reason: 'Delhivery cannot cancel a shipment that is out for delivery or already returning.', order: o };
  try {
    await cancelShipment(o.shipment.awb);
  } catch (e) {
    await Order.updateOne({ _id: o._id }, { $set: { 'shipment.error': `Cancel failed: ${clean(e.message, 250)}`, 'shipment.errorAt': new Date() } });
    shipLog('shipment_cancel_failed', { orderNumber: o.orderNumber, awb: o.shipment.awb, reason: clean(e.message, 120) });
    return { ok: false, reason: clean(e.message, 300), order: await Order.findById(o._id) };
  }
  const now = new Date();
  await Order.updateOne({ _id: o._id }, { $set: { 'shipment.cancelledAt': now, 'shipment.error': '' } });
  await ingest(o._id, [{ key: `cancel:${o.shipment.awb}`, status: 'cancelled', courierStatus: 'Cancelled', note: by === 'customer' ? 'Shipment cancelled with your order.' : 'Shipment cancelled.', at: now, source: 'system' }]);
  shipLog('shipment_cancelled', { orderNumber: o.orderNumber, awb: o.shipment.awb, outcome: 'cancelled' });
  return { ok: true, order: await Order.findById(o._id) };
}

// ----- notifications -----
// One email per milestone per order, however many times the scan arrives:
// the milestone is claimed in the database before the email goes out.
const MILESTONE = { awb_assigned: 'shipment_created', picked_up: 'shipped', in_transit: 'shipped', out_for_delivery: 'out_for_delivery', delivered: 'delivered', exception: 'exception', rto: 'rto', returned: 'rto', confirmed: 'confirmed' };
export async function notify(order, status) {
  const key = MILESTONE[status];
  if (!key || !order?.customer?.email) return false;
  const claim = await Order.updateOne({ _id: order._id, 'shipment.notified': { $ne: key } }, { $addToSet: { 'shipment.notified': key } });
  if (!claim.modifiedCount || !mailConfigured()) return false;
  try {
    await sendMail({ to: order.customer.email, ...shippingEmail(key, order) });
    shipLog('notification_sent', { orderNumber: order.orderNumber, status: key });
    return true;
  } catch (e) {
    shipLog('notification_failed', { orderNumber: order.orderNumber, status: key, reason: clean(e.message, 80) });
    return false;
  }
}

// ----- what the customer sees -----
const city = (loc) => {
  const m = String(loc || '').match(/\(([^)]+)\)\s*$/);
  return clean(m ? m[1] : String(loc || '').split('_')[0], 60);
};
export function shipmentView(o) {
  const s = o.shipment;
  if (!s?.provider) return null;
  // A failed or in-progress creation is the team's problem, not the customer's.
  const status = !s.awb || s.status === 'failed' ? 'pending' : s.status;
  const delayed = !!s.expectedDelivery && !['delivered', 'cancelled', 'returned'].includes(status) && new Date(s.expectedDelivery) < new Date();
  return {
    carrier: CARRIER,
    status,
    label: SHIPMENT_LABELS[status] || status,
    awb: s.awb || '',
    trackingUrl: s.awb ? trackingUrl(CARRIER, s.awb) : '',
    courierStatus: status === 'pending' ? '' : s.courierStatus || '',
    location: city(s.location),
    pickedUpAt: s.pickedUpAt || null,
    outForDeliveryAt: s.outForDeliveryAt || null,
    deliveredAt: s.deliveredAt || null,
    returnedAt: s.returnedAt || null,
    expectedDelivery: s.expectedDelivery || null,
    delayed,
    lastUpdate: s.lastTrackingUpdate || s.lastEventAt || null,
    lastCheckedAt: s.lastCheckedAt || null,
    events: (s.events || [])
      .filter((e) => e.status || e.note)
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .map((e) => ({ status: e.status || null, label: e.status ? SHIPMENT_LABELS[e.status] : e.courierStatus, note: e.note || e.courierStatus || '', location: city(e.location), at: e.at })),
  };
}

// The customer opened their order: refresh tracking if it is stale (at most
// every ten minutes per order), so the page is current without the browser
// ever calling Delhivery.
export async function freshen(order) {
  const s = order?.shipment;
  if (!delhiveryConfigured() || !s?.awb || SHIPMENT_FINAL.includes(s.status)) return order;
  if (s.lastCheckedAt && Date.now() - new Date(s.lastCheckedAt) < 10 * 60 * 1000) return order;
  const claimed = await Order.updateOne(
    { _id: order._id, $or: [{ 'shipment.lastCheckedAt': null }, { 'shipment.lastCheckedAt': { $lt: new Date(Date.now() - 10 * 60 * 1000) } }] },
    { $set: { 'shipment.lastCheckedAt': new Date() } }
  );
  if (!claimed.modifiedCount) return order;
  try {
    await refreshTracking([order], 'customer');
  } catch (e) {
    shipLog('tracking_failed', { orderNumber: order.orderNumber, reason: clean(e.message, 120) });
    return { ...order, trackingUnavailable: true };
  }
  return Order.findById(order._id).lean();
}

// ----- background jobs -----
// Every few minutes: retry failed creations that are due, create shipments
// for ready orders the payment hook may have missed, and poll tracking for
// shipments still on the way (as a backstop to the scan push).
let running = false;
export async function shippingTick() {
  if (running || !delhiveryConfigured()) return { skipped: true };
  running = true;
  const out = { retried: 0, created: 0, checked: 0, updated: 0 };
  try {
    const now = new Date();
    const due = await Order.find({ 'shipment.status': 'failed', 'shipment.nextAttemptAt': { $ne: null, $lte: now }, 'shipment.attempts': { $lt: MAX_AUTO_ATTEMPTS } }).select('_id').limit(20).lean();
    for (const o of due) {
      out.retried++;
      await ensureShipment(o._id);
    }
    if (autoCreateOn()) {
      // Recent orders only: older ones were handled before Delhivery was set up.
      const ready = await Order.find({
        currency: 'INR',
        status: { $in: ['Order Placed', 'Confirmed', 'Packed'] },
        createdAt: { $gte: new Date(now - 3 * 24 * 60 * 60 * 1000) },
        'shipment.provider': { $exists: false },
        $or: [{ trackingNumber: { $in: [null, ''] } }, { trackingNumber: { $exists: false } }],
      }).limit(20);
      for (const o of ready) {
        if (notReady(o)) continue;
        const r = await ensureShipment(o._id);
        if (r.ok) out.created++;
      }
    }
    const stale = new Date(now - pollMinutes() * 60 * 1000);
    const active = await Order.find({
      'shipment.awb': { $type: 'string' },
      'shipment.status': { $nin: SHIPMENT_FINAL },
      $or: [{ 'shipment.lastCheckedAt': null }, { 'shipment.lastCheckedAt': { $lt: stale } }],
    }).select('_id orderNumber customer.email customer.name shipment').limit(200).lean();
    if (active.length) Object.assign(out, await refreshTracking(active, 'poll'));
  } catch (e) {
    shipLog('tick_failed', { reason: clean(e.message, 120) });
  } finally {
    running = false;
  }
  return out;
}

export function startShippingJobs() {
  if (!delhiveryConfigured()) return null;
  const t = setInterval(() => shippingTick(), 5 * 60 * 1000);
  t.unref?.();
  setTimeout(() => shippingTick(), 30 * 1000).unref?.();
  shipLog('jobs_started', { count: pollMinutes() });
  return t;
}
