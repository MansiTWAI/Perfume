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
