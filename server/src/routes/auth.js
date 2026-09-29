import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import Order from '../models/Order.js';
import { signToken, requireAuth, asyncHandler } from '../middleware/auth.js';

const r = Router();

r.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return res.status(400).json({ message: 'Please enter a valid email address.' });
    if (String(password).length < 8) return res.status(400).json({ message: 'Use a password of at least 8 characters.' });
    const exists = await User.findOne({ email: String(email).toLowerCase() });
    if (exists) return res.status(409).json({ message: 'An account with this email already exists. Sign in instead.' });
    const user = await User.create({ name, email, passwordHash: await User.hashPassword(password) });
    res.status(201).json({ token: signToken(user), user: user.toSafe() });
  })
);

r.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email: String(email || '').toLowerCase() });
    if (!user || !(await user.checkPassword(String(password || '')))) {
      return res.status(401).json({ message: 'That email and password do not match.' });
    }
    res.json({ token: signToken(user), user: user.toSafe() });
  })
);

r.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toSafe() }));

// ----- profile -----
const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const accountLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, message: { message: 'Too many attempts. Please wait a few minutes and try again.' } });

// Name, phone and the saved delivery address.
r.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name, phone, address } = req.body || {};
    const u = req.user;
    if (name !== undefined) {
      const n = clean(name, 80);
      if (!n) return res.status(400).json({ message: 'Please enter your name.' });
      u.name = n;
    }
    if (phone !== undefined) {
      const p = clean(phone, 40);
      if (p && p.replace(/\D/g, '').length < 6) return res.status(400).json({ message: 'Please enter a valid phone number.' });
      u.phone = p;
    }
    if (address && typeof address === 'object') {
      u.address = {
        line1: clean(address.line1, 200),
        line2: clean(address.line2, 200),
        city: clean(address.city, 80),
        state: clean(address.state, 80),
        postalCode: clean(address.postalCode, 20),
        region: /^[A-Z]{2}$/.test(address.region || '') ? address.region : u.address?.region || '',
      };
    }
    await u.save();
    res.json({ user: u.toSafe() });
  })
);

// Changing the sign-in email needs the current password. Orders placed as a
// guest with the old email are linked to the account first, so they stay
// under My orders.
r.post(
  '/me/email',
  accountLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const email = clean(req.body?.email, 160).toLowerCase();
    if (!isEmail(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
    if (!(await req.user.checkPassword(String(req.body?.password || '')))) return res.status(401).json({ message: 'Your current password is not correct.' });
    if (email === req.user.email) return res.json({ user: req.user.toSafe() });
    if (await User.exists({ email })) return res.status(409).json({ message: 'Another account already uses this email.' });
    await Order.updateMany({ 'customer.email': req.user.email, $or: [{ user: null }, { user: { $exists: false } }] }, { $set: { user: req.user._id } });
    req.user.email = email;
    await req.user.save();
    res.json({ user: req.user.toSafe() });
  })
);

r.post(
  '/me/password',
  accountLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const { current, next } = req.body || {};
    if (!(await req.user.checkPassword(String(current || '')))) return res.status(401).json({ message: 'Your current password is not correct.' });
    if (String(next || '').length < 8) return res.status(400).json({ message: 'Use a new password of at least 8 characters.' });
    req.user.passwordHash = await User.hashPassword(String(next));
    await req.user.save();
    res.json({ ok: true });
  })
);

export default r;
