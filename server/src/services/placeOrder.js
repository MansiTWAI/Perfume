// Creates an order: the checkout and the admin's "Add order" both come here,
// so prices are always recalculated from the database and stock is reserved
// the same way. Throws an error with `status` for anything the caller should
// show to the person placing the order.
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { ORDER_STAGES, regionByCode, shippingFor, paymentsFor } from '../config/commerce.js';
import { code } from '../utils.js';
import { validPhone } from '../models/User.js';
import { checkCoupon, claimCoupon, releaseCoupon, discountFor } from './coupons.js';

const fail = (status, message) => Object.assign(new Error(message), { status });
const MAX_QTY = 10;
const MAX_LINES = 20;

// The delivery details, checked on the server (the checkout form is only a
// convenience): plain strings within sane lengths, a real email, a mobile
// number and, in India, a 6-digit PIN code.
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function cleanCustomer(customer, region) {
  const c = customer && typeof customer === 'object' ? customer : {};
  const ad = c.address && typeof c.address === 'object' ? c.address : {};
  const s = (v, max) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/\s+/g, ' ').trim() : '').slice(0, max + 1);
  const out = {
    name: s(c.name, 120), email: s(c.email, 160).toLowerCase(), phone: s(c.phone, 40),
    address: { line1: s(ad.line1, 200), line2: s(ad.line2, 200), city: s(ad.city, 80), state: s(ad.state, 80), postalCode: s(ad.postalCode, 20) },
  };
  if (!out.name || !out.email || !out.phone || !out.address.line1 || !out.address.city || !out.address.postalCode) {
    throw fail(400, 'Please complete your name, contact details and delivery address.');
  }
  const long = [['name', 120], ['email', 160], ['phone', 40]].find(([k, m]) => out[k].length > m)
    || [['line1', 200], ['line2', 200], ['city', 80], ['state', 80], ['postalCode', 20]].find(([k, m]) => out.address[k].length > m);
  if (long) throw fail(400, 'Some delivery details are too long. Please shorten them.');
  if (!EMAIL_RX.test(out.email)) throw fail(400, 'Please enter a valid email address.');
  const digits = out.phone.replace(/\D/g, '');
  const phoneOk = region.code === 'IN' ? validPhone(out.phone) : digits.length >= 8 && digits.length <= 15;
  if (!phoneOk) throw fail(400, 'Please enter a valid phone number.');
  if (region.code === 'IN' && !/^[1-9][0-9]{5}$/.test(out.address.postalCode.replace(/\s/g, ''))) throw fail(400, 'Please enter a valid 6-digit PIN code.');
  return out;
}

export async function placeOrder({ items = [], customer, regionCode = 'IN', paymentMethod, giftNote, userId, couponCode, expectedTotal, historyNote = 'We have received your order.' }) {
  const region = regionByCode(regionCode);
  if (!region?.ships) throw fail(400, 'We do not deliver to this country yet. Please contact us on WhatsApp.');
  const { currency } = region;
  if (!Array.isArray(items) || !items.length) throw fail(400, 'Your bag is empty.');
  // Slugs are plain strings: anything else (e.g. { $ne: null }) is dropped.
  items = items.filter((it) => it && typeof it.slug === 'string' && it.slug.length <= 120);
  if (!items.length) throw fail(400, 'Your bag is empty.');
  // Whole quantities from 1 to 10 per fragrance; the same fragrance listed
  // twice counts once. Anything else is refused, never silently changed.
  const merged = new Map();
  for (const it of items) {
    const q = Number(it.qty ?? 1);
    if (!Number.isInteger(q) || q < 1 || q > MAX_QTY) throw fail(400, `Choose between 1 and ${MAX_QTY} of each fragrance.`);
    merged.set(it.slug, (merged.get(it.slug) || 0) + q);
  }
  if (merged.size > MAX_LINES) throw fail(400, `An order can hold up to ${MAX_LINES} different fragrances.`);
  if ([...merged.values()].some((q) => q > MAX_QTY)) throw fail(400, `Choose between 1 and ${MAX_QTY} of each fragrance.`);
  items = [...merged].map(([slug, qty]) => ({ slug, qty }));

  customer = cleanCustomer(customer, region);
  const a = customer.address;
  const methods = paymentsFor(region);
  if (paymentMethod !== undefined && paymentMethod !== null && paymentMethod !== '' && !methods.includes(paymentMethod)) {
    throw fail(400, 'That payment method is not available for this order.');
  }
  const method = methods.includes(paymentMethod) ? paymentMethod : methods[0];

  // Check the coupon against the database prices before reserving anything.
  const priceOf = new Map();
  for (const it of items) {
    const p = await Product.findOne({ slug: it.slug, published: true }).select('slug price').lean();
    if (p) priceOf.set(p.slug, p.price[currency]);
  }
  let coupon = null;
  if (couponCode) {
    const subtotal = items.reduce((n, it) => n + (priceOf.get(it.slug) || 0) * it.qty, 0);
    coupon = await checkCoupon(couponCode, { subtotal, currency, user: userId ? { _id: userId } : null });
  }

  const lines = [];
  for (const it of items) {
    const { qty } = it;
    const p = await Product.findOne({ slug: it.slug, published: true });
    if (!p) throw fail(400, `${it.slug} is no longer available.`);
    if (p.stock < qty) throw fail(409, `Only ${p.stock} of ${p.name} left in stock.`);
    lines.push({ p, qty });
  }

  // The customer saw a total; if prices changed since, stop before anything
  // is reserved and let them review the new one.
  if (expectedTotal !== undefined && expectedTotal !== null && expectedTotal !== '') {
    const sub = lines.reduce((n, { p, qty }) => n + p.price[currency] * qty, 0);
    const now = sub - (coupon ? discountFor(coupon.rule, sub, currency) : 0) + shippingFor(region, sub);
    if (Math.round(Number(expectedTotal) * 100) !== Math.round(now * 100)) {
      throw Object.assign(fail(409, 'Prices have changed since you opened your bag. Please review the new total before you pay.'), { code: 'PRICE_CHANGED', total: now });
    }
  }

  // Reserve stock atomically; roll back if any line fails.
  const reserved = [];
  for (const { p, qty } of lines) {
    const ok = await Product.updateOne({ _id: p._id, stock: { $gte: qty } }, { $inc: { stock: -qty } });
    if (!ok.modifiedCount) {
      for (const x of reserved) await Product.updateOne({ _id: x.p._id }, { $inc: { stock: x.qty } });
      throw fail(409, `${p.name} just sold out. Please update your bag.`);
    }
    reserved.push({ p, qty });
  }

  const orderItems = lines.map(({ p, qty }) => ({
    product: p._id,
    slug: p.slug,
    name: p.name,
    image: p.images?.[0]?.src,
    qty,
    unitPrice: p.price[currency],
  }));
  const subtotal = orderItems.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  // Delivery is judged on the subtotal before the discount.
  const shipping = shippingFor(region, subtotal);
  const discount = coupon ? discountFor(coupon.rule, subtotal, currency) : 0;
  const undoStock = async () => {
    for (const x of reserved) await Product.updateOne({ _id: x.p._id }, { $inc: { stock: x.qty } });
  };
  if (coupon && !(await claimCoupon(coupon.rule.code))) {
    await undoStock();
    throw Object.assign(fail(409, 'This coupon has been fully used.'), { code: 'COUPON_EXPIRED' });
  }

  try {
    return await Order.create({
      orderNumber: 'AB-' + new Date().getFullYear().toString().slice(2) + code(5),
      trackingId: 'ABL' + code(9),
      user: userId,
      customer: { ...customer, address: { ...a, country: region.name } },
      items: orderItems,
      currency,
      subtotal,
      discount,
      ...(coupon && { coupon: coupon.rule }),
      shipping,
      total: subtotal - discount + shipping,
      paymentMethod: method,
      giftNote: giftNote?.enabled
        ? {
            enabled: true,
            name: String(giftNote.name || '').slice(0, 40),
            occasion: String(giftNote.occasion || '').slice(0, 40),
            message: String(giftNote.message || '').slice(0, 160),
          }
        : { enabled: false },
      history: [{ status: ORDER_STAGES[0], note: historyNote }],
    });
  } catch (e) {
    // Nothing was ordered: give back the stock and the coupon use.
    await undoStock();
    if (coupon) await releaseCoupon(coupon.rule.code);
    throw e;
  }
}
