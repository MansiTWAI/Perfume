// Scratch cards: print runs of unique codes. Each card works once, is never
// listed on the website, and is the only way to the bigger discounts. Prices
// themselves carry no discount ("was" prices are off).
import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { http, reset, close, makeUser, makeProduct, customer, base, Coupon } from './helpers.js';

after(close);
beforeEach(reset);

const makeBatch = (token, body) => http('POST', '/api/admin/coupon-batches', { token, body: { name: 'Scratch 25% Oct', percent: 25, count: 20, ...body } });
const order = (code, email = 'buyer@example.test', items) => http('POST', '/api/orders', { body: { region: 'IN', paymentMethod: 'cod', items, customer: customer(email), couponCode: code } });

describe('scratch cards', () => {
  test('a manager creates a print run of unique, hidden, single-use codes', async () => {
    const { token } = await makeUser('manager');
    const r = await makeBatch(token, { count: 300 });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.count, 300);
    assert.equal(r.body.unused, 300);
    const codes = await Coupon.find({ batch: r.body.id }).lean();
    assert.equal(codes.length, 300);
    assert.equal(new Set(codes.map((c) => c.code)).size, 300, 'all different');
    for (const c of codes) {
      assert.match(c.code, /^AB-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
      assert.equal(c.usageLimit, 1);
      assert.equal(c.showOnSite, false);
      assert.equal(c.percent, 25);
    }
    // Not listed to shoppers, not mixed into the normal coupon list.
    assert.equal((await http('GET', '/api/coupons?region=IN')).body.items.length, 0);
    assert.equal((await http('GET', '/api/admin/coupons', { token })).body.items.length, 0);
  });

  test('a card gives its discount once; the second use is refused', async () => {
    const { token } = await makeUser('admin');
    const batch = (await makeBatch(token, { count: 2, percent: 50 })).body;
    const [card] = await Coupon.find({ batch: batch.id }).lean();
    const p = await makeProduct({ inr: 2000 });
    const first = await order(card.code, 'a@example.test', [{ slug: p.slug, qty: 1 }]);
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const { default: Order } = await import('../src/models/Order.js');
    assert.equal((await Order.findOne({ orderNumber: first.body.orderNumber }).lean()).discount, 1000, '50% of 2000');
    const second = await order(card.code, 'b@example.test', [{ slug: p.slug, qty: 1 }]);
    assert.equal(second.status, 400);
    assert.equal(second.body.code, 'COUPON_EXPIRED');
    assert.match(second.body.message, /fully used/);
    const list = await http('GET', '/api/admin/coupon-batches', { token });
    assert.equal(list.body[0].used, 1);
    assert.equal(list.body[0].unused, 1);
  });

  test('cap, minimum order and expiry come from the print run', async () => {
    const { token } = await makeUser('admin');
    const batch = (await makeBatch(token, { count: 1, percent: 50, maxDiscount: { INR: 300 }, minSubtotal: { INR: 1500 }, expiresAt: new Date(Date.now() + 864e5).toISOString() })).body;
    const [card] = await Coupon.find({ batch: batch.id }).lean();
    const small = await makeProduct({ inr: 1000 });
    const big = await makeProduct({ inr: 2000 });
    const tooSmall = await http('POST', '/api/coupons/check', { body: { code: card.code, region: 'IN', items: [{ slug: small.slug, qty: 1 }] } });
    assert.equal(tooSmall.body.code, 'COUPON_MIN_NOT_MET');
    const ok = await http('POST', '/api/coupons/check', { body: { code: card.code, region: 'IN', items: [{ slug: big.slug, qty: 1 }] } });
    assert.equal(ok.body.valid, true);
    assert.equal(ok.body.discount, 300, 'capped');
    assert.equal((await makeBatch(token, { expiresAt: '2001-01-01' })).status, 400);
  });

  test('switching a print run off stops every unused card at once', async () => {
    const { token } = await makeUser('admin');
    const batch = (await makeBatch(token, { count: 5 })).body;
    const [card] = await Coupon.find({ batch: batch.id }).lean();
    const off = await http('PATCH', `/api/admin/coupon-batches/${batch.id}`, { token, body: { active: false } });
    assert.equal(off.body.active, false);
    const p = await makeProduct();
    assert.equal((await order(card.code, 'c@example.test', [{ slug: p.slug, qty: 1 }])).status, 400);
    await http('PATCH', `/api/admin/coupon-batches/${batch.id}`, { token, body: { active: true } });
    assert.equal((await order(card.code, 'c@example.test', [{ slug: p.slug, qty: 1 }])).status, 201);
  });

  test('the codes download as a workbook for the printer, with usage', async () => {
    const { token } = await makeUser('admin');
    const batch = (await makeBatch(token, { count: 3 })).body;
    const [card] = await Coupon.find({ batch: batch.id }).sort({ createdAt: 1, code: 1 }).lean();
    const p = await makeProduct();
    await order(card.code, 'used@example.test', [{ slug: p.slug, qty: 1 }]);
    const res = await fetch(`${base}/api/admin/coupon-batches/${batch.id}/codes`, { headers: { Authorization: `Bearer ${token}`, 'X-Forwarded-For': '10.4.4.4' } });
    assert.equal(res.status, 200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await res.arrayBuffer()));
    const ws = wb.getWorksheet('Scratch cards');
    const text = [];
    ws.eachRow((row) => text.push(row.values.map((v) => (v && typeof v === 'object' && 'text' in v ? v.text : v)).join(' | ')));
    const all = text.join('\n');
    const allCodes = (await Coupon.find({ batch: batch.id }).lean()).map((c) => c.code);
    for (const code of allCodes) assert.ok(all.includes(code), code);
    assert.match(all, /used@example\.test/);
    assert.match(all, /Used/);
  });

  test('only managers and admins can make or read cards', async () => {
    const support = await makeUser('support');
    const customerUser = await makeUser('customer');
    assert.equal((await makeBatch(support.token)).status, 403);
    assert.equal((await makeBatch(customerUser.token)).status, 403);
    assert.equal((await http('GET', '/api/admin/coupon-batches')).status, 401);
  });

  test('checks: name, whole percent 1–100, 1–5000 cards', async () => {
    const { token } = await makeUser('admin');
    assert.equal((await makeBatch(token, { name: '' })).status, 400);
    assert.equal((await makeBatch(token, { percent: 0 })).status, 400);
    assert.equal((await makeBatch(token, { percent: 12.5 })).status, 400);
    assert.equal((await makeBatch(token, { count: 0 })).status, 400);
    assert.equal((await makeBatch(token, { count: 5001 })).status, 400);
  });
});

describe('no discount without a code', () => {
  test('prices carry no crossed-out "was" price, even if one is stored', async () => {
    const p = await makeProduct({ inr: 2000 });
    const { default: Product } = await import('../src/models/Product.js');
    await Product.updateOne({ _id: p._id }, { $set: { compareAt: { INR: 4000 } } });
    const r = await http('GET', `/api/v1/products/${p.slug}`);
    assert.equal(r.body.data.compareAtPrice, null);
  });

  test('an order without a code pays the full price', async () => {
    const p = await makeProduct({ inr: 2000 });
    const r = await order(undefined, 'full@example.test', [{ slug: p.slug, qty: 1 }]);
    assert.equal(r.status, 201);
    const { default: Order } = await import('../src/models/Order.js');
    const o = await Order.findOne({ orderNumber: r.body.orderNumber }).lean();
    assert.equal(o.discount, 0);
    assert.equal(o.subtotal, 2000);
  });
});
