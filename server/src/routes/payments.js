import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import Order from '../models/Order.js';
import mongoose from 'mongoose';
import { optionalAuth, requireAuth, asyncHandler } from '../middleware/auth.js';
import { razorpayConfigured, ONLINE_CURRENCIES, createRazorpayOrder, verifyPaymentSignature, verifyWebhookSignature } from '../services/razorpay.js';

// Online payment for an order that has already been placed (POST /orders).
// The amount always comes from the saved order, never from the client.
const r = Router();
const payLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, message: { message: 'Too many payment attempts. Please wait a few minutes and try again.' } });

// The customer proves the order is theirs by signing in, or with the email
// used at checkout (the same proof as order tracking).
// The order is given as orderNumber (e.g. AB-26K7Q2M) or orderId (that, or the id).
async function findPayable(req) {
  const key = String(req.body?.orderNumber || req.body?.orderId || '').trim();
  const email = String(req.body?.email || '').toLowerCase().trim();
  const order = key && (await Order.findOne(mongoose.isValidObjectId(key) ? { _id: key } : { orderNumber: key.toUpperCase() }));
  const mine = order && ((req.user && (String(order.user) === String(req.user._id) || order.customer.email === req.user.email)) || (email && order.customer.email === email));
  if (!mine) throw Object.assign(new Error('We could not find this order in your account.'), { status: 404 });
  return order;
}

const fail = (res, e) => res.status(e.status || 400).json({ message: e.message });

const createPayment = asyncHandler(async (req, res) => {
    if (!razorpayConfigured()) return res.status(503).json({ message: 'Online payment is not set up yet. Please choose another payment method.' });
    let order;
    try {
      order = await findPayable(req);
    } catch (e) {
      return fail(res, e);
    }
    if (order.paymentStatus === 'paid') return res.status(409).json({ message: 'This order is already paid.' });
    if (order.status === 'Cancelled') return res.status(409).json({ message: 'This order is cancelled, so it can no longer be paid.' });
    if (!ONLINE_CURRENCIES.includes(order.currency)) return res.status(400).json({ message: 'Online payment is not available for this currency yet.' });
    const amount = Math.round(order.total * 100); // paise
    // Re-use the Razorpay order unless the total changed (e.g. quantities edited).
    if (!order.payment?.providerOrderId || order.payment.amount !== amount) {
      let rp;
      try {
        rp = await createRazorpayOrder({ amount, currency: order.currency, receipt: order.orderNumber, notes: { orderNumber: order.orderNumber } });
      } catch (e) {
        return fail(res, e);
      }
      order.payment = { provider: 'razorpay', providerOrderId: rp.id, amount };
      await order.save();
    }
    res.json({
      provider: 'razorpay',
      keyId: process.env.RAZORPAY_KEY_ID, // public key; the secret stays on the server
      razorpayOrderId: order.payment.providerOrderId,
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

// Marks an order paid. Idempotent.
async function markPaid(order, paymentId, note) {
  if (order.paymentStatus === 'paid') return false;
  order.paymentStatus = 'paid';
  order.paymentMethod = 'online';
  order.payment = { ...(order.payment?.toObject?.() || order.payment || {}), provider: 'razorpay', providerPaymentId: paymentId, paidAt: new Date() };
  if (order.status === 'Order Placed') {
    order.status = 'Confirmed';
    order.history.push({ status: 'Confirmed', note });
  }
  await order.save();
  return true;
}

// Called by the app/website right after Razorpay Checkout succeeds.
const verifyPayment = asyncHandler(async (req, res) => {
    if (!razorpayConfigured()) return res.status(503).json({ message: 'Online payment is not set up yet. Please choose another payment method.' });
    let order;
    try {
      order = await findPayable(req);
    } catch (e) {
      return fail(res, e);
    }
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if (!orderId || orderId !== order.payment?.providerOrderId || !paymentId || !signature || !verifyPaymentSignature({ orderId, paymentId, signature })) {
      return res.status(400).json({ message: 'The payment could not be verified. If money left your account, contact us with your Order ID.' });
    }
    await markPaid(order, paymentId, 'Payment received. Thank you.');
    res.json({ ok: true, message: 'Payment verified', orderNumber: order.orderNumber, paymentStatus: order.paymentStatus, status: order.status });
});
r.post('/razorpay/verify', payLimiter, optionalAuth, verifyPayment);
r.post('/verify', payLimiter, optionalAuth, verifyPayment);

// Razorpay webhook (Dashboard → Webhooks: payment.captured, order.paid), in
// case the customer closes the page before /verify runs.
const webhook = asyncHandler(async (req, res) => {
    if (!verifyWebhookSignature(req.rawBody, req.get('x-razorpay-signature'))) return res.status(400).json({ message: 'Invalid signature.' });
    const event = req.body?.event;
    const payment = req.body?.payload?.payment?.entity;
    const orderId = payment?.order_id || req.body?.payload?.order?.entity?.id;
    if (['payment.captured', 'order.paid'].includes(event) && orderId) {
      const order = await Order.findOne({ 'payment.providerOrderId': orderId });
      if (order) await markPaid(order, payment?.id, 'Payment received. Thank you.');
    }
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
    const order = await Order.findOne({ $or: [{ 'payment.providerPaymentId': id }, { 'payment.providerOrderId': id }] }).lean();
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
      paidAt: order.payment?.paidAt || null,
    });
  })
);

export default r;
