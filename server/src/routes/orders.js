import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { optionalAuth, requireAuth, requireAdmin, asyncHandler } from '../middleware/auth.js';
import { ORDER_STAGES, regionByCode, shippingFor } from '../config/commerce.js';
import { code } from '../utils.js';

const r = Router();
const placeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 });

// Place an order. Prices are always recalculated from the database.
r.post(
  '/',
  placeLimiter,
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { items = [], customer, region: regionCode = 'IN', paymentMethod, giftNote } = req.body || {};
    const region = regionByCode(regionCode);
    if (!region?.ships) {
      return res.status(400).json({ message: 'We do not deliver to this country yet. Please contact us on WhatsApp.' });
    }
    const { currency } = region;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Your bag is empty.' });
    const a = customer?.address || {};
    if (!customer?.name || !customer?.email || !customer?.phone || !a.line1 || !a.city || !a.postalCode) {
      return res.status(400).json({ message: 'Please complete your name, contact details and delivery address.' });
    }
    const method = region.payments.includes(paymentMethod) ? paymentMethod : region.payments[0];

    const lines = [];
    for (const it of items.slice(0, 20)) {
      const qty = Math.min(Math.max(parseInt(it.qty, 10) || 1, 1), 10);
      const p = await Product.findOne({ slug: it.slug, published: true });
      if (!p) return res.status(400).json({ message: `${it.slug} is no longer available.` });
      if (p.stock < qty) return res.status(409).json({ message: `Only ${p.stock} of ${p.name} left in stock.` });
      lines.push({ p, qty });
    }

    // Reserve stock atomically; roll back if any line fails.
    const reserved = [];
    for (const { p, qty } of lines) {
      const ok = await Product.updateOne({ _id: p._id, stock: { $gte: qty } }, { $inc: { stock: -qty } });
      if (!ok.modifiedCount) {
        for (const x of reserved) await Product.updateOne({ _id: x.p._id }, { $inc: { stock: x.qty } });
        return res.status(409).json({ message: `${p.name} just sold out. Please update your bag.` });
      }
      reserved.push({ p, qty });
    }

    const orderItems = lines.map(({ p, qty }) => ({
      product: p._id,
      slug: p.slug,
      name: p.name,
      image: p.images?.[0]?.src,
      qty,
      unitPrice: p.price[currency],
    }));
    const subtotal = orderItems.reduce((s, i) => s + i.unitPrice * i.qty, 0);
    const shipping = shippingFor(region, subtotal);

    const order = await Order.create({
      orderNumber: 'AB-' + new Date().getFullYear().toString().slice(2) + code(5),
      trackingId: 'ABL' + code(9),
      user: req.user?._id,
      customer: { ...customer, address: { ...a, country: region.name } },
      items: orderItems,
      currency,
      subtotal,
      shipping,
      total: subtotal + shipping,
      paymentMethod: method,
      giftNote: giftNote?.enabled
        ? {
            enabled: true,
            name: String(giftNote.name || '').slice(0, 40),
            occasion: String(giftNote.occasion || '').slice(0, 40),
            message: String(giftNote.message || '').slice(0, 160),
          }
        : { enabled: false },
      history: [{ status: ORDER_STAGES[0], note: 'We have received your order.' }],
    });
    res.status(201).json({ orderNumber: order.orderNumber, trackingId: order.trackingId, total: order.total, currency });
  })
);

// Public tracking: tracking ID plus the email used at checkout.
r.get(
  '/track/:trackingId',
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ trackingId: String(req.params.trackingId).toUpperCase().trim() });
    const email = String(req.query.email || '').toLowerCase().trim();
    if (!order || order.customer.email !== email) {
      return res.status(404).json({ message: 'No order matches that tracking ID and email.' });
    }
    res.json({
      orderNumber: order.orderNumber,
      trackingId: order.trackingId,
      status: order.status,
      stages: ORDER_STAGES,
      history: order.history,
      carrier: order.carrier,
      carrierUrl: order.carrierUrl,
      eta: order.eta,
      items: order.items.map((i) => ({ slug: i.slug, name: i.name, qty: i.qty, image: i.image })),
      city: order.customer.address.city,
      country: order.customer.address.country,
      createdAt: order.createdAt,
    });
  })
);

r.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orders = await Order.find({ $or: [{ user: req.user._id }, { 'customer.email': req.user.email }] }).sort({ createdAt: -1 });
    res.json(orders);
  })
);

// ----- admin -----
r.get(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const filter = req.query.status ? { status: req.query.status } : {};
    res.json(await Order.find(filter).sort({ createdAt: -1 }).limit(200));
  })
);

r.get(
  '/stats',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [byStatus, revenue, count] = await Promise.all([
      Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Order.aggregate([{ $group: { _id: '$currency', total: { $sum: '$total' } } }]),
      Order.countDocuments(),
    ]);
    res.json({ byStatus, revenue, count, stages: ORDER_STAGES });
  })
);

r.patch(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    const { status, carrier, carrierUrl, eta, paymentStatus, note } = req.body || {};
    if (status && ORDER_STAGES.includes(status) && status !== order.status) {
      order.status = status;
      order.history.push({ status, note: note || '' });
    }
    if (carrier !== undefined) order.carrier = carrier;
    if (carrierUrl !== undefined) order.carrierUrl = carrierUrl;
    if (eta !== undefined) order.eta = eta;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    await order.save();
    res.json(order);
  })
);

export default r;
