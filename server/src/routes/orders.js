import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import OrderImport from '../models/OrderImport.js';
import Address from '../models/Address.js';
import { optionalAuth, requireAuth, requireAdmin, asyncHandler, isAdminSession } from '../middleware/auth.js';
import { ORDER_STAGES, ORDER_STATUSES, ORDER_CANCELLED, REGIONS, shippingFor, statusKey } from '../config/commerce.js';
import { discountFor, releaseCoupon } from '../services/coupons.js';
import { placeOrder } from '../services/placeOrder.js';
import { reserve, release } from '../services/orderStock.js';
import { razorpayConfigured, ONLINE_CURRENCIES } from '../services/razorpay.js';
import { orderFilter, describeFilters } from '../services/filters.js';
import { shipmentView, freshen, orderReady, cancelShipmentFor } from '../services/shipping.js';
import { newWorkbook, addTableSheet, sendWorkbook, fileName, tzLabel } from '../services/excel.js';
import { buildOrdersWorkbook, buildTemplate, readOrderSheet, planOrderImport, applyOrderChanges, MAX_IMPORT_ROWS } from '../services/orderSheet.js';

const r = Router();
const placeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, message: { message: 'Too many orders from this connection. Please try again in a few minutes, or order on WhatsApp.' } });

// The delivery details for an order placed from the app: a saved address
// (addressId), else the default saved address, else the account's address.
export async function checkoutTarget(user, { addressId, customer, region } = {}) {
  let addr = null;
  if (addressId) {
    addr = mongoose.isValidObjectId(addressId) ? await Address.findOne({ _id: addressId, user: user._id }) : null;
    if (!addr) throw Object.assign(new Error('That address is not in your address book.'), { status: 404, code: 'ADDRESS_NOT_FOUND' });
  } else if (!customer) {
    addr = await Address.findOne({ user: user._id }).sort({ isDefault: -1, updatedAt: -1 });
  }
  if (addr) {
    return {
      regionCode: addr.countryCode,
      customer: {
        name: addr.fullName, email: user.email, phone: addr.phone,
        address: { line1: addr.addressLine1, line2: addr.addressLine2, city: addr.city, state: addr.state, postalCode: addr.postalCode },
      },
    };
  }
  const a = user.address || {};
  return {
    regionCode: region || a.region || 'IN',
    customer: customer || { name: user.name, email: user.email, phone: user.phone, address: { line1: a.line1, line2: a.line2, city: a.city, state: a.state, postalCode: a.postalCode } },
  };
}

// Place an order. Prices are always recalculated from the database.
// Website / guests: { items, customer, region, paymentMethod, giftNote, couponCode }.
// App (signed in): { addressId, paymentMethod, couponCode, giftNote }: the
// items come from the account's bag, which is emptied once the order is placed.
r.post(
  '/',
  placeLimiter,
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { paymentMethod, giftNote, couponCode, expectedTotal } = req.body || {};
    let { items = [], customer, region: regionCode = 'IN' } = req.body || {};
    const fromCart = !items.length && !!req.user;
    try {
      if (fromCart) {
        items = req.user.cart.map((i) => ({ slug: i.slug, qty: i.qty }));
        ({ customer, regionCode } = await checkoutTarget(req.user, { addressId: req.body?.addressId, customer, region: req.body?.region }));
      }
      const order = await placeOrder({ items, customer, regionCode, paymentMethod, giftNote, couponCode, expectedTotal, userId: req.user?._id });
      // Paid online: the bag empties once the payment is confirmed.
      if (fromCart && order.paymentHold) {
        await Order.updateOne({ _id: order._id }, { $set: { clearBagOnPay: true } });
      } else if (fromCart) {
        req.user.cart = [];
        await req.user.save();
      }
      res.status(201).json({
        orderNumber: order.orderNumber, trackingId: order.trackingId, total: order.total, currency: order.currency,
        ...(order.paymentHold && { paymentRequired: true }),
        ...(req.apiV1 && { order: customerView(order.toObject()) }),
      });
    } catch (e) {
      if (e.status) return res.status(e.status).json({ code: e.code, message: e.message, ...(e.total !== undefined && { total: e.total }) });
      throw e;
    }
  })
);

// A customer's orders: placed while signed in, or with their account email.
const ownedBy = (user) => ({ $or: [{ user: user._id }, { 'customer.email': user.email }] });
const STATUS_KEY_OF_LABEL = { 'Order Placed': 'placed', Confirmed: 'confirmed', Packed: 'packed', Shipped: 'shipped', 'Out for Delivery': 'out_for_delivery', Delivered: 'delivered', Cancelled: 'cancelled' };

// Until an order ships the customer can correct the delivery details and
// the gift card, or cancel it. Quantities can change only before it is
// packed, and only while it is unpaid (a paid order would need a refund).
const DETAILS_EDITABLE = ['Order Placed', 'Confirmed', 'Packed'];
const ITEMS_EDITABLE = ['Order Placed', 'Confirmed'];
// Once Delhivery has the parcel booked, its address and contents are fixed
// there, so they can no longer change here (cancelling is still possible).
const booked = (o) => !!(o.shipment?.awb && !['cancelled', 'failed'].includes(o.shipment.status));
const canEdit = (o) => ({
  details: DETAILS_EDITABLE.includes(o.status) && !booked(o),
  items: ITEMS_EDITABLE.includes(o.status) && o.paymentStatus !== 'paid' && !booked(o),
  cancel: DETAILS_EDITABLE.includes(o.status) && !['picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'rto', 'returned'].includes(o.shipment?.status),
});

// What a customer may see of their own order. Internal notes, the linked
// account id and courier links stay with the team.
export function customerView(o) {
  const region = REGIONS.find((x) => x.ships && x.currency === o.currency);
  return {
    _id: o._id,
    id: String(o._id),
    orderNumber: o.orderNumber,
    trackingId: o.trackingId,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    status: o.status,
    statusKey: statusKey(o),
    stages: ORDER_STAGES,
    history: (o.history || []).map((h) => ({ status: h.status, at: h.at, note: h.note })),
    items: (o.items || []).map((i) => ({ slug: i.slug, name: i.name, image: i.image, qty: i.qty, unitPrice: i.unitPrice, lineTotal: (i.unitPrice || 0) * (i.qty || 0) })),
    currency: o.currency,
    taxLabel: region?.taxLabel || '',
    subtotal: o.subtotal,
    discount: o.discount || 0,
    couponCode: o.coupon?.code || null,
    tax: 0, // prices include tax (see taxLabel)
    shipping: o.shipping,
    total: o.total,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    refunded: (o.payment?.refundedAmount || 0) / 100,
    tracking: { carrier: o.carrier || '', trackingNumber: o.trackingNumber || '', status: statusKey(o), eta: o.eta || '' },
    // Courier shipment (Delhivery): status, AWB, timeline. null until one exists.
    shipment: shipmentView(o),
    customer: { name: o.customer?.name, email: o.customer?.email, phone: o.customer?.phone, address: o.customer?.address },
    giftNote: o.giftNote?.enabled ? { enabled: true, name: o.giftNote.name, occasion: o.giftNote.occasion, message: o.giftNote.message } : { enabled: false },
    carrier: o.carrier || '',
    trackingNumber: o.trackingNumber || '',
    eta: o.eta || '',
    editable: canEdit(o),
    // Online payment can be started (POST /payments/razorpay/order).
    canPayOnline: razorpayConfigured() && ONLINE_CURRENCIES.includes(o.currency) && o.paymentStatus === 'pending' && o.status !== 'Cancelled',
    edits: (o.edits || []).map((e) => ({ at: e.at, summary: e.summary })),
  };
}

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
      trackingNumber: order.trackingNumber,
      eta: order.eta,
      items: order.items.map((i) => ({ slug: i.slug, name: i.name, qty: i.qty, image: i.image })),
      city: order.customer.address.city,
      country: order.customer.address.country,
      createdAt: order.createdAt,
      shipment: shipmentView(order),
    });
  })
);

r.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orders = await Order.find(ownedBy(req.user)).sort({ createdAt: -1 }).lean();
    res.json(orders.map(customerView));
  })
);

// ----- admin -----
// Filters: status, paymentStatus, currency, product, customer (user id), q,
// period (24h, 1d, 7d, 1m, 2m, 3m, custom + from/to, all) and tz.
// Without `paged=1` it returns the latest 200 as a plain array, as before.
const httpError = (res, e) => (e.status ? res.status(e.status).json({ message: e.message }) : null);

// Customers: their order history (GET /orders in the app contract).
// Admins: every order, with the filters above.
r.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res, next) => {
    if (isAdminSession(req)) return next();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const filter = ownedBy(req.user);
    const [orders, total] = await Promise.all([Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Order.countDocuments(filter)]);
    res.json({ items: orders.map(customerView), total, page, pages: Math.max(1, Math.ceil(total / limit)), limit, message: 'Orders fetched successfully' });
  })
);

export const listOrders = asyncHandler(async (req, res) => {
    let filter;
    try {
      ({ filter } = await orderFilter(req.query));
    } catch (e) {
      if (httpError(res, e)) return;
      throw e;
    }
    if (req.query.paged !== '1' && !req.apiV1) return res.json(await Order.find(filter).sort({ createdAt: -1 }).limit(200));
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const [items, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Order.countDocuments(filter),
    ]);
    res.json({ items: items.map((o) => ({ ...o, id: String(o._id), statusKey: statusKey(o) })), total, page, pages: Math.max(1, Math.ceil(total / limit)), limit });
});
r.get('/', requireAdmin, listOrders);

// The house places an order for a customer (phone or WhatsApp orders). Same
// pricing and stock rules as the checkout; linked to their account by email.
r.post(
  '/admin',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { items, customer, region, paymentMethod, paymentStatus, giftNote, notes } = req.body || {};
    const email = String(customer?.email || '').toLowerCase().trim();
    const account = email ? await User.findOne({ email }).select('_id') : null;
    try {
      const order = await placeOrder({
        items, customer: { ...customer, email }, regionCode: region, paymentMethod, giftNote,
        userId: account?._id, historyNote: 'Order placed by the house on your behalf.',
      });
      if (paymentStatus === 'paid' || notes) {
        if (paymentStatus === 'paid') order.paymentStatus = 'paid';
        if (notes) order.notes = String(notes).slice(0, 2000);
        await order.save();
      }
      res.status(201).json(order);
    } catch (e) {
      if (httpError(res, e)) return;
      throw e;
    }
  })
);

// ----- Excel: export, template, import (preview → confirm) and history -----
r.get(
  '/export',
  requireAdmin,
  asyncHandler(async (req, res) => {
    let filter, period;
    try {
      ({ filter, period } = await orderFilter(req.query));
    } catch (e) {
      if (httpError(res, e)) return;
      throw e;
    }
    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean(); // read-only
    const tz = period.tz;
    const generated = new Date();
    const meta = [
      ['Report period', period.label],
      ['Filters', describeFilters(req.query)],
      ['Orders', orders.length],
      ['Generated', `${generated.toISOString().slice(0, 16).replace('T', ' ')} UTC by ${req.user.name}`],
      ['Times shown in', tzLabel(tz)],
    ];
    const wb = newWorkbook();
    buildOrdersWorkbook(wb, orders, { title: 'Orders', meta, tz });

    // Summary and one-row-per-item detail sheets for reporting.
    const by = (key) => Object.entries(orders.reduce((m, o) => ((m[o[key]] = (m[o[key]] || 0) + 1), m), {}));
    const value = orders.reduce((m, o) => ((m[o.currency] = (m[o.currency] || 0) + (o.total || 0)), m), {});
    addTableSheet(wb, 'Summary', {
      title: 'Orders summary',
      meta,
      columns: [
        { key: 'group', header: 'Group', width: 18 },
        { key: 'label', header: 'Value', width: 22 },
        { key: 'count', header: 'Orders', type: 'int', width: 10 },
        { key: 'amount', header: 'Order value', type: 'money', width: 18 },
      ],
      rows: [
        ...by('status').map(([label, count]) => ({ group: 'Order status', label, count })),
        ...by('paymentStatus').map(([label, count]) => ({ group: 'Payment status', label, count })),
        ...Object.entries(value).map(([cur, amount]) => ({ group: 'Order value', label: cur, count: orders.filter((o) => o.currency === cur).length, amount, currency: cur })),
      ],
      tz,
    });
    addTableSheet(wb, 'Order Items', {
      title: 'Order items',
      meta: [['Report period', period.label]],
      columns: [
        { key: 'orderNumber', header: 'Order ID', width: 14, freeze: true },
        { key: 'createdAt', header: 'Order Date', type: 'datetime', width: 18 },
        { key: 'customer', header: 'Customer', width: 22 },
        { key: 'productId', header: 'Product ID', width: 26 },
        { key: 'slug', header: 'Product Code', width: 14 },
        { key: 'name', header: 'Product', width: 22 },
        { key: 'qty', header: 'Quantity', type: 'int', width: 10 },
        { key: 'unitPrice', header: 'Unit Price', type: 'money', width: 14 },
        { key: 'lineTotal', header: 'Line Total', type: 'money', width: 14 },
        { key: 'currency', header: 'Currency', width: 10 },
        { key: 'paymentStatus', header: 'Payment Status', width: 15 },
        { key: 'status', header: 'Order Status', width: 17 },
      ],
      rows: orders.flatMap((o) =>
        (o.items || []).map((i) => ({
          orderNumber: o.orderNumber, createdAt: o.createdAt, customer: o.customer?.name, productId: i.product ? String(i.product) : '',
          slug: i.slug, name: i.name, qty: i.qty, unitPrice: i.unitPrice, lineTotal: (i.unitPrice || 0) * (i.qty || 0),
          currency: o.currency, paymentStatus: o.paymentStatus, status: o.status,
        }))
      ),
      tz,
    });
    await sendWorkbook(res, wb, fileName('orders', period));
  })
);

r.get(
  '/template',
  requireAdmin,
  asyncHandler(async (req, res) => {
    // ?prefill=1 (+ the order filters): one row per matching order, gold columns blank.
    if (req.query.prefill !== '1') return sendWorkbook(res, buildTemplate(newWorkbook()), 'orders_update_template.xlsx');
    let filter, period;
    try {
      ({ filter, period } = await orderFilter(req.query));
    } catch (e) {
      if (httpError(res, e)) return;
      throw e;
    }
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(MAX_IMPORT_ROWS).lean();
    const filters = describeFilters(req.query);
    const scope = `the orders from ${period.label.toLowerCase()}${filters === 'none' ? '' : ` (${filters})`}`;
    await sendWorkbook(res, buildTemplate(newWorkbook(), { orders, tz: period.tz, scope }), fileName('orders_update_template', period));
  })
);

const sheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /\.xlsx$/i.test(file.originalname)),
});
const receiveSheet = (req, res, next) =>
  sheetUpload.single('file')(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'That file is larger than 4 MB. Split it into smaller files.' });
    next(err);
  });

const PREVIEW_TTL = 60 * 60 * 1000; // a preview can be confirmed for one hour
const MAX_LISTED = 1000; // issues and changes sent to the screen; the rest are in the error report

function importSummary(job, { full = false } = {}) {
  const j = job.toObject ? job.toObject() : job;
  return {
    id: j._id,
    fileName: j.fileName,
    fileSize: j.fileSize,
    sheetName: j.sheetName,
    status: j.status,
    admin: { name: j.adminName, email: j.adminEmail },
    totals: j.totals,
    createdAt: j.createdAt,
    committedAt: j.committedAt,
    transactional: j.transactional,
    error: j.error,
    ...(full && {
      errors: (j.rowErrors || []).slice(0, MAX_LISTED),
      errorsTotal: (j.rowErrors || []).length,
      warnings: (j.rowWarnings || []).slice(0, MAX_LISTED),
      changes: (j.changes || []).slice(0, MAX_LISTED).map((c) => ({ row: c.row, orderNumber: c.orderNumber, diffs: c.diffs })),
      changesTotal: (j.changes || []).length,
      expiresAt: j.status === 'previewed' ? new Date(new Date(j.createdAt).getTime() + PREVIEW_TTL) : undefined,
    }),
  };
}

// Step 1: upload → validate → preview. Nothing in the orders changes here.
r.post(
  '/import/preview',
  requireAdmin,
  receiveSheet,
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Choose an Excel file (.xlsx) to upload.' });
    let sheet;
    try {
      sheet = await readOrderSheet(req.file.buffer);
    } catch (e) {
      if (httpError(res, e)) return;
      throw e;
    }
    const EMPTY = 'Add a row for each order you want to update: its Order ID, plus the new values in the gold columns. Then upload the file again.';
    if (!sheet.rows.length) return res.status(400).json({ message: `No orders found in this file. ${EMPTY}` });
    const plan = await planOrderImport(sheet);
    if (plan.samples === sheet.rows.length) return res.status(400).json({ message: `This is the blank template (it only has the sample row). ${EMPTY}` });
    if (sheet.unknown.length) {
      plan.warnings.unshift({ row: sheet.headerRow, orderId: '', field: '', message: `These columns are not recognised and were ignored: ${sheet.unknown.join(', ')}.` });
    }
    const job = await OrderImport.create({
      admin: req.user._id,
      adminName: req.user.name,
      adminEmail: req.user.email,
      fileName: String(req.file.originalname).slice(0, 200),
      fileSize: req.file.size,
      sheetName: sheet.sheetName,
      totals: { rows: sheet.rows.length, updated: 0, created: 0, failed: new Set(plan.errors.map((e) => e.row)).size, skipped: plan.unchanged + plan.samples, warnings: plan.warnings.length },
      changes: plan.changes,
      rowErrors: plan.errors,
      rowWarnings: plan.warnings,
    });
    res.status(201).json(importSummary(job, { full: true }));
  })
);

// Step 2: confirm → write to the database.
r.post(
  '/imports/:id/commit',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const job = await OrderImport.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Import not found.' });
    if (job.status !== 'previewed') return res.status(409).json({ message: `This import is already ${job.status}.` });
    if (Date.now() - job.createdAt.getTime() > PREVIEW_TTL) {
      job.status = 'expired';
      await job.save();
      return res.status(410).json({ message: 'This preview is more than an hour old. Upload the file again to check it against the latest orders.' });
    }
    // Claim the job so a double click cannot apply it twice.
    const claimed = await OrderImport.updateOne({ _id: job._id, status: 'previewed' }, { $set: { status: 'committed', committedAt: new Date() } });
    if (!claimed.modifiedCount) return res.status(409).json({ message: 'This import is already being applied.' });
    try {
      const { updated, conflicts, transactional } = await applyOrderChanges(job.changes);
      job.status = 'committed';
      job.committedAt = new Date();
      job.transactional = transactional;
      job.totals.updated = updated;
      job.totals.failed += conflicts.length;
      job.rowErrors.push(...conflicts);
      for (const c of job.changes) c.patch = undefined;
      job.markModified('changes');
      await job.save();
      res.json(importSummary(job, { full: true }));
    } catch (e) {
      job.status = 'failed';
      job.error = 'The update could not be completed. Export the orders again to check their current state before retrying.';
      await job.save();
      throw e;
    }
  })
);

r.post(
  '/imports/:id/cancel',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const job = await OrderImport.findOneAndUpdate({ _id: req.params.id, status: 'previewed' }, { $set: { status: 'cancelled' }, $unset: { changes: 1 } }, { new: true });
    if (!job) return res.status(409).json({ message: 'This import can no longer be cancelled.' });
    res.json(importSummary(job));
  })
);

r.get(
  '/imports',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const jobs = await OrderImport.find().sort({ createdAt: -1 }).limit(limit).select('-changes -rowErrors -rowWarnings').lean();
    res.json(jobs.map((j) => importSummary(j)));
  })
);

r.get(
  '/imports/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const job = await OrderImport.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ message: 'Import not found.' });
    res.json(importSummary(job, { full: true }));
  })
);

// Every error, warning and change of one import, as a workbook.
r.get(
  '/imports/:id/report',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const job = await OrderImport.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ message: 'Import not found.' });
    const wb = newWorkbook();
    const meta = [['File', job.fileName], ['Uploaded', `${job.createdAt.toISOString().slice(0, 16).replace('T', ' ')} UTC by ${job.adminName}`], ['Status', job.status]];
    const issueCols = [
      { key: 'row', header: 'Excel Row', type: 'int', width: 10 },
      { key: 'orderId', header: 'Order ID', width: 14 },
      { key: 'field', header: 'Column', width: 20 },
      { key: 'message', header: 'Problem', width: 90, wrap: true },
    ];
    addTableSheet(wb, 'Errors', { title: 'Rows that were not applied', meta, columns: issueCols, rows: job.rowErrors || [] });
    addTableSheet(wb, 'Warnings', { title: 'Warnings', meta, columns: issueCols, rows: job.rowWarnings || [] });
    addTableSheet(wb, 'Changes', {
      title: job.status === 'committed' ? 'Changes applied' : 'Changes in the preview',
      meta,
      columns: [
        { key: 'row', header: 'Excel Row', type: 'int', width: 10 },
        { key: 'orderNumber', header: 'Order ID', width: 14 },
        { key: 'field', header: 'Column', width: 22 },
        { key: 'from', header: 'Before', width: 36, wrap: true },
        { key: 'to', header: 'After', width: 36, wrap: true },
      ],
      rows: (job.changes || []).flatMap((c) => c.diffs.map((d) => ({ row: c.row, orderNumber: c.orderNumber, ...d }))),
    });
    await sendWorkbook(res, wb, `import_report_${String(job._id).slice(-6)}.xlsx`);
  })
);

r.get(
  '/stats',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [byStatus, revenue, count] = await Promise.all([
      Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Order.aggregate([{ $match: { status: { $ne: ORDER_CANCELLED } } }, { $group: { _id: '$currency', total: { $sum: '$total' } } }]),
      Order.countDocuments(),
    ]);
    res.json({ byStatus, revenue, count, stages: ORDER_STAGES });
  })
);

// Admin: change an order's status, expected delivery, payment status, notes
// or customer details. Also used by PATCH /admin/orders/:id/status. The
// courier and tracking come only from the Delhivery integration
// (services/shipping.js); they cannot be typed in by hand.
export const updateOrder = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    const { status, carrier, carrierUrl, trackingNumber, eta, paymentStatus, note, notes, customer } = req.body || {};
    const problems = [];
    const text = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

    // Customer details (name, contact, delivery address). The country stays
    // tied to the market the order was priced in.
    if (customer && typeof customer === 'object') {
      const a = customer.address || {};
      const fields = [
        ['name', customer.name, 120, true, 'Name'],
        ['email', customer.email, 160, true, 'Email'],
        ['phone', customer.phone, 40, true, 'Phone'],
        ['address.line1', a.line1, 200, true, 'Address line 1'],
        ['address.line2', a.line2, 200, false, 'Address line 2'],
        ['address.city', a.city, 80, true, 'City'],
        ['address.state', a.state, 80, false, 'State'],
        ['address.postalCode', a.postalCode, 20, true, 'Postal code'],
      ];
      const bookedWithDelhivery = !!(order.shipment?.awb && order.shipment.status !== 'cancelled');
      for (const [path, value, max, required, label] of fields) {
        if (value === undefined) continue;
        const v = text(value, max);
        if (bookedWithDelhivery && (path === 'phone' || path.startsWith('address.')) && v !== String(order.get(`customer.${path}`) ?? '')) {
          problems.push('The parcel is already booked with Delhivery for the current address. Cancel the shipment before changing the delivery details.');
          break;
        }
        if (required && !v) problems.push(`${label} cannot be empty.`);
        else if (path === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) problems.push('Enter a valid email address.');
        else if (path === 'phone' && v.replace(/\D/g, '').length < 6) problems.push('Enter a valid phone number.');
        else order.set(`customer.${path}`, path === 'email' ? v.toLowerCase() : v);
      }
    }

    // Cancelling returns the items to stock; reopening a cancelled order
    // reserves them again (and is refused if they are no longer in stock).
    let stockMove = null;
    if (status && ORDER_STATUSES.includes(status) && status !== order.status) {
      if (status === ORDER_CANCELLED) stockMove = 'release';
      else if (order.status === ORDER_CANCELLED) stockMove = 'reserve';
      order.status = status;
      order.history.push({ status, note: text(note, 300) });
    }
    // Courier and tracking are Delhivery's (create the shipment from the
    // order or Admin → Shipping). Sending the values already saved is fine.
    const typedCourier = [['carrier', carrier, 80], ['trackingNumber', trackingNumber, 80], ['carrierUrl', carrierUrl, 500]]
      .some(([k, v, max]) => v !== undefined && text(v, max) !== String(order[k] || ''));
    if (typedCourier) problems.push('Courier and tracking are set by Delhivery. Create the Delhivery shipment for this order instead.');
    if (eta !== undefined) order.eta = text(eta, 60);
    // Online payments are settled by Razorpay (and refunded with the refund
    // action), so their status cannot be typed over by hand.
    if (paymentStatus && ['pending', 'paid', 'refunded'].includes(paymentStatus) && paymentStatus !== order.paymentStatus) {
      if (order.payment?.providerPaymentId) problems.push('This order was paid online. Use Refund to return money; the payment status follows Razorpay.');
      else order.paymentStatus = paymentStatus;
    }
    if (notes !== undefined) order.notes = String(notes).slice(0, 2000);
    if (problems.length) return res.status(400).json({ message: problems.join(' ') });
    const lines = order.items.filter((i) => i.product && i.qty > 0);
    if (stockMove === 'release') {
      for (const i of lines) await Product.updateOne({ _id: i.product }, { $inc: { stock: i.qty } });
    }
    if (stockMove === 'reserve') {
      const done = [];
      for (const i of lines) {
        const ok = await Product.updateOne({ _id: i.product, stock: { $gte: i.qty } }, { $inc: { stock: -i.qty } });
        if (!ok.modifiedCount) {
          for (const d of done) await Product.updateOne({ _id: d.product }, { $inc: { stock: d.qty } });
          return res.status(409).json({ message: `${i.name} no longer has ${i.qty} in stock, so this order cannot be reopened.` });
        }
        done.push(i);
      }
    }
    const wasReady = order.isModified('status') || order.isModified('paymentStatus');
    await order.save();
    if (stockMove === 'release' && order.coupon?.code) await releaseCoupon(order.coupon.code);
    // Confirmed or paid: confirmation email and, when automatic, the
    // Delhivery shipment. Cancelled: cancel the booked shipment too.
    if (wasReady && (['Confirmed', 'Packed'].includes(order.status) || (order.status === 'Order Placed' && order.paymentStatus === 'paid'))) orderReady(order._id);
    let out = order;
    if (stockMove === 'release' && order.shipment?.awb && order.shipment.status !== 'cancelled') out = (await cancelShipmentFor(order._id, { by: 'admin' })).order || order;
    res.json(req.apiV1 ? { ...out.toObject(), id: String(out._id), statusKey: statusKey(out) } : out);
});
r.patch('/:id', requireAdmin, updateOrder);

// Shipment tracking for one of the signed-in customer's orders: the courier,
// the AWB number, the status and every step so far.
r.get(
  '/:orderId/tracking',
  requireAuth,
  asyncHandler(async (req, res) => {
    const key = String(req.params.orderId).trim();
    const match = mongoose.isValidObjectId(key) ? { _id: key } : { orderNumber: key.toUpperCase() };
    let o = await Order.findOne({ $and: [match, isAdminSession(req) ? {} : ownedBy(req.user)] }).lean();
    if (!o) return res.status(404).json({ message: 'We could not find this order in your account.' });
    // Fresh from Delhivery when stale (the server asks, never the browser).
    o = await freshen(o);
    res.json({
      orderId: String(o._id),
      paymentStatus: o.paymentStatus,
      shipment: shipmentView(o),
      trackingUnavailable: !!o.trackingUnavailable,
      orderNumber: o.orderNumber,
      trackingId: o.trackingId,
      status: statusKey(o),
      statusLabel: o.status,
      carrier: o.carrier || '',
      trackingNumber: o.trackingNumber || '',
      trackingUrl: o.carrierUrl || '',
      eta: o.eta || '',
      stages: ORDER_STAGES,
      events: (o.history || []).map((h) => ({ status: STATUS_KEY_OF_LABEL[h.status] || h.status, label: h.status, at: h.at, note: h.note || '' })),
    });
  })
);

// One of the signed-in customer's own orders, by Order ID (or id). Anyone
// else's order is simply "not found". Registered last so the named admin
// routes above (stats, export, imports…) are matched first.
r.get(
  '/:orderId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const key = String(req.params.orderId).trim();
    const match = mongoose.isValidObjectId(key) ? { _id: key } : { orderNumber: key.toUpperCase() };
    const order = await Order.findOne({ $and: [match, isAdminSession(req) ? {} : ownedBy(req.user)] }).lean();
    if (!order) return res.status(404).json({ message: 'We could not find this order in your account.' });
    const fresh = await freshen(order);
    res.json({ ...customerView(fresh), trackingUnavailable: !!fresh.trackingUnavailable });
  })
);

// ----- the customer changes or cancels their own order -----
const findMine = (req) => {
  const key = String(req.params.orderId).trim();
  const match = mongoose.isValidObjectId(key) ? { _id: key } : { orderNumber: key.toUpperCase() };
  return Order.findOne({ $and: [match, ownedBy(req.user)] });
};
const clip = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

r.patch(
  '/mine/:orderId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const order = await findMine(req);
    if (!order) return res.status(404).json({ message: 'We could not find this order in your account.' });
    const can = canEdit(order);
    if (!can.details) return res.status(409).json({ message: `This order is ${order.status.toLowerCase()}, so it can no longer be changed. Message us on WhatsApp and we will help.` });
    const { customer, giftNote, items } = req.body || {};
    const summary = [];

    if (customer && typeof customer === 'object') {
      const a = customer.address || {};
      const fields = [
        ['name', customer.name, 120, true, 'Name'],
        ['phone', customer.phone, 40, true, 'Phone'],
        ['address.line1', a.line1, 200, true, 'Address line 1'],
        ['address.line2', a.line2, 200, false, 'Address line 2'],
        ['address.city', a.city, 80, true, 'City'],
        ['address.state', a.state, 80, false, 'State'],
        ['address.postalCode', a.postalCode, 20, true, 'Postal code'],
      ];
      let changed = false;
      for (const [path, value, max, required, label] of fields) {
        if (value === undefined) continue;
        const v = clip(value, max);
        if (required && !v) return res.status(400).json({ message: `${label} cannot be empty.` });
        if (path === 'phone' && v.replace(/\D/g, '').length < 6) return res.status(400).json({ message: 'Please enter a valid phone number.' });
        if ((order.get(`customer.${path}`) || '') !== v) {
          order.set(`customer.${path}`, v);
          changed = true;
        }
      }
      if (changed) summary.push('delivery details');
    }

    if (giftNote && typeof giftNote === 'object') {
      const next = giftNote.enabled
        ? { enabled: true, name: clip(giftNote.name, 40), occasion: clip(giftNote.occasion, 40), message: clip(giftNote.message, 160) }
        : { enabled: false };
      const cur = order.giftNote || {};
      if (!!cur.enabled !== next.enabled || (next.enabled && (cur.name !== next.name || cur.occasion !== next.occasion || cur.message !== next.message))) {
        order.giftNote = next;
        summary.push(next.enabled ? 'Signature Card' : 'removed the Signature Card');
      }
    }

    // Quantities: each line keeps the price it was ordered at. 0 removes it.
    let stockDelta = [];
    if (Array.isArray(items)) {
      const wanted = new Map(items.map((i) => [String(i.slug), Math.min(Math.max(parseInt(i.qty, 10) || 0, 0), 10)]));
      const changes = order.items.filter((i) => wanted.has(i.slug) && wanted.get(i.slug) !== i.qty);
      if (changes.length) {
        if (!can.items) {
          return res.status(409).json({
            message: order.paymentStatus === 'paid'
              ? 'This order is already paid, so its items cannot be changed here. Message us on WhatsApp and we will help.'
              : `This order is ${order.status.toLowerCase()}, so its items can no longer be changed.`,
          });
        }
        const remaining = order.items.reduce((n, i) => n + (wanted.has(i.slug) ? wanted.get(i.slug) : i.qty), 0);
        if (remaining < 1) return res.status(400).json({ message: 'An order needs at least one fragrance. To stop the order, cancel it instead.' });
        stockDelta = changes.map((i) => ({ product: i.product, name: i.name, qty: wanted.get(i.slug) - i.qty }));
        const more = stockDelta.filter((d) => d.qty > 0);
        const got = await reserve(more);
        if (!got.ok) return res.status(409).json({ message: `Sorry, there is not enough ${got.failed.name} in stock for that quantity.` });
        await release(stockDelta.filter((d) => d.qty < 0).map((d) => ({ ...d, qty: -d.qty })));
        for (const i of changes) summary.push(wanted.get(i.slug) ? `${i.name} × ${wanted.get(i.slug)}` : `removed ${i.name}`);
        order.items = order.items.map((i) => (wanted.has(i.slug) ? { ...i.toObject(), qty: wanted.get(i.slug) } : i)).filter((i) => i.qty > 0);
        const region = REGIONS.find((x) => x.ships && x.currency === order.currency);
        order.subtotal = order.items.reduce((n, i) => n + i.unitPrice * i.qty, 0);
        order.shipping = shippingFor(region, order.subtotal);
        order.discount = discountFor(order.coupon?.code ? order.coupon : null, order.subtotal, order.currency);
        order.total = order.subtotal - order.discount + order.shipping;
      }
    }

    if (!summary.length) return res.json(customerView(order.toObject()));
    order.edits.push({ by: 'customer', summary: `Changed ${summary.join(', ')}` });
    // A payment that lands while the items change must not be applied to
    // the new items: save only if the order is still unpaid.
    if (stockDelta.length) order.$where = { paymentStatus: 'pending' };
    try {
      await order.save();
    } catch (e) {
      // Put stock back if the order itself could not be saved.
      await release(stockDelta.filter((d) => d.qty > 0));
      await reserve(stockDelta.filter((d) => d.qty < 0).map((d) => ({ ...d, qty: -d.qty })));
      if (e?.name === 'DocumentNotFoundError') return res.status(409).json({ message: 'This order was just paid, so its items cannot be changed here. Message us on WhatsApp and we will help.' });
      throw e;
    }
    res.json(customerView(order.toObject()));
  })
);

r.post(
  '/mine/:orderId/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    const order = await findMine(req);
    if (!order) return res.status(404).json({ message: 'We could not find this order in your account.' });
    if (!canEdit(order).cancel) {
      return res.status(409).json({ message: order.status === ORDER_CANCELLED ? 'This order is already cancelled.' : `This order is ${order.status.toLowerCase()}, so it can no longer be cancelled here. Message us on WhatsApp and we will help.` });
    }
    const reason = clip(req.body?.reason, 200);
    const refund = order.paymentStatus === 'paid' ? ' We will arrange your refund.' : '';
    order.status = ORDER_CANCELLED;
    order.history.push({ status: ORDER_CANCELLED, note: `Cancelled by you${reason ? `: ${reason}` : ''}.${refund}` });
    order.edits.push({ by: 'customer', summary: `Cancelled the order${reason ? ` (${reason})` : ''}` });
    await order.save();
    await release(order.items.map((i) => ({ product: i.product, qty: i.qty })));
    if (order.coupon?.code) await releaseCoupon(order.coupon.code);
    if (order.shipment?.awb) {
      const c = await cancelShipmentFor(order._id, { by: 'customer' });
      return res.json(customerView((c.order || order).toObject()));
    }
    res.json(customerView(order.toObject()));
  })
);

export default r;
