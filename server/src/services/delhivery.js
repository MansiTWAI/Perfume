// Delhivery Express API (India). Server only: the token never reaches the
// browser, the logs or an API response.
//
// Environment:
//   DELHIVERY_API_TOKEN        account API token (staging token first, then production)
//   DELHIVERY_ENV              staging (default) | production
//   DELHIVERY_PICKUP_LOCATION  warehouse name exactly as registered with Delhivery (case-sensitive)
//   DELHIVERY_WEBHOOK_TOKEN    shared secret Delhivery sends with every scan push
//
// Endpoints (delhivery-express-api-doc.readme.io):
//   POST /api/cmu/create.json      create (manifest) a shipment; body format=json&data=<json>
//   GET  /api/v1/packages/json/?waybill=<awb>&ref_ids=<order id>   tracking (up to 50 each, comma separated)
//   POST /api/p/edit               cancel: { waybill, cancellation: "true" }
import crypto from 'crypto';

export const delhiveryConfigured = () => !!(process.env.DELHIVERY_API_TOKEN && process.env.DELHIVERY_PICKUP_LOCATION);
export const delhiveryMode = () => (process.env.DELHIVERY_ENV === 'production' ? 'production' : 'staging');
const base = () => (delhiveryMode() === 'production' ? 'https://track.delhivery.com' : 'https://staging-express.delhivery.com');

// Waybills are digits; order references are our order numbers.
export const AWB_RX = /^[0-9]{8,20}$/;
export const REF_RX = /^[A-Z0-9-]{4,30}$/;

// One JSON line per shipping event: ids and states only, never the token,
// addresses or phone numbers.
const LOG_FIELDS = ['orderNumber', 'awb', 'status', 'courierStatus', 'source', 'outcome', 'reason', 'count'];
export function shipLog(event, fields = {}) {
  if (process.env.NODE_ENV === 'test') return;
  const safe = Object.fromEntries(LOG_FIELDS.filter((k) => fields[k] !== undefined && fields[k] !== null).map((k) => [k, fields[k]]));
  console.log(JSON.stringify({ at: new Date().toISOString(), scope: 'shipping', event, ...safe }));
}

// Errors carry `retryable` (timeouts, 5xx, network) and `unknown` (the
// request may have reached Delhivery, so the result must be looked up
// before trying again).
const fail = (message, extra = {}) => Object.assign(new Error(message), extra);

async function call(path, { method = 'GET', query, form, json, timeout = 15000 } = {}) {
  const url = new URL(base() + path);
  for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, v);
  const headers = { Authorization: `Token ${process.env.DELHIVERY_API_TOKEN}`, Accept: 'application/json' };
  let body;
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(form).toString();
  } else if (json) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }
  let res;
  try {
    res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(timeout) });
  } catch (e) {
    const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    // A POST that timed out may still have been processed.
    throw fail(timedOut ? 'Delhivery did not answer in time.' : 'Could not reach Delhivery.', { retryable: true, unknown: method !== 'GET' });
  }
  const text = await res.text();
  if (res.status === 401 || res.status === 403) throw fail('Delhivery refused the API token. Check DELHIVERY_API_TOKEN and DELHIVERY_ENV.', { retryable: false, auth: true });
  if (res.status === 429) throw fail('Delhivery rate limit reached. Retrying later.', { retryable: true });
  if (res.status >= 500) throw fail(`Delhivery is having trouble (HTTP ${res.status}).`, { retryable: true, unknown: method !== 'GET' });
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw fail(`Delhivery sent an unexpected reply (HTTP ${res.status}).`, { retryable: res.status >= 500, unknown: method !== 'GET' });
  }
  if (res.status >= 400) throw fail(clean(data?.rmk || data?.error || data?.Error || `Delhivery rejected the request (HTTP ${res.status}).`), { retryable: false });
  return data;
}

// Delhivery refuses & # % ; and backslashes in text fields.
export const clean = (v, max = 200) => String(v ?? '').replace(/[&#%;\\]/g, ' ').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const digits = (v) => String(v || '').replace(/\D/g, '');

// The shipment request for one of our orders. Only what Delhivery needs.
export function shipmentPayload(order, ref = order.orderNumber, cfg = shippingConfig()) {
  const c = order.customer;
  const a = c.address || {};
  const cod = order.paymentMethod === 'cod' && order.paymentStatus === 'pending';
  const qty = order.items.reduce((n, i) => n + (i.qty || 0), 0) || 1;
  const phone = digits(c.phone).slice(-10);
  return {
    pickup_location: { name: process.env.DELHIVERY_PICKUP_LOCATION },
    shipments: [
      {
        order: ref,
        name: clean(c.name, 80),
        add: clean([a.line1, a.line2].filter(Boolean).join(', '), 250),
        city: clean(a.city, 60),
        state: clean(a.state, 60),
        country: 'India',
        pin: digits(a.postalCode).slice(0, 6),
        phone,
        payment_mode: cod ? 'COD' : 'Prepaid',
        cod_amount: cod ? order.total : 0,
        total_amount: order.total,
        order_date: new Date(order.createdAt || Date.now()).toISOString().slice(0, 19).replace('T', ' '),
        products_desc: clean(order.items.map((i) => `${i.name} x ${i.qty}`).join(', '), 200),
        quantity: String(qty),
        weight: String(cfg.itemWeight * qty + cfg.boxWeight),
        shipment_length: cfg.length,
        shipment_width: cfg.width,
        shipment_height: cfg.height,
        shipping_mode: cfg.mode,
        hsn_code: cfg.hsn,
        ...(cfg.sellerGst && { seller_gst_tin: cfg.sellerGst }),
        ...(cfg.sellerName && { seller_name: cfg.sellerName }),
        fragile_shipment: 'true',
      },
    ],
  };
}

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
export function shippingConfig() {
  return {
    itemWeight: num(process.env.DELHIVERY_ITEM_WEIGHT_G, 350), // grams per bottle, boxed
    boxWeight: num(process.env.DELHIVERY_BOX_WEIGHT_G, 150),
    length: num(process.env.DELHIVERY_BOX_L_CM, 20),
    width: num(process.env.DELHIVERY_BOX_W_CM, 15),
    height: num(process.env.DELHIVERY_BOX_H_CM, 12),
    mode: process.env.DELHIVERY_SHIPPING_MODE === 'Express' ? 'Express' : 'Surface',
    hsn: String(process.env.DELHIVERY_HSN_CODE || '33030010'), // perfumes and toilet waters
    sellerGst: String(process.env.DELHIVERY_SELLER_GST_TIN || '').trim(),
    sellerName: clean(process.env.DELHIVERY_SELLER_NAME || 'AL BARAKAH LIFESTYLE', 60),
  };
}

// Creates the shipment. Returns { awb, reference } or throws. A "duplicate
// order id" answer means Delhivery already has this order: the caller looks
// the waybill up instead of creating another one.
export async function createShipment(order, ref = order.orderNumber) {
  const data = await call('/api/cmu/create.json', { method: 'POST', form: { format: 'json', data: JSON.stringify(shipmentPayload(order, ref)) }, timeout: 20000 });
  const pkg = Array.isArray(data?.packages) ? data.packages.find((p) => !p.refnum || String(p.refnum) === ref) || data.packages[0] : null;
  const remarks = clean([].concat(pkg?.remarks || []).join(' ') || data?.rmk || '', 300);
  if (pkg && String(pkg.status).toLowerCase() === 'success' && AWB_RX.test(String(pkg.waybill || ''))) {
    return { awb: String(pkg.waybill), reference: clean(data.upload_wbn || '', 40) };
  }
  if (/duplicate/i.test(remarks)) throw fail('Delhivery already has a shipment for this order.', { duplicate: true, retryable: false });
  throw fail(remarks || 'Delhivery could not create the shipment.', { retryable: /internal error|try again|timeout/i.test(remarks) });
}

// Tracking: GET /api/v1/packages/json/?waybill=<awbs>&ref_ids=<order ids>,
// both sent when known (up to 50 each). Returns Delhivery's Shipment objects.
export async function trackShipments({ awbs = [], refs = [], ref } = {}) {
  const list = awbs.map(String).filter((w) => AWB_RX.test(w)).slice(0, 50);
  const ids = [...refs, ...(ref ? [ref] : [])].map((x) => String(x).toUpperCase()).filter((x) => REF_RX.test(x)).slice(0, 50);
  if (!list.length && !ids.length) return [];
  const query = { ...(list.length && { waybill: list.join(',') }), ...(ids.length && { ref_ids: ids.join(',') }) };
  // The tracking API takes the token as a query parameter (as documented);
  // it is sent only to Delhivery over HTTPS and the URL is never logged.
  const data = await call('/api/v1/packages/json/', { query: { ...query, token: process.env.DELHIVERY_API_TOKEN } });
  if (data?.Error) {
    if (/no such|no data|not found|invalid/i.test(String(data.Error))) return [];
    throw fail(clean(data.Error), { retryable: false });
  }
  return (Array.isArray(data?.ShipmentData) ? data.ShipmentData : []).map((x) => x?.Shipment).filter(Boolean);
}

export async function cancelShipment(awb) {
  if (!AWB_RX.test(String(awb))) throw fail('Not a Delhivery waybill.', { retryable: false });
  const data = await call('/api/p/edit', { method: 'POST', json: { waybill: String(awb), cancellation: 'true' } });
  if (data?.status === true || /cancel/i.test(String(data?.remark || ''))) return { ok: true, remark: clean(data?.remark || 'Cancelled', 200) };
  throw fail(clean(data?.remark || data?.error || 'Delhivery could not cancel this shipment.'), { retryable: false });
}

// Scan-push authentication: Delhivery sends the header agreed during webhook
// setup. We accept "Authorization: Bearer <token>", "Authorization: Token
// <token>" or "X-Webhook-Token: <token>", compared in constant time.
export function webhookAuthorized(req) {
  const secret = process.env.DELHIVERY_WEBHOOK_TOKEN || '';
  if (secret.length < 16) return false;
  const auth = String(req.get('authorization') || '');
  const given = auth.replace(/^(Bearer|Token)\s+/i, '') || String(req.get('x-webhook-token') || '');
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(secret).digest();
  return given.length > 0 && crypto.timingSafeEqual(a, b);
}
