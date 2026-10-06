// Public storefront data for the website and the app: markets and
// currencies, categories, search and the homepage.
import { Router } from 'express';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Banner from '../models/Banner.js';
import HomeContent from '../models/HomeContent.js';
import Post from '../models/Post.js';
import { optionalAuth, asyncHandler } from '../middleware/auth.js';
import { publicRegions, CURRENCY_SYMBOLS } from '../config/commerce.js';
import { appProducts, salesBySlug, currencyFrom } from '../services/catalog.js';
import { productQuery } from './products.js';
import { slugify, escapeRegex } from '../utils.js';

const r = Router();

// Markets: where we deliver, in which currency, and how customers can pay.
r.get('/config', (_req, res) => {
  const countries = publicRegions().map((x) => ({
    code: x.code,
    name: x.name,
    currency: x.currency,
    symbol: CURRENCY_SYMBOLS[x.currency] || x.currency,
    ships: !!x.ships,
    // Enquiry markets show indicative prices and order on WhatsApp.
    orderMode: x.ships ? 'checkout' : 'whatsapp',
    rtl: x.code !== 'IN',
    taxLabel: x.taxLabel || '',
    shipping: x.shipping || null,
    payments: x.payments || [],
  }));
  res.set('Cache-Control', 'public, max-age=300').json({ countries, defaultCountry: 'IN', defaultCurrency: 'INR', languages: ['en', 'ar'] });
});

// Categories from the admin; until some are created, the categories the
// published products use.
export async function listCategories() {
  const counts = new Map((await Product.aggregate([{ $match: { published: true } }, { $group: { _id: '$category', n: { $sum: 1 } } }])).map((c) => [String(c._id || '').toLowerCase(), c.n]));
  const saved = await Category.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean();
  if (saved.length) {
    return saved.map((c) => ({ id: String(c._id), name: c.name, slug: c.slug, image: c.image || null, description: c.description || '', sortOrder: c.sortOrder, productCount: counts.get(c.name.toLowerCase()) || 0 }));
  }
  const names = (await Product.distinct('category', { published: true })).filter(Boolean);
  return names.map((name, i) => ({ id: slugify(name), name, slug: slugify(name), image: null, description: '', sortOrder: i, productCount: counts.get(name.toLowerCase()) || 0 }));
}

r.get('/categories', asyncHandler(async (_req, res) => res.set('Cache-Control', 'public, max-age=60').json(await listCategories())));

// Search: matching products, categories and suggested searches.
r.get(
  '/search',
  asyncHandler(async (req, res) => {
    const text = String(req.query.q || req.query.search || '').trim().slice(0, 60);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const currency = currencyFrom(req.query);
    if (!text) return res.json({ query: '', products: [], categories: [], suggestions: [], pagination: { page, limit, total: 0, totalPages: 1 } });
    const { filter, sort } = await productQuery({ ...req.query, q: text });
    const rx = new RegExp(escapeRegex(text), 'i');
    const [found, total, categories] = await Promise.all([
      Product.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
      Product.countDocuments(filter),
      listCategories(),
    ]);
    // Suggestions: product names, families and notes that contain the text.
    const pool = await Product.find({ published: true }).select('name family notes mood').lean();
    const words = new Set();
    for (const p of pool) {
      for (const w of [p.name, p.family, ...(p.mood || []), ...['top', 'heart', 'base'].flatMap((k) => (p.notes?.[k] || []).map((n) => n.name))]) {
        if (w && rx.test(w)) words.add(w);
      }
    }
    res.json({
      query: text,
      products: await appProducts(found, currency),
      categories: categories.filter((c) => rx.test(c.name)),
      suggestions: [...words].slice(0, 8),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  })
);

// Everything the homepage shows, arranged in the admin.
export const getHome = () => HomeContent.findOne({ key: 'home' }).lean();

r.get(
  '/home',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const currency = currencyFrom(req.query);
    const now = new Date();
    const home = (await getHome()) || {};
    const [banners, products, categories, posts, sold] = await Promise.all([
      Banner.find({ active: true, $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] }] }).sort({ placement: 1, sortOrder: 1 }).lean(),
      Product.find({ published: true }).sort({ sortOrder: 1, createdAt: 1 }),
      listCategories(),
      Post.find({ status: 'published' }).sort({ publishedAt: -1 }).limit(home.blogsLimit ?? 3).select('title slug excerpt cover category publishedAt readingMinutes').lean(),
      salesBySlug(),
    ]);
    const all = await appProducts(products, currency);
    const bySlug = new Map(all.map((p) => [p.slug, p]));
    const pick = (slugs) => (slugs || []).map((s) => bySlug.get(s)).filter(Boolean);
    const featured = home.featuredProducts?.length ? pick(home.featuredProducts) : all.filter((p) => p.featured);
    const bestsellers = [...all].sort((a, b) => (sold.get(b.slug) || 0) - (sold.get(a.slug) || 0)).slice(0, home.bestsellersLimit ?? 8);
    res.set('Cache-Control', 'public, max-age=60').json({
      banners: banners.map((b) => ({ id: String(b._id), title: b.title || '', subtitle: b.subtitle || '', image: b.image, mobileImage: b.mobileImage || b.image, link: b.link || '', buttonLabel: b.buttonLabel || '', placement: b.placement, sortOrder: b.sortOrder })),
      featuredProducts: featured,
      categories,
      collections: (home.collections || []).map((c) => ({ ...c, products: pick(c.products) })),
      bestsellers,
      newArrivals: [...all].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8),
      offers: home.offers || [],
      blogs: posts.map((p) => ({ id: String(p._id), title: p.title, slug: p.slug, excerpt: p.excerpt || '', image: p.cover?.src || null, category: p.category, publishedAt: p.publishedAt, readingMinutes: p.readingMinutes })),
      currency,
    });
  })
);

export default r;
