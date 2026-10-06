// Admin API for the admin panel and staff apps: /admin/...
//
// Roles (checked on the server for every request):
//   admin    everything
//   manager  products, categories, orders, customers, coupons, reviews, homepage
//   support  orders, customers (read) and reviews
// Every change is written to the audit log.
import { Router } from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Order from '../models/Order.js';
import User, { STAFF_ROLES, ROLES } from '../models/User.js';
import Coupon from '../models/Coupon.js';
import Review from '../models/Review.js';
import Banner from '../models/Banner.js';
import HomeContent from '../models/HomeContent.js';
import AuditLog from '../models/AuditLog.js';
import RefreshToken from '../models/RefreshToken.js';
import { requireRole, asyncHandler } from '../middleware/auth.js';
import { ORDER_STATUSES, ORDER_CANCELLED, STATUS_FROM_KEY, statusKey } from '../config/commerce.js';
import { productQuery, createProduct, updateProduct, deleteProduct } from './products.js';
import { listOrders, updateOrder } from './orders.js';
import { usersPipeline, shape, readPeriod } from './users.js';
import { publicCoupon } from '../services/coupons.js';
import { getHome } from './storefront.js';
import { slugify, escapeRegex } from '../utils.js';

const r = Router();
const MANAGE = ['manager'];
const SERVE = ['manager', 'support'];

// Any staff member may enter; each route narrows it further.
r.use(requireRole(...STAFF_ROLES.filter((x) => x !== 'admin')));

// Audit log: every successful change.
r.use((req, res, next) => {
  if (req.method === 'GET') return next();
  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    const target = (req.path.match(/[a-f0-9]{24}/i) || [])[0];
    AuditLog.create({
      actor: req.user?._id, actorEmail: req.user?.email, actorRole: req.user?.role,
      method: req.method, path: `/admin${req.path}`, status: res.statusCode, target, ip: req.ip,
    }).catch((e) => console.error('Audit log failed:', e.message));
  });
  next();
});

const page = (q, fallback = 20) => {
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || fallback, 1), 100);
  return { limit, page: Math.max(parseInt(q.page, 10) || 1, 1) };
};
const paged = (items, total, p) => ({ items, total, page: p.page, pages: Math.max(1, Math.ceil(total / p.limit)), limit: p.limit });
const validId = (id) => mongoose.isValidObjectId(id);
const bad = (res, message, errors) => res.status(400).json({ message, ...(errors && { errors }) });

// ----- products -----
r.get(
  '/products',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const { filter, sort } = await productQuery(req.query, { includeHidden: true });
    if (req.query.status === 'active') filter.published = true;
    if (req.query.status === 'draft') filter.published = false;
    if (req.query.lowStock) filter.stock = { $lte: Number(req.query.lowStock) || 5 };
    const p = page(req.query);
    const [items, total] = await Promise.all([Product.find(filter).sort(sort).skip((p.page - 1) * p.limit).limit(p.limit), Product.countDocuments(filter)]);
    res.json(paged(items, total, p));
  })
);
r.post('/products', requireRole(...MANAGE), createProduct);
r.get(
  '/products/:id',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const p = validId(req.params.id) ? await Product.findById(req.params.id) : await Product.findOne({ slug: String(req.params.id).toLowerCase() });
    if (!p) return res.status(404).json({ message: 'Product not found.' });
    res.json(p);
  })
);
r.put('/products/:id', requireRole(...MANAGE), updateProduct);
r.delete('/products/:id', requireRole(...MANAGE), deleteProduct);
// Publish or hide: { published: true|false } or { status: 'active'|'draft' }; optionally { stock }.
r.patch(
  '/products/:id/status',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const { published, status, stock } = req.body || {};
    const set = {};
    if (typeof published === 'boolean') set.published = published;
    else if (['active', 'draft'].includes(status)) set.published = status === 'active';
    if (stock !== undefined) {
      const n = parseInt(stock, 10);
      if (!(n >= 0)) return bad(res, 'Stock must be 0 or more.', [{ field: 'stock', message: 'Must be 0 or more' }]);
      set.stock = n;
    }
    if (!Object.keys(set).length) return bad(res, 'Send published (true/false), status (active/draft) or stock.');
    const p = validId(req.params.id) && (await Product.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }));
    if (!p) return res.status(404).json({ message: 'Product not found.' });
    res.json(p);
  })
);

// ----- categories -----
function readCategory(body, partial) {
  const out = {};
  const errors = [];
  if (body.name !== undefined || !partial) {
    out.name = String(body.name || '').trim().slice(0, 60);
    if (!out.name) errors.push({ field: 'name', message: 'name is required' });
  }
  if (body.slug !== undefined || (!partial && out.name)) out.slug = slugify(body.slug || out.name);
  for (const k of ['image', 'description']) if (body[k] !== undefined) out[k] = String(body[k] || '').slice(0, k === 'image' ? 500 : 400);
  if (body.sortOrder !== undefined) out.sortOrder = parseInt(body.sortOrder, 10) || 0;
  if (body.active !== undefined) out.active = !!body.active;
  return { out, errors };
}
r.get('/categories', requireRole(...MANAGE), asyncHandler(async (_req, res) => res.json(await Category.find().sort({ sortOrder: 1, name: 1 }))));
r.post(
  '/categories',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const { out, errors } = readCategory(req.body || {}, false);
    if (errors.length) return bad(res, 'Please check the category.', errors);
    res.status(201).json(await Category.create(out));
  })
);
r.put(
  '/categories/:id',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const { out, errors } = readCategory(req.body || {}, true);
    if (errors.length) return bad(res, 'Please check the category.', errors);
    const before = validId(req.params.id) && (await Category.findById(req.params.id));
    if (!before) return res.status(404).json({ message: 'Category not found.' });
    const c = await Category.findByIdAndUpdate(before._id, { $set: out }, { new: true, runValidators: true });
    // Renaming a category moves its products with it.
    if (out.name && out.name !== before.name) await Product.updateMany({ category: new RegExp(`^${escapeRegex(before.name)}$`, 'i') }, { $set: { category: out.name } });
    res.json(c);
  })
);
r.delete(
  '/categories/:id',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const c = validId(req.params.id) && (await Category.findById(req.params.id));
    if (!c) return res.status(404).json({ message: 'Category not found.' });
    const used = await Product.countDocuments({ category: new RegExp(`^${escapeRegex(c.name)}$`, 'i') });
    if (used) return res.status(409).json({ message: `${used} product(s) are in this category. Move them first, or hide the category (active: false).` });
    await c.deleteOne();
    res.json({ ok: true, message: 'Category deleted' });
  })
);

// ----- orders -----
r.get('/orders', requireRole(...SERVE), listOrders);
r.get(
  '/orders/:id',
  requireRole(...SERVE),
  asyncHandler(async (req, res) => {
    const key = String(req.params.id);
    const o = await Order.findOne(validId(key) ? { _id: key } : { orderNumber: key.toUpperCase() }).lean();
    if (!o) return res.status(404).json({ message: 'Order not found.' });
    res.json({ ...o, id: String(o._id), statusKey: statusKey(o) });
  })
);

// Status as the readable label ("Shipped") or the app key ("shipped",
// "in_transit"…), plus optional note, carrier, trackingNumber, carrierUrl, eta.
const resolveOrder = async (req, res) => {
  const key = String(req.params.id);
  const o = await Order.findOne(validId(key) ? { _id: key } : { orderNumber: key.toUpperCase() }).select('_id');
  if (!o) {
    res.status(404).json({ message: 'Order not found.' });
    return false;
  }
  req.params.id = String(o._id);
  return true;
};
r.patch(
  '/orders/:id/status',
  requireRole(...SERVE),
  asyncHandler(async (req, res, next) => {
    const raw = String(req.body?.status || '');
    const label = ORDER_STATUSES.includes(raw) ? raw : STATUS_FROM_KEY[raw.toLowerCase()];
    if (raw && !label) {
      return res.status(400).json({ code: 'INVALID_STATUS', message: `Unknown status "${raw}". Use one of: ${Object.keys(STATUS_FROM_KEY).join(', ')}.` });
    }
    if (!(await resolveOrder(req, res))) return;
    req.body = { ...req.body, ...(label && { status: label }), ...(raw.toLowerCase() === 'refunded' && { paymentStatus: 'refunded' }) };
    updateOrder(req, res, next);
  })
);
r.post(
  '/orders/:id/cancel',
  requireRole(...SERVE),
  asyncHandler(async (req, res, next) => {
    if (!(await resolveOrder(req, res))) return;
    const o = await Order.findById(req.params.id).select('status');
    if (o.status === ORDER_CANCELLED) return res.status(409).json({ message: 'This order is already cancelled.' });
    req.body = { status: ORDER_CANCELLED, note: String(req.body?.reason || req.body?.note || 'Cancelled by the house.').slice(0, 300) };
    updateOrder(req, res, next);
  })
);

// ----- customers -----
const customerOut = (u) => ({ ...shape(u), phone: u.phone || shape(u).phone, accountStatus: u.status || 'active', phoneVerified: !!u.phoneVerified });
r.get(
  '/customers',
  requireRole(...SERVE),
  asyncHandler(async (req, res) => {
    const period = readPeriod(req, res);
    if (!period) return;
    const p = page(req.query);
    const q = { role: 'customer', ...req.query };
    const [out] = await User.aggregate([...usersPipeline(q, period), { $facet: { items: [{ $skip: (p.page - 1) * p.limit }, { $limit: p.limit }], total: [{ $count: 'n' }] } }]);
    res.json(paged(out.items.map(customerOut), out.total[0]?.n || 0, p));
  })
);
r.get(
  '/customers/:id',
  requireRole(...SERVE),
  asyncHandler(async (req, res) => {
    if (!validId(req.params.id)) return res.status(404).json({ message: 'User not found.' });
    const period = readPeriod(req, res);
    if (!period) return;
    const [u] = await User.aggregate([{ $match: { _id: new mongoose.Types.ObjectId(req.params.id) } }, ...usersPipeline({}, period)]);
    if (!u) return res.status(404).json({ message: 'User not found.' });
    const orders = await Order.find({ $or: [{ user: u._id }, { 'customer.email': u.email }] }).sort({ createdAt: -1 }).lean();
    res.json({ customer: customerOut(u), orders: orders.map((o) => ({ ...o, id: String(o._id), statusKey: statusKey(o) })) });
  })
);
// Block or unblock: { status: 'active' | 'blocked' }. Blocking signs the account out everywhere.
r.patch(
  '/customers/:id/status',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const status = req.body?.status;
    if (!['active', 'blocked'].includes(status)) return bad(res, 'Status must be active or blocked.', [{ field: 'status', message: 'active or blocked' }]);
    const u = validId(req.params.id) && (await User.findById(req.params.id));
    if (!u) return res.status(404).json({ message: 'User not found.' });
    if (String(u._id) === String(req.user._id)) return res.status(409).json({ message: 'You cannot change the status of your own account.' });
    if (u.role === 'admin' && req.user.role !== 'admin') return res.status(403).json({ code: 'FORBIDDEN', message: 'Only an admin can block another admin.' });
    u.status = status;
    if (status === 'blocked') {
      u.tokenVersion = (u.tokenVersion || 0) + 1;
      await RefreshToken.updateMany({ user: u._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    }
    await u.save();
    res.json({ user: u.toSafe() });
  })
);
// Staff roles: { role: 'customer' | 'support' | 'manager' | 'admin' } (admins only).
r.patch(
  '/customers/:id/role',
  requireRole(),
  asyncHandler(async (req, res) => {
    const role = req.body?.role;
    if (!ROLES.includes(role)) return bad(res, `Role must be one of ${ROLES.join(', ')}.`, [{ field: 'role', message: ROLES.join(', ') }]);
    const u = validId(req.params.id) && (await User.findById(req.params.id));
    if (!u) return res.status(404).json({ message: 'User not found.' });
    if (String(u._id) === String(req.user._id)) return res.status(409).json({ message: 'You cannot change your own role.' });
    u.role = role;
    u.tokenVersion = (u.tokenVersion || 0) + 1; // new tokens carry the new role
    await u.save();
    res.json({ user: u.toSafe() });
  })
);

// ----- coupons -----
const money = (v) => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const o = {};
  for (const c of ['INR', 'AED']) if (v[c] !== undefined && v[c] !== null && v[c] !== '') o[c] = Math.max(0, Number(v[c]) || 0);
  return o;
};
function readCoupon(body, partial) {
  const out = {};
  const errors = [];
  if (body.code !== undefined || !partial) {
    out.code = String(body.code || '').toUpperCase().replace(/\s+/g, '').slice(0, 30);
    if (!/^[A-Z0-9_-]{3,30}$/.test(out.code)) errors.push({ field: 'code', message: '3–30 letters, digits, - or _' });
  }
  if (body.type !== undefined || !partial) {
    if (!['percent', 'fixed'].includes(body.type)) errors.push({ field: 'type', message: 'percent or fixed' });
    else out.type = body.type;
  }
  if (body.percent !== undefined) out.percent = Number(body.percent);
  for (const k of ['amount', 'maxDiscount', 'minSubtotal']) if (body[k] !== undefined) out[k] = money(body[k]);
  for (const k of ['startsAt', 'expiresAt']) {
    if (body[k] === undefined) continue;
    if (body[k] === null || body[k] === '') out[k] = null;
    else if (Number.isNaN(new Date(body[k]).getTime())) errors.push({ field: k, message: 'Invalid date' });
    else out[k] = new Date(body[k]);
  }
  for (const k of ['usageLimit', 'perUserLimit']) if (body[k] !== undefined) out[k] = body[k] === null || body[k] === '' ? null : Math.max(1, parseInt(body[k], 10) || 1);
  if (body.description !== undefined) out.description = String(body.description || '').slice(0, 200);
  if (body.active !== undefined) out.active = !!body.active;
  return { out, errors };
}
function checkCouponRules(c) {
  if (c.type === 'percent' && !(c.percent >= 1 && c.percent <= 100)) return [{ field: 'percent', message: 'Percent coupons need percent from 1 to 100' }];
  if (c.type === 'fixed' && !(c.amount?.INR || c.amount?.AED)) return [{ field: 'amount', message: 'Fixed coupons need amount.INR and/or amount.AED' }];
  if (c.startsAt && c.expiresAt && c.startsAt >= c.expiresAt) return [{ field: 'expiresAt', message: 'Must be after startsAt' }];
  return [];
}
r.get(
  '/coupons',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.active === 'true') filter.active = true;
    if (req.query.active === 'false') filter.active = false;
    if (req.query.q) filter.code = new RegExp(escapeRegex(String(req.query.q).toUpperCase().slice(0, 30)));
    const p = page(req.query, 50);
    const [items, total] = await Promise.all([Coupon.find(filter).sort({ createdAt: -1 }).skip((p.page - 1) * p.limit).limit(p.limit), Coupon.countDocuments(filter)]);
    res.json(paged(items.map(publicCoupon), total, p));
  })
);
r.post(
  '/coupons',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const { out, errors } = readCoupon(req.body || {}, false);
    errors.push(...(errors.length ? [] : checkCouponRules(out)));
    if (errors.length) return bad(res, 'Please check the coupon.', errors);
    if (await Coupon.exists({ code: out.code })) return res.status(409).json({ message: 'A coupon with this code already exists.' });
    res.status(201).json(publicCoupon(await Coupon.create(out)));
  })
);
r.get(
  '/coupons/:id',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const c = validId(req.params.id) ? await Coupon.findById(req.params.id) : await Coupon.findOne({ code: String(req.params.id).toUpperCase() });
    if (!c) return res.status(404).json({ message: 'Coupon not found.' });
    res.json(publicCoupon(c));
  })
);
r.put(
  '/coupons/:id',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const c = validId(req.params.id) && (await Coupon.findById(req.params.id));
    if (!c) return res.status(404).json({ message: 'Coupon not found.' });
    const { out, errors } = readCoupon(req.body || {}, true);
    if (errors.length) return bad(res, 'Please check the coupon.', errors);
    if (out.code && out.code !== c.code && (await Coupon.exists({ code: out.code }))) return res.status(409).json({ message: 'A coupon with this code already exists.' });
    c.set(out);
    const rules = checkCouponRules(c);
    if (rules.length) return bad(res, 'Please check the coupon.', rules);
    await c.save();
    res.json(publicCoupon(c));
  })
);
r.delete(
  '/coupons/:id',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const c = validId(req.params.id) && (await Coupon.findByIdAndDelete(req.params.id));
    if (!c) return res.status(404).json({ message: 'Coupon not found.' });
    res.json({ ok: true, message: 'Coupon deleted' });
  })
);

// ----- reviews -----
r.get(
  '/reviews',
  requireRole(...SERVE),
  asyncHandler(async (req, res) => {
    const filter = ['pending', 'approved', 'rejected'].includes(req.query.status) ? { status: req.query.status } : {};
    if (req.query.product) filter.slug = String(req.query.product).toLowerCase();
    const p = page(req.query, 50);
    const [items, total] = await Promise.all([Review.find(filter).sort({ createdAt: -1 }).skip((p.page - 1) * p.limit).limit(p.limit), Review.countDocuments(filter)]);
    res.json(paged(items, total, p));
  })
);
const setReview = (status) =>
  asyncHandler(async (req, res) => {
    const update = { status };
    if (req.body?.reply !== undefined) update.reply = String(req.body.reply).slice(0, 600);
    const review = validId(req.params.id) && (await Review.findByIdAndUpdate(req.params.id, update, { new: true }));
    if (!review) return res.status(404).json({ message: 'Review not found.' });
    res.json(review);
  });
r.patch('/reviews/:id/approve', requireRole(...SERVE), setReview('approved'));
r.patch('/reviews/:id/reject', requireRole(...SERVE), setReview('rejected'));
r.delete(
  '/reviews/:id',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const review = validId(req.params.id) && (await Review.findByIdAndDelete(req.params.id));
    if (!review) return res.status(404).json({ message: 'Review not found.' });
    res.json({ ok: true, message: 'Review deleted' });
  })
);

// ----- homepage (CMS) and banners -----
const slugList = (v) => (Array.isArray(v) ? v.map((s) => String(s).toLowerCase().trim()).filter(Boolean).slice(0, 24) : undefined);
r.get(
  '/home',
  requireRole(...MANAGE),
  asyncHandler(async (_req, res) => {
    const [home, banners] = await Promise.all([getHome(), Banner.find().sort({ placement: 1, sortOrder: 1 })]);
    res.json({ ...(home || { featuredProducts: [], collections: [], offers: [], bestsellersLimit: 8, blogsLimit: 3 }), banners });
  })
);
r.put(
  '/home',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const set = {};
    if (b.featuredProducts !== undefined) set.featuredProducts = slugList(b.featuredProducts) || [];
    if (Array.isArray(b.collections)) {
      set.collections = b.collections.slice(0, 12).map((c) => ({ title: String(c.title || '').slice(0, 80), subtitle: String(c.subtitle || '').slice(0, 200), image: c.image || undefined, link: c.link || undefined, products: slugList(c.products) || [] }));
      if (set.collections.some((c) => !c.title)) return bad(res, 'Every collection needs a title.', [{ field: 'collections[].title', message: 'required' }]);
    }
    if (Array.isArray(b.offers)) {
      set.offers = b.offers.slice(0, 12).map((o) => ({ title: String(o.title || '').slice(0, 80), text: String(o.text || '').slice(0, 240), couponCode: o.couponCode ? String(o.couponCode).toUpperCase().slice(0, 30) : undefined, image: o.image || undefined, link: o.link || undefined }));
      if (set.offers.some((o) => !o.title)) return bad(res, 'Every offer needs a title.', [{ field: 'offers[].title', message: 'required' }]);
    }
    for (const k of ['bestsellersLimit', 'blogsLimit']) if (b[k] !== undefined) set[k] = Math.min(Math.max(parseInt(b[k], 10) || 0, 0), k === 'blogsLimit' ? 12 : 24);
    const home = await HomeContent.findOneAndUpdate({ key: 'home' }, { $set: set, $setOnInsert: { key: 'home' } }, { new: true, upsert: true, runValidators: true });
    res.json(home);
  })
);

function readBanner(body, partial) {
  const out = {};
  const errors = [];
  if (body.image !== undefined || !partial) {
    out.image = String(body.image || '').trim().slice(0, 500);
    if (!out.image) errors.push({ field: 'image', message: 'image is required' });
  }
  for (const [k, max] of [['title', 120], ['subtitle', 240], ['mobileImage', 500], ['link', 500], ['buttonLabel', 40]]) if (body[k] !== undefined) out[k] = String(body[k] || '').slice(0, max);
  if (body.placement !== undefined) {
    if (!['hero', 'strip', 'offer'].includes(body.placement)) errors.push({ field: 'placement', message: 'hero, strip or offer' });
    else out.placement = body.placement;
  }
  if (body.sortOrder !== undefined) out.sortOrder = parseInt(body.sortOrder, 10) || 0;
  if (body.active !== undefined) out.active = !!body.active;
  for (const k of ['startsAt', 'endsAt']) {
    if (body[k] === undefined) continue;
    if (body[k] === null || body[k] === '') out[k] = null;
    else if (Number.isNaN(new Date(body[k]).getTime())) errors.push({ field: k, message: 'Invalid date' });
    else out[k] = new Date(body[k]);
  }
  return { out, errors };
}
r.get('/banners', requireRole(...MANAGE), asyncHandler(async (_req, res) => res.json(await Banner.find().sort({ placement: 1, sortOrder: 1 }))));
r.post(
  '/banners',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const { out, errors } = readBanner(req.body || {}, false);
    if (errors.length) return bad(res, 'Please check the banner.', errors);
    res.status(201).json(await Banner.create(out));
  })
);
r.put(
  '/banners/:id',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const { out, errors } = readBanner(req.body || {}, true);
    if (errors.length) return bad(res, 'Please check the banner.', errors);
    const b = validId(req.params.id) && (await Banner.findByIdAndUpdate(req.params.id, { $set: out }, { new: true, runValidators: true }));
    if (!b) return res.status(404).json({ message: 'Banner not found.' });
    res.json(b);
  })
);
r.delete(
  '/banners/:id',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const b = validId(req.params.id) && (await Banner.findByIdAndDelete(req.params.id));
    if (!b) return res.status(404).json({ message: 'Banner not found.' });
    res.json({ ok: true, message: 'Banner deleted' });
  })
);

// ----- audit log (admins) -----
r.get(
  '/audit-logs',
  requireRole(),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.actor && validId(req.query.actor)) filter.actor = req.query.actor;
    if (req.query.target) filter.target = String(req.query.target);
    const p = page(req.query, 50);
    const [items, total] = await Promise.all([AuditLog.find(filter).sort({ createdAt: -1 }).skip((p.page - 1) * p.limit).limit(p.limit), AuditLog.countDocuments(filter)]);
    res.json(paged(items, total, p));
  })
);

export default r;
