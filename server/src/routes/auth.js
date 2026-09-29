import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import Order from '../models/Order.js';
import crypto from 'crypto';
import RefreshToken from '../models/RefreshToken.js';
import { signToken, requireAuth, asyncHandler } from '../middleware/auth.js';
import { mailConfigured, sendMail, resetEmail } from '../services/mail.js';

const r = Router();

// Brute-force protection: per connection, across sign-in, sign-up and reset.
const signInLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, message: { message: 'Too many sign-in attempts. Please wait a few minutes and try again.' } });

// ----- tokens -----
// Access token (JWT, 7 days) for every request; refresh token (opaque, 60
// days, rotated on each use) so the mobile app can stay signed in.
const REFRESH_DAYS = 60;
const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

async function issueRefresh(user, req, family = crypto.randomUUID()) {
  const token = crypto.randomBytes(48).toString('base64url');
  await RefreshToken.create({
    user: user._id, hash: sha256(token), family,
    expiresAt: new Date(Date.now() + REFRESH_DAYS * 86400000),
    userAgent: String(req.get('user-agent') || '').slice(0, 200),
  });
  return token;
}
async function session(user, req, family) {
  return { token: signToken(user), refreshToken: await issueRefresh(user, req, family), user: user.toSafe() };
}
const revokeAll = (userId) => RefreshToken.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });

r.post(
  '/register',
  signInLimiter,
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return res.status(400).json({ message: 'Please enter a valid email address.' });
    if (String(password).length < 8) return res.status(400).json({ message: 'Use a password of at least 8 characters.' });
    const exists = await User.findOne({ email: String(email).toLowerCase() });
    if (exists) return res.status(409).json({ message: 'An account with this email already exists. Sign in instead.' });
    const user = await User.create({ name, email, passwordHash: await User.hashPassword(password) });
    res.status(201).json(await session(user, req));
  })
);

r.post(
  '/login',
  signInLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email: String(email || '').toLowerCase() });
    if (!user || !(await user.checkPassword(String(password || '')))) {
      return res.status(401).json({ message: 'That email and password do not match.' });
    }
    res.json(await session(user, req));
  })
);

r.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toSafe() }));

// A new access token (and a replacement refresh token) for the mobile app.
r.post(
  '/refresh',
  signInLimiter,
  asyncHandler(async (req, res) => {
    const presented = String(req.body?.refreshToken || '');
    const doc = presented && (await RefreshToken.findOne({ hash: sha256(presented) }));
    if (!doc || doc.expiresAt < new Date()) return res.status(401).json({ message: 'This refresh token is not valid. Please sign in again.' });
    if (doc.revokedAt) {
      // A replaced token used again: it was copied. End that whole sign-in.
      await RefreshToken.updateMany({ family: doc.family, revokedAt: null }, { $set: { revokedAt: new Date() } });
      return res.status(401).json({ message: 'This refresh token has already been used. Please sign in again.' });
    }
    const user = await User.findById(doc.user);
    if (!user) return res.status(401).json({ message: 'This refresh token is not valid. Please sign in again.' });
    const next = await session(user, req, doc.family);
    doc.revokedAt = new Date();
    doc.replacedBy = sha256(next.refreshToken);
    await doc.save();
    res.json(next);
  })
);

// Sign out this device (the refresh token stops working).
r.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const presented = String(req.body?.refreshToken || '');
    if (presented) await RefreshToken.updateOne({ hash: sha256(presented), revokedAt: null }, { $set: { revokedAt: new Date() } });
    res.json({ ok: true });
  })
);

// Sign out every device: all tokens issued so far stop working.
r.post(
  '/logout-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
    await req.user.save();
    await revokeAll(req.user._id);
    res.json({ ok: true });
  })
);

// ----- password reset by email -----
const RESET_MINUTES = 60;
const siteUrl = (req) => (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

// Always answers the same way, so it cannot be used to find out who has an account.
r.post(
  '/forgot-password',
  signInLimiter,
  asyncHandler(async (req, res) => {
    if (!mailConfigured()) return res.status(503).json({ message: 'Password reset by email is not set up yet. Please contact us on WhatsApp.' });
    const email = String(req.body?.email || '').toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
    const user = await User.findOne({ email });
    if (user) {
      const token = crypto.randomBytes(32).toString('base64url');
      user.passwordReset = { hash: sha256(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60000) };
      await user.save();
      const link = `${siteUrl(req)}/reset-password?token=${token}`;
      try {
        await sendMail({ to: user.email, ...resetEmail({ name: user.name, link }) });
      } catch (e) {
        console.error('Reset email failed:', e.message);
        return res.status(502).json({ message: 'We could not send the email just now. Please try again in a few minutes.' });
      }
    }
    res.json({ ok: true, message: 'If an account uses this email, a link to reset the password is on its way.' });
  })
);

r.post(
  '/reset-password',
  signInLimiter,
  asyncHandler(async (req, res) => {
    const { token, password } = req.body || {};
    if (String(password || '').length < 8) return res.status(400).json({ message: 'Use a password of at least 8 characters.' });
    const user = token && (await User.findOne({ 'passwordReset.hash': sha256(token) }));
    if (!user) return res.status(400).json({ message: 'This reset link is invalid or has already been used. Please ask for a new one.' });
    if (!user.passwordReset?.expiresAt || user.passwordReset.expiresAt < new Date()) {
      return res.status(400).json({ message: 'This reset link has expired. Please ask for a new one.' });
    }
    user.passwordHash = await User.hashPassword(String(password));
    user.passwordReset = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1; // sign out everywhere else
    await user.save();
    await revokeAll(user._id);
    res.json(await session(user, req));
  })
);

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
    req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
    await req.user.save();
    await revokeAll(req.user._id);
    res.json({ ok: true, ...(await session(req.user, req)) });
  })
);

export default r;
