// Test harness: an in-memory MongoDB, the real Express app on a random port,
// and a fake Razorpay API (global fetch is intercepted for api.razorpay.com),
// so no real payment, database or third-party service is ever touched.
//
// Run: npm test   (set MONGOMS_SYSTEM_BINARY to a local mongod to skip the
// one-time MongoDB download)
import crypto from 'crypto';

// Blank every outside service before the app loads server/.env (dotenv never
// overwrites a variable that is already set).
for (const k of ['CLOUDINARY_URL', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'WHATSAPP_OTP_TEMPLATE', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'CLIENT_ORIGIN']) process.env[k] = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(24).toString('hex');
process.env.RAZORPAY_KEY_ID = 'rzp_test_FAKEKEY123';
process.env.RAZORPAY_KEY_SECRET = crypto.randomBytes(16).toString('hex');
process.env.RAZORPAY_WEBHOOK_SECRET = crypto.randomBytes(16).toString('hex');
process.env.GEMINI_API_KEY = `test-gemini-${crypto.randomBytes(8).toString('hex')}`;
process.env.DELHIVERY_API_TOKEN = `dlv-${crypto.randomBytes(12).toString('hex')}`;
process.env.DELHIVERY_ENV = 'staging';
process.env.DELHIVERY_PICKUP_LOCATION = 'Test Warehouse';
process.env.DELHIVERY_WEBHOOK_TOKEN = crypto.randomBytes(20).toString('hex');
process.env.DELHIVERY_AUTO_CREATE = 'true';
process.env.MAIL_TRANSPORT = 'memory';
process.env.WHATSAPP_ACCESS_TOKEN = `wa-${crypto.randomBytes(12).toString('hex')}`;
process.env.WHATSAPP_PHONE_NUMBER_ID = '100200300400';
process.env.WHATSAPP_NOTIFY_TEMPLATE = 'house_update';
process.env.WHATSAPP_NOTIFY_PARAMS = 'name,message';
process.env.WHATSAPP_APP_SECRET = crypto.randomBytes(16).toString('hex');
process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = crypto.randomBytes(10).toString('hex');

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
export const { default: Lead } = await import('../src/models/Lead.js');
export const { default: ChatSession } = await import('../src/models/ChatSession.js');
const { signToken } = await import('../src/middleware/auth.js');
export const { outbox } = await import('../src/services/mail.js');
export const shipping = await import('../src/services/shipping.js');
export const whatsapp = await import('../src/services/whatsapp.js');
export const { default: WhatsAppContact } = await import('../src/models/WhatsAppContact.js');
export const { default: WhatsAppMessage, WhatsAppCampaign } = await import('../src/models/WhatsAppMessage.js');
export const { default: Coupon } = await import('../src/models/Coupon.js');
const mongoose = (await import('mongoose')).default;
await Promise.all([Order.init(), PaymentEvent.init(), Product.init(), User.init()]);

// ----- fake Gemini -----
// Queue replies with gemini.reply(...): each is a content object, a function
// (request body) => content, or { status } for an HTTP error. Every request
// is kept in gemini.requests (url, headers, body) for assertions.
export const gemini = {
  queue: [], requests: [],
  reply(...items) { this.queue.push(...items); },
  text: (text) => ({ role: 'model', parts: [{ text }] }),
  call: (name, args = {}) => ({ role: 'model', parts: [{ functionCall: { name, args }, thoughtSignature: 'sig-abc' }] }),
};

// ----- fake Delhivery -----
// Shipments by waybill. Switches: down (network error), timeoutAfterCreate
// (creates the shipment, then the reply is lost), rejectNext (a remark),
// trackDown. Every call is kept in dlv.calls ("POST /api/cmu/create.json").
export const dlv = { shipments: new Map(), calls: [], bodies: [], trackQueries: [], down: false, trackDown: false, timeoutAfterCreate: false, rejectNext: null, cancelled: [] };
const dlvBase = /^https:\/\/(staging-express|track)\.delhivery\.com/;
const awbNo = () => String(1000000000000 + crypto.randomInt(1e9) * 1000 + crypto.randomInt(1000));
// Adds a scan to a fake shipment (what Delhivery's tracking API returns).
dlv.scan = (awb, Status, StatusType = 'UD', { at = new Date(), location = 'Hyderabad_Kukatpally_D (Telangana)', note = '' } = {}) => {
  const ist = new Date(at.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 23); // India time, no zone
  dlv.shipments.get(awb).scans.push({ ScanDetail: { Scan: Status, ScanType: StatusType, ScanDateTime: ist, StatusDateTime: ist, ScannedLocation: location, Instructions: note } });
  return { Status, StatusType, StatusDateTime: ist, StatusLocation: location, Instructions: note };
};
async function fakeDelhivery(u, opts) {
  const url = new URL(u);
  const method = opts.method || 'GET';
  dlv.calls.push(`${method} ${url.pathname}`);
  if (dlv.down) throw new TypeError('fetch failed');
  const token = String(opts.headers?.Authorization || '').replace('Token ', '') || url.searchParams.get('token');
  if (token !== process.env.DELHIVERY_API_TOKEN) return new Response('You could not be authenticated', { status: 401 });
  if (method === 'POST' && url.pathname === '/api/cmu/create.json') {
    const form = new URLSearchParams(opts.body);
    const data = JSON.parse(form.get('data'));
    dlv.bodies.push(data);
    const sh = data.shipments[0];
    const fail = (remarks) => reply(200, { success: false, package_count: 1, packages: [{ status: 'Fail', waybill: '', refnum: sh.order, remarks: [remarks] }], rmk: '' });
    if (form.get('format') !== 'json' || data.pickup_location?.name !== process.env.DELHIVERY_PICKUP_LOCATION) return fail('ClientWarehouse matching query does not exist.');
    if (dlv.rejectNext) { const r = dlv.rejectNext; dlv.rejectNext = null; return fail(r); }
    if ([...dlv.shipments.values()].some((x) => x.ref === sh.order)) return fail('Duplicate order id');
    if (!/^\d{6}$/.test(sh.pin)) return fail('Crashing while saving package due to exception pin');
    const awb = awbNo();
    dlv.shipments.set(awb, { ref: sh.order, payload: sh, scans: [], status: null });
    dlv.scan(awb, 'Manifested', 'UD', { note: 'Manifest uploaded' });
    if (dlv.timeoutAfterCreate) { dlv.timeoutAfterCreate = false; throw new DOMException('The operation timed out.', 'TimeoutError'); }
    return reply(200, { success: true, package_count: 1, upload_wbn: `UPL${crypto.randomInt(1e9)}`, packages: [{ status: 'Success', waybill: awb, refnum: sh.order, remarks: [] }] });
  }
  if (method === 'GET' && url.pathname === '/api/v1/packages/json/') {
    if (dlv.trackDown) return reply(503, { Error: 'down' });
    dlv.trackQueries.push(Object.fromEntries([...url.searchParams].filter(([k]) => k !== 'token')));
    const refs = (url.searchParams.get('ref_ids') || '').split(',').filter(Boolean);
    const want = [...new Set([...(url.searchParams.get('waybill') || '').split(',').filter(Boolean), ...[...dlv.shipments.entries()].filter(([, x]) => refs.includes(x.ref)).map(([w]) => w)])];
    const found = want.filter((w) => dlv.shipments.has(w));
    if (!found.length) return reply(200, { Error: 'No such waybill or Order Id found' });
    return reply(200, { ShipmentData: found.map((w) => {
      const x = dlv.shipments.get(w);
      const last = x.scans.at(-1).ScanDetail;
      return { Shipment: { AWB: w, ReferenceNo: x.ref, Status: { Status: last.Scan, StatusType: last.ScanType, StatusDateTime: last.StatusDateTime, StatusLocation: last.ScannedLocation, Instructions: last.Instructions }, Scans: x.scans, ExpectedDeliveryDate: x.edd || null, Consignee: { Name: 'should-not-be-stored' } } };
    }) });
  }
  if (method === 'POST' && url.pathname === '/api/p/edit') {
    const b = JSON.parse(opts.body);
    if (b.cancellation !== 'true' || !dlv.shipments.has(b.waybill)) return reply(200, { status: false, remark: 'Invalid waybill' });
    dlv.cancelled.push(b.waybill);
    dlv.scan(b.waybill, 'Cancelled', 'UD', { note: 'Shipment cancelled' });
    return reply(200, { status: true, waybill: b.waybill, remark: 'Shipment has been cancelled', order_id: dlv.shipments.get(b.waybill).ref });
  }
  return reply(404, { error: 'not found' });
}

// ----- fake WhatsApp Cloud API -----
// Every send is kept in wa.sent ({ to, body }). Queue failures with
// wa.fail.push({ status, code, message }) (one per send) or set wa.down.
export const wa = { sent: [], fail: [], down: false };
async function fakeWhatsApp(u, opts) {
  if (wa.down) throw new TypeError('fetch failed');
  if (opts.headers?.Authorization !== `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`) return reply(401, { error: { code: 190, message: 'Invalid OAuth access token.' } });
  if (!u.endsWith(`/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`)) return reply(404, { error: { code: 100, message: 'Unknown path' } });
  const body = JSON.parse(opts.body);
  const f = wa.fail.shift();
  if (f) return reply(f.status || 400, { error: { code: f.code, message: f.message || 'scripted failure' } });
  const params = body.template?.components?.[0]?.parameters || [];
  if (params.some((p) => /[\n\t]| {5,}/.test(p.text))) return reply(400, { error: { code: 132018, message: 'Param text cannot have new-line/tab characters or more than 4 consecutive spaces' } });
  const id = `wamid.${crypto.randomBytes(12).toString('hex')}`;
  wa.sent.push({ to: body.to, body, id });
  return reply(200, { messaging_product: 'whatsapp', contacts: [{ input: body.to, wa_id: body.to }], messages: [{ id }] });
}
// A signed status/reply webhook from Meta.
export function waHook(value, { secret = process.env.WHATSAPP_APP_SECRET } = {}) {
  const raw = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: 'WABA', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', ...value } }] }] });
  return http('POST', '/api/whatsapp/webhook', { body: {}, raw, headers: { 'x-hub-signature-256': `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}` } });
}

// ----- fake Razorpay -----
export const rzp = { orders: new Map(), payments: new Map(), refunds: new Map(), down: false, calls: [] };
const rid = (p) => `${p}_${crypto.randomBytes(7).toString('hex')}`;
const realFetch = globalThis.fetch;
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.startsWith('https://generativelanguage.googleapis.com/')) {
    const body = JSON.parse(opts.body);
    gemini.requests.push({ url: u, headers: opts.headers, body });
    const next = gemini.queue.shift();
    if (!next) return reply(200, { candidates: [{ content: gemini.text('(no scripted reply)') }] });
    if (next.throw) throw new TypeError('fetch failed');
    if (next.status) return reply(next.status, { error: { message: 'scripted error' } });
    return reply(200, { candidates: [{ content: typeof next === 'function' ? next(body) : next }] });
  }
  if (dlvBase.test(u)) return fakeDelhivery(u, opts);
  if (u.startsWith('https://graph.facebook.com/')) return fakeWhatsApp(u, opts);
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
export const base = `http://127.0.0.1:${server.address().port}`;
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
  await whatsapp.whatsappIdle(); // let a send in progress finish before the data goes
  await mongoose.connection.db.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.createIndexes())); // unique indexes are part of the rules
  gemini.queue.length = 0;
  gemini.requests.length = 0;
  rzp.orders.clear();
  rzp.payments.clear();
  rzp.refunds.clear();
  rzp.down = false;
  rzp.calls.length = 0;
  dlv.shipments.clear();
  dlv.calls.length = 0;
  dlv.bodies.length = 0;
  dlv.trackQueries.length = 0;
  dlv.cancelled.length = 0;
  Object.assign(dlv, { down: false, trackDown: false, timeoutAfterCreate: false, rejectNext: null });
  outbox.length = 0;
  wa.sent.length = 0;
  wa.fail.length = 0;
  wa.down = false;
}

export async function close() {
  server.close();
  await mongoose.disconnect();
  await mem.stop();
}
