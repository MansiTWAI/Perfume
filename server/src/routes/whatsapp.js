// WhatsApp updates, public side: /api/whatsapp/...
//   POST /subscribe/code  send a one-time code to the number (proves it is theirs)
//   POST /subscribe       subscribe with that code and consent
//   POST /unsubscribe   stop them (always answers the same, so numbers cannot be probed)
//   GET  /webhook       Meta's one-time webhook verification
//   POST /webhook       delivery statuses and replies (STOP / START), signed by Meta
// Signed-in customers manage theirs at /api/me/whatsapp.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { optionalAuth, requireAuth, asyncHandler } from '../middleware/auth.js';
import ChatSession from '../models/ChatSession.js';
import WhatsAppContact from '../models/WhatsAppContact.js';
import Otp from '../models/Otp.js';
import { normalizePhone, validPhone, phoneKeys } from '../models/User.js';
import { subscribe, unsubscribe, webhookSignatureOk, handleWebhook } from '../services/whatsapp.js';
import { otpAvailable, issueOtp, consumeOtp, OTP_MINUTES } from '../services/otp.js';

const r = Router();
const formLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many tries from this connection. Please wait a few minutes.' } });
const hookLimiter = rateLimit({ windowMs: 60 * 1000, limit: 1200, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many requests.' } });
const str = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const PURPOSE = 'whatsapp_subscribe';
const badPhone = (res) => res.status(400).json({ message: 'Please enter a valid WhatsApp number with country code.', errors: [{ field: 'phone', message: 'Invalid phone number' }] });
// A signed-in customer whose number is already verified on the account needs no new code for it.
const verifiedOnAccount = (user, phone) => !!(user?.phoneVerified && user.phoneNormalized && phoneKeys(phone).includes(user.phoneNormalized));

// Nobody can subscribe a number they cannot receive messages on: a one-time
// code goes to that number by WhatsApp first (the same sender and template
// as sign-in codes), and subscribing needs it back.
r.post(
  '/subscribe/code',
  formLimiter,
  optionalAuth,
  asyncHandler(async (req, res) => {
    const phone = normalizePhone(str(req.body?.phone, 30));
    if (!validPhone(phone)) return badPhone(res);
    if (verifiedOnAccount(req.user, phone)) return res.json({ ok: true, needsCode: false, message: 'This number is already verified on your account.' });
    if (!otpAvailable()) return res.status(503).json({ code: 'OTP_NOT_CONFIGURED', message: 'WhatsApp updates are not available just yet. Please try again later.' });
    let sent;
    try {
      sent = await issueOtp(Otp, phone, PURPOSE);
    } catch (e) {
      return res.status(e.status || 502).json({ message: e.message });
    }
    res.json({ ok: true, needsCode: true, message: 'We sent a 6-digit code to this number on WhatsApp.', expiresInSeconds: OTP_MINUTES * 60, ...(sent.devCode && { devCode: sent.devCode }) });
  })
);

// Checks the code for a number (unless the account already verified it).
async function proven(req, res, phone) {
  if (verifiedOnAccount(req.user, phone)) return true;
  const wrong = await consumeOtp(Otp, phone, PURPOSE, req.body?.code);
  if (wrong) {
    res.status(400).json({ ...wrong, errors: [{ field: 'code', message: wrong.message }] });
    return false;
  }
  return true;
}

r.post(
  '/subscribe',
  formLimiter,
  optionalAuth,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    if (b.consent !== true) return res.status(400).json({ message: 'Please tick the box to agree to WhatsApp updates.', errors: [{ field: 'consent', message: 'consent is required' }] });
    const phone = normalizePhone(str(b.phone, 30));
    if (!validPhone(phone)) return badPhone(res);
    if (!(await proven(req, res, phone))) return;
    // A concierge chat links the subscription to the lead it produced.
    let lead;
    const sessionId = str(b.sessionId, 64);
    if (sessionId) lead = (await ChatSession.findOne({ sessionId }).select('lead').lean())?.lead;
    await subscribe({ phone, name: str(b.name, 80) || req.user?.name, email: req.user?.email, user: req.user?._id, lead, source: sessionId ? 'concierge' : 'website' });
    res.status(201).json({ ok: true, subscribed: true, message: 'You will receive our updates on WhatsApp. Reply STOP at any time to stop them.' });
  })
);

r.post(
  '/unsubscribe',
  formLimiter,
  asyncHandler(async (req, res) => {
    await unsubscribe(str(req.body?.phone, 30), 'customer');
    res.json({ ok: true, subscribed: false, message: 'Done. This number will not receive our WhatsApp updates.' });
  })
);

// ----- signed-in customer: /api/whatsapp/me -----
r.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const n = normalizePhone(req.user.phone);
    const c = await WhatsAppContact.findOne({ $or: [{ user: req.user._id }, ...(n ? [{ phone: n }] : [])] }).sort({ subscribed: -1, updatedAt: -1 }).lean();
    const phone = c?.phone || n || '';
    res.json({ subscribed: !!c?.subscribed, phone, since: c?.subscribed ? c.subscribedAt : null, verified: !!phone && verifiedOnAccount(req.user, phone) });
  })
);
r.put(
  '/me',
  formLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const want = req.body?.subscribed;
    if (typeof want !== 'boolean') return res.status(400).json({ message: 'subscribed must be true or false.' });
    const phone = str(req.body?.phone, 30) || req.user.phone;
    if (!want) {
      // Every number this account subscribed, plus the one it names.
      const contacts = await WhatsAppContact.find({ $or: [{ user: req.user._id }, { phone: normalizePhone(phone) }], subscribed: true }).select('phone').lean();
      for (const c of contacts) await unsubscribe(c.phone, 'customer');
      return res.json({ subscribed: false, phone: normalizePhone(phone) || '' });
    }
    if (!phone) return res.status(400).json({ message: 'Add your WhatsApp number first.', errors: [{ field: 'phone', message: 'phone is required' }] });
    const n = normalizePhone(phone);
    if (!validPhone(n)) return badPhone(res);
    if (!verifiedOnAccount(req.user, n) && !req.body?.code) return res.status(400).json({ code: 'OTP_REQUIRED', message: 'Confirm the number with the code we send on WhatsApp.', needsCode: true });
    if (!(await proven(req, res, n))) return;
    const c = await subscribe({ phone: n, name: req.user.name, email: req.user.email, user: req.user._id, source: 'account' });
    res.json({ subscribed: true, phone: c.phone, since: c.subscribedAt });
  })
);

// ----- Meta webhook -----
r.get('/webhook', (req, res) => {
  const token = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (token && req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === token) {
    return res.type('text/plain').send(String(req.query['hub.challenge'] ?? ''));
  }
  res.status(403).json({ message: 'Forbidden.' });
});
r.post(
  '/webhook',
  hookLimiter,
  asyncHandler(async (req, res) => {
    if (!process.env.WHATSAPP_APP_SECRET) return res.status(503).json({ message: 'Not configured.' });
    if (!webhookSignatureOk(req)) return res.status(401).json({ message: 'Unauthorized.' });
    const result = await handleWebhook(req.body);
    res.json({ ok: true, ...result });
  })
);

export default r;
