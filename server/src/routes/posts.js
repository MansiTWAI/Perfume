import { Router } from 'express';
import Post from '../models/Post.js';
import Product from '../models/Product.js';
import { optionalAuth, requireAdmin, asyncHandler } from '../middleware/auth.js';
import { slugify, escapeRegex } from '../utils.js';

const r = Router();

r.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const isAdmin = req.user?.role === 'admin' && req.query.all === '1';
    const filter = isAdmin ? {} : { status: 'published' };
    if (req.query.category && req.query.category !== 'All') filter.category = req.query.category;
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 60)), 'i');
      filter.$or = [{ title: rx }, { excerpt: rx }, { tags: rx }];
    }
    const limit = Math.min(Number(req.query.limit) || 12, 50);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const [items, total] = await Promise.all([
      Post.find(filter)
        .select(isAdmin ? '-content' : '-content -seo')
        .sort({ featured: -1, publishedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Post.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  })
);

r.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const cats = await Post.distinct('category', { status: 'published' });
    res.json(cats.sort());
  })
);

r.get(
  '/id/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found.' });
    res.json(post);
  })
);

r.get(
  '/:slug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const post = await Post.findOne({ slug: req.params.slug });
    if (!post || (post.status !== 'published' && req.user?.role !== 'admin')) {
      return res.status(404).json({ message: 'This article could not be found.' });
    }
    const base = { status: 'published', _id: { $ne: post._id } };
    const [sameCategory, products] = await Promise.all([
      Post.find({ ...base, category: post.category }).select('-content').sort({ publishedAt: -1 }).limit(3),
      Product.find({ slug: { $in: post.relatedProducts || [] }, published: true }),
    ]);
    const related = sameCategory.length >= 3
      ? sameCategory
      : sameCategory.concat(
          await Post.find({ ...base, _id: { $nin: [post._id, ...sameCategory.map((p) => p._id)] } })
            .select('-content')
            .sort({ publishedAt: -1 })
            .limit(3 - sameCategory.length)
        );
    res.json({ post, related, products });
  })
);

r.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const post = new Post({ ...req.body, slug: slugify(req.body.slug || req.body.title) });
    await post.save();
    res.status(201).json(post);
  })
);

r.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found.' });
    const body = { ...req.body };
    delete body._id;
    if (body.slug) body.slug = slugify(body.slug);
    post.set(body);
    await post.save(); // runs reading-time + publishedAt hooks
    res.json(post);
  })
);

r.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await Post.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  })
);

export default r;
