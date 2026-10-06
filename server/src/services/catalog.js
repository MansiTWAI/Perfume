// Catalogue helpers shared by the product, cart, search and homepage routes.
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Review from '../models/Review.js';
import { ORDER_CANCELLED, REGIONS } from '../config/commerce.js';

const BRAND = 'AL BARAKAH LIFESTYLE';

// Products are addressed by slug on the website and by id in the app: accept both.
export const productKey = (key) => {
  const k = String(key || '').trim();
  return mongoose.isValidObjectId(k) ? { _id: k } : { slug: k.toLowerCase() };
};

export const findProduct = (key, extra = {}) => Product.findOne({ ...productKey(key), ...extra });

// The slug for an id-or-slug, or null when no such product exists.
export async function slugFor(key, extra = {}) {
  const k = String(key || '').trim();
  if (!mongoose.isValidObjectId(k)) return k.toLowerCase() || null;
  const p = await Product.findOne({ _id: k, ...extra }).select('slug').lean();
  return p?.slug || null;
}

// Price of a product in a market: shipping markets use their own price,
// enquiry markets an indicative conversion from their base currency.
export function priceIn(p, currency) {
  if (p.price?.[currency] != null) return { amount: p.price[currency], compareAt: p.compareAt?.[currency] ?? null, currency, estimate: false };
  const region = REGIONS.find((r) => r.currency === currency && r.fx);
  if (region) {
    const conv = (v) => (v == null ? null : Math.round(v * region.fx * 100) / 100);
    return { amount: conv(p.price?.[region.base]), compareAt: conv(p.compareAt?.[region.base]), currency, estimate: true };
  }
  return { amount: p.price?.INR ?? null, compareAt: p.compareAt?.INR ?? null, currency: 'INR', estimate: false };
}

// Average rating and count per slug, for approved reviews.
export async function ratings(slugs) {
  const rows = await Review.aggregate([
    { $match: { slug: { $in: slugs }, status: 'approved' } },
    { $group: { _id: '$slug', average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id, { rating: Math.round(r.average * 10) / 10, reviewCount: r.count }]));
}

// Units sold per slug (cancelled orders excluded).
export async function salesBySlug() {
  const rows = await Order.aggregate([
    { $match: { status: { $ne: ORDER_CANCELLED } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.slug', sold: { $sum: '$items.qty' } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.sold]));
}

const noteNames = (list) => (list || []).map((n) => n.name);

// The product in the app's shape: one price in the requested currency, plus
// every stored field (prices per currency stay available under `prices`).
export function appProduct(doc, { currency = 'INR', rating } = {}) {
  const p = doc?.toObject ? doc.toObject() : doc;
  const price = priceIn(p, currency);
  return {
    ...p,
    id: String(p._id),
    brand: BRAND,
    prices: p.price,
    price: price.amount,
    compareAtPrice: price.compareAt,
    currency: price.currency,
    priceIsEstimate: price.estimate,
    volumeMl: p.sizeMl,
    inStock: (p.stock || 0) > 0,
    image: p.images?.[0]?.src || null,
    fragrance: {
      family: p.family || '',
      topNotes: noteNames(p.notes?.top),
      heartNotes: noteNames(p.notes?.heart),
      baseNotes: noteNames(p.notes?.base),
      longevity: p.longevity || '',
    },
    rating: rating?.rating ?? 0,
    reviewCount: rating?.reviewCount ?? 0,
  };
}

// Many products in the app's shape, with ratings filled in.
export async function appProducts(docs, currency) {
  const r = await ratings(docs.map((d) => d.slug));
  return docs.map((d) => appProduct(d, { currency, rating: r.get(d.slug) }));
}

export const currencyFrom = (q = {}) => {
  const c = String(q.currency || '').toUpperCase();
  if (REGIONS.some((r) => r.currency === c)) return c;
  const region = REGIONS.find((r) => r.code === String(q.country || '').toUpperCase());
  return region?.currency || 'INR';
};
