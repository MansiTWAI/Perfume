// What a Razorpay payment means for one of our orders. The checkout callback,
// the webhook and reconciliation all come here, so an order is settled the
// same way whichever arrives first, and only once.
//
// An order counts as paid only when Razorpay reports the payment captured for
// exactly the amount and currency the order is due now. Anything else that
// took money (a different amount, a second payment, a payment after the order
// was cancelled) is recorded under payment.issues for the team to refund.
import Order from '../models/Order.js';
import { ORDER_CANCELLED } from '../config/commerce.js';
import {
  razorpayConfigured, toMinor, fetchPayment, fetchOrderPayments, capturePayment, createRefund, payLog,
} from './razorpay.js';
import { orderReady } from './shipping.js';
import User from '../models/User.js';
import { release } from './orderStock.js';
import { releaseCoupon } from './coupons.js';

const fail = (status, message, code) => Object.assign(new Error(message), { status, ...(code && { code }) });

// Razorpay orders created for an order (older orders kept just one id).
export const attemptIds = (o) =>
  [...new Set([...(o.payment?.attempts || []).map((a) => a.providerOrderId), o.payment?.providerOrderId].filter(Boolean))];
export const amountDue = (o) => toMinor(o.total);
const byProviderOrder = (id) => Order.findOne({ $or: [{ 'payment.attempts.providerOrderId': id }, { 'payment.providerOrderId': id }] }).setOptions({ withHeld: true });

// Money is taken at capture. With auto-capture on (recommended) Razorpay does
// it within seconds; otherwise capture here, but only for the right amount:
// an authorised payment that is never captured is released to the customer.
async function ensureCaptured(p, expected, currency) {
  if (p.status !== 'authorized' || p.amount !== expected || p.currency !== currency) return p;
  try {
    return await capturePayment(p.id, p.amount, p.currency);
  } catch {
    try {
      return await fetchPayment(p.id); // captured meanwhile by auto-capture
    } catch {
      return p;
    }
  }
}

async function recordIssue(order, kind, p, note) {
  await Order.updateOne(
    { _id: order._id, 'payment.issues.providerPaymentId': { $ne: p.id } },
    { $push: { 'payment.issues': { kind, providerPaymentId: p.id, amount: p.amount, note } } }
  );
  payLog('payment_issue', { orderNumber: order.orderNumber, razorpayOrderId: p.order_id, razorpayPaymentId: p.id, amount: p.amount, currency: p.currency, outcome: kind });
}

// p: a Razorpay payment entity ({ id, order_id, amount, currency, status, method, error_description }).
// Returns { outcome, order }; outcome is one of paid, already, duplicate,
// mismatch, failed, not_captured, unknown.
export async function applyPayment(p, source, round = 0) {
  const order = await byProviderOrder(p.order_id);
  const log = { orderNumber: order?.orderNumber, razorpayOrderId: p.order_id, razorpayPaymentId: p.id, amount: p.amount, currency: p.currency, status: p.status, source };
  if (!order) {
    payLog('payment_unknown_order', { ...log, outcome: 'unknown' });
    return { outcome: 'unknown', order: null };
  }
  if (p.status === 'failed') {
    // The customer can try again on the same Razorpay order.
    await Order.updateOne(
      { _id: order._id, paymentStatus: 'pending', 'payment.attempts.providerOrderId': p.order_id },
      { $set: { 'payment.attempts.$.lastError': String(p.error_description || 'Payment failed').slice(0, 200) } }
    );
    payLog('payment_failed', { ...log, outcome: 'failed' });
    return { outcome: 'failed', order };
  }
  const expected = amountDue(order);
  p = await ensureCaptured(p, expected, order.currency);
  if (p.status !== 'captured') {
    payLog('payment_not_captured', { ...log, status: p.status, outcome: 'not_captured' });
    return { outcome: 'not_captured', order };
  }
  // This payment already settled the order (callback + webhook, retries).
  if (order.payment?.providerPaymentId === p.id) return { outcome: 'already', order };
  if (order.paymentStatus !== 'pending') {
    await recordIssue(order, 'duplicate_payment', p, 'A second payment arrived for an order that was already paid. Refund it.');
    return { outcome: 'duplicate', order };
  }
  if (p.amount !== expected || p.currency !== order.currency) {
    await recordIssue(order, 'amount_mismatch', p, `Paid ${p.amount} ${p.currency} (paise) but the order was due ${expected} ${order.currency}. Refund it, or adjust the order.`);
    return { outcome: 'mismatch', order };
  }

  // Claim the order atomically: only one of callback / webhook / reconcile
  // wins, and a total changed meanwhile (items edited) makes the claim fail.
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: 'pending', total: order.total },
    {
      $set: {
        paymentStatus: 'paid',
        paymentMethod: 'online',
        'payment.provider': 'razorpay',
        'payment.providerOrderId': p.order_id,
        'payment.amount': p.amount,
        'payment.currency': p.currency,
        'payment.providerPaymentId': p.id,
        'payment.method': p.method || '',
        'payment.paidAt': new Date(),
        'payment.verifiedBy': source,
      },
      // Paid: from now on it is a real order, seen by the customer and the team.
      $unset: { paymentHold: 1 },
    },
    { new: true }
  );
  if (!claimed) {
    if (round > 1) return { outcome: 'already', order: await Order.findById(order._id).setOptions({ withHeld: true }) };
    return applyPayment(p, source, round + 1); // look again at what changed
  }
  await Order.updateOne({ _id: order._id, 'payment.attempts.providerOrderId': p.order_id }, { $set: { 'payment.attempts.$.status': 'paid' } });
  if (claimed.clearBagOnPay && claimed.user) await User.updateOne({ _id: claimed.user }, { $set: { cart: [] } });
  if (claimed.status === 'Order Placed') {
    await Order.updateOne(
      { _id: order._id, status: 'Order Placed' },
      { $set: { status: 'Confirmed' }, $push: { history: { status: 'Confirmed', note: 'Payment received. Thank you.' } } }
    );
  }
  if (claimed.status === ORDER_CANCELLED) {
    await recordIssue(claimed, 'paid_after_cancel', p, 'Paid after the order was cancelled. Refund it, or reopen the order.');
  }
  payLog('payment_captured', { ...log, status: 'captured', outcome: 'paid' });
  // Paid: confirmation email, and the Delhivery shipment when automatic.
  if (claimed.status !== ORDER_CANCELLED) orderReady(order._id);
  return { outcome: 'paid', order: await Order.findById(order._id) };
}

// Asks Razorpay what happened to an order's payment attempts and settles it.
// Used when the customer's browser lost the callback, before starting a new
// attempt, and from the admin studio.
export async function reconcile(order) {
  if (!razorpayConfigured() || !order) return order;
  for (const id of attemptIds(order).slice(-5)) {
    let payments;
    try {
      payments = await fetchOrderPayments(id);
    } catch {
      continue;
    }
    for (const p of payments.filter((x) => x.status === 'captured' || x.status === 'authorized')) await applyPayment(p, 'reconcile');
  }
  return Order.findById(order._id).setOptions({ withHeld: true });
}

// ----- refunds -----

const live = (r) => r.status !== 'failed';
const refundedFor = (o, paymentId) => (o.payment?.refunds || []).filter((r) => r.providerPaymentId === paymentId && live(r)).reduce((n, r) => n + (r.amount || 0), 0);

// Re-derives refundedAmount and paymentStatus from the refunds list.
async function settleRefundState(orderId) {
  const o = await Order.findById(orderId);
  if (!o?.payment?.providerPaymentId) return o;
  const refunded = refundedFor(o, o.payment.providerPaymentId);
  const set = { 'payment.refundedAmount': refunded };
  if (['paid', 'partially_refunded', 'refunded'].includes(o.paymentStatus)) {
    set.paymentStatus = refunded <= 0 ? 'paid' : refunded >= (o.payment.amount || 0) ? 'refunded' : 'partially_refunded';
  }
  // An issue payment refunded in full is dealt with.
  const issues = (o.payment.issues || []).map((i) => ({ ...i.toObject(), resolved: i.resolved || refundedFor(o, i.providerPaymentId) >= (i.amount || 0) }));
  set['payment.issues'] = issues;
  return Order.findByIdAndUpdate(orderId, { $set: set }, { new: true });
}

// Admin refund. amount in rupees (empty = everything still refundable);
// paymentId to refund one of the issue payments instead of the main one.
export async function refundOrder(orderId, { amount, paymentId, reason, by }) {
  if (!razorpayConfigured()) throw fail(503, 'Online payment is not set up, so refunds cannot be sent from here.');
  let order = await Order.findById(orderId);
  if (!order) throw fail(404, 'Order not found.');
  const main = order.payment?.providerPaymentId;
  const target = paymentId ? String(paymentId) : main;
  const issue = (order.payment?.issues || []).find((i) => i.providerPaymentId === target);
  if (!target || (target !== main && !issue)) throw fail(400, 'This order has no online payment to refund.', 'REFUND_NOT_ALLOWED');
  if (target === main && !['paid', 'partially_refunded'].includes(order.paymentStatus)) {
    throw fail(409, order.paymentStatus === 'refunded' ? 'This payment is already refunded in full.' : 'This order is not paid online, so there is nothing to refund.', 'REFUND_NOT_ALLOWED');
  }

  // One refund at a time per order: a double click or two admins cannot
  // both send one. The lock expires on its own after two minutes.
  const locked = await Order.findOneAndUpdate(
    { _id: order._id, $or: [{ 'payment.refundLockAt': null }, { 'payment.refundLockAt': { $lt: new Date(Date.now() - 120000) } }] },
    { $set: { 'payment.refundLockAt': new Date() } },
    { new: true }
  );
  if (!locked) throw fail(409, 'A refund for this order is already being processed. Refresh in a moment.', 'REFUND_IN_PROGRESS');
  order = locked;
  try {
    const paid = target === main ? order.payment.amount || 0 : issue.amount || 0;
    const refundable = paid - refundedFor(order, target);
    if (refundable <= 0) throw fail(409, 'Nothing is left to refund on this payment.', 'REFUND_NOT_ALLOWED');
    const want = amount === undefined || amount === null || amount === '' ? refundable : toMinor(amount);
    if (!Number.isSafeInteger(want) || want < 100 || want > refundable) {
      throw fail(400, `Enter a refund between ${order.currency} 1 and ${order.currency} ${(refundable / 100).toFixed(2).replace(/\.00$/, '')}.`, 'REFUND_INVALID_AMOUNT');
    }
    const n = (order.payment.refunds || []).length + 1;
    let rf;
    try {
      rf = await createRefund(target, {
        amount: want,
        receipt: `${order.orderNumber}-R${n}`.slice(0, 40),
        notes: { orderNumber: order.orderNumber, reason: String(reason || '').slice(0, 200) },
      });
    } catch (e) {
      throw fail(502, e.providerDescription ? `Razorpay: ${e.providerDescription}` : e.message, 'PAYMENT_PROVIDER_ERROR');
    }
    await Order.updateOne(
      { _id: order._id, 'payment.refunds.providerRefundId': { $ne: rf.id } },
      { $push: { 'payment.refunds': { providerRefundId: rf.id, providerPaymentId: target, amount: rf.amount || want, status: rf.status === 'processed' ? 'processed' : 'pending', reason: String(reason || '').slice(0, 200), by } } }
    );
    payLog('refund_created', { orderNumber: order.orderNumber, razorpayPaymentId: target, razorpayRefundId: rf.id, amount: want, currency: order.currency, status: rf.status, source: 'admin' });
    return await settleRefundState(order._id);
  } finally {
    await Order.updateOne({ _id: order._id }, { $unset: { 'payment.refundLockAt': 1 } });
  }
}

// Webhook refund.created / refund.processed / refund.failed, including
// refunds made from the Razorpay Dashboard. Never moves a finished refund
// back to pending when events arrive out of order.
export async function applyRefund(rf) {
  const order = await Order.findOne({ $or: [{ 'payment.providerPaymentId': rf.payment_id }, { 'payment.issues.providerPaymentId': rf.payment_id }] });
  if (!order) {
    payLog('refund_unknown_payment', { razorpayPaymentId: rf.payment_id, razorpayRefundId: rf.id, outcome: 'unknown' });
    return { outcome: 'unknown' };
  }
  const status = rf.status === 'processed' ? 'processed' : rf.status === 'failed' ? 'failed' : 'pending';
  const pushed = await Order.updateOne(
    { _id: order._id, 'payment.refunds.providerRefundId': { $ne: rf.id } },
    { $push: { 'payment.refunds': { providerRefundId: rf.id, providerPaymentId: rf.payment_id, amount: rf.amount, status, reason: String(rf.notes?.reason || 'Refunded from the Razorpay Dashboard').slice(0, 200), by: 'razorpay', ...(status !== 'pending' && { processedAt: new Date() }) } } }
  );
  if (!pushed.modifiedCount && status !== 'pending') {
    await Order.updateOne(
      { _id: order._id, payment: { $exists: true } },
      { $set: { 'payment.refunds.$[r].status': status, 'payment.refunds.$[r].processedAt': new Date() } },
      { arrayFilters: [{ 'r.providerRefundId': rf.id, 'r.status': 'pending' }] }
    );
  }
  payLog('refund_update', { orderNumber: order.orderNumber, razorpayPaymentId: rf.payment_id, razorpayRefundId: rf.id, amount: rf.amount, status, source: 'webhook' });
  await settleRefundState(order._id);
  return { outcome: status };
}

// ----- unpaid online orders -----
// An order chosen for online payment holds its stock and coupon while the
// customer pays. If nothing is paid within PAYMENT_HOLD_MINUTES (60 by
// default) of the order and of its latest payment attempt, Razorpay is asked
// one last time; only when every attempt is confirmed unpaid is the order
// cancelled and the stock and coupon given back. If Razorpay cannot be
// reached, the order is left for the next round. A payment that still arrives
// later is recorded as "paid after cancel" for the team to refund.
export const holdMinutes = () => Math.max(15, Number(process.env.PAYMENT_HOLD_MINUTES) || 60);
const lastActivity = (o) => Math.max(new Date(o.createdAt).getTime(), ...(o.payment?.attempts || []).map((a) => new Date(a.createdAt || 0).getTime()));

// Releases one unpaid online order: Razorpay is asked about every attempt
// first (a captured payment is applied, never thrown away). Returns
// 'released', 'paid' (money arrived, it is a real order now) or 'unknown'
// (Razorpay could not be reached: nothing changed).
export async function releaseUnpaid(order, reason = 'expired') {
  if (razorpayConfigured()) {
    for (const id of attemptIds(order)) {
      let payments;
      try {
        payments = await fetchOrderPayments(id);
      } catch {
        return 'unknown'; // try again later
      }
      for (const p of payments.filter((x) => x.status === 'captured' || x.status === 'authorized')) await applyPayment(p, 'reconcile');
    }
  } else if (attemptIds(order).length) {
    return 'unknown'; // cannot ask Razorpay: never cancel blind
  }
  const done = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: 'pending', status: 'Order Placed' },
    {
      $set: { status: ORDER_CANCELLED },
      $push: { history: { status: ORDER_CANCELLED, note: 'Payment was not completed, so the order was released. You are welcome to order again.' } },
    },
    { new: true }
  );
  if (!done) {
    const now = await Order.findById(order._id).setOptions({ withHeld: true });
    return now?.paymentStatus && now.paymentStatus !== 'pending' ? 'paid' : 'released';
  }
  await release(done.items.map((i) => ({ product: i.product, qty: i.qty })));
  if (done.coupon?.code) await releaseCoupon(done.coupon.code);
  payLog('unpaid_order_released', { orderNumber: done.orderNumber, outcome: 'cancelled', source: reason });
  return 'released';
}

export async function expireUnpaidOrders(now = Date.now()) {
  const cutoff = now - holdMinutes() * 60000;
  const stale = await Order.find({ paymentMethod: 'online', paymentStatus: 'pending', status: 'Order Placed', createdAt: { $lt: new Date(cutoff) } }).setOptions({ withHeld: true }).limit(50);
  let cancelled = 0;
  for (const order of stale) {
    if (lastActivity(order) > cutoff) continue;
    if ((await releaseUnpaid(order, 'expired')) === 'released') cancelled++;
  }
  return cancelled;
}

export function startPaymentJobs() {
  const tick = () => expireUnpaidOrders().catch((e) => console.error('Unpaid order check failed:', e.message));
  const t = setInterval(tick, 5 * 60 * 1000);
  t.unref?.();
  setTimeout(tick, 30000).unref?.();
}
