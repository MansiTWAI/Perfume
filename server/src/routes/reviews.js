import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import Review from '../models/Review.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { requireAdmin, asyncHandler } from '../middleware/auth.js';

const r = Router();
const submitLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, message: { message: 'Too many reviews from this connection. Please try again later.' } });

// Public name: first name and initial only ("Ayesha K.").
export function displayName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Verified buyer';
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}

export const publicReview = (x) => ({
  _id: x._id,
  name: x.name,
  city: x.city,
  country: x.country,
  rating: x.rating,
  title: x.title,
  body: x.body,
  reply: x.reply,
  createdAt: x.createdAt,
  verified: true,
});

export async function ratingFor(slug) {
  const [s] = await Review.aggregate([
    { $match: { slug, status: 'approved' } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  return s ? { average: Math.round(s.average * 10) / 10, count: s.count } : { average: 0, count: 0 };
}

// Approved reviews for a product, newest first, with the summary.
r.get(
  '/product/:slug',
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug).toLowerCase();
    const [items, summary] = await Promise.all([
      Review.find({ slug, status: 'approved' }).sort({ createdAt: -1 }).limit(50),
      ratingFor(slug),
    ]);
    res.json({ ...summary, items: items.map(publicReview) });
  })
);

// Which products in a delivered order can still be reviewed (for the Track page).
r.get(
  '/eligible/:trackingId',
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ trackingId: String(req.params.trackingId).toUpperCase().trim() });
    const email = String(req.query.email || '').toLowerCase().trim();
    if (!order || order.customer.email !== email) return res.status(404).json({ message: 'No order matches that tracking ID and email.' });
    if (order.status !== 'Delivered') return res.json({ delivered: false, items: [] });
    const done = await Review.find({ order: order._id }).select('slug');
    const reviewed = new Set(done.map((d) => d.slug));
    res.json({
      delivered: true,
      items: order.items.map((i) => ({ slug: i.slug, name: i.name, image: i.image, reviewed: reviewed.has(i.slug) })),
    });
  })
);

// Submit a review: proven by tracking ID + checkout email, delivered orders only.
r.post(
  '/',
  submitLimiter,
  asyncHandler(async (req, res) => {
    const { trackingId, email, slug, rating, title, body } = req.body || {};
    const order = await Order.findOne({ trackingId: String(trackingId || '').toUpperCase().trim() });
    if (!order || order.customer.email !== String(email || '').toLowerCase().trim()) {
      return res.status(404).json({ message: 'No order matches that tracking ID and email.' });
    }
    if (order.status !== 'Delivered') return res.status(400).json({ message: 'You can review your fragrance once your order has been delivered.' });
    const item = order.items.find((i) => i.slug === slug);
    if (!item) return res.status(400).json({ message: 'That fragrance was not part of this order.' });
    const stars = parseInt(rating, 10);
    if (!(stars >= 1 && stars <= 5)) return res.status(400).json({ message: 'Please choose a rating from one to five.' });
    const text = String(body || '').trim();
    if (text.length < 20) return res.status(400).json({ message: 'Please write a few words about the fragrance (at least 20 characters).' });
    const product = await Product.findOne({ slug });
    if (!product) return res.status(400).json({ message: 'That fragrance is no longer available.' });

    try {
      await Review.create({
        product: product._id,
        slug,
        order: order._id,
        orderNumber: order.orderNumber,
        name: displayName(order.customer.name),
        city: order.customer.address?.city,
        country: order.customer.address?.country,
        rating: stars,
        title: String(title || '').trim().slice(0, 80),
        body: text.slice(0, 1200),
      });
    } catch (e) {
      if (e?.code === 11000) return res.status(409).json({ message: 'You have already reviewed this fragrance for this order. Thank you.' });
      throw e;
    }
    res.status(201).json({ ok: true, message: 'Thank you. Your review will appear once the house has read it.' });
  })
);

// ----- admin -----
r.get(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const filter = req.query.status ? { status: req.query.status } : {};
    res.json(await Review.find(filter).sort({ createdAt: -1 }).limit(300));
  })
);

r.patch(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { status, reply } = req.body || {};
    const update = {};
    if (['pending', 'approved', 'rejected'].includes(status)) update.status = status;
    if (reply !== undefined) update.reply = String(reply).slice(0, 600);
    const review = await Review.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!review) return res.status(404).json({ message: 'Review not found.' });
    res.json(review);
  })
);

export default r;
