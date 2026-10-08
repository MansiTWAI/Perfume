// One-time codes by WhatsApp (Meta Cloud API). Enabled when the server has
// WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_OTP_TEMPLATE
// (an approved "Authentication" template with a copy-code button). The access
// token never leaves the server.
//
// Without WhatsApp, development servers return the code in the response
// (`devCode`) so the app can be tested; production refuses with
// OTP_NOT_CONFIGURED.
import crypto from 'crypto';

export const OTP_MINUTES = 5;
export const OTP_MAX_ATTEMPTS = 5;

export const whatsappConfigured = () =>
  !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_OTP_TEMPLATE);
export const otpAvailable = () => whatsappConfigured() || process.env.NODE_ENV !== 'production';

export const newCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
export const hashCode = (phone, code) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET || 'otp').update(`${phone}:${code}`).digest('hex');

export async function sendOtp(phone, code) {
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
// Sign-in, phone verification and WhatsApp-update subscriptions all use the
// same rules: at most one code every 30 seconds and five per 15 minutes for a
// number; a new code cancels older ones; codes last OTP_MINUTES and allow
// OTP_MAX_ATTEMPTS tries. The models are passed in to keep this file free of
// database imports.
export async function issueOtp(Otp, phone, purpose) {
  const recent = await Otp.find({ phone, createdAt: { $gt: new Date(Date.now() - 15 * 60000) } }).sort({ createdAt: -1 }).limit(5);
  if (recent.length >= 5 || (recent[0] && Date.now() - recent[0].createdAt.getTime() < 30000)) {
    throw Object.assign(new Error('Too many codes requested for this number. Please wait a moment and try again.'), { status: 429 });
  }
  const code = newCode();
  await Otp.updateMany({ phone, purpose, usedAt: null }, { $set: { usedAt: new Date() } }); // older codes stop working
  await Otp.create({ phone, purpose, hash: hashCode(phone, code), expiresAt: new Date(Date.now() + OTP_MINUTES * 60000) });
  return sendOtp(phone, code);
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
  if (otp.hash !== hashCode(phone, code)) {
    otp.attempts += 1;
    await otp.save();
    return invalid;
  }
  // Used once only, even if two requests race with the same code.
  const used = await Otp.updateOne({ _id: otp._id, usedAt: null }, { $set: { usedAt: new Date() } });
  return used.modifiedCount === 1 ? null : invalid;
}
