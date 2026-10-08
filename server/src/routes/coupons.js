// Coupons for shoppers (website bag and checkout, signed in or not):
//   GET  /api/coupons?region=IN        the coupons the team chose to list, usable now
//   POST /api/coupons/check            { code, region, items: [{ slug, qty }], email? }
// The discount is always worked out here from catalogue prices; placing the
// order checks the code again. Signed-in shoppers can also use
// /api/coupons/validate and /api/checkout/preview (account.js).
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import Coupon from '../models/Coupon.js';
import { optionalAuth, asyncHandler } from '../middleware/auth.js';
import { REGIONS, regionByCode } from '../config/commerce.js';
import { priced } from './cart.js';
import { checkCoupon, offerView, usableIn } from '../services/coupons.js';

const r = Router();
// Enough for real shoppers, too few to guess codes.
const checkLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { code: 'TOO_MANY_TRIES', message: 'Too many coupon tries. Please wait a few minutes.' } });
const market = (code) => {
  const reg = regionByCode(String(code || '').toUpperCase());
  return reg?.ships ? reg : REGIONS[0];
};

r.get(
  '/',
  asyncHandler(async (req, res) => {
    const region = market(req.query.region);
    const list = await Coupon.find({ active: true, showOnSite: true }).sort({ createdAt: -1 }).limit(50).lean();
    const items = list.filter((c) => usableIn(c, region.currency)).map((c) => offerView(c, region.currency));
    res.set('Cache-Control', 'no-store').json({ currency: region.currency, items });
  })
);

r.post(
  '/check',
  checkLimiter,
  optionalAuth,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const region = market(b.region);
    const items = (Array.isArray(b.items) ? b.items : [])
      .filter((i) => i && typeof i.slug === 'string' && i.slug.length <= 120)
      .slice(0, 20)
      .map((i) => ({ slug: i.slug, qty: Math.min(Math.max(parseInt(i.qty, 10) || 1, 1), 10) }));
    const cart = await priced({ cart: items }, region);
    if (!cart.subtotal) return res.status(400).json({ code: 'CART_EMPTY', message: 'Add a fragrance to your bag first.' });
    try {
      const c = await checkCoupon(typeof b.code === 'string' ? b.code : '', {
        subtotal: cart.subtotal,
        currency: region.currency,
        user: req.user,
        email: req.user?.email || (typeof b.email === 'string' ? b.email.slice(0, 160) : ''),
      });
      res.json({ valid: true, ...offerView(c.coupon, region.currency), discount: c.discount, subtotal: cart.subtotal, shipping: cart.shipping, total: cart.subtotal - c.discount + cart.shipping });
    } catch (e) {
      if (!e.status) throw e;
      res.status(e.status).json({ valid: false, code: e.code || 'COUPON_INVALID', message: e.message });
    }
  })
);

export default r;
