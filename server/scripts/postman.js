// Builds the Postman collection (v2.1) and environments from the OpenAPI
// description, so they always match the routes (server/test/openapi.test.js).
//   npm run postman   →   docs/postman/*.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { openapi } from '../src/docs/openapi.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'docs/postman');
const spec = openapi('https://albarakah.me');
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

// {id} after /products → {{productId}}; named params keep their own variable.
const SINGULAR = { categories: 'category', addresses: 'address', imports: 'import', customers: 'customer', devices: 'device' };
const singular = (seg) => SINGULAR[seg] || seg.replace(/s$/, '');
const NAMED = { slug: 'productSlug', trackingId: 'trackingId', orderId: 'orderId', productId: 'productId', sessionId: 'sessionId', paymentId: 'paymentId', orderNumber: 'orderNumber' };
function paramVar(p, name) {
  if (name !== 'id') return NAMED[name] || name;
  const segs = p.split('/').filter(Boolean);
  const i = segs.indexOf('{id}');
  return `${singular(segs[i - 1] || 'item')}Id`;
}

// A sample body from a schema when the spec has no example. String fields get
// a believable value by name, so "create" requests work as they are.
const BY_NAME = {
  name: 'Sample name', title: 'Sample title', slug: 'sample-{{$timestamp}}', email: '{{email}}', phone: '+91 98765 43210', password: 'ChangeMe-12345',
  code: 'WELCOME10', message: 'Hello from Postman', description: 'Sample description', subtitle: 'Eau de Parfum', family: 'Oriental Woody Oud',
  fullName: 'Sample Customer', addressLine1: '12 Sample Road', line1: '12 Sample Road', city: 'Hyderabad', state: 'Telangana', postalCode: '500001',
  countryCode: 'IN', region: 'IN', currency: 'INR', question: 'How are sales this week?', brief: 'Eid launch with 10% off', identifier: '{{email}}',
  trackingId: '{{trackingId}}', orderNumber: '{{orderNumber}}', refreshToken: '{{refreshToken}}', sessionId: '{{sessionId}}', product: '{{productSlug}}',
  slugOrId: '{{productSlug}}', src: 'https://albarakah.me/media/render-zafreon.webp', alt: 'Bottle', topic: 'Product question', reply: 'Thank you!',
};
function sample(schema, depth = 0, key = '') {
  if (!schema || depth > 4) return undefined;
  if (schema.$ref) return sample(spec.components.schemas[schema.$ref.split('/').pop()], depth + 1);
  if (schema.example !== undefined) return schema.example;
  if (schema.enum) return schema.enum[0];
  switch (schema.type) {
    case 'object': {
      const o = {};
      for (const [k, v] of Object.entries(schema.properties || {})) { const s = sample(v, depth + 1, k); if (s !== undefined) o[k] = s; }
      return o;
    }
    case 'array': { const s = sample(schema.items, depth + 1, key); return s === undefined ? [] : [s]; }
    case 'integer': case 'number': return key === 'qty' || key === 'quantity' ? 1 : key === 'stock' ? 10 : key === 'percent' ? 10 : key === 'rating' ? 5 : key === 'INR' ? 2799 : key === 'AED' ? 129 : 1;
    case 'boolean': return true;
    case 'string': if (BY_NAME[key] !== undefined) return BY_NAME[key]; return schema.format === 'date-time' ? '2026-12-01T10:00:00.000Z' : schema.format === 'date' ? '2026-12-01' : schema.format === 'email' ? '{{email}}' : '';
    default: return undefined;
  }
}

const isAdmin = (op, p) => (op.tags || []).some((t) => t.startsWith('Admin')) || p.startsWith('/admin') || p.startsWith('/users');

// Saves tokens and new ids into collection variables, for /api/v1 (enveloped) and /api (plain).
const SAVE = (p, method, op) => {
  const lines = ["const j = pm.response.json(); const d = (j && j.data !== undefined) ? j.data : j;"];
  if (['/auth/login', '/auth/register', '/auth/verify-otp', '/auth/refresh'].includes(p)) {
    const which = op.__adminLogin ? 'adminToken' : 'token';
    lines.push(`if (d && (d.token || d.accessToken)) { pm.collectionVariables.set('${which}', d.token || d.accessToken); }`);
    lines.push("if (d && d.refreshToken) pm.collectionVariables.set('refreshToken', d.refreshToken);");
  }
  if (method === 'post' && !p.endsWith('}') && !p.startsWith('/auth')) {
    const last = p.split('/').filter(Boolean).pop();
    const v = `${singular(last)}Id`;
    lines.push(`const o = d && ([d.order, d.product, d.coupon, d.template, d.campaign, d.address, d.item].find((x) => x && typeof x === 'object') || d); if (o && (o.id || o._id)) pm.collectionVariables.set('${v}', o.id || o._id);`);
    if (p === '/orders') lines.push("if (o && o.trackingId) pm.collectionVariables.set('trackingId', o.trackingId); if (o && o.orderNumber) pm.collectionVariables.set('orderNumber', o.orderNumber);");
    if (p === '/ai/chat') lines.push("if (d && d.sessionId) pm.collectionVariables.set('sessionId', d.sessionId);");
    if (p === '/admin/whatsapp/campaigns') lines.push("if (d && d.id) pm.collectionVariables.set('campaignId', d.id);");
  }
  lines.push("pm.test('status is 2xx', () => pm.expect(pm.response.code).to.be.within(200, 299));");
  return lines;
};

function request(p, method, op) {
  const segs = p.split('/').filter(Boolean).map((s) => {
    const m = s.match(/^\{(\w+)\}$/);
    return m ? `:${m[1]}` : s;
  });
  const variable = [...p.matchAll(/\{(\w+)\}/g)].map(([, name]) => {
    const prm = (op.parameters || []).find((x) => x.in === 'path' && x.name === name);
    return { key: name, value: `{{${paramVar(p, name)}}}`, description: prm?.description || '' };
  });
  const query = (op.parameters || []).filter((x) => x.in === 'query').map((x) => ({ key: x.name, value: x.example !== undefined ? String(x.example) : '', description: x.description || '', disabled: x.example === undefined }));
  const req = {
    method: method.toUpperCase(),
    header: [],
    url: { raw: `{{baseUrl}}/${segs.join('/')}${query.filter((x) => !x.disabled).length ? `?${query.filter((x) => !x.disabled).map((x) => `${x.key}=${x.value}`).join('&')}` : ''}`, host: ['{{baseUrl}}'], path: segs, ...(query.length && { query }), ...(variable.length && { variable }) },
    description: [op.description || '', '', `**Responses:** ${Object.entries(op.responses || {}).map(([c, r]) => `\`${c}\` ${r.description || ''}`).join(' · ')}`].join('\n').trim(),
  };
  if (op.security) req.auth = { type: 'bearer', bearer: [{ key: 'token', value: isAdmin(op, p) ? '{{adminToken}}' : '{{token}}', type: 'string' }] };
  else req.auth = { type: 'noauth' };
  const content = op.requestBody?.content || {};
  if (content['multipart/form-data']) {
    // The file, then any text fields the form takes (with their examples).
    const props = content['multipart/form-data'].schema?.properties || {};
    const fields = Object.entries(props).filter(([k]) => k !== 'file').map(([key, s]) => ({ key, value: s.example !== undefined ? String(s.example) : '', type: 'text', ...(s.example === undefined && { disabled: true }) }));
    req.body = { mode: 'formdata', formdata: [{ key: 'file', type: 'file', src: [], description: 'Choose the file' }, ...fields] };
  } else if (content['application/json']) {
    const c = content['application/json'];
    const ex = c.example !== undefined ? c.example : sample(c.schema);
    req.header.push({ key: 'Content-Type', value: 'application/json' });
    req.body = { mode: 'raw', raw: JSON.stringify(ex ?? {}, null, 2), options: { raw: { language: 'json' } } };
  }
  return req;
}

function examples(op, req, name) {
  const out = [];
  for (const [code, r] of Object.entries(op.responses || {})) {
    const ex = r.content?.['application/json']?.example;
    if (ex === undefined || !/^2/.test(code)) continue;
    out.push({ name: `${code} ${r.description || ''}`.trim(), originalRequest: req, status: r.description || 'OK', code: Number(code), _postman_previewlanguage: 'json', header: [{ key: 'Content-Type', value: 'application/json' }], body: JSON.stringify({ success: true, message: r.description || 'OK', data: ex }, null, 2) });
  }
  return out;
}

function item(p, method, op, name = op.summary || `${method.toUpperCase()} ${p}`) {
  const req = request(p, method, op);
  return { name, request: req, response: examples(op, req, name), event: [{ listen: 'test', script: { type: 'text/javascript', exec: SAVE(p, method, op) } }] };
}

// Folders in the spec's tag order.
const folders = new Map(spec.tags.map((t) => [t.name, []]));
for (const [p, ops] of Object.entries(spec.paths)) {
  for (const m of METHODS) {
    const op = ops[m];
    if (!op) continue;
    const tag = op.tags?.[0] || 'Other';
    if (!folders.has(tag)) folders.set(tag, []);
    folders.get(tag).push(item(p, m, op));
    if (p === '/auth/login' && m === 'post') {
      const adminOp = { ...op, __adminLogin: true, requestBody: { content: { 'application/json': { example: { identifier: '{{adminEmail}}', password: '{{adminPassword}}' } } } } };
      folders.get(tag).unshift(item(p, m, adminOp, 'Sign in as admin (saves adminToken)'));
    }
  }
}

const collection = {
  info: {
    name: 'AL BARAKAH LIFESTYLE API',
    _postman_id: 'a1b2c3d4-al-barakah-api-v1',
    description: [
      `${spec.info.description || ''}`,
      '',
      '## Getting started',
      '1. Pick the **AL BARAKAH Production** (or Local) environment.',
      '2. **Auth → Sign in** (customer) saves `token`; **Sign in as admin** saves `adminToken` (set `adminEmail` / `adminPassword` in the environment first — never commit them).',
      '3. Requests that create things (orders, products, coupons, templates, campaigns…) save their id, so the next request in the folder works without copying ids.',
      '',
      '`baseUrl` is `/api/v1`: every response is `{ success, message, data }`. Change it to `/api` for plain bodies (what the website uses).',
      `Generated from /api/openapi.json (${Object.keys(spec.paths).length} paths). Regenerate with \`npm run postman\`.`,
    ].join('\n'),
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
  variable: [
    ['token', ''], ['adminToken', ''], ['refreshToken', ''], ['email', 'customer@example.com'],
    ['productSlug', 'zafreon'], ['productId', ''], ['orderId', ''], ['orderNumber', ''], ['trackingId', ''], ['addressId', ''], ['deviceId', ''],
    ['couponId', ''], ['categoryId', ''], ['bannerId', ''], ['reviewId', ''], ['customerId', ''], ['userId', ''], ['importId', ''], ['postId', ''],
    ['contactId', ''], ['templateId', ''], ['campaignId', ''], ['messageId', ''], ['leadId', ''], ['sessionId', ''], ['paymentId', ''],
  ].map(([key, value]) => ({ key, value })),
  item: [...folders].filter(([, items]) => items.length).map(([name, items]) => ({ name, item: items })),
};

const env = (name, baseUrl) => ({
  id: `al-barakah-${name.toLowerCase().replace(/\W+/g, '-')}`,
  name: `AL BARAKAH ${name}`,
  values: [
    { key: 'baseUrl', value: baseUrl, type: 'default', enabled: true },
    { key: 'adminEmail', value: '', type: 'default', enabled: true },
    { key: 'adminPassword', value: '', type: 'secret', enabled: true },
    { key: 'email', value: 'customer@example.com', type: 'default', enabled: true },
  ],
  _postman_variable_scope: 'environment',
});

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'AL-BARAKAH-API.postman_collection.json'), `${JSON.stringify(collection, null, 2)}\n`);
fs.writeFileSync(path.join(OUT, 'AL-BARAKAH-Production.postman_environment.json'), `${JSON.stringify(env('Production', 'https://albarakah.me/api/v1'), null, 2)}\n`);
fs.writeFileSync(path.join(OUT, 'AL-BARAKAH-Local.postman_environment.json'), `${JSON.stringify(env('Local', 'http://localhost:5000/api/v1'), null, 2)}\n`);
const count = collection.item.reduce((n, f) => n + f.item.length, 0);
console.log(`${count} requests in ${collection.item.length} folders → docs/postman/`);
