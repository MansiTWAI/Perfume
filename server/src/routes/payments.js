import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import Order from '../models/Order.js';
import PaymentEvent from '../models/PaymentEvent.js';
import mongoose from 'mongoose';
import { optionalAuth, requireAuth, asyncHandler } from '../middleware/auth.js';
import {
  razorpayConfigured, ONLINE_CURRENCIES, ID, createRazorpayOrder, fetchPayment, verifyPaymentSignature, verifyWebhookSignature, payLog,
} from '../services/razorpay.js';
import { applyPayment, applyRefund, reconcile, attemptIds, amountDue } from '../services/payments.js';

// Online payment for an order that has already been placed (POST /orders).
// The amount always comes from the saved order, never from the client, and an
// order is marked paid only after the server has checked the payment.
const r = Router();
const payLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, message: { message: 'Too many payment attempts. Please wait a few minutes and try again.' } });
const statusLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, message: { message: 'Too many requests. Please wait a few minutes and try again.' } });

const NOT_SET_UP = { message: 'Online payment is not set up yet. Please choose another payment method.' };
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// The customer proves the order is theirs by signing in, or with the email
// used at checkout (the same proof as order tracking).
// The order is given as orderNumber (e.g. AB-26K7Q2M) or orderId (that, or the id).
async function findPayable(req) {
  const key = str(req.body?.orderNumber) || str(req.body?.orderId);
  const email = str(req.body?.email, 160).toLowerCase();
  const order = key && (await Order.findOne(mongoose.isValidObjectId(key) ? { _id: key } : { orderNumber: key.toUpperCase() }));
  const mine = order && ((req.user && (String(order.user) === String(req.user._id) || order.customer.email === req.user.email)) || (email && order.customer.email === email));
  if (!mine) throw Object.assign(new Error('We could not find this order in your account.'), { status: 404 });
  return order;
}

const fail = (res, e) => res.status(e.status || 400).json({ ...(e.code && { code: e.code }), message: e.message });
const paidReply = (o) => ({ ok: true, paid: true, orderNumber: o.orderNumber, paymentStatus: o.paymentStatus, status: o.status });

const createPayment = asyncHandler(async (req, res) => {
  if (!razorpayConfigured()) return res.status(503).json(NOT_SET_UP);
  let order;
  try {
    order = await findPayable(req);
  } catch (e) {
    return fail(res, e);
  }
  // A payment may have gone through without the browser hearing about it
  // (closed tab, lost connection): ask Razorpay before taking another one.
  if (order.paymentStatus === 'pending' && attemptIds(order).length) order = await reconcile(order);
  if (order.paymentStatus !== 'pending') return res.status(409).json({ code: 'ALREADY_PAID', message: 'This order is already paid.', ...paidReply(order) });
  if (order.status === 'Cancelled') return res.status(409).json({ message: 'This order is cancelled, so it can no longer be paid.' });
  if (!ONLINE_CURRENCIES.includes(order.currency)) return res.status(400).json({ message: 'Online payment is not available for this currency yet.' });
  const amount = amountDue(order); // paise, from the saved order
  if (!Number.isSafeInteger(amount) || amount < 100) return res.status(400).json({ message: 'This order total cannot be paid online. Please contact us.' });

  // Re-use the latest Razorpay order while the amount is unchanged, so every
  // retry, refresh and second tab pays the same one (Razorpay accepts only one
  // successful payment per order: no double charge).
  const latest = (order.payment?.attempts || []).at(-1);
  let rpOrderId = latest && latest.amount === amount && latest.currency === order.currency && latest.status === 'created' ? latest.providerOrderId : null;
  if (!rpOrderId && !order.payment?.attempts?.length && order.payment?.providerOrderId && order.payment.amount === amount) rpOrderId = order.payment.providerOrderId; // older orders
  if (!rpOrderId) {
    let rp;
    try {
      rp = await createRazorpayOrder({ amount, currency: order.currency, receipt: order.orderNumber, notes: { orderNumber: order.orderNumber } });
    } catch (e) {
      return fail(res, e);
    }
    // Only one new attempt wins if two tabs ask at once; the loser's
    // Razorpay order is never shown to anyone, so it cannot be paid.
    const before = latest?.providerOrderId ?? null;
    const saved = await Order.findOneAndUpdate(
      { _id: order._id, paymentStatus: 'pending', total: order.total, $expr: { $eq: [{ $ifNull: [{ $last: '$payment.attempts.providerOrderId' }, null] }, before] } },
      {
        $set: { 'payment.provider': 'razorpay', 'payment.providerOrderId': rp.id, 'payment.amount': amount, 'payment.currency': order.currency },
        $push: { 'payment.attempts': { providerOrderId: rp.id, amount, currency: order.currency, status: 'created' } },
      },
      { new: true }
    );
    // Older attempts were for another amount: a late payment on one of them
    // is matched but treated as a mismatch (refunded), never as paid.
    if (saved) {
      await Order.updateOne(
        { _id: order._id },
        { $set: { 'payment.attempts.$[old].status': 'superseded' } },
        { arrayFilters: [{ 'old.status': 'created', 'old.providerOrderId': { $ne: rp.id } }] }
      );
    }
    if (saved) {
      rpOrderId = rp.id;
      payLog('razorpay_order_created', { orderNumber: order.orderNumber, razorpayOrderId: rp.id, amount, currency: order.currency });
    } else {
      const fresh = await Order.findById(order._id);
      const won = (fresh.payment?.attempts || []).at(-1);
      if (fresh.paymentStatus !== 'pending') return res.status(409).json({ code: 'ALREADY_PAID', message: 'This order is already paid.', ...paidReply(fresh) });
      if (!won || won.amount !== amountDue(fresh)) return res.status(409).json({ message: 'Your order changed while we were preparing the payment. Please try again.' });
      rpOrderId = won.providerOrderId;
    }
  }
  res.json({
    provider: 'razorpay',
    keyId: process.env.RAZORPAY_KEY_ID, // public key; the secret stays on the server
    razorpayOrderId: rpOrderId,
    amount,
    currency: order.currency,
    orderNumber: order.orderNumber,
    name: 'AL BARAKAH LIFESTYLE',
    description: `Order ${order.orderNumber}`,
    prefill: { name: order.customer.name, email: order.customer.email, contact: order.customer.phone },
  });
});
r.post('/razorpay/order', payLimiter, optionalAuth, createPayment);
r.post('/create-order', payLimiter, optionalAuth, createPayment);

// Called by the app/website right after Razorpay Checkout succeeds. The
// signature proves Razorpay issued this payment for this Razorpay order; the
// payment itself is then read from Razorpay to check its state and amount.
const verifyPayment = asyncHandler(async (req, res) => {
  if (!razorpayConfigured()) return res.status(503).json(NOT_SET_UP);
  let order;
  try {
    order = await findPayable(req);
  } catch (e) {
    return fail(res, e);
  }
  const orderId = str(req.body?.razorpay_order_id, 60);
  const paymentId = str(req.body?.razorpay_payment_id, 60);
  const signature = str(req.body?.razorpay_signature, 80);
  const bad = () => {
    payLog('verify_rejected', { orderNumber: order.orderNumber, razorpayOrderId: orderId || undefined, razorpayPaymentId: paymentId || undefined, outcome: 'invalid' });
    return res.status(400).json({ message: 'The payment could not be verified. If money left your account, contact us with your Order ID.' });
  };
  if (!ID.order.test(orderId) || !ID.payment.test(paymentId) || !ID.signature.test(signature)) return bad();
  if (!attemptIds(order).includes(orderId)) return bad();
  if (!verifyPaymentSignature({ orderId, paymentId, signature })) return bad();

  // Already settled by this payment (webhook first, or a replayed request).
  if (order.payment?.providerPaymentId === paymentId) return res.json({ ...paidReply(order), message: 'Payment verified' });

  let payment;
  try {
    payment = await fetchPayment(paymentId);
  } catch {
    // Razorpay unreachable: the signature is genuine, so the payment exists.
    // Don't guess; the webhook or the next status check will settle it.
    payLog('verify_deferred', { orderNumber: order.orderNumber, razorpayOrderId: orderId, razorpayPaymentId: paymentId, outcome: 'confirming' });
    return res.status(202).json({ ok: true, paid: false, confirming: true, message: 'We are confirming your payment. Please do not pay again.' });
  }
  if (payment.order_id !== orderId) return bad();
  const { outcome, order: after } = await applyPayment(payment, 'checkout');
  const o = after || order;
  if (outcome === 'paid' || outcome === 'already') return res.json({ ...paidReply(o), message: 'Payment verified' });
  if (outcome === 'not_captured') return res.status(202).json({ ok: true, paid: false, confirming: true, message: 'We are confirming your payment. Please do not pay again.' });
  if (outcome === 'failed') return res.status(402).json({ code: 'PAYMENT_FAILED', message: payment.error_description || 'The payment did not go through. Please try again.' });
  // duplicate / mismatch: money arrived but cannot count towards this order.
  return res.status(409).json({
    code: 'PAYMENT_NEEDS_REVIEW',
    message: o.paymentStatus === 'paid'
      ? 'This order was already paid. We will refund the extra payment within 5–7 working days.'
      : 'Your order total changed while you were paying, so this payment could not be applied. We will refund it within 5–7 working days. Please pay the new total.',
    paymentStatus: o.paymentStatus,
  });
});
r.post('/razorpay/verify', payLimiter, optionalAuth, verifyPayment);
r.post('/verify', payLimiter, optionalAuth, verifyPayment);

// Where a payment stands, checking with Razorpay when the order is still
// pending. The website calls this when the callback was lost.
r.post(
  '/razorpay/status',
  statusLimiter,
  optionalAuth,
  asyncHandler(async (req, res) => {
    let order;
    try {
      order = await findPayable(req);
    } catch (e) {
      return fail(res, e);
    }
    if (order.paymentStatus === 'pending' && attemptIds(order).length) order = await reconcile(order);
    const last = (order.payment?.attempts || []).at(-1);
    res.json({
      orderNumber: order.orderNumber,
      paid: order.paymentStatus !== 'pending',
      paymentStatus: order.paymentStatus,
      status: order.status,
      lastError: order.paymentStatus === 'pending' ? last?.lastError || null : null,
    });
  })
);

// Razorpay webhook (Dashboard → Webhooks, events: payment.captured,
// payment.failed, order.paid, refund.created, refund.processed,
// refund.failed). Authoritative even when the customer's browser never
// reports back. Retries and duplicates are harmless: each event id is handled
// once and every update is idempotent. Errors return 500 so Razorpay retries.
const webhook = asyncHandler(async (req, res) => {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    payLog('webhook_not_configured', {});
    return res.status(503).json({ message: 'Not configured.' });
  }
  if (!verifyWebhookSignature(req.rawBody, req.get('x-razorpay-signature'))) {
    payLog('webhook_rejected', { outcome: 'invalid_signature' });
    return res.status(400).json({ message: 'Invalid signature.' });
  }
  const event = str(req.body?.event, 60);
  const eventId = str(req.get('x-razorpay-event-id'), 80) || null;
  const payment = req.body?.payload?.payment?.entity;
  const refund = req.body?.payload?.refund?.entity;
  const orderEntity = req.body?.payload?.order?.entity;
  if (eventId && (await PaymentEvent.exists({ eventId }))) {
    payLog('webhook_duplicate', { eventId, outcome: 'skipped' });
    return res.json({ ok: true });
  }

  let outcome = 'ignored';
  if (['payment.captured', 'payment.authorized', 'payment.failed', 'order.paid'].includes(event) && payment?.id && (payment.order_id || orderEntity?.id)) {
    ({ outcome } = await applyPayment({ ...payment, order_id: payment.order_id || orderEntity.id }, 'webhook'));
  } else if (event.startsWith('refund.') && refund?.id && refund.payment_id) {
    ({ outcome } = await applyRefund(refund));
  }
  if (eventId) {
    await PaymentEvent.create({ eventId, event, providerOrderId: payment?.order_id || orderEntity?.id, providerPaymentId: payment?.id || refund?.payment_id, outcome }).catch((e) => {
      if (e?.code !== 11000) throw e; // a parallel delivery recorded it first
    });
  }
  payLog('webhook_handled', { eventId, razorpayOrderId: payment?.order_id || orderEntity?.id, razorpayPaymentId: payment?.id || refund?.payment_id, status: event, outcome });
  res.json({ ok: true });
});
r.post('/razorpay/webhook', webhook);
r.post('/webhook', webhook);

// The payment of one of the signed-in customer's orders, by the provider's
// payment id (pay_…) or order id (order_…).
r.get(
  '/:paymentId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = String(req.params.paymentId).trim();
    if (!ID.payment.test(id) && !ID.order.test(id)) return res.status(404).json({ message: 'Payment not found.' });
    const order = await Order.findOne({ $or: [{ 'payment.providerPaymentId': id }, { 'payment.providerOrderId': id }, { 'payment.attempts.providerOrderId': id }] }).lean();
    const mine = order && (req.user.role === 'admin' || String(order.user) === String(req.user._id) || order.customer.email === req.user.email);
    if (!mine) return res.status(404).json({ message: 'Payment not found.' });
    res.json({
      paymentId: order.payment?.providerPaymentId || null,
      provider: order.payment?.provider || null,
      providerOrderId: order.payment?.providerOrderId || null,
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      amount: order.total,
      amountMinor: order.payment?.amount || Math.round(order.total * 100),
      currency: order.currency,
      status: order.paymentStatus,
      method: order.payment?.method || null,
      paidAt: order.payment?.paidAt || null,
      refunded: (order.payment?.refundedAmount || 0) / 100,
    });
  })
);

export default r;
