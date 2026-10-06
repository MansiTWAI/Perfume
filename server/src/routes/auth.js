import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import User, { normalizePhone } from '../models/User.js';
import Order from '../models/Order.js';
import crypto from 'crypto';
import RefreshToken from '../models/RefreshToken.js';
import Otp from '../models/Otp.js';
import { signToken, requireAuth, optionalAuth, asyncHandler } from '../middleware/auth.js';
import { mailConfigured, sendMail, resetEmail } from '../services/mail.js';
import { otpAvailable, sendOtp, newCode, hashCode, OTP_MINUTES, OTP_MAX_ATTEMPTS } from '../services/otp.js';

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
// `token` and `accessToken` are the same access token (the app contract calls
// it accessToken; the website reads token).
async function session(user, req, family) {
  const token = signToken(user);
  return { token, accessToken: token, refreshToken: await issueRefresh(user, req, family), user: user.toSafe() };
}
const revokeAll = (userId) => RefreshToken.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
const blocked = (res) => res.status(403).json({ code: 'ACCOUNT_BLOCKED', message: 'This account is blocked. Please contact us for help.' });
const validPhone = (p) => p.replace(/\D/g, '').length >= 8 && p.replace(/\D/g, '').length <= 15;

r.post(
  '/register',
  signInLimiter,
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body || {};
    const phone = String(req.body?.phone || '').trim().slice(0, 40);
    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Name, email and password are required.',
        errors: [['name', name], ['email', email], ['password', password]].filter(([, v]) => !v).map(([field]) => ({ field, message: `${field} is required` })),
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return res.status(400).json({ message: 'Please enter a valid email address.', errors: [{ field: 'email', message: 'Invalid email address' }] });
    if (String(password).length < 8) return res.status(400).json({ message: 'Use a password of at least 8 characters.', errors: [{ field: 'password', message: 'At least 8 characters' }] });
    if (phone && !validPhone(phone)) return res.status(400).json({ message: 'Please enter a valid phone number.', errors: [{ field: 'phone', message: 'Invalid phone number' }] });
    const exists = await User.findOne({ email: String(email).toLowerCase() });
    if (exists) return res.status(409).json({ message: 'An account with this email already exists. Sign in instead.' });
    if (phone && (await User.exists({ phoneNormalized: normalizePhone(phone) }))) {
      return res.status(409).json({ message: 'An account with this phone number already exists. Sign in instead.' });
    }
    const user = await User.create({ name, email, phone: phone || undefined, passwordHash: await User.hashPassword(password) });
    res.status(201).json(await session(user, req));
  })
);

// Sign in with email or phone (`identifier`), or `email` as before.
r.post(
  '/login',
  signInLimiter,
  asyncHandler(async (req, res) => {
    const { password } = req.body || {};
    const id = String(req.body?.identifier || req.body?.email || '').trim();
    const user = id.includes('@')
      ? await User.findOne({ email: id.toLowerCase() })
      : id && (await User.findOne({ phoneNormalized: normalizePhone(id) }).sort({ createdAt: 1 }));
    if (!user || !(await user.checkPassword(String(password || '')))) {
      return res.status(401).json({ message: id.includes('@') || !id ? 'That email and password do not match.' : 'That phone number and password do not match.' });
    }
    if (user.status === 'blocked') return blocked(res);
    res.json(await session(user, req));
  })
);

// ----- one-time codes by WhatsApp: sign in by phone, or verify a phone -----
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { message: 'Too many code requests. Please wait a few minutes and try again.' } });
const PURPOSES = ['login', 'verify_phone'];

r.post(
  '/send-otp',
  otpLimiter,
  optionalAuth,
  asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.body?.phone);
    const purpose = PURPOSES.includes(req.body?.purpose) ? req.body.purpose : 'login';
    if (!phone || !validPhone(phone)) return res.status(400).json({ message: 'Please enter a valid phone number.', errors: [{ field: 'phone', message: 'Invalid phone number' }] });
    if (!otpAvailable()) return res.status(503).json({ code: 'OTP_NOT_CONFIGURED', message: 'Sign-in by code is not set up yet. Please sign in with your password.' });
    if (purpose === 'verify_phone' && !req.user) return res.status(401).json({ message: 'Please sign in to continue.' });
    // At most one code every 30 seconds and five per 15 minutes for a number.
    const recent = await Otp.find({ phone, createdAt: { $gt: new Date(Date.now() - 15 * 60000) } }).sort({ createdAt: -1 }).limit(5);
    if (recent.length >= 5 || (recent[0] && Date.now() - recent[0].createdAt.getTime() < 30000)) {
      return res.status(429).json({ message: 'Too many codes requested for this number. Please wait a moment and try again.' });
    }
    // The same answer whether or not an account uses the number.
    const account = purpose === 'login' ? await User.findOne({ phoneNormalized: phone }).select('_id status') : req.user;
    const reply = { ok: true, message: 'If this number can sign in, a code is on its way by WhatsApp.', expiresInSeconds: OTP_MINUTES * 60 };
    if (!account || account.status === 'blocked') return res.json(reply);
    const code = newCode();
    await Otp.updateMany({ phone, purpose, usedAt: null }, { $set: { usedAt: new Date() } }); // older codes stop working
    await Otp.create({ phone, purpose, hash: hashCode(phone, code), expiresAt: new Date(Date.now() + OTP_MINUTES * 60000) });
    let sent;
    try {
      sent = await sendOtp(phone, code);
    } catch (e) {
      return res.status(e.status || 502).json({ message: e.message });
    }
    res.json({ ...reply, ...(sent.devCode && { devCode: sent.devCode }) });
  })
);

r.post(
  '/verify-otp',
  signInLimiter,
  optionalAuth,
  asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.body?.phone);
    const purpose = PURPOSES.includes(req.body?.purpose) ? req.body.purpose : 'login';
    const code = String(req.body?.otp || req.body?.code || '').trim();
    const invalid = () => res.status(400).json({ code: 'OTP_INVALID', message: 'That code is not correct. Please check it or ask for a new one.' });
    if (!phone || !/^\d{6}$/.test(code)) return invalid();
    const otp = await Otp.findOne({ phone, purpose, usedAt: null }).sort({ createdAt: -1 });
    if (!otp || otp.expiresAt < new Date()) return res.status(400).json({ code: 'OTP_EXPIRED', message: 'This code has expired. Please ask for a new one.' });
    if (otp.attempts >= OTP_MAX_ATTEMPTS) return res.status(400).json({ code: 'OTP_EXPIRED', message: 'Too many wrong attempts. Please ask for a new code.' });
    if (otp.hash !== hashCode(phone, code)) {
      otp.attempts += 1;
      await otp.save();
      return invalid();
    }
    otp.usedAt = new Date();
    await otp.save();

    if (purpose === 'verify_phone') {
      if (!req.user) return res.status(401).json({ message: 'Please sign in to continue.' });
      if (req.user.phoneNormalized !== phone) {
        req.user.phone = req.body?.phone ? String(req.body.phone).trim().slice(0, 40) : phone;
      }
      await req.user.save(); // the pre-save hook normalises the number
      req.user.phoneVerified = true;
      await req.user.save();
      return res.json({ ok: true, message: 'Your phone number is verified.', user: req.user.toSafe() });
    }
    const user = await User.findOne({ phoneNormalized: phone }).sort({ createdAt: 1 });
    if (!user) return res.status(404).json({ code: 'ACCOUNT_NOT_FOUND', message: 'No account uses this phone number yet. Please create an account first.' });
    if (user.status === 'blocked') return blocked(res);
    if (!user.phoneVerified) {
      user.phoneVerified = true;
      await user.save();
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
    if (user.status === 'blocked') return blocked(res);
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

// Name, phone and the saved delivery address; also the email when the
// current password comes with it (PUT /me in the app contract).
export const updateProfile = asyncHandler(async (req, res) => {
    const { name, phone, address } = req.body || {};
    const u = req.user;
    if (name !== undefined) {
      const n = clean(name, 80);
      if (!n) return res.status(400).json({ message: 'Please enter your name.', errors: [{ field: 'name', message: 'Name is required' }] });
      u.name = n;
    }
    if (phone !== undefined) {
      const p = clean(phone, 40);
      if (p && p.replace(/\D/g, '').length < 6) return res.status(400).json({ message: 'Please enter a valid phone number.', errors: [{ field: 'phone', message: 'Invalid phone number' }] });
      if (p && normalizePhone(p) !== u.phoneNormalized && (await User.exists({ phoneNormalized: normalizePhone(p), _id: { $ne: u._id } }))) {
        return res.status(409).json({ message: 'Another account already uses this phone number.' });
      }
      u.phone = p;
    }
    if (req.body?.email !== undefined && clean(req.body.email, 160).toLowerCase() !== u.email) {
      const email = clean(req.body.email, 160).toLowerCase();
      if (!isEmail(email)) return res.status(400).json({ message: 'Please enter a valid email address.', errors: [{ field: 'email', message: 'Invalid email address' }] });
      const password = String(req.body?.password || req.body?.currentPassword || '');
      if (!password) return res.status(400).json({ message: 'To change your email, also send your current password as "password".', errors: [{ field: 'password', message: 'Current password is required to change the email' }] });
      if (!(await u.checkPassword(password))) return res.status(401).json({ message: 'Your current password is not correct.' });
      if (await User.exists({ email })) return res.status(409).json({ message: 'Another account already uses this email.' });
      await Order.updateMany({ 'customer.email': u.email, $or: [{ user: null }, { user: { $exists: false } }] }, { $set: { user: u._id } });
      u.email = email;
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
});
r.patch('/me', requireAuth, updateProfile);

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

// { current, next } (website) or { currentPassword, newPassword } (app contract).
export const changePassword = asyncHandler(async (req, res) => {
  const current = req.body?.current ?? req.body?.currentPassword;
  const next = req.body?.next ?? req.body?.newPassword;
  if (!(await req.user.checkPassword(String(current || '')))) return res.status(401).json({ message: 'Your current password is not correct.' });
  if (String(next || '').length < 8) return res.status(400).json({ message: 'Use a new password of at least 8 characters.', errors: [{ field: 'newPassword', message: 'At least 8 characters' }] });
  req.user.passwordHash = await User.hashPassword(String(next));
  req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
  await req.user.save();
  await revokeAll(req.user._id);
  res.json({ ok: true, ...(await session(req.user, req)) });
});
r.post('/me/password', accountLimiter, requireAuth, changePassword);
export { accountLimiter };

export default r;
