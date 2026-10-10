// Core shop flows end to end through the real API: sessions and tokens,
// password reset, cart, coupons, reviews, stock, product deletion, staff
// roles, uploads and the Excel import. Outside services are faked.
import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {
  http, reset, close, makeUser, makeProduct, customer, Order, Product, User, outbox, base, pay, shipping,
} from './helpers.js';

after(close);
beforeEach(reset);

// Sign-up, then the emailed code (from the test outbox), as a customer does.
const signUp = (email, extra = {}) => http('POST', '/api/auth/register', { body: { name: 'Flow Person', email, phone: `98${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`, password: 'flow-pass-123', ...extra } });
const register = async (email, extra = {}) => {
  const r = await signUp(email, extra);
  if (r.status !== 201 || !r.body.verificationRequired) return r;
  const code = outbox.filter((m) => m.to === email).at(-1).subject.match(/\d{6}/)[0];
  return http('POST', '/api/auth/verify-email', { body: { email, code } });
};
const login = (email, password = 'flow-pass-123') => http('POST', '/api/auth/login', { body: { email, password } });
const cod = (items, extra = {}) => http('POST', '/api/orders', { body: { region: 'IN', paymentMethod: 'cod', items, customer: customer(), ...extra } });
// Test reads see every order, held (awaiting payment) ones too.
const load = (orderNumber) => Order.findOne({ orderNumber }).setOptions({ withHeld: true }).lean();

describe('sessions and tokens', () => {
  test('sign-up checks: long names, non-string fields', async () => {
    assert.equal((await register('a@example.test', { name: 'x'.repeat(81) })).status, 400);
    assert.equal((await register('b@example.test', { name: { first: 'A' } })).status, 400);
    assert.equal((await register(['c@example.test'])).status, 400);
    assert.equal((await register('d@example.test', { password: 'x'.repeat(201) })).status, 400);
    assert.equal((await register('e@example.test', { name: '  Zoë   مريم  ' })).body.user.name, 'Zoë مريم');
  });
  test('refresh rotates; a used refresh token is refused; logout revokes it', async () => {
    const r = await register('s@example.test');
    const first = await http('POST', '/api/auth/refresh', { body: { refreshToken: r.body.refreshToken } });
    assert.equal(first.status, 200);
    assert.notEqual(first.body.refreshToken, r.body.refreshToken);
    assert.equal((await http('POST', '/api/auth/refresh', { body: { refreshToken: r.body.refreshToken } })).status, 401);
    await http('POST', '/api/auth/logout', { body: { refreshToken: first.body.refreshToken } });
    assert.equal((await http('POST', '/api/auth/refresh', { body: { refreshToken: first.body.refreshToken } })).status, 401);
  });
  test('changing the password or "sign out everywhere" ends old sessions; blocked accounts are locked out', async () => {
    const r = await register('t@example.test');
    const old = r.body.token;
    assert.equal((await http('POST', '/api/auth/me/password', { token: old, body: { currentPassword: 'flow-pass-123', newPassword: 'flow-pass-456' } })).status, 200);
    assert.equal((await http('GET', '/api/auth/me', { token: old })).status, 401);
    const again = await login('t@example.test', 'flow-pass-456');
    assert.equal(again.status, 200);
    assert.equal((await http('POST', '/api/auth/logout-all', { token: again.body.token })).status, 200);
    assert.equal((await http('GET', '/api/auth/me', { token: again.body.token })).status, 401);
    const fresh = await login('t@example.test', 'flow-pass-456');
    const { token: adminToken } = await makeUser('admin');
    const blocked = await http('PATCH', `/api/admin/customers/${fresh.body.user.id || fresh.body.user._id}/status`, { token: adminToken, body: { status: 'blocked' } });
    assert.equal(blocked.status, 200);
    assert.equal((await http('GET', '/api/auth/me', { token: fresh.body.token })).status, 401);
    assert.equal((await login('t@example.test', 'flow-pass-456')).status >= 400, true);
  });
  test('customers cannot change their own role or status', async () => {
    const r = await register('u@example.test');
    await http('PATCH', '/api/auth/me', { token: r.body.token, body: { role: 'admin', status: 'active', tokenVersion: 99 } });
    const u = await User.findOne({ email: 'u@example.test' }).lean();
    assert.equal(u.role, 'customer');
    assert.equal(u.tokenVersion || 0, 0);
  });
});

describe('password reset', () => {
  test('the link is on our own domain, works once and sets the new password', async () => {
    await register('r@example.test');
    const asked = await http('POST', '/api/auth/forgot-password', { body: { email: 'r@example.test' }, headers: { Host: 'evil.example', 'X-Forwarded-Host': 'evil.example' } });
    assert.equal(asked.status, 200);
    const mail = outbox.find((m) => m.to === 'r@example.test' && /Reset/.test(m.subject));
    assert.ok(mail, 'reset email sent');
    assert.ok(!mail.text.includes('evil.example'), 'link must not follow the Host header');
    const token = mail.text.match(/token=([A-Za-z0-9_-]+)/)[1];
    assert.equal((await http('POST', '/api/auth/reset-password', { body: { token, password: 'brand-new-pass' } })).status, 200);
    assert.equal((await http('POST', '/api/auth/reset-password', { body: { token, password: 'another-pass-1' } })).status, 400);
    assert.equal((await login('r@example.test', 'brand-new-pass')).status, 200);
    assert.equal((await login('r@example.test')).status, 401);
  });
  test('unknown emails get the same answer (no account discovery)', async () => {
    const r = await http('POST', '/api/auth/forgot-password', { body: { email: 'nobody@example.test' } });
    assert.equal(r.status, 200);
    assert.equal(outbox.length, 0);
  });
});

describe('cart and wishlist', () => {
  test('add, change, remove; unknown and hidden products refused; quantities bounded', async () => {
    const p = await makeProduct({ slug: 'cart-one', stock: 4 });
    await makeProduct({ slug: 'hidden-cart' }).then((x) => Product.updateOne({ _id: x._id }, { published: false }));
    const { token } = await makeUser();
    assert.equal((await http('POST', '/api/cart/items', { token, body: { slug: 'cart-one', qty: 2 } })).status < 300, true);
    assert.equal((await http('POST', '/api/cart/items', { token, body: { slug: 'nope', qty: 1 } })).status, 404);
    assert.ok([400, 404].includes((await http('POST', '/api/cart/items', { token, body: { slug: 'hidden-cart', qty: 1 } })).status));
    await http('PATCH', '/api/cart/items/cart-one', { token, body: { qty: 999 } });
    let cart = await http('GET', '/api/cart', { token });
    const line = JSON.stringify(cart.body);
    const qty = Number(line.match(/"qty":(\d+)/)[1]);
    assert.ok(qty >= 1 && qty <= 10, `qty ${qty}`);
    await http('DELETE', '/api/cart/items/cart-one', { token });
    cart = await http('GET', '/api/cart', { token });
    assert.ok(!JSON.stringify(cart.body).includes('"cart-one"'));
    assert.equal(p.slug, 'cart-one');
    assert.equal((await http('POST', '/api/wishlist/cart-one', { token })).status < 300, true);
    assert.ok(JSON.stringify((await http('GET', '/api/wishlist', { token })).body).includes('cart-one'));
  });
});

describe('stock and historical orders', () => {
  test('ordering reserves stock; cancelling returns it; reopening reserves again', async () => {
    const p = await makeProduct({ stock: 5 });
    const o = await cod([{ slug: p.slug, qty: 3 }]);
    assert.equal((await Product.findById(p._id)).stock, 2);
    const { token } = await makeUser('admin');
    const order = await load(o.body.orderNumber);
    assert.equal((await http('POST', `/api/admin/orders/${order._id}/cancel`, { token })).status, 200);
    assert.equal((await Product.findById(p._id)).stock, 5);
    assert.equal((await http('PATCH', `/api/admin/orders/${order._id}/status`, { token, body: { status: 'confirmed' } })).status, 200);
    assert.equal((await Product.findById(p._id)).stock, 2);
  });
  test('two buyers racing for the last bottle: exactly one order', async () => {
    const p = await makeProduct({ stock: 1 });
    const results = await Promise.all([cod([{ slug: p.slug, qty: 1 }]), cod([{ slug: p.slug, qty: 1 }]), cod([{ slug: p.slug, qty: 1 }])]);
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal((await Product.findById(p._id)).stock, 0);
  });
  test('editing or deleting a product never changes past orders', async () => {
    const p = await makeProduct({ inr: 1000 });
    const o = await cod([{ slug: p.slug, qty: 1 }]);
    const { token } = await makeUser('admin');
    await http('PUT', `/api/admin/products/${p._id}`, { token, body: { name: 'RENAMED', price: { INR: 5000, AED: 200 } } });
    await http('DELETE', `/api/admin/products/${p._id}`, { token });
    const order = await load(o.body.orderNumber);
    assert.equal(order.items[0].unitPrice, 1000);
    assert.equal(order.items[0].name, p.name);
    assert.equal(order.total, 1099);
  });
});

describe('coupons', () => {
  test('percent coupon applies on the server, respects its usage limit, and junk codes are refused', async () => {
    const { token: adminToken } = await makeUser('admin');
    const c = await http('POST', '/api/admin/coupons', { token: adminToken, body: { code: 'WELCOME10', type: 'percent', percent: 10, usageLimit: 1, perUserLimit: 1, active: true } });
    assert.ok(c.status < 300, JSON.stringify(c.body));
    const p = await makeProduct({ inr: 3000, stock: 10 });
    const first = await cod([{ slug: p.slug, qty: 1 }], { couponCode: 'welcome10' });
    assert.equal(first.status, 201);
    const o = await load(first.body.orderNumber);
    assert.equal(o.discount, 300);
    assert.equal(o.total, 2700);
    const second = await cod([{ slug: p.slug, qty: 1 }], { couponCode: 'WELCOME10' });
    assert.ok(second.status >= 400, 'usage limit reached');
    assert.equal((await Product.findById(p._id)).stock, 9, 'refused order reserved nothing');
    assert.ok((await cod([{ slug: p.slug, qty: 1 }], { couponCode: { $ne: null } })).status !== 500);
  });
});

describe('reviews', () => {
  test('only after delivery, once per order, shown after approval', async () => {
    const p = await makeProduct();
    const o = await cod([{ slug: p.slug, qty: 1 }]);
    const order = await load(o.body.orderNumber);
    const review = { trackingId: order.trackingId, email: order.customer.email, slug: p.slug, rating: 5, title: 'Lovely', body: 'Warm, long-lasting and elegant on the skin.' };
    assert.equal((await http('POST', '/api/reviews', { body: review })).status, 400);
    const { token } = await makeUser('admin');
    await http('PATCH', `/api/admin/orders/${order._id}/status`, { token, body: { status: 'delivered' } });
    assert.equal((await http('POST', '/api/reviews', { body: { ...review, email: 'someone@example.test' } })).status, 404);
    const sent = await http('POST', '/api/reviews', { body: review });
    assert.ok(sent.status < 300, JSON.stringify(sent.body));
    assert.ok((await http('POST', '/api/reviews', { body: review })).status >= 400, 'second review refused');
    const before = await http('GET', `/api/reviews/product/${p.slug}`);
    assert.ok(!JSON.stringify(before.body).includes('long-lasting'), 'hidden until approved');
    const list = await http('GET', '/api/reviews', { token });
    const id = (list.body.items || list.body)[0]._id;
    assert.equal((await http('PATCH', `/api/admin/reviews/${id}/approve`, { token })).status, 200);
    assert.ok(JSON.stringify((await http('GET', `/api/reviews/product/${p.slug}`)).body).includes('long-lasting'));
  });
});

describe('staff roles', () => {
  test('support serves orders but cannot manage products, refunds or roles; managers cannot change roles', async () => {
    const support = await makeUser('support');
    const manager = await makeUser('manager');
    const cust = await makeUser('customer');
    const p = await makeProduct();
    assert.equal((await http('GET', '/api/admin/orders', { token: support.token })).status, 200);
    assert.equal((await http('POST', '/api/admin/products', { token: support.token, body: { name: 'X', slug: 'x', price: { INR: 1, AED: 1 } } })).status, 403);
    assert.equal((await http('DELETE', `/api/admin/products/${p._id}`, { token: support.token })).status, 403);
    assert.equal((await http('PUT', `/api/admin/products/${p._id}`, { token: manager.token, body: { stock: 7 } })).status, 200);
    assert.equal((await http('PATCH', `/api/admin/customers/${cust.user._id}/role`, { token: manager.token, body: { role: 'admin' } })).status, 403);
    assert.equal((await http('POST', '/api/admin/orders/000000000000000000000000/refund', { token: manager.token })).status, 403);
    assert.equal((await http('GET', '/api/admin/audit-logs', { token: manager.token })).status, 403);
    // The older /api/orders admin routes are for full admins only.
    assert.equal((await http('GET', '/api/orders/export', { token: manager.token })).status, 403);
  });
});

describe('uploads', () => {
  const upload = async (token, name, type, bytes) => {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type }), name);
    const r = await fetch(`${base}/api/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Forwarded-For': '10.1.1.1' }, body: form });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
  test('real images are stored under their real type; disguised files are refused', async () => {
    const { token } = await makeUser('admin');
    assert.equal((await upload(token, 'page.jpg', 'image/jpeg', Buffer.from('<html><script>alert(1)</script></html>'))).status, 400);
    assert.equal((await upload(token, 'x.svg', 'image/svg+xml', Buffer.from('<svg onload="alert(1)"/>'))).status, 400);
    const ok = await upload(token, 'Bottle Shot.jpeg', 'image/jpeg', PNG); // a PNG named .jpeg
    assert.equal(ok.status, 201);
    assert.match(ok.body.src, /^\/uploads\/bottle-shot-[a-z0-9]{5}\.png$/);
    const served = await fetch(base + ok.body.src);
    assert.equal(served.headers.get('content-type'), 'image/png');
    assert.equal(served.headers.get('x-content-type-options'), 'nosniff');
    const cust = await makeUser();
    assert.equal((await upload(cust.token, 'a.png', 'image/png', PNG)).status, 403);
  });
});

describe('Excel import', () => {
  async function sheetFor(orderNumber, edits) {
    const { token } = await makeUser('admin');
    const res = await fetch(`${base}/api/orders/template?prefill=1&period=all`, { headers: { Authorization: `Bearer ${token}`, 'X-Forwarded-For': '10.2.2.2' } });
    assert.equal(res.status, 200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));
    const ws = wb.getWorksheet('Orders');
    let headerRow = 0;
    ws.eachRow((row, i) => { if (!headerRow && row.values.some((v) => String(v ?? '').replace(/\s*\*$/, '').trim() === 'Order ID')) headerRow = i; });
    const headers = ws.getRow(headerRow).values.map((v) => String(v?.richText ? v.richText.map((t) => t.text).join('') : v ?? '').replace(/\s*\*$/, '').trim());
    ws.eachRow((row, i) => {
      if (i <= headerRow || String(row.getCell(headers.indexOf('Order ID')).value) !== orderNumber) return;
      for (const [h, v] of Object.entries(edits)) row.getCell(headers.indexOf(h)).value = v;
    });
    const buf = await wb.xlsx.writeBuffer();
    const form = new FormData();
    form.append('file', new Blob([buf]), 'orders.xlsx');
    const pre = await fetch(`${base}/api/orders/import/preview`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Forwarded-For': '10.2.2.3' }, body: form });
    return { token, preview: await pre.json(), status: pre.status };
  }
  test('preview → commit updates the order; committing twice is refused', async () => {
    const p = await makeProduct();
    const o = await cod([{ slug: p.slug, qty: 1 }]);
    const { token, preview, status } = await sheetFor(o.body.orderNumber, { 'Order Status': 'Packed', 'Internal Notes': 'Gift wrap in gold' });
    assert.equal(status, 201, JSON.stringify(preview));
    assert.equal(preview.totals.failed, 0, JSON.stringify(preview.errors));
    const c = await http('POST', `/api/orders/imports/${preview.id}/commit`, { token });
    assert.equal(c.status, 200);
    const order = await load(o.body.orderNumber);
    assert.equal(order.status, 'Packed');
    assert.equal(order.notes, 'Gift wrap in gold');
    assert.equal((await http('POST', `/api/orders/imports/${preview.id}/commit`, { token })).status, 409);
  });
  test('cannot reopen a cancelled order or rewrite an online payment from Excel', async () => {
    const p = await makeProduct({ stock: 5 });
    const o = await cod([{ slug: p.slug, qty: 2 }]);
    await Order.updateOne({ orderNumber: o.body.orderNumber }, { status: 'Cancelled' });
    const a = await sheetFor(o.body.orderNumber, { 'Order Status': 'Confirmed' });
    assert.equal(a.preview.totals.failed, 1);
    assert.match(a.preview.errors[0].message, /cancelled/i);

    const online = await http('POST', '/api/orders', { body: { region: 'IN', paymentMethod: 'online', items: [{ slug: p.slug, qty: 1 }], customer: customer() } });
    const s = await http('POST', '/api/payments/razorpay/order', { body: { orderNumber: online.body.orderNumber, email: 'buyer@example.test' } });
    const { response } = pay(s.body.razorpayOrderId);
    await http('POST', '/api/payments/razorpay/verify', { body: { orderNumber: online.body.orderNumber, email: 'buyer@example.test', ...response } });
    await shipping.shippingIdle();
    const b = await sheetFor(online.body.orderNumber, { 'Payment Status': 'pending' });
    assert.equal(b.preview.totals.failed, 1);
    assert.match(JSON.stringify(b.preview.errors), /Razorpay|Delhivery/);
  });
});

describe('coupons listed in the bag', () => {
  test('signed in: a coupon used as often as allowed is no longer listed; the server still decides', async () => {
    const { default: Coupon } = await import('../src/models/Coupon.js');
    await Coupon.create({ code: 'ONCE10', type: 'percent', percent: 10, active: true, showOnSite: true, perUserLimit: 1 });
    await Coupon.create({ code: 'HIDDEN5', type: 'percent', percent: 5, active: true, showOnSite: false });
    const p = await makeProduct();
    const { user, token } = await makeUser('customer', 'coupon-user@example.test');
    const codes = async (t) => (await http('GET', '/api/coupons?region=IN', { token: t })).body.items.map((c) => c.code);
    assert.deepEqual(await codes(token), ['ONCE10']);
    assert.deepEqual(await codes(), ['ONCE10']);
    const placed = await http('POST', '/api/orders', { token, body: { region: 'IN', paymentMethod: 'cod', items: [{ slug: p.slug, qty: 1 }], customer: customer(user.email), couponCode: 'ONCE10' } });
    assert.equal(placed.status, 201);
    assert.deepEqual(await codes(token), [], 'used up for this customer');
    assert.deepEqual(await codes(), ['ONCE10'], 'still listed for others');
    const again = await http('POST', '/api/coupons/check', { token, body: { code: 'ONCE10', region: 'IN', items: [{ slug: p.slug, qty: 1 }] } });
    assert.equal(again.body.code, 'COUPON_ALREADY_USED');
  });
});
