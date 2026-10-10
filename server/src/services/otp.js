// One-time codes. Sign-in codes are sent by email (Nodemailer, the SMTP_*
// settings in services/mail.js); the email goes to the address on the account,
// never to one typed in the request.
//
// WhatsApp delivery (Meta Cloud API) is kept below but switched off: enabled
// again by restoring the call in sendOtp. It needs WHATSAPP_ACCESS_TOKEN,
// WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_OTP_TEMPLATE (an approved
// "Authentication" template with a copy-code button).
//
// Without email, development servers return the code in the response
// (`devCode`) so the app can be tested; production refuses with
// OTP_NOT_CONFIGURED.
import crypto from 'crypto';
import { mailConfigured, sendMail, codeEmail } from './mail.js';

export const OTP_MINUTES = 5;
export const OTP_MAX_ATTEMPTS = 5;

export const whatsappConfigured = () =>
  !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_OTP_TEMPLATE);
export const otpAvailable = () => mailConfigured() || process.env.NODE_ENV !== 'production';
// The concierge's WhatsApp sign-up offer still depends on WhatsApp itself.
export const whatsappAvailable = () => whatsappConfigured() || process.env.NODE_ENV !== 'production';

export const newCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
export const hashCode = (phone, code) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET || 'otp').update(`${phone}:${code}`).digest('hex');
const sameHash = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Sends a code by email. `kind` picks the wording: 'login' or 'staff'.
export async function sendOtp(to, code, kind = 'login') {
  // WhatsApp delivery is paused; codes go by email.
  // return sendOtpWhatsApp(phone, code);
  if (!mailConfigured()) {
    if (process.env.NODE_ENV === 'production') throw Object.assign(new Error('Email is not set up yet, so we cannot send the code.'), { status: 503, code: 'OTP_NOT_CONFIGURED' });
    return { channel: 'dev', devCode: code };
  }
  try {
    await sendMail({ to, ...codeEmail({ code, minutes: OTP_MINUTES, kind }) });
  } catch (e) {
    console.error('Code email failed:', e.message);
    throw Object.assign(new Error('We could not send the code just now. Please try again in a minute.'), { status: 502 });
  }
  return { channel: 'email' };
}

// Kept for when WhatsApp codes are switched back on (see sendOtp).
export async function sendOtpWhatsApp(phone, code) {
  if (!whatsappConfigured()) return { channel: 'dev', devCode: code };
  const res = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone.replace(/\D/g, ''),
      type: 'template',
      template: {
        name: process.env.WHATSAPP_OTP_TEMPLATE,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
        ],
      },
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    console.error('WhatsApp OTP failed:', data?.error?.message || res.status);
    throw Object.assign(new Error('We could not send the code just now. Please try again in a minute.'), { status: 502 });
  }
  return { channel: 'whatsapp' };
}

// ----- shared by every place that asks for a code -----
// At most one code every 30 seconds and five per 15 minutes for a number; a
// new code cancels older ones; codes last OTP_MINUTES and allow
// OTP_MAX_ATTEMPTS tries. The models are passed in to keep this file free of
// database imports. `email` is where the code goes (the account's own address).
export async function issueOtp(Otp, phone, purpose, email) {
  const recent = await Otp.find({ phone, createdAt: { $gt: new Date(Date.now() - 15 * 60000) } }).sort({ createdAt: -1 }).limit(5);
  if (recent.length >= 5 || (recent[0] && Date.now() - recent[0].createdAt.getTime() < 30000)) {
    throw Object.assign(new Error('Too many codes requested for this number. Please wait a moment and try again.'), { status: 429 });
  }
  const code = newCode();
  await Otp.updateMany({ phone, purpose, usedAt: null }, { $set: { usedAt: new Date() } }); // older codes stop working
  await Otp.create({ phone, purpose, hash: hashCode(phone, code), expiresAt: new Date(Date.now() + OTP_MINUTES * 60000) });
  return sendOtp(email, code, 'login');
}

// Checks a code and uses it up. Returns null when it is right, else
// { code, message } to send back with a 400.
export async function consumeOtp(Otp, phone, purpose, rawCode) {
  const code = String(rawCode ?? '').trim();
  const invalid = { code: 'OTP_INVALID', message: 'That code is not correct. Please check it or ask for a new one.' };
  if (!phone || !/^\d{6}$/.test(code)) return invalid;
  const otp = await Otp.findOne({ phone, purpose, usedAt: null }).sort({ createdAt: -1 });
  if (!otp || otp.expiresAt < new Date()) return { code: 'OTP_EXPIRED', message: 'This code has expired. Please ask for a new one.' };
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return { code: 'OTP_EXPIRED', message: 'Too many wrong attempts. Please ask for a new code.' };
  if (!sameHash(otp.hash, hashCode(phone, code))) {
    otp.attempts += 1;
    await otp.save();
    return invalid;
  }
  // Used once only, even if two requests race with the same code.
  const used = await Otp.updateOne({ _id: otp._id, usedAt: null }, { $set: { usedAt: new Date() } });
  return used.modifiedCount === 1 ? null : invalid;
}

// ----- staff two-step sign-in -----
// After the right password, staff get a code by email. The browser that
// passed the password step gets a random challenge token; the code works only
// together with it, once, for STAFF_MINUTES and STAFF_MAX_ATTEMPTS tries.
// Resending keeps the challenge, waits RESEND_SECONDS between emails and
// allows STAFF_MAX_SENDS emails per challenge and per account every 15 minutes.
export const STAFF_MINUTES = 10;
export const STAFF_MAX_ATTEMPTS = 5;
export const RESEND_SECONDS = 30;
export const STAFF_MAX_SENDS = 5;
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const tooMany = () => Object.assign(new Error('Too many codes requested. Please wait a few minutes and try again.'), { status: 429, code: 'OTP_RATE_LIMITED' });

export async function startStaffChallenge(Otp, user) {
  const key = `staff:${user._id}`;
  const sent = await Otp.aggregate([{ $match: { phone: key, createdAt: { $gt: new Date(Date.now() - 15 * 60000) } } }, { $group: { _id: null, n: { $sum: '$sends' } } }]);
  if ((sent[0]?.n || 0) >= STAFF_MAX_SENDS) throw tooMany();
  const token = crypto.randomBytes(32).toString('base64url');
  const code = newCode();
  await Otp.updateMany({ phone: key, purpose: 'staff_2fa', usedAt: null }, { $set: { usedAt: new Date() } }); // one live challenge per account
  await Otp.create({ phone: key, purpose: 'staff_2fa', challenge: sha(token), hash: hashCode(key, code), lastSentAt: new Date(), expiresAt: new Date(Date.now() + STAFF_MINUTES * 60000) });
  const out = await sendOtp(user.email, code, 'staff');
  return { challengeToken: token, ...(out.devCode && { devCode: out.devCode }) };
}

const liveChallenge = (Otp, token) =>
  typeof token === 'string' && token.length >= 32 && token.length <= 64
    ? Otp.findOne({ challenge: sha(token), purpose: 'staff_2fa', usedAt: null })
    : null;

// Returns { userId, devCode? } or throws.
export async function resendStaffCode(Otp, token, email) {
  const otp = await liveChallenge(Otp, token);
  if (!otp || otp.expiresAt < new Date()) throw Object.assign(new Error('This sign-in has expired. Please enter your password again.'), { status: 401, code: 'OTP_EXPIRED' });
  const wait = RESEND_SECONDS - Math.floor((Date.now() - (otp.lastSentAt || otp.createdAt).getTime()) / 1000);
  if (wait > 0) throw Object.assign(new Error(`Please wait ${wait} seconds before asking for a new code.`), { status: 429, code: 'OTP_COOLDOWN', retryAfter: wait });
  if (otp.sends >= STAFF_MAX_SENDS) throw tooMany();
  const code = newCode();
  const updated = await Otp.findOneAndUpdate(
    { _id: otp._id, usedAt: null, sends: otp.sends },
    { $set: { hash: hashCode(otp.phone, code), attempts: 0, lastSentAt: new Date(), expiresAt: new Date(Date.now() + STAFF_MINUTES * 60000) }, $inc: { sends: 1 } },
    { new: true }
  );
  if (!updated) throw tooMany(); // a parallel resend won
  const out = await sendOtp(email, code, 'staff');
  return { userId: otp.phone.slice(6), ...(out.devCode && { devCode: out.devCode }) };
}

// Looks up the challenge without changing it (to find the account for resend).
export async function staffChallengeUser(Otp, token) {
  const otp = await liveChallenge(Otp, token);
  return otp && otp.expiresAt > new Date() ? otp.phone.slice(6) : null;
}

// Returns { userId } when the code is right, else { error: { code, message } }.
export async function verifyStaffCode(Otp, token, rawCode) {
  const code = String(rawCode ?? '').trim();
  const otp = await liveChallenge(Otp, token);
  if (!otp || otp.expiresAt < new Date()) return { error: { code: 'OTP_EXPIRED', message: 'This code has expired. Please sign in again.' } };
  if (otp.attempts >= STAFF_MAX_ATTEMPTS) {
    await Otp.updateOne({ _id: otp._id }, { $set: { usedAt: new Date() } });
    return { error: { code: 'OTP_EXPIRED', message: 'Too many wrong attempts. Please sign in again.' } };
  }
  if (!/^\d{6}$/.test(code) || !sameHash(otp.hash, hashCode(otp.phone, code))) {
    await Otp.updateOne({ _id: otp._id }, { $inc: { attempts: 1 } });
    return { error: { code: 'OTP_INVALID', message: 'That code is not correct. Please check it or ask for a new one.' } };
  }
  const used = await Otp.updateOne({ _id: otp._id, usedAt: null }, { $set: { usedAt: new Date() } });
  if (used.modifiedCount !== 1) return { error: { code: 'OTP_INVALID', message: 'That code is not correct. Please check it or ask for a new one.' } };
  return { userId: otp.phone.slice(6) };
}
