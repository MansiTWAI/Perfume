import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Order from '../models/Order.js';
import Review from '../models/Review.js';
import { optionalAuth, requireAuth, requireAdmin, asyncHandler } from '../middleware/auth.js';
import { slugify, escapeRegex } from '../utils.js';
import { productKey, appProduct, appProducts, ratings, salesBySlug, currencyFrom } from '../services/catalog.js';
import { ratingFor, publicReview, displayName } from './reviews.js';

const r = Router();

// Builds the catalogue query from the filters the website and the app send.
export async function productQuery(q, { includeHidden = false } = {}) {
  const filter = includeHidden ? {} : { published: true };
  if (q.category) {
    // A category name or slug, matched without case.
    const cat = await Category.findOne({ slug: String(q.category).toLowerCase() }).select('name').lean();
    filter.category = new RegExp(`^${escapeRegex(cat?.name || String(q.category).slice(0, 60))}$`, 'i');
  }
  if (q.featured === '1' || q.featured === 'true') filter.featured = true;
  if (['unisex', 'men', 'women'].includes(q.gender)) filter.gender = q.gender === 'unisex' ? 'unisex' : { $in: [q.gender, 'unisex'] };
  const text = String(q.q || q.search || '').trim().slice(0, 60);
  if (text) {
    const rx = new RegExp(escapeRegex(text), 'i');
    filter.$or = [{ name: rx }, { family: rx }, { tagline: rx }, { description: rx }, { category: rx }, { mood: rx }, { occasions: rx }, { 'notes.top.name': rx }, { 'notes.heart.name': rx }, { 'notes.base.name': rx }];
  }
  if (q.family) filter.family = new RegExp(`^${escapeRegex(String(q.family).slice(0, 60))}$`, 'i');
  if (q.inStock === '1' || q.inStock === 'true') filter.stock = { $gt: 0 };
  const currency = ['INR', 'AED'].includes(q.currency) ? q.currency : 'INR';
  const min = Number(q.minPrice);
  const max = Number(q.maxPrice);
  if (Number.isFinite(min) || Number.isFinite(max)) {
    filter[`price.${currency}`] = { ...(Number.isFinite(min) && { $gte: min }), ...(Number.isFinite(max) && { $lte: max }) };
  }
  const SORTS = {
    'price-asc': { [`price.${currency}`]: 1 },
    price_asc: { [`price.${currency}`]: 1 },
    'price-desc': { [`price.${currency}`]: -1 },
    price_desc: { [`price.${currency}`]: -1 },
    newest: { createdAt: -1 },
    name: { name: 1 },
  };
  return { filter, sort: SORTS[q.sort] || { sortOrder: 1, createdAt: 1 }, popular: q.sort === 'popular' };
}

// Most sold first (ties keep the catalogue order).
async function byPopularity(products) {
  const sold = await salesBySlug();
  return [...products].sort((a, b) => (sold.get(b.slug) || 0) - (sold.get(a.slug) || 0));
}

const pageParams = (q, fallback = 20) => {
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || fallback, 1), 100);
  const page = Math.max(parseInt(q.page, 10) || 1, 1);
  return { limit, page };
};

r.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const includeHidden = req.user?.role === 'admin' && req.query.all === '1';
    const { filter, sort, popular } = await productQuery(req.query, { includeHidden });
    // The website asks for the whole (small) catalogue as an array; the app
    // contract (/api/v1, or ?page=) is paginated with the app's product shape.
    if (!req.apiV1 && !req.query.page) {
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 0), 100);
      let list = await Product.find(filter).sort(sort);
      if (popular) list = await byPopularity(list);
      return res.json(limit ? list.slice(0, limit) : list);
    }
    const { limit, page } = pageParams(req.query);
    let list;
    let total;
    if (popular) {
      const all = await byPopularity(await Product.find(filter).sort(sort));
      total = all.length;
      list = all.slice((page - 1) * limit, page * limit);
    } else {
      [list, total] = await Promise.all([Product.find(filter).sort(sort).skip((page - 1) * limit).limit(limit), Product.countDocuments(filter)]);
    }
    const currency = currencyFrom(req.query);
    res.json({ items: await appProducts(list, currency), total, page, pages: Math.max(1, Math.ceil(total / limit)), limit, message: 'Products fetched successfully' });
  })
);

// Curated lists for the homepage and the app.
const listOut = async (req, res, list) =>
  res.json(req.apiV1 ? await appProducts(list, currencyFrom(req.query)) : list);
const listLimit = (q) => Math.min(Math.max(parseInt(q.limit, 10) || 10, 1), 50);

r.get('/featured', asyncHandler(async (req, res) => listOut(req, res, await Product.find({ published: true, featured: true }).sort({ sortOrder: 1 }).limit(listLimit(req.query)))));

r.get('/new-arrivals', asyncHandler(async (req, res) => listOut(req, res, await Product.find({ published: true }).sort({ createdAt: -1 }).limit(listLimit(req.query)))));

r.get(
  '/bestsellers',
  asyncHandler(async (req, res) => {
    const ranked = await byPopularity(await Product.find({ published: true }).sort({ sortOrder: 1 }));
    listOut(req, res, ranked.slice(0, listLimit(req.query)));
  })
);

// ----- reviews of one product (id or slug) -----
r.get(
  '/:productId/reviews',
  asyncHandler(async (req, res) => {
    const p = await Product.findOne({ ...productKey(req.params.productId), published: true }).select('slug').lean();
    if (!p) return res.status(404).json({ message: 'This fragrance could not be found.' });
    const [items, summary] = await Promise.all([Review.find({ slug: p.slug, status: 'approved' }).sort({ createdAt: -1 }).limit(50), ratingFor(p.slug)]);
    res.json({ ...summary, rating: summary.average, reviewCount: summary.count, items: items.map(publicReview) });
  })
);

// A signed-in customer reviews a product from one of their delivered orders.
// Reviews appear once the house approves them.
const reviewLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, message: { message: 'Too many reviews from this connection. Please try again later.' } });
r.post(
  '/:productId/reviews',
  reviewLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const p = await Product.findOne(productKey(req.params.productId));
    if (!p) return res.status(404).json({ message: 'This fragrance could not be found.' });
    const stars = parseInt(req.body?.rating, 10);
    if (!(stars >= 1 && stars <= 5)) return res.status(400).json({ message: 'Please choose a rating from one to five.', errors: [{ field: 'rating', message: 'Must be 1 to 5' }] });
    const text = String(req.body?.comment ?? req.body?.body ?? '').trim();
    if (text.length < 20) return res.status(400).json({ message: 'Please write a few words about the fragrance (at least 20 characters).', errors: [{ field: 'comment', message: 'At least 20 characters' }] });
    const orders = await Order.find({ $or: [{ user: req.user._id }, { 'customer.email': req.user.email }], 'items.slug': p.slug }).sort({ createdAt: -1 });
    const delivered = orders.filter((o) => o.status === 'Delivered');
    if (!delivered.length) {
      return res.status(orders.length ? 400 : 403).json({
        message: orders.length ? 'You can review your fragrance once your order has been delivered.' : 'Only customers who bought this fragrance can review it.',
      });
    }
    const reviewed = new Set((await Review.find({ order: { $in: delivered.map((o) => o._id) }, slug: p.slug }).select('order')).map((x) => String(x.order)));
    const order = delivered.find((o) => !reviewed.has(String(o._id)));
    if (!order) return res.status(409).json({ message: 'You have already reviewed this fragrance. Thank you.' });
    const review = await Review.create({
      product: p._id,
      slug: p.slug,
      order: order._id,
      orderNumber: order.orderNumber,
      name: displayName(req.user.name || order.customer.name),
      city: order.customer.address?.city,
      country: order.customer.address?.country,
      rating: stars,
      title: String(req.body?.title || '').trim().slice(0, 80),
      body: text.slice(0, 1200),
    });
    res.status(201).json({ ok: true, message: 'Thank you. Your review will appear once the house has read it.', review: { ...publicReview(review), status: review.status } });
  })
);

// One product by slug (website) or id (app), with up to three related ones.
r.get(
  '/:slug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const product = await Product.findOne(productKey(req.params.slug));
    if (!product || (!product.published && req.user?.role !== 'admin')) {
      return res.status(404).json({ message: 'This fragrance could not be found.' });
    }
    const related = await Product.find({ published: true, _id: { $ne: product._id } })
      .sort({ sortOrder: 1 })
      .limit(3);
    if (!req.apiV1) return res.json({ product, related });
    const currency = currencyFrom(req.query);
    const rating = (await ratings([product.slug])).get(product.slug);
    res.json({ ...appProduct(product, { currency, rating }), related: await appProducts(related, currency) });
  })
);

export const createProduct = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  body.slug = slugify(body.slug || body.name);
  const product = await Product.create(body);
  res.status(201).json(product);
});

export const updateProduct = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (body.slug) body.slug = slugify(body.slug);
  delete body._id;
  const product = await Product.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  res.json(product);
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const p = await Product.findByIdAndDelete(req.params.id);
  if (!p && req.apiV1) return res.status(404).json({ message: 'Product not found.' });
  res.json({ ok: true });
});

r.post('/', requireAdmin, createProduct);
r.put('/:id', requireAdmin, updateProduct);
r.delete('/:id', requireAdmin, deleteProduct);

export default r;
