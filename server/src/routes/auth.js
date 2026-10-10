import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import User, { normalizePhone, validPhone, phoneKeys } from '../models/User.js';
import Order from '../models/Order.js';
import crypto from 'crypto';
import RefreshToken from '../models/RefreshToken.js';
import Otp from '../models/Otp.js';
import { signToken, requireAuth, optionalAuth, asyncHandler, isStaff } from '../middleware/auth.js';
import { mailConfigured, sendMail, resetEmail } from '../services/mail.js';
import {
  otpAvailable, issueOtp, consumeOtp, OTP_MINUTES, codeLoginOn, staffTwoStepOn, startStaffChallenge, resendStaffCode, staffChallengeUser, verifyStaffCode, STAFF_MINUTES, RESEND_SECONDS,
} from '../services/otp.js';

const r = Router();

// Brute-force protection: per connection, across sign-in, sign-up and reset.
const signInLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, message: { message: 'Too many sign-in attempts. Please wait a few minutes and try again.' } });
const otpLimiterEarly = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { message: 'Too many code requests. Please wait a few minutes and try again.' } });

// ----- tokens -----
// Access token (JWT, 7 days) for every request; refresh token (opaque, 60
// days, rotated on each use) so the mobile app can stay signed in.
const REFRESH_DAYS = 60;
const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

async function issueRefresh(user, req, family = crypto.randomUUID(), mfa = false) {
  const token = crypto.randomBytes(48).toString('base64url');
  await RefreshToken.create({
    user: user._id, hash: sha256(token), family, ...(mfa && { mfa: true }),
    expiresAt: new Date(Date.now() + REFRESH_DAYS * 86400000),
    userAgent: String(req.get('user-agent') || '').slice(0, 200),
  });
  return token;
}
// `token` and `accessToken` are the same access token (the app contract calls
// it accessToken; the website reads token). `mfa`: staff passed the emailed code.
async function session(user, req, family, { mfa = false } = {}) {
  const token = signToken(user, { mfa });
  return { token, accessToken: token, refreshToken: await issueRefresh(user, req, family, mfa), user: user.toSafe() };
}
const maskEmail = (e) => String(e).replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.min(Math.max(b.length, 2), 6)) + c);
const revokeAll = (userId) => RefreshToken.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
const blocked = (res) => res.status(403).json({ code: 'ACCOUNT_BLOCKED', message: 'This account is blocked. Please contact us for help.' });

r.post(
  '/register',
  signInLimiter,
  asyncHandler(async (req, res) => {
    // Plain strings only, within sane lengths.
    const str = (v) => (typeof v === 'string' ? v : '');
    const name = str(req.body?.name).replace(/\s+/g, ' ').trim();
    const email = str(req.body?.email).trim();
    const password = str(req.body?.password);
    const phone = str(req.body?.phone).trim().slice(0, 40);
    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Name, email and password are required.',
        errors: [['name', name], ['email', email], ['password', password]].filter(([, v]) => !v).map(([field]) => ({ field, message: `${field} is required` })),
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return res.status(400).json({ message: 'Please enter a valid email address.', errors: [{ field: 'email', message: 'Invalid email address' }] });
    if (name.length > 80) return res.status(400).json({ message: 'Please keep your name under 80 characters.', errors: [{ field: 'name', message: 'At most 80 characters' }] });
    if (email.length > 160) return res.status(400).json({ message: 'Please enter a valid email address.', errors: [{ field: 'email', message: 'Invalid email address' }] });
    if (password.length > 200) return res.status(400).json({ message: 'Please use a password under 200 characters.', errors: [{ field: 'password', message: 'At most 200 characters' }] });
    if (String(password).length < 8) return res.status(400).json({ message: 'Use a password of at least 8 characters.', errors: [{ field: 'password', message: 'At least 8 characters' }] });
    // The website always asks for a mobile number; the app API keeps it optional.
    if (!phone && !req.apiV1) return res.status(400).json({ message: 'Please enter your mobile number.', errors: [{ field: 'phone', message: 'phone is required' }] });
    if (phone && !validPhone(phone)) return res.status(400).json({ message: 'Please enter a valid mobile number, e.g. +91 98765 43210.', errors: [{ field: 'phone', message: 'Invalid phone number' }] });
    // A sign-up still waiting for its code can be started again (the code
    // proves the email, so nobody can take an address they cannot read).
    const exists = await User.findOne({ email: String(email).toLowerCase() });
    if (exists && exists.emailVerified !== false) return res.status(409).json({ message: 'An account with this email already exists. Sign in instead.' });
    if (phone && (await User.exists({ phoneNormalized: { $in: phoneKeys(phone) }, ...(exists && { _id: { $ne: exists._id } }) }))) {
      return res.status(409).json({ message: 'An account with this phone number already exists. Sign in instead.' });
    }
    // Without email on the server the account cannot be confirmed: it is
    // created ready to use, as before.
    const verify = otpAvailable();
    const fields = { name, phone: phone || undefined, passwordHash: await User.hashPassword(password) };
    let user;
    if (exists) {
      exists.set(fields);
      user = await exists.save();
    } else {
      user = await User.create({ ...fields, email, ...(verify && { emailVerified: false }) });
    }
    if (!verify) return res.status(201).json(await session(user, req));
    res.status(201).json(await sendVerification(user));
  })
);

// ----- confirming the email of a new account: once, with a code -----
const verifyKey = (email) => `verify:${email}`;
// Emails the code (or says one was sent moments ago). Never fails the sign-up:
// the customer can ask for a new code.
async function sendVerification(user) {
  const reply = {
    verificationRequired: true,
    email: user.email,
    expiresInSeconds: OTP_MINUTES * 60,
    message: 'We emailed you a 6-digit code. Enter it to finish creating your account.',
  };
  try {
    const sent = await issueOtp(Otp, verifyKey(user.email), 'verify_email', user.email, 'verify');
    return { ...reply, ...(sent.devCode && { devCode: sent.devCode }) };
  } catch (e) {
    if (e.status === 429) return { ...reply, message: 'We sent you a code a moment ago. Please check your email.' };
    return { ...reply, emailFailed: true, message: 'We could not send the code just now. Please ask for a new one in a minute.' };
  }
}

r.post(
  '/verify-email',
  signInLimiter,
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || '').toLowerCase().trim().slice(0, 160);
    const wrong = await consumeOtp(Otp, verifyKey(email), 'verify_email', req.body?.code ?? req.body?.otp);
    if (wrong) return res.status(400).json(wrong);
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ code: 'ACCOUNT_NOT_FOUND', message: 'No account uses this email. Please sign up again.' });
    if (user.status === 'blocked') return blocked(res);
    if (user.emailVerified === false) {
      user.emailVerified = true;
      await user.save();
    }
    res.json(await session(user, req, undefined, { mfa: isStaff(user) }));
  })
);

// The same answer whether or not the email waits for a code.
r.post(
  '/verify-email/resend',
  otpLimiterEarly,
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || '').toLowerCase().trim().slice(0, 160);
    const user = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (await User.findOne({ email }));
    const reply = { ok: true, message: 'If this email is waiting for a code, a new one is on its way.', expiresInSeconds: OTP_MINUTES * 60 };
    if (!user || user.emailVerified !== false || user.status === 'blocked') return res.json(reply);
    const sent = await sendVerification(user);
    if (sent.emailFailed) return res.status(502).json({ message: sent.message });
    res.json({ ...reply, ...(sent.devCode && { devCode: sent.devCode }) });
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
      : id && (await User.findOne({ phoneNormalized: { $in: phoneKeys(id) } }).sort({ createdAt: 1 }));
    if (!user || !(await user.checkPassword(String(password || '')))) {
      return res.status(401).json({ message: id.includes('@') || !id ? 'That email and password do not match.' : 'That phone number and password do not match.' });
    }
    if (user.status === 'blocked') return blocked(res);
    // A new account that never entered its code: send one and ask for it.
    if (user.emailVerified === false) {
      const sent = await sendVerification(user);
      return res.status(403).json({ ...sent, code: 'EMAIL_NOT_VERIFIED', message: 'Please confirm your email first. We emailed you a 6-digit code.' });
    }
    // Staff with two-step sign-in on: the password is only the first step; a
    // code by email is the second. Off: the password signs staff in.
    if (isStaff(user) && !staffTwoStepOn()) return res.json(await session(user, req, undefined, { mfa: true }));
    if (isStaff(user)) {
      let challenge;
      try {
        challenge = await startStaffChallenge(Otp, user);
      } catch (e) {
        return res.status(e.status || 502).json({ ...(e.code && { code: e.code }), message: e.message });
      }
      return res.json({
        twoFactorRequired: true,
        challengeToken: challenge.challengeToken,
        sentTo: maskEmail(user.email),
        expiresInSeconds: STAFF_MINUTES * 60,
        resendInSeconds: RESEND_SECONDS,
        message: 'We emailed you a 6-digit code to finish signing in.',
        ...(challenge.devCode && { devCode: challenge.devCode }),
      });
    }
    res.json(await session(user, req));
  })
);

// ----- staff two-step sign-in: the emailed code -----
const twoStepLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, message: { message: 'Too many attempts. Please wait a few minutes and try again.' } });

r.post(
  '/2fa/verify',
  twoStepLimiter,
  asyncHandler(async (req, res) => {
    const out = await verifyStaffCode(Otp, req.body?.challengeToken, req.body?.code ?? req.body?.otp);
    if (out.error) return res.status(out.error.code === 'OTP_EXPIRED' ? 401 : 400).json(out.error);
    const user = await User.findById(out.userId);
    if (!user) return res.status(401).json({ code: 'OTP_EXPIRED', message: 'This sign-in has expired. Please sign in again.' });
    if (user.status === 'blocked') return blocked(res);
    res.json(await session(user, req, undefined, { mfa: isStaff(user) }));
  })
);

r.post(
  '/2fa/resend',
  twoStepLimiter,
  asyncHandler(async (req, res) => {
    const userId = await staffChallengeUser(Otp, req.body?.challengeToken);
    const user = userId && (await User.findById(userId).select('email status'));
    if (!user || user.status === 'blocked') return res.status(401).json({ code: 'OTP_EXPIRED', message: 'This sign-in has expired. Please enter your password again.' });
    try {
      const sent = await resendStaffCode(Otp, req.body.challengeToken, user.email);
      res.json({ ok: true, sentTo: maskEmail(user.email), expiresInSeconds: STAFF_MINUTES * 60, resendInSeconds: RESEND_SECONDS, ...(sent.devCode && { devCode: sent.devCode }) });
    } catch (e) {
      if (e.retryAfter) res.set('Retry-After', String(e.retryAfter));
      res.status(e.status || 502).json({ ...(e.code && { code: e.code }), ...(e.retryAfter && { retryAfter: e.retryAfter }), message: e.message });
    }
  })
);

// ----- one-time codes by email: sign in with a code instead of the password -----
// The code goes to the email on the account found by phone (or email); the
// answer is the same whether or not an account exists. Verifying a phone
// number needs WhatsApp, which is paused (services/otp.js).
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { message: 'Too many code requests. Please wait a few minutes and try again.' } });
const PURPOSES = ['login', 'verify_phone'];

r.post(
  '/send-otp',
  otpLimiter,
  optionalAuth,
  asyncHandler(async (req, res) => {
    const purpose = PURPOSES.includes(req.body?.purpose) ? req.body.purpose : 'login';
    if (purpose === 'verify_phone') return res.status(503).json({ code: 'OTP_NOT_CONFIGURED', message: 'Phone verification is not available right now.' });
    if (!codeLoginOn()) return res.status(503).json({ code: 'OTP_NOT_CONFIGURED', message: 'Please sign in with your email and password.' });
    const byEmail = String(req.body?.email || '').toLowerCase().trim().slice(0, 160);
    if (byEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(byEmail)) return res.status(400).json({ message: 'Please enter a valid email address.', errors: [{ field: 'email', message: 'Invalid email address' }] });
    const phone = byEmail ? `email:${byEmail}` : normalizePhone(req.body?.phone);
    if (!byEmail && (!phone || !validPhone(phone))) return res.status(400).json({ message: 'Please enter a valid phone number.', errors: [{ field: 'phone', message: 'Invalid phone number' }] });
    if (!otpAvailable()) return res.status(503).json({ code: 'OTP_NOT_CONFIGURED', message: 'Sign-in by code is not set up yet. Please sign in with your password.' });
    // At most one code every 30 seconds and five per 15 minutes for a number.
    const recent = await Otp.find({ phone, createdAt: { $gt: new Date(Date.now() - 15 * 60000) } }).sort({ createdAt: -1 }).limit(5);
    if (recent.length >= 5 || (recent[0] && Date.now() - recent[0].createdAt.getTime() < 30000)) {
      return res.status(429).json({ message: 'Too many codes requested for this number. Please wait a moment and try again.' });
    }
    // The same answer whether or not an account matches. Staff accounts sign
    // in with their password and the two-step code instead.
    const account = byEmail
      ? await User.findOne({ email: byEmail }).select('_id status email role')
      : await User.findOne({ phoneNormalized: { $in: phoneKeys(phone) } }).sort({ createdAt: 1 }).select('_id status email role');
    const reply = { ok: true, message: 'If an account matches, a code is on its way to its email address.', expiresInSeconds: OTP_MINUTES * 60 };
    if (!account || account.status === 'blocked' || isStaff(account)) return res.json(reply);
    let sent;
    try {
      sent = await issueOtp(Otp, phone, purpose, account.email);
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
    const purpose = PURPOSES.includes(req.body?.purpose) ? req.body.purpose : 'login';
    if (purpose === 'verify_phone') return res.status(503).json({ code: 'OTP_NOT_CONFIGURED', message: 'Phone verification is not available right now.' });
    if (!codeLoginOn()) return res.status(503).json({ code: 'OTP_NOT_CONFIGURED', message: 'Please sign in with your email and password.' });
    const byEmail = String(req.body?.email || '').toLowerCase().trim().slice(0, 160);
    const phone = byEmail ? `email:${byEmail}` : normalizePhone(req.body?.phone);
    const wrong = await consumeOtp(Otp, phone, purpose, req.body?.otp || req.body?.code);
    if (wrong) return res.status(400).json(wrong);

    // The code went to the account's email, so it proves the email, not the
    // phone: phoneVerified stays as it is.
    const user = byEmail ? await User.findOne({ email: byEmail }) : await User.findOne({ phoneNormalized: { $in: phoneKeys(phone) } }).sort({ createdAt: 1 });
    if (!user) return res.status(404).json({ code: 'ACCOUNT_NOT_FOUND', message: 'No account matches yet. Please create an account first.' });
    if (user.status === 'blocked') return blocked(res);
    if (isStaff(user)) return res.status(403).json({ code: 'STAFF_PASSWORD_REQUIRED', message: 'Team accounts sign in with the password and the emailed code.' });
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
    const next = await session(user, req, doc.family, { mfa: !!doc.mfa && isStaff(user) });
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
// Links in emails never come from the request's Host header: a forged Host
// would send the reset token to someone else's site. SITE_URL, else the first
// CLIENT_ORIGIN, else the shop's own domain (localhost only in development).
const siteUrl = () => {
  const configured = process.env.SITE_URL || String(process.env.CLIENT_ORIGIN || '').split(',')[0].trim();
  const fallback = process.env.NODE_ENV === 'production' ? 'https://albarakah.me' : `http://localhost:${process.env.PORT || 5000}`;
  return (/^https?:\/\/[^\s/]+/.test(configured) ? configured : fallback).replace(/\/$/, '');
};

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
      const link = `${siteUrl()}/reset-password?token=${token}`;
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
    if (user.emailVerified === false) user.emailVerified = true; // the link proved the email
    user.tokenVersion = (user.tokenVersion || 0) + 1; // sign out everywhere else
    await user.save();
    await revokeAll(user._id);
    // With two-step sign-in on, staff sign in again with the new password and the code.
    if (isStaff(user) && !staffTwoStepOn()) return res.json(await session(user, req, undefined, { mfa: true }));
    if (isStaff(user)) return res.json({ ok: true, signInRequired: true, message: 'Your password is changed. Please sign in.' });
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
      if (p && !validPhone(p)) return res.status(400).json({ message: 'Please enter a valid mobile number, e.g. +91 98765 43210.', errors: [{ field: 'phone', message: 'Invalid phone number' }] });
      if (p && !phoneKeys(p).includes(u.phoneNormalized) && (await User.exists({ phoneNormalized: { $in: phoneKeys(p) }, _id: { $ne: u._id } }))) {
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
  res.json({ ok: true, ...(await session(req.user, req, undefined, { mfa: !!req.authMfa })) });
});
r.post('/me/password', accountLimiter, requireAuth, changePassword);
export { accountLimiter };

export default r;
