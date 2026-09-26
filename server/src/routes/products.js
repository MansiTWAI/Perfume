import { Router } from 'express';
import Product from '../models/Product.js';
import { optionalAuth, requireAdmin, asyncHandler } from '../middleware/auth.js';
import { slugify } from '../utils.js';

const r = Router();

r.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const isAdmin = req.user?.role === 'admin' && req.query.all === '1';
    const filter = isAdmin ? {} : { published: true };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.featured === '1') filter.featured = true;
    const products = await Product.find(filter).sort({ sortOrder: 1, createdAt: 1 });
    res.json(products);
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
