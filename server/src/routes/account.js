// The signed-in customer: profile, address book, devices for push
// notifications, checkout preview and coupons.
import { Router } from 'express';
import mongoose from 'mongoose';
import Address from '../models/Address.js';
import DeviceToken from '../models/DeviceToken.js';
import { requireAuth, asyncHandler } from '../middleware/auth.js';
import { REGIONS, regionByCode, paymentsFor } from '../config/commerce.js';
import { updateProfile, changePassword, accountLimiter } from './auth.js';
import { priced } from './cart.js';
import { checkCoupon } from '../services/coupons.js';

const r = Router();
const MAX_ADDRESSES = 20;
const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// ----- profile -----
r.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toSafe() }));
r.put('/me', accountLimiter, requireAuth, updateProfile);
r.patch('/me', accountLimiter, requireAuth, updateProfile);
r.post('/me/change-password', accountLimiter, requireAuth, changePassword);

// ----- address book -----
// The default address is also the account's saved address (website checkout).
async function syncDefault(user) {
  const d = await Address.findOne({ user: user._id }).sort({ isDefault: -1, updatedAt: -1 });
  user.address = d
    ? { line1: d.addressLine1, line2: d.addressLine2 || '', city: d.city, state: d.state || '', postalCode: d.postalCode, region: d.countryCode }
    : user.address;
  await user.save();
}

// Accounts that saved an address on the website get it in the book the first time.
async function ensureImported(user) {
  if (await Address.exists({ user: user._id })) return;
  const a = user.address || {};
  if (!a.line1 || !a.city || !a.postalCode) return;
  await Address.create({
    user: user._id, fullName: user.name, phone: user.phone || '-', addressLine1: a.line1, addressLine2: a.line2,
    city: a.city, state: a.state, postalCode: a.postalCode, countryCode: a.region || 'IN', isDefault: true,
  });
}

function readAddress(body, partial = false) {
  const errors = [];
  const out = {};
  const fields = [
    ['fullName', 120, true], ['phone', 40, true], ['addressLine1', 200, true], ['addressLine2', 200, false],
    ['city', 80, true], ['state', 80, false], ['postalCode', 20, true], ['label', 30, false],
  ];
  for (const [f, max, required] of fields) {
    if (body[f] === undefined) {
      if (required && !partial) errors.push({ field: f, message: `${f} is required` });
      continue;
    }
    const v = clean(body[f], max);
    if (required && !v) errors.push({ field: f, message: `${f} is required` });
    out[f] = v;
  }
  if (out.phone && out.phone.replace(/\D/g, '').length < 6) errors.push({ field: 'phone', message: 'Invalid phone number' });
  if (body.countryCode !== undefined || !partial) {
    const cc = String(body.countryCode || '').toUpperCase();
    if (!regionByCode(cc)) errors.push({ field: 'countryCode', message: `Use one of ${REGIONS.map((x) => x.code).join(', ')}` });
    else out.countryCode = cc;
  }
  if (body.isDefault !== undefined) out.isDefault = !!body.isDefault;
  return { errors, out };
}

const notFound = (res) => res.status(404).json({ code: 'ADDRESS_NOT_FOUND', message: 'That address is not in your address book.' });
const mineById = (req) => (mongoose.isValidObjectId(req.params.id) ? Address.findOne({ _id: req.params.id, user: req.user._id }) : null);

r.get(
  '/addresses',
  requireAuth,
  asyncHandler(async (req, res) => {
    await ensureImported(req.user);
    const list = await Address.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: 1 });
    res.json(list.map((a) => a.toPublic()));
  })
);

r.post(
  '/addresses',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { errors, out } = readAddress(req.body || {});
    if (errors.length) return res.status(400).json({ message: 'Please check the address.', errors });
    await ensureImported(req.user);
    const count = await Address.countDocuments({ user: req.user._id });
    if (count >= MAX_ADDRESSES) return res.status(400).json({ message: `You can save up to ${MAX_ADDRESSES} addresses.` });
    if (!count) out.isDefault = true;
    if (out.isDefault) await Address.updateMany({ user: req.user._id }, { $set: { isDefault: false } });
    const a = await Address.create({ ...out, user: req.user._id });
    if (a.isDefault) await syncDefault(req.user);
    res.status(201).json(a.toPublic());
  })
);

r.put(
  '/addresses/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const a = await mineById(req);
    if (!a) return notFound(res);
    const { errors, out } = readAddress(req.body || {}, true);
    if (errors.length) return res.status(400).json({ message: 'Please check the address.', errors });
    if (out.isDefault === false && a.isDefault) delete out.isDefault; // choose another default instead
    if (out.isDefault) await Address.updateMany({ user: req.user._id, _id: { $ne: a._id } }, { $set: { isDefault: false } });
    Object.assign(a, out);
    await a.save();
    if (a.isDefault) await syncDefault(req.user);
    res.json(a.toPublic());
  })
);

r.delete(
  '/addresses/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const a = await mineById(req);
    if (!a) return notFound(res);
    await a.deleteOne();
    if (a.isDefault) {
      const next = await Address.findOne({ user: req.user._id }).sort({ updatedAt: -1 });
      if (next) {
        next.isDefault = true;
        await next.save();
        await syncDefault(req.user);
      }
    }
    res.json({ ok: true, message: 'Address deleted' });
  })
);

// ----- devices (push notifications) -----
r.post(
  '/devices/register',
  requireAuth,
  asyncHandler(async (req, res) => {
    const token = String(req.body?.token || '').trim();
    const platform = String(req.body?.platform || '').toLowerCase();
    if (!token || token.length > 4096) return res.status(400).json({ message: 'Send the device token.', errors: [{ field: 'token', message: 'token is required' }] });
    if (!['android', 'ios', 'web'].includes(platform)) return res.status(400).json({ message: 'Platform must be android, ios or web.', errors: [{ field: 'platform', message: 'android, ios or web' }] });
    // A token belongs to one account: signing in on a phone moves it there.
    const d = await DeviceToken.findOneAndUpdate(
      { token },
      { $set: { user: req.user._id, platform, appVersion: clean(req.body?.appVersion, 30), lastSeenAt: new Date() } },
      { new: true, upsert: true }
    );
    res.status(201).json({ id: String(d._id), platform: d.platform, createdAt: d.createdAt });
  })
);

r.delete(
  '/devices/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const key = String(req.params.id);
    const match = mongoose.isValidObjectId(key) ? { _id: key } : { token: key };
    const d = await DeviceToken.findOneAndDelete({ ...match, user: req.user._id });
    if (!d) return res.status(404).json({ message: 'Device not found.' });
    res.json({ ok: true, message: 'Device removed' });
  })
);

// ----- checkout preview and coupons -----
// The market to price in: the address's country, else ?region / currency,
// else the saved address, else India.
async function previewMarket(req) {
  let address = null;
  const addressId = req.body?.addressId;
  if (addressId) {
    address = mongoose.isValidObjectId(addressId) ? await Address.findOne({ _id: addressId, user: req.user._id }) : null;
    if (!address) throw Object.assign(new Error('That address is not in your address book.'), { status: 404, code: 'ADDRESS_NOT_FOUND' });
  }
  const byCurrency = REGIONS.find((x) => x.ships && x.currency === String(req.body?.currency || '').toUpperCase());
  const region = regionByCode(address?.countryCode) || regionByCode(String(req.body?.region || '').toUpperCase()) || byCurrency || regionByCode(req.user.address?.region) || REGIONS[0];
  return { region, address };
}

r.post(
  '/checkout/preview',
  requireAuth,
  asyncHandler(async (req, res) => {
    let market;
    try {
      market = await previewMarket(req);
    } catch (e) {
      return res.status(e.status).json({ code: e.code, message: e.message });
    }
    const { region, address } = market;
    const cart = await priced(req.user, region);
    const problems = [];
    if (!region.ships) problems.push({ code: 'REGION_NOT_SUPPORTED', message: 'We do not deliver to this country yet. Please order on WhatsApp.' });
    if (!cart.items.length) problems.push({ code: 'CART_EMPTY', message: 'Your bag is empty.' });
    for (const i of cart.items) if (!i.available || i.stock < i.qty) problems.push({ code: 'OUT_OF_STOCK', message: `${i.name}: ${i.message || 'not available in that quantity'}`, productId: i.productId });

    let coupon = null;
    let discount = 0;
    if (req.body?.couponCode) {
      try {
        const c = await checkCoupon(req.body.couponCode, { subtotal: cart.subtotal, currency: region.currency, user: req.user, email: req.user.email });
        discount = c.discount;
        coupon = { code: c.rule.code, valid: true, discount, discountType: c.rule.type, message: 'Coupon applied' };
      } catch (e) {
        coupon = { code: String(req.body.couponCode).toUpperCase().trim(), valid: false, discount: 0, errorCode: e.code || 'COUPON_INVALID', message: e.message };
      }
    }
    res.json({
      region: region.code,
      currency: region.currency,
      items: cart.items,
      subtotal: cart.subtotal,
      discount,
      tax: 0,
      taxIncluded: true,
      taxLabel: region.taxLabel || '',
      shipping: cart.shipping,
      total: cart.subtotal - discount + cart.shipping,
      freeShippingOver: cart.freeShippingOver,
      coupon,
      address: address ? address.toPublic() : null,
      paymentMethods: region.ships ? paymentsFor(region) : [],
      canCheckout: problems.length === 0 && !!(address || req.user.address?.line1),
      problems,
    });
  })
);

r.post(
  '/coupons/validate',
  requireAuth,
  asyncHandler(async (req, res) => {
    const region = REGIONS.find((x) => x.ships && x.currency === String(req.body?.currency || '').toUpperCase()) || regionByCode(req.user.address?.region) || REGIONS[0];
    const cartTotal = Number(req.body?.cartTotal);
    const subtotal = Number.isFinite(cartTotal) && cartTotal > 0 ? cartTotal : (await priced(req.user, region)).subtotal;
    try {
      const c = await checkCoupon(req.body?.code, { subtotal, currency: region.currency, user: req.user, email: req.user.email });
      res.json({
        valid: true, code: c.rule.code, discount: c.discount, discountType: c.rule.type,
        percent: c.rule.percent ?? null, amount: c.rule.amount ?? null, currency: region.currency, subtotal,
        description: c.coupon.description || '', expiresAt: c.coupon.expiresAt || null,
      });
    } catch (e) {
      res.status(e.status || 400).json({ code: e.code || 'COUPON_INVALID', message: e.message });
    }
  })
);

export default r;
