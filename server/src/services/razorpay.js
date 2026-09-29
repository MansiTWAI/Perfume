// Razorpay (India: UPI, cards, netbanking, wallets). Enabled when the server
// environment has RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET; the webhook also
// needs RAZORPAY_WEBHOOK_SECRET. The key secret never leaves the server.
import crypto from 'crypto';

export const razorpayConfigured = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
export const ONLINE_CURRENCIES = ['INR'];

const API = 'https://api.razorpay.com/v1';

// Creates the Razorpay order for one of our orders. Amount in paise.
export async function createRazorpayOrder({ amount, currency, receipt, notes }) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const res = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency, receipt, notes }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) {
    console.error('Razorpay order failed:', data?.error?.description || res.status);
    throw Object.assign(new Error('The payment provider is not responding. Please try again in a moment.'), { status: 502 });
  }
  return data;
}

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Checkout callback: HMAC-SHA256(order_id|payment_id) with the key secret.
export const verifyPaymentSignature = ({ orderId, paymentId, signature }) =>
  safeEqual(crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex'), signature);

// Webhook: HMAC-SHA256(raw body) with the webhook secret.
export const verifyWebhookSignature = (rawBody, signature) =>
  !!process.env.RAZORPAY_WEBHOOK_SECRET && !!rawBody &&
  safeEqual(crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex'), signature);
