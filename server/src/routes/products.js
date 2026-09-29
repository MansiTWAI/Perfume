import { Router } from 'express';
import Product from '../models/Product.js';
import { optionalAuth, requireAdmin, asyncHandler } from '../middleware/auth.js';
import { slugify, escapeRegex } from '../utils.js';

const r = Router();

r.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const isAdmin = req.user?.role === 'admin' && req.query.all === '1';
    const filter = isAdmin ? {} : { published: true };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.featured === '1') filter.featured = true;
    // Search and filters (used by the mobile app; the website filters on screen).
    const q = String(req.query.q || '').trim().slice(0, 60);
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: rx }, { family: rx }, { tagline: rx }, { description: rx }, { mood: rx }, { occasions: rx }, { 'notes.top.name': rx }, { 'notes.heart.name': rx }, { 'notes.base.name': rx }];
    }
    if (req.query.family) filter.family = new RegExp(`^${escapeRegex(String(req.query.family).slice(0, 60))}$`, 'i');
    if (req.query.inStock === '1') filter.stock = { $gt: 0 };
    const currency = ['INR', 'AED'].includes(req.query.currency) ? req.query.currency : 'INR';
    const min = Number(req.query.minPrice);
    const max = Number(req.query.maxPrice);
    if (Number.isFinite(min) || Number.isFinite(max)) {
      filter[`price.${currency}`] = { ...(Number.isFinite(min) && { $gte: min }), ...(Number.isFinite(max) && { $lte: max }) };
    }
    const SORTS = {
      'price-asc': { [`price.${currency}`]: 1 },
      'price-desc': { [`price.${currency}`]: -1 },
      newest: { createdAt: -1 },
      name: { name: 1 },
    };
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 0), 100);
    let query = Product.find(filter).sort(SORTS[req.query.sort] || { sortOrder: 1, createdAt: 1 });
    if (limit) query = query.limit(limit);
    res.json(await query);
  })
);

r.get(
  '/:slug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const product = await Product.findOne({ slug: req.params.slug });
    if (!product || (!product.published && req.user?.role !== 'admin')) {
      return res.status(404).json({ message: 'This fragrance could not be found.' });
    }
    const related = await Product.find({ published: true, _id: { $ne: product._id } })
      .sort({ sortOrder: 1 })
      .limit(3);
    res.json({ product, related });
  })
);

r.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = { ...req.body };
    body.slug = slugify(body.slug || body.name);
    const product = await Product.create(body);
    res.status(201).json(product);
  })
);

r.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = { ...req.body };
    if (body.slug) body.slug = slugify(body.slug);
    delete body._id;
    const product = await Product.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    res.json(product);
  })
);

r.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  })
);

export default r;
