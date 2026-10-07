// Razorpay (India: UPI, cards, netbanking, wallets). Enabled when the server
// environment has RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET; the webhook also
// needs RAZORPAY_WEBHOOK_SECRET. The key secret never leaves the server and is
// never logged.
import crypto from 'crypto';

export const razorpayConfigured = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
export const ONLINE_CURRENCIES = ['INR'];
// rzp_test_… keys are Test Mode, rzp_live_… take real money.
export const razorpayMode = () => (String(process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_live_') ? 'live' : 'test');

const API = 'https://api.razorpay.com/v1';

// Money in the smallest unit (paise). Prices are stored in whole rupees; the
// rounding only guards against floating-point dust (e.g. 19.99 * 100).
export const toMinor = (amount) => Math.round(Number(amount || 0) * 100);

// Razorpay ids the browser may send back: checked before they touch a query.
export const ID = {
  order: /^order_[A-Za-z0-9]{6,40}$/,
  payment: /^pay_[A-Za-z0-9]{6,40}$/,
  refund: /^rfnd_[A-Za-z0-9]{6,40}$/,
  signature: /^[a-f0-9]{64}$/,
};

// One JSON line per payment event, so logs can be searched and alerted on.
// Only ids, amounts and states: never secrets, card data or contact details.
const LOG_FIELDS = ['orderNumber', 'razorpayOrderId', 'razorpayPaymentId', 'razorpayRefundId', 'eventId', 'status', 'amount', 'currency', 'source', 'outcome', 'reason'];
export function payLog(event, fields = {}) {
  if (process.env.NODE_ENV === 'test') return;
  const safe = Object.fromEntries(LOG_FIELDS.filter((k) => fields[k] !== undefined && fields[k] !== null).map((k) => [k, fields[k]]));
  console.log(JSON.stringify({ at: new Date().toISOString(), scope: 'payment', event, ...safe }));
}

const providerError = () => Object.assign(new Error('The payment provider is not responding. Please try again in a moment.'), { status: 502 });

async function call(path, { method = 'GET', body } = {}) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      ...(body && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    payLog('provider_unreachable', { reason: `${method} ${path.split('/')[1]}` });
    throw providerError();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    payLog('provider_error', { status: res.status, reason: String(data?.error?.description || data?.error?.code || '').slice(0, 160) });
    throw Object.assign(providerError(), { providerStatus: res.status, providerCode: data?.error?.code, providerDescription: data?.error?.description });
  }
  return data;
}

// Creates the Razorpay order for one of our orders. Amount in paise.
export async function createRazorpayOrder({ amount, currency, receipt, notes }) {
  const data = await call('/orders', { method: 'POST', body: { amount, currency, receipt, notes } });
  if (!data.id) throw providerError();
  return data;
}

export const fetchPayment = (paymentId) => call(`/payments/${paymentId}`);
export const fetchOrderPayments = async (orderId) => (await call(`/orders/${orderId}/payments`)).items || [];
export const capturePayment = (paymentId, amount, currency) => call(`/payments/${paymentId}/capture`, { method: 'POST', body: { amount, currency } });
export const createRefund = (paymentId, { amount, receipt, notes }) =>
  call(`/payments/${paymentId}/refund`, { method: 'POST', body: { amount, receipt, notes, speed: 'normal' } });

export const safeEqual = (a, b) => {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};

// Checkout callback: HMAC-SHA256(order_id|payment_id) with the key secret.
export const verifyPaymentSignature = ({ orderId, paymentId, signature }) =>
  !!process.env.RAZORPAY_KEY_SECRET &&
  safeEqual(crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex'), signature);

// Webhook: HMAC-SHA256(raw body) with the webhook secret.
export const verifyWebhookSignature = (rawBody, signature) =>
  !!process.env.RAZORPAY_WEBHOOK_SECRET && !!rawBody && !!signature &&
  safeEqual(crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex'), signature);
