import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { requireAdmin, asyncHandler } from '../middleware/auth.js';
import { periodRange, describeFilters } from '../services/filters.js';
import { newWorkbook, addTableSheet, addNotesSheet, sendWorkbook, fileName, tzLabel } from '../services/excel.js';
import { escapeRegex } from '../utils.js';

// Admin → Users. Registered accounts with their orders, linked the same way
// as the customer's own "My orders" page: orders placed while signed in to
// the account, plus orders placed with the account's email. Password hashes
// and tokens are never selected.
const r = Router();
r.use(requireAdmin);

const ORDER_FIELDS = { _id: 1, orderNumber: 1, createdAt: 1, total: 1, currency: 1, status: 1, paymentStatus: 1, 'customer.phone': 1, 'customer.address': 1 };
const SORTS = { createdAt: 'createdAt', name: 'name', email: 'email', orders: 'lifetime.orders', lastOrder: 'lifetime.last', periodOrders: 'period.orders' };

const sumCur = (list, cur) => ({ $sum: { $map: { input: { $filter: { input: list, cond: { $eq: ['$$this.currency', cur] } } }, in: '$$this.total' } } });
const stats = (list) => ({
  orders: { $size: list },
  value: { INR: sumCur(list, 'INR'), AED: sumCur(list, 'AED') },
  first: { $min: `${list}.createdAt` },
  last: { $max: `${list}.createdAt` },
});

// Builds the users pipeline with lifetime and selected-period order stats.
export function usersPipeline(q, period) {
  const match = {};
  if (['customer', 'admin', 'manager', 'support'].includes(q.role)) match.role = q.role;
  if (['active', 'blocked'].includes(q.status)) match.status = q.status === 'active' ? { $ne: 'blocked' } : 'blocked';
  const text = String(q.q || '').trim().slice(0, 80);
  if (text) {
    const rx = new RegExp(escapeRegex(text), 'i');
    match.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    if (mongoose.isValidObjectId(text)) match.$or.push({ _id: new mongoose.Types.ObjectId(text) });
  }
  const inPeriod = [];
  if (period.from) inPeriod.push({ $gte: ['$$this.createdAt', period.from] });
  if (period.to) inPeriod.push({ $lt: ['$$this.createdAt', period.to] });
  if (q.activity === 'registered') {
    match.createdAt = {};
    if (period.from) match.createdAt.$gte = period.from;
    if (period.to) match.createdAt.$lt = period.to;
    if (!period.from && !period.to) delete match.createdAt;
  }

  const pipeline = [
    { $match: match },
    { $project: { passwordHash: 0 } },
    { $lookup: { from: 'orders', localField: '_id', foreignField: 'user', as: 'o1', pipeline: [{ $project: ORDER_FIELDS }] } },
    { $lookup: { from: 'orders', localField: 'email', foreignField: 'customer.email', as: 'o2', pipeline: [{ $project: ORDER_FIELDS }] } },
    { $addFields: { orders: { $setUnion: ['$o1', '$o2'] } } },
    { $addFields: { periodOrders: inPeriod.length ? { $filter: { input: '$orders', cond: { $and: inPeriod } } } : '$orders' } },
    {
      $addFields: {
        lifetime: stats('$orders'),
        period: stats('$periodOrders'),
        latest: { $first: { $sortArray: { input: '$orders', sortBy: { createdAt: -1 } } } },
      },
    },
    { $project: { o1: 0, o2: 0, orders: 0, periodOrders: 0 } },
  ];
  if (q.activity === 'ordered') pipeline.push({ $match: { 'period.orders': { $gt: 0 } } });
  if (q.activity === 'none') pipeline.push({ $match: { 'lifetime.orders': 0 } });
  const sortKey = SORTS[q.sort] || 'createdAt';
  const dir = q.dir === 'asc' ? 1 : -1;
  pipeline.push({ $sort: { [sortKey]: dir, _id: dir } });
  return pipeline;
}

// Only non-sensitive fields leave the server.
export const shape = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.lifetime?.orders ? 'Customer (has ordered)' : 'Registered (no orders yet)',
  createdAt: u.createdAt,
  phone: u.latest?.customer?.phone || '',
  address: u.latest?.customer?.address || null,
  lifetime: u.lifetime,
  period: u.period,
});

export function readPeriod(req, res) {
  try {
    return periodRange(req.query);
  } catch (e) {
    res.status(e.status || 400).json({ message: e.message });
    return null;
  }
}

r.get(
  '/',
  asyncHandler(async (req, res) => {
    const period = readPeriod(req, res);
    if (!period) return;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const [out] = await User.aggregate([
      ...usersPipeline(req.query, period),
      { $facet: { items: [{ $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: 'n' }] } },
    ]);
    const total = out.total[0]?.n || 0;
    res.json({ items: out.items.map(shape), total, page, pages: Math.max(1, Math.ceil(total / limit)), limit, period: { key: period.key, label: period.label } });
  })
);

// One user with every order (the same list they see under My orders).
r.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'User not found.' });
    const period = readPeriod(req, res);
    if (!period) return;
    const [u] = await User.aggregate([{ $match: { _id: new mongoose.Types.ObjectId(req.params.id) } }, ...usersPipeline({}, period)]);
    if (!u) return res.status(404).json({ message: 'User not found.' });
    const orders = await Order.find({ $or: [{ user: u._id }, { 'customer.email': u.email }] }).sort({ createdAt: -1 }).lean();
    res.json({ user: { ...shape(u), updatedAt: u.updatedAt }, orders, period: { key: period.key, label: period.label } });
  })
);

// Users report: "Users Summary" (one row per user, selected-period and
// lifetime figures side by side) and "User Orders" (one row per item of each
// order in the period, linked user → order → item → product by id).
r.get(
  '/export/xlsx',
  asyncHandler(async (req, res) => {
    const period = readPeriod(req, res);
    if (!period) return;
    const tz = period.tz;
    const users = await User.aggregate(usersPipeline(req.query, period)); // read-only

    const ids = users.map((u) => u._id);
    const byEmail = new Map(users.map((u) => [u.email, u]));
    const byId = new Map(users.map((u) => [String(u._id), u]));
    const orderMatch = { $or: [{ user: { $in: ids } }, { 'customer.email': { $in: [...byEmail.keys()] } }] };
    if (period.from || period.to) {
      orderMatch.createdAt = {};
      if (period.from) orderMatch.createdAt.$gte = period.from;
      if (period.to) orderMatch.createdAt.$lt = period.to;
    }
    const orders = ids.length ? await Order.find(orderMatch).sort({ createdAt: -1 }).lean() : [];
    const productIds = [...new Set(orders.flatMap((o) => o.items.map((i) => String(i.product || ''))).filter(Boolean))];
    const products = new Map((await Product.find({ _id: { $in: productIds } }).select('name slug').lean()).map((p) => [String(p._id), p]));

    const orderRows = [];
    for (const o of orders) {
      // An order belongs to the account it was placed under and to the
      // account with its email (usually the same one).
      const owners = new Map();
      if (o.user && byId.has(String(o.user))) owners.set(String(o.user), byId.get(String(o.user)));
      const e = byEmail.get(o.customer?.email);
      if (e) owners.set(String(e._id), e);
      for (const u of owners.values()) {
        for (const i of o.items) {
          const p = products.get(String(i.product));
          orderRows.push({
            userId: String(u._id), userName: u.name, orderNumber: o.orderNumber, createdAt: o.createdAt,
            productId: i.product ? String(i.product) : '', product: p?.name || i.name, sku: p?.slug || i.slug,
            qty: i.qty, unitPrice: i.unitPrice, lineTotal: (i.unitPrice || 0) * (i.qty || 0), orderTotal: o.total,
            currency: o.currency, paymentStatus: o.paymentStatus, status: o.status,
          });
        }
      }
    }

    const generated = new Date();
    const meta = [
      ['Report period', `${period.label} (applies to "Period" columns and to the User Orders sheet)`],
      ['Filters', describeFilters(req.query)],
      ['Users', users.length],
      ['Generated', `${generated.toISOString().slice(0, 16).replace('T', ' ')} UTC by ${req.user.name}`],
      ['Times shown in', tzLabel(tz)],
    ];
    const wb = newWorkbook();
    addTableSheet(wb, 'Users Summary', {
      title: 'Users summary',
      meta,
      tz,
      columns: [
        { key: 'id', header: 'User ID', width: 26, freeze: true },
        { key: 'name', header: 'Name', width: 22 },
        { key: 'email', header: 'Email', width: 30 },
        { key: 'phone', header: 'Phone (latest order)', width: 18 },
        { key: 'city', header: 'City (latest order)', width: 16 },
        { key: 'country', header: 'Country (latest order)', width: 18 },
        { key: 'createdAt', header: 'Registration Date', type: 'date', width: 16 },
        { key: 'role', header: 'Role', width: 10 },
        { key: 'status', header: 'Status', width: 24 },
        { key: 'pOrders', header: 'Period Orders', type: 'int', width: 12 },
        { key: 'pINR', header: 'Period Order Value (INR)', type: 'money', currencyKey: 'inr', width: 18 },
        { key: 'pAED', header: 'Period Order Value (AED)', type: 'money', currencyKey: 'aed', width: 18 },
        { key: 'lOrders', header: 'Lifetime Orders', type: 'int', width: 12 },
        { key: 'lINR', header: 'Lifetime Order Value (INR)', type: 'money', currencyKey: 'inr', width: 18 },
        { key: 'lAED', header: 'Lifetime Order Value (AED)', type: 'money', currencyKey: 'aed', width: 18 },
        { key: 'first', header: 'First Order Date', type: 'date', width: 16 },
        { key: 'last', header: 'Last Order Date', type: 'date', width: 16 },
      ],
      rows: users.map((u) => {
        const s = shape(u);
        return {
          id: String(s.id), name: s.name, email: s.email, phone: s.phone, city: s.address?.city, country: s.address?.country,
          createdAt: s.createdAt, role: s.role, status: s.status,
          pOrders: s.period.orders, pINR: s.period.value.INR, pAED: s.period.value.AED,
          lOrders: s.lifetime.orders, lINR: s.lifetime.value.INR, lAED: s.lifetime.value.AED,
          first: s.lifetime.first, last: s.lifetime.last, inr: 'INR', aed: 'AED',
        };
      }),
    });
    addTableSheet(wb, 'User Orders', {
      title: `User orders · ${period.label}`,
      meta: [['Report period', period.label], ['Rows', 'One row per item of each order placed in the period']],
      tz,
      columns: [
        { key: 'userId', header: 'User ID', width: 26, freeze: true },
        { key: 'userName', header: 'User Name', width: 22 },
        { key: 'orderNumber', header: 'Order ID', width: 14 },
        { key: 'createdAt', header: 'Order Date', type: 'datetime', width: 18 },
        { key: 'productId', header: 'Product ID', width: 26 },
        { key: 'sku', header: 'Product Code', width: 14 },
        { key: 'product', header: 'Product', width: 22 },
        { key: 'qty', header: 'Quantity', type: 'int', width: 10 },
        { key: 'unitPrice', header: 'Unit Price', type: 'money', width: 14 },
        { key: 'lineTotal', header: 'Line Total', type: 'money', width: 14 },
        { key: 'orderTotal', header: 'Order Total', type: 'money', width: 14 },
        { key: 'currency', header: 'Currency', width: 10 },
        { key: 'paymentStatus', header: 'Payment Status', width: 15 },
        { key: 'status', header: 'Order / Delivery Status', width: 20 },
      ],
      rows: orderRows,
    });
    addNotesSheet(wb, 'About this report', 'About this report', [
      'Period vs lifetime:',
      `"Period" columns count only orders placed in the report period (${period.label}). "Lifetime" columns count every order the user has ever placed.`,
      '',
      'How orders are linked:',
      'An order belongs to a user when it was placed while signed in to their account, or with their account email, exactly as on the customer\'s My orders page. Products are matched by product ID; the product code and name come from the catalogue (or the name at the time of the order if the product was removed).',
      '',
      'Order value:',
      'The sum of order totals (including delivery), kept separate for INR and AED.',
      '',
      'Phone and city:',
      'Accounts store only name and email, so phone and address come from the user\'s most recent order.',
      '',
      'Privacy:',
      'Passwords, password hashes and sign-in tokens are never included.',
    ]);
    await sendWorkbook(res, wb, fileName('users', period));
  })
);

export default r;
