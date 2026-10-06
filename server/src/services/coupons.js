// Coupon rules, shared by /coupons/validate, /checkout/preview and placing
// an order, so a code is judged the same way everywhere.
import Coupon from '../models/Coupon.js';
import Order from '../models/Order.js';
import { ORDER_CANCELLED } from '../config/commerce.js';

const fail = (message, code = 'COUPON_INVALID') => Object.assign(new Error(message), { status: 400, code });

// The discount a stored rule gives on a subtotal (whole units, never more
// than the subtotal). Also used when an order's quantities change later.
export function discountFor(rule, subtotal, currency) {
  if (!rule || !subtotal) return 0;
  let d = 0;
  if (rule.type === 'percent') {
    d = Math.round((subtotal * (rule.percent || 0)) / 100);
    const cap = typeof rule.maxDiscount === 'number' ? rule.maxDiscount : rule.maxDiscount?.[currency];
    if (cap) d = Math.min(d, cap);
  } else if (rule.type === 'fixed') {
    d = typeof rule.amount === 'number' ? rule.amount : rule.amount?.[currency] || 0;
  }
  return Math.max(0, Math.min(d, subtotal));
}

// Checks a code for a subtotal in a currency (and a customer, for per-customer
// limits). Returns { coupon, discount, rule } or throws a 400 with `code`.
export async function checkCoupon(rawCode, { subtotal, currency, user } = {}) {
  const code = String(rawCode || '').toUpperCase().trim();
  if (!code) throw fail('Please enter a coupon code.');
  const c = await Coupon.findOne({ code });
  const now = new Date();
  if (!c || !c.active) throw fail('This coupon code is not valid.');
  if (c.startsAt && c.startsAt > now) throw fail('This coupon is not active yet.');
  if (c.expiresAt && c.expiresAt < now) throw fail('This coupon has expired.', 'COUPON_EXPIRED');
  if (c.usageLimit && c.usedCount >= c.usageLimit) throw fail('This coupon has been fully used.', 'COUPON_EXPIRED');
  if (c.type === 'fixed' && !c.amount?.[currency]) throw fail(`This coupon cannot be used for orders in ${currency}.`);
  const min = c.minSubtotal?.[currency];
  if (min && subtotal < min) throw fail(`This coupon needs an order of at least ${min} ${currency}.`, 'COUPON_MIN_NOT_MET');
  if (user && c.perUserLimit) {
    const used = await Order.countDocuments({ 'coupon.code': code, user: user._id, status: { $ne: ORDER_CANCELLED } });
    if (used >= c.perUserLimit) throw fail('You have already used this coupon.', 'COUPON_ALREADY_USED');
  }
  const rule = {
    code,
    type: c.type,
    percent: c.percent,
    amount: c.type === 'fixed' ? c.amount?.[currency] : undefined,
    maxDiscount: c.type === 'percent' ? c.maxDiscount?.[currency] : undefined,
  };
  return { coupon: c, rule, discount: discountFor(rule, subtotal, currency) };
}

// Counts one use, unless the limit was reached in the meantime.
export async function claimCoupon(code) {
  const c = await Coupon.findOne({ code });
  if (!c) return false;
  const filter = { _id: c._id, ...(c.usageLimit && { usedCount: { $lt: c.usageLimit } }) };
  const r = await Coupon.updateOne(filter, { $inc: { usedCount: 1 } });
  return r.modifiedCount === 1;
}

export const releaseCoupon = (code) => Coupon.updateOne({ code, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });

export const publicCoupon = (c) => ({
  id: c._id,
  code: c.code,
  description: c.description || '',
  type: c.type,
  percent: c.percent,
  amount: c.amount,
  maxDiscount: c.maxDiscount,
  minSubtotal: c.minSubtotal,
  startsAt: c.startsAt,
  expiresAt: c.expiresAt,
  usageLimit: c.usageLimit,
  perUserLimit: c.perUserLimit,
  usedCount: c.usedCount,
  active: c.active,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});
