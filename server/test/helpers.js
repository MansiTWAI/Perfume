// Test harness: an in-memory MongoDB, the real Express app on a random port,
// and a fake Razorpay API (global fetch is intercepted for api.razorpay.com),
// so no real payment, database or third-party service is ever touched.
//
// Run: npm test   (set MONGOMS_SYSTEM_BINARY to a local mongod to skip the
// one-time MongoDB download)
import crypto from 'crypto';

// Blank every outside service before the app loads server/.env (dotenv never
// overwrites a variable that is already set).
for (const k of ['CLOUDINARY_URL', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'CLIENT_ORIGIN']) process.env[k] = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(24).toString('hex');
process.env.RAZORPAY_KEY_ID = 'rzp_test_FAKEKEY123';
process.env.RAZORPAY_KEY_SECRET = crypto.randomBytes(16).toString('hex');
process.env.RAZORPAY_WEBHOOK_SECRET = crypto.randomBytes(16).toString('hex');

const { MongoMemoryServer } = await import('mongodb-memory-server-core');
const mem = await MongoMemoryServer.create();
process.env.MONGODB_URI = mem.getUri('albarakah-test');

const { connectDB } = await import('../src/config/db.js');
await connectDB();
const { default: app } = await import('../src/app.js');
export const { default: User } = await import('../src/models/User.js');
export const { default: Product } = await import('../src/models/Product.js');
export const { default: Order } = await import('../src/models/Order.js');
export const { default: PaymentEvent } = await import('../src/models/PaymentEvent.js');
const { signToken } = await import('../src/middleware/auth.js');
const mongoose = (await import('mongoose')).default;
await Promise.all([Order.init(), PaymentEvent.init(), Product.init(), User.init()]);

// ----- fake Razorpay -----
export const rzp = { orders: new Map(), payments: new Map(), refunds: new Map(), down: false, calls: [] };
const rid = (p) => `${p}_${crypto.randomBytes(7).toString('hex')}`;
const realFetch = globalThis.fetch;
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (!u.startsWith('https://api.razorpay.com/v1')) return realFetch(url, opts);
  const auth = Buffer.from(String(opts.headers?.Authorization || '').replace('Basic ', ''), 'base64').toString();
  if (auth !== `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`) return reply(401, { error: { code: 'BAD_REQUEST_ERROR', description: 'Authentication failed' } });
  const path = u.slice('https://api.razorpay.com/v1'.length);
  const method = opts.method || 'GET';
  rzp.calls.push(`${method} ${path}`);
  if (rzp.down) throw new TypeError('fetch failed');
  const body = opts.body ? JSON.parse(opts.body) : {};
  let m;
  if (method === 'POST' && path === '/orders') {
    if (!Number.isInteger(body.amount) || body.amount < 100) return reply(400, { error: { description: 'Order amount less than minimum amount allowed' } });
    const o = { id: rid('order'), entity: 'order', amount: body.amount, currency: body.currency, receipt: body.receipt, status: 'created', notes: body.notes };
    rzp.orders.set(o.id, o);
    return reply(200, o);
  }
  if (method === 'GET' && (m = path.match(/^\/orders\/([^/]+)\/payments$/))) return reply(200, { items: [...rzp.payments.values()].filter((p) => p.order_id === m[1]) });
  if (method === 'GET' && (m = path.match(/^\/payments\/([^/]+)$/))) return rzp.payments.has(m[1]) ? reply(200, rzp.payments.get(m[1])) : reply(400, { error: { description: 'The id provided does not exist' } });
  if (method === 'POST' && (m = path.match(/^\/payments\/([^/]+)\/capture$/))) {
    const p = rzp.payments.get(m[1]);
    if (!p || p.status !== 'authorized' || body.amount !== p.amount) return reply(400, { error: { description: 'This payment has already been captured' } });
    p.status = 'captured';
    return reply(200, p);
  }
  if (method === 'POST' && (m = path.match(/^\/payments\/([^/]+)\/refund$/))) {
    const p = rzp.payments.get(m[1]);
    const done = [...rzp.refunds.values()].filter((r) => r.payment_id === m[1]).reduce((n, r) => n + r.amount, 0);
    const amount = body.amount ?? p.amount - done;
    if (!p || p.status !== 'captured' || amount > p.amount - done) return reply(400, { error: { description: 'The refund amount provided is greater than amount captured' } });
    const r = { id: rid('rfnd'), entity: 'refund', payment_id: p.id, amount, currency: p.currency, status: 'processed', notes: body.notes, receipt: body.receipt };
    rzp.refunds.set(r.id, r);
    return reply(200, r);
  }
  return reply(404, { error: { description: 'not found' } });
};

// The customer pays in the Razorpay window: creates the payment and returns
// what Checkout hands to the browser's handler.
export function pay(rpOrderId, { amount, status = 'captured', method = 'upi' } = {}) {
  const o = rzp.orders.get(rpOrderId);
  const p = { id: rid('pay'), entity: 'payment', order_id: rpOrderId, amount: amount ?? o.amount, currency: o.currency, status, method, error_description: status === 'failed' ? 'Payment declined by bank' : null };
  rzp.payments.set(p.id, p);
  if (status === 'captured' && p.amount === o.amount) o.status = 'paid';
  return { payment: p, response: { razorpay_order_id: rpOrderId, razorpay_payment_id: p.id, razorpay_signature: sign(`${rpOrderId}|${p.id}`) } };
}
export const sign = (s, secret = process.env.RAZORPAY_KEY_SECRET) => crypto.createHmac('sha256', secret).update(s).digest('hex');

// ----- HTTP -----
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
// Each request comes from its own client address unless `ip` is given, so
// the per-IP rate limits only bite in the test that is about them.
const anyIp = () => `10.${crypto.randomInt(256)}.${crypto.randomInt(256)}.${crypto.randomInt(1, 255)}`;
export async function http(method, path, { body, token, headers = {}, raw, ip = anyIp() } = {}) {
  const res = await realFetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip, ...(token && { Authorization: `Bearer ${token}` }), ...headers },
    ...(body !== undefined && { body: raw ?? JSON.stringify(body) }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}
export function webhook(event, payload, { eventId = rid('evt'), secret } = {}) {
  const raw = JSON.stringify({ entity: 'event', event, payload, created_at: Math.floor(Date.now() / 1000) });
  return http('POST', '/api/payments/razorpay/webhook', { body: {}, raw, headers: { 'x-razorpay-signature': sign(raw, secret || process.env.RAZORPAY_WEBHOOK_SECRET), 'x-razorpay-event-id': eventId } });
}

// ----- data -----
export async function makeUser(role = 'customer', email = `${rid('u')}@example.test`) {
  const u = await User.create({ name: `Test ${role}`, email, passwordHash: await User.hashPassword(crypto.randomBytes(9).toString('hex')), role });
  return { user: u, token: signToken(u) };
}
export async function makeProduct({ slug = rid('p'), inr = 2799, aed = 129, stock = 10 } = {}) {
  return Product.create({ name: slug.toUpperCase(), slug, price: { INR: inr, AED: aed }, stock, published: true });
}
export const customer = (email = 'buyer@example.test') => ({ name: 'Test Buyer', email, phone: '9876543210', address: { line1: '1 Test Road', city: 'Mumbai', postalCode: '400001' } });
export async function placeOnline(items, { email = 'buyer@example.test', token, extra = {} } = {}) {
  const r = await http('POST', '/api/orders', { token, body: { region: 'IN', paymentMethod: 'online', items, customer: customer(email), ...extra } });
  return r;
}

export async function reset() {
  await mongoose.connection.db.dropDatabase();
  await Promise.all([Order, PaymentEvent, Product, User].map((m) => m.createIndexes()));
  rzp.orders.clear();
  rzp.payments.clear();
  rzp.refunds.clear();
  rzp.down = false;
  rzp.calls.length = 0;
}

export async function close() {
  server.close();
  await mongoose.disconnect();
  await mem.stop();
}
