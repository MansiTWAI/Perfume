import { Router } from 'express';
import Product from '../models/Product.js';
import { requireAuth, asyncHandler } from '../middleware/auth.js';
import { REGIONS, regionByCode, shippingFor } from '../config/commerce.js';
import { productKey, slugFor } from '../services/catalog.js';

// The signed-in customer's bag and saved fragrances, stored on the account so
// the website and the mobile app share them. Prices are always worked out
// here from the catalogue (the same rules the checkout uses), never trusted
// from the client. Placing the order is still POST /api/orders.
const r = Router();

const MAX_LINES = 20;
const MAX_QTY = 10;
const clampQty = (q) => Math.min(Math.max(parseInt(q, 10) || 0, 0), MAX_QTY);

// The market to price in: ?region=, else the saved address, else India.
const marketFor = (req) => regionByCode(String(req.query.region || req.body?.region || '').toUpperCase()) || regionByCode(req.user.address?.region) || REGIONS[0];

function unitPrice(p, region) {
  const base = p.price?.[region.base || region.currency];
  if (base == null) return null;
  return region.fx ? Math.round(base * region.fx) : base;
}

export async function priced(user, region) {
  const slugs = user.cart.map((i) => i.slug);
  const products = new Map((await Product.find({ slug: { $in: slugs } }).lean()).map((p) => [p.slug, p]));
  const items = user.cart.map((i) => {
    const p = products.get(i.slug);
    const available = !!p && p.published && p.stock > 0;
    const price = p ? unitPrice(p, region) : null;
    return {
      productId: p ? String(p._id) : null,
      slug: i.slug,
      name: p?.name || i.slug,
      image: p?.images?.[0]?.src || null,
      sizeLabel: p?.sizeLabel || '',
      qty: i.qty,
      unitPrice: price,
      lineTotal: available && price != null ? price * i.qty : 0,
      stock: p?.stock ?? 0,
      available,
      message: !p || !p.published ? 'No longer available' : p.stock < i.qty ? (p.stock ? `Only ${p.stock} left` : 'Sold out') : null,
    };
  });
  const subtotal = items.reduce((n, i) => n + i.lineTotal, 0);
  const shipping = region.ships && subtotal ? shippingFor(region, subtotal) : 0;
  return {
    region: region.code,
    currency: region.currency,
    estimate: !!region.fx, // enquiry markets: indicative prices, order on WhatsApp
    ships: !!region.ships,
    items,
    count: items.reduce((n, i) => n + i.qty, 0),
    subtotal,
    shipping,
    total: subtotal + shipping,
    freeShippingOver: region.shipping?.freeOver ?? null,
  };
}

const send = async (req, res, status = 200) => res.status(status).json(await priced(req.user, marketFor(req)));

// A product by slug (website) or id (app).
async function checkProduct(key) {
  const p = key ? await Product.findOne({ ...productKey(key), published: true }).select('slug stock').lean() : null;
  if (!p) throw Object.assign(new Error('That fragrance is not available.'), { status: 404 });
  return p;
}
const fail = (res, e) => res.status(e.status || 400).json({ message: e.message });

// ----- cart -----
r.get('/cart', requireAuth, asyncHandler(async (req, res) => send(req, res)));

// Replace the whole bag, e.g. after editing it offline: { items: [{ slug, qty }] }.
r.put('/cart', requireAuth,
  asyncHandler(async (req, res) => {
    const list = Array.isArray(req.body?.items) ? req.body.items : null;
    if (!list) return res.status(400).json({ message: 'Send items as an array of { slug, qty }.' });
    const merged = new Map();
    for (const it of list.slice(0, 50)) {
      const slug = String(it?.slug || '').toLowerCase();
      const qty = clampQty(it?.qty);
      if (slug && qty) merged.set(slug, Math.min(MAX_QTY, (merged.get(slug) || 0) + qty));
    }
    const known = new Set((await Product.find({ slug: { $in: [...merged.keys()] }, published: true }).select('slug').lean()).map((p) => p.slug));
    req.user.cart = [...merged].filter(([slug]) => known.has(slug)).slice(0, MAX_LINES).map(([slug, qty]) => ({ slug, qty }));
    await req.user.save();
    send(req, res);
  })
);

// Add to the bag (adds to the quantity already there): { slug | productId, qty | quantity = 1 }.
r.post('/cart/items', requireAuth,
  asyncHandler(async (req, res) => {
    let p;
    try {
      p = await checkProduct(req.body?.productId || req.body?.slug);
    } catch (e) {
      return fail(res, e);
    }
    const qty = clampQty(req.body?.quantity ?? req.body?.qty ?? 1) || 1;
    const line = req.user.cart.find((i) => i.slug === p.slug);
    if (line) line.qty = Math.min(MAX_QTY, line.qty + qty);
    else {
      if (req.user.cart.length >= MAX_LINES) return res.status(400).json({ message: `A bag can hold up to ${MAX_LINES} different fragrances.` });
      req.user.cart.push({ slug: p.slug, qty });
    }
    await req.user.save();
    send(req, res, 201);
  })
);

// Set a line's quantity: { qty | quantity } (0 removes it). The line is
// addressed by product slug or product id.
r.patch('/cart/items/:slug', requireAuth,
  asyncHandler(async (req, res) => {
    const slug = await slugFor(req.params.slug);
    const line = req.user.cart.find((i) => i.slug === slug);
    if (!line) return res.status(404).json({ message: 'That fragrance is not in your bag.' });
    const qty = clampQty(req.body?.quantity ?? req.body?.qty);
    if (qty) line.qty = qty;
    else req.user.cart = req.user.cart.filter((i) => i !== line);
    await req.user.save();
    send(req, res);
  })
);

r.delete('/cart/items/:slug', requireAuth,
  asyncHandler(async (req, res) => {
    const slug = await slugFor(req.params.slug);
    req.user.cart = req.user.cart.filter((i) => i.slug !== slug);
    await req.user.save();
    send(req, res);
  })
);

r.delete('/cart', requireAuth,
  asyncHandler(async (req, res) => {
    req.user.cart = [];
    await req.user.save();
    send(req, res);
  })
);

// ----- wishlist -----
async function wishlist(user) {
  const products = await Product.find({ slug: { $in: user.wishlist }, published: true }).lean();
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  return {
    items: user.wishlist
      .filter((s) => bySlug.has(s))
      .map((s) => {
        const p = bySlug.get(s);
        return { productId: String(p._id), slug: p.slug, name: p.name, subtitle: p.subtitle, image: p.images?.[0]?.src || null, price: p.price, inStock: p.stock > 0 };
      }),
  };
}

r.get('/wishlist', requireAuth, asyncHandler(async (req, res) => res.json(await wishlist(req.user))));

// Save a fragrance: POST /wishlist { productId } (app) or POST /wishlist/:slug (website).
const addToWishlist = (keyOf) =>
  asyncHandler(async (req, res) => {
    let p;
    try {
      p = await checkProduct(keyOf(req));
    } catch (e) {
      return fail(res, e);
    }
    if (!req.user.wishlist.includes(p.slug)) {
      req.user.wishlist.push(p.slug);
      await req.user.save();
    }
    res.status(201).json(await wishlist(req.user));
  });
r.post('/wishlist', requireAuth, addToWishlist((req) => req.body?.productId || req.body?.slug));
r.post('/wishlist/:slug', requireAuth, addToWishlist((req) => req.params.slug));

r.delete('/wishlist/:slug', requireAuth,
  asyncHandler(async (req, res) => {
    const slug = await slugFor(req.params.slug);
    req.user.wishlist = req.user.wishlist.filter((s) => s !== slug);
    await req.user.save();
    res.json(await wishlist(req.user));
  })
);

export default r;
