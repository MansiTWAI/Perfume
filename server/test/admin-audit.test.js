// Admin studio audit fixes: dashboard figures by period, cancellation
// reasons, bulk order changes, coupon usage, the AED/INR price check, reviews
// added by the house, Journal views, user tags and deleting test accounts,
// menu alerts and integration settings saved from the studio.
import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { http, reset, close, makeUser, makeProduct, customer, Order, User, Coupon } from './helpers.js';

after(close);
beforeEach(reset);

let n = 0;
async function codOrder(extra = {}, email = 'buyer@example.test') {
  const p = await makeProduct({ inr: 1250, aed: 55 });
  const r = await http('POST', '/api/orders', { body: { region: 'IN', paymentMethod: 'cod', items: [{ slug: p.slug, qty: 1 }], customer: customer(email), ...extra }, ip: `10.9.${Math.floor(n / 200)}.${(n++ % 200) + 1}` });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return Order.findOne({ orderNumber: r.body.orderNumber }).lean();
}

describe('orders: cancellation reasons, bulk changes and dashboard figures', () => {
  test('cancelling records the reason; reopening clears it', async () => {
    const o = await codOrder();
    const { token } = await makeUser('admin');
    const r = await http('PATCH', `/api/orders/${o._id}`, { token, body: { status: 'Cancelled', cancelReason: 'out_of_stock', note: 'Restocking next month' } });
    assert.equal(r.status, 200);
    let saved = await Order.findById(o._id).lean();
    assert.equal(saved.cancellation.reason, 'out_of_stock');
    assert.equal(saved.cancellation.note, 'Restocking next month');
    await http('PATCH', `/api/orders/${o._id}`, { token, body: { status: 'Confirmed' } });
    saved = await Order.findById(o._id).lean();
    assert.equal(saved.cancellation, undefined);
  });
  test('bulk: several orders at once, each through the normal rules; cancelling needs a reason', async () => {
    const a = await codOrder();
    const b = await codOrder();
    const { token } = await makeUser('admin');
    const noReason = await http('POST', '/api/orders/bulk', { token, body: { ids: [a._id, b._id], status: 'Cancelled' } });
    assert.equal(noReason.status, 400);
    const r = await http('POST', '/api/orders/bulk', { token, body: { ids: [a._id, b._id, 'not-an-id'], status: 'Cancelled', cancelReason: 'test' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.updated, 2);
    const both = await Order.find({ _id: { $in: [a._id, b._id] } }).lean();
    assert.ok(both.every((x) => x.status === 'Cancelled' && x.cancellation.reason === 'test'));
    const confirm = await http('POST', '/api/orders/bulk', { token, body: { ids: [a._id], status: 'Confirmed' } });
    assert.equal(confirm.body.updated, 1);
    const customerToken = (await makeUser()).token;
    assert.equal((await http('POST', '/api/orders/bulk', { token: customerToken, body: { ids: [a._id], status: 'Packed' } })).status, 403);
  });
  test('stats: by period, with a daily series and the reasons orders were cancelled', async () => {
    const a = await codOrder();
    await codOrder();
    const old = await codOrder();
    await Order.collection.updateOne({ _id: old._id }, { $set: { createdAt: new Date(Date.now() - 40 * 864e5) } });
    const { token } = await makeUser('admin');
    await http('PATCH', `/api/orders/${a._id}`, { token, body: { status: 'Cancelled', cancelReason: 'duplicate' } });
    const all = await http('GET', '/api/orders/stats', { token });
    assert.equal(all.body.count, 3);
    const week = await http('GET', '/api/orders/stats?period=7d&tz=-330', { token });
    assert.equal(week.body.count, 2);
    assert.equal(week.body.revenue.find((x) => x._id === 'INR').n, 1); // the cancelled one is not order value
    assert.equal(week.body.daily.zone, '+05:30');
    assert.equal(week.body.daily.days.reduce((n, d) => n + d.orders, 0), 1);
    assert.deepEqual(week.body.cancelled.map((x) => [x.reason, x.n]), [['duplicate', 1]]);
    assert.equal((await http('GET', '/api/orders/stats?period=custom', { token })).status, 400);
  });
});

describe('coupons, products, reviews, journal', () => {
  test('coupon list counts live and cancelled uses from the orders', async () => {
    const { token } = await makeUser('admin');
    await Coupon.create({ code: 'TEN', type: 'percent', percent: 10, active: true, showOnSite: false });
    const a = await codOrder({ couponCode: 'TEN' });
    await codOrder({ couponCode: 'TEN' }, 'second@example.test');
    await http('PATCH', `/api/orders/${a._id}`, { token, body: { status: 'Cancelled', cancelReason: 'customer_request' } });
    const list = await http('GET', '/api/admin/coupons?state=', { token });
    const c = list.body.items.find((x) => x.code === 'TEN');
    assert.equal(c.usage.orders, 1);
    assert.equal(c.usage.cancelled, 1);
    assert.equal(c.usedCount, 1);
  });
  test('AED price far from the rupee price is refused; a little off is saved with a warning', async () => {
    const { token } = await makeUser('admin');
    const swapped = await http('POST', '/api/admin/products', { token, body: { name: 'Swap', price: { INR: 2799, AED: 2799 } } });
    assert.equal(swapped.status, 400);
    assert.match(swapped.body.message, /should be near AED 122/);
    const odd = await http('POST', '/api/admin/products', { token, body: { name: 'Odd', price: { INR: 2799, AED: 249 } } });
    assert.equal(odd.status, 201);
    assert.match(odd.body.warnings[0], /AED 249 is high/);
    const fine = await http('PUT', `/api/admin/products/${odd.body._id}`, { token, body: { price: { INR: 2799, AED: 125 } } });
    assert.deepEqual(fine.body.warnings, []);
  });
  test('the house can add a review; it is published but never marked as a verified purchase', async () => {
    const p = await makeProduct();
    const { token } = await makeUser('admin');
    const bad = await http('POST', '/api/reviews/admin', { token, body: { slug: p.slug, rating: 9, name: '', body: 'x' } });
    assert.equal(bad.status, 400);
    assert.deepEqual(bad.body.errors.map((e) => e.field), ['rating', 'name', 'body']);
    for (const name of ['Aisha Khan', 'Rahul Mehta']) {
      const r = await http('POST', '/api/reviews/admin', { token, body: { slug: p.slug, rating: 5, name, city: 'Hyderabad', body: 'Lovely, long-lasting scent.' } });
      assert.equal(r.status, 201);
    }
    const pub = await http('GET', `/api/reviews/product/${p.slug}`);
    assert.equal(pub.body.count, 2);
    assert.equal(pub.body.verified, 0);
    assert.ok(pub.body.items.every((x) => x.verified === false));
    assert.equal(pub.body.items[0].name.endsWith('.'), true); // "Rahul M."
    assert.equal((await http('POST', '/api/reviews/admin', { token: (await makeUser()).token, body: { slug: p.slug, rating: 5, name: 'X', body: 'Long enough text' } })).status, 403);
  });
  test('journal: reader visits are counted, the team\'s are not; drafts can be listed apart', async () => {
    const { token } = await makeUser('admin');
    const post = await http('POST', '/api/posts', { token, body: { title: 'Oud notes', content: 'Hello', status: 'published', views: 500 } });
    await http('POST', '/api/posts', { token, body: { title: 'Draft one', content: 'Hi' } });
    assert.equal(post.body.views, 0);
    await http('GET', `/api/posts/${post.body.slug}`);
    await http('GET', `/api/posts/${post.body.slug}`);
    await http('GET', `/api/posts/${post.body.slug}`, { token });
    await new Promise((r) => setTimeout(r, 50));
    const list = await http('GET', '/api/posts?all=1&status=draft', { token });
    assert.deepEqual(list.body.items.map((x) => x.title), ['Draft one']);
    assert.deepEqual(list.body.counts, { draft: 1, published: 1 });
    const all = await http('GET', '/api/posts?all=1', { token });
    assert.equal(all.body.items.find((x) => x.title === 'Oud notes').views, 2);
  });
});

describe('users and menu alerts', () => {
  test('tags, the test-account filter and deleting accounts that never ordered', async () => {
    const { token } = await makeUser('admin');
    const tester = (await makeUser('customer', 'pppp@example.test')).user;
    const buyer = (await makeUser('customer', 'buyer@example.test')).user;
    await codOrder(); // placed with buyer@example.test
    const tagged = await http('PATCH', `/api/users/${tester._id}/tags`, { token, body: { tags: ['test'] } });
    assert.deepEqual(tagged.body.tags, ['test']);
    assert.equal((await http('PATCH', `/api/users/${tester._id}/tags`, { token, body: { tags: ['nonsense'] } })).status, 400);
    const real = await http('GET', '/api/users?role=customer&tag=real', { token });
    assert.ok(!real.body.items.some((u) => u.email === 'pppp@example.test'));
    const tests = await http('GET', '/api/users?tag=test', { token });
    assert.deepEqual(tests.body.items.map((u) => u.email), ['pppp@example.test']);
    const keep = await http('DELETE', `/api/users/${buyer._id}`, { token });
    assert.equal(keep.status, 409);
    assert.equal(keep.body.code, 'USER_HAS_ORDERS');
    assert.equal((await http('DELETE', `/api/users/${tester._id}`, { token })).status, 200);
    assert.equal(await User.countDocuments({ email: 'pppp@example.test' }), 0);
  });
  test('menu counts: new orders, unread enquiries and reviews to read', async () => {
    const { token } = await makeUser('admin');
    await codOrder();
    await http('POST', '/api/enquiries', { body: { name: 'Riya', email: 'riya@example.test', phone: '9876543210', topic: 'Gifting', message: 'Gift wrap?' } });
    const r = await http('GET', '/api/admin/counts', { token });
    assert.deepEqual(r.body, { orders: 1, enquiries: 1, reviews: 0, shipping: 0 });
  });
});

describe('integration settings from the studio', () => {
  test('saved keys apply at once, secrets never come back, clearing returns to the server file', async () => {
    const { token } = await makeUser('admin');
    const before = process.env.DELHIVERY_PICKUP_LOCATION;
    const token0 = process.env.DELHIVERY_API_TOKEN;
    try {
      const view = await http('GET', '/api/admin/settings/integrations', { token });
      assert.equal(view.status, 200);
      const tok = view.body.delhivery.keys.find((k) => k.key === 'DELHIVERY_API_TOKEN');
      assert.equal(tok.set, true);
      assert.equal(tok.value, undefined);
      assert.ok(!JSON.stringify(view.body).includes(token0));
      const bad = await http('PUT', '/api/admin/settings/integrations/delhivery', { token, body: { values: { DELHIVERY_ENV: 'live' } } });
      assert.equal(bad.status, 400);
      const ok = await http('PUT', '/api/admin/settings/integrations/delhivery', { token, body: { values: { DELHIVERY_PICKUP_LOCATION: 'ABL Hyderabad', DELHIVERY_API_TOKEN: '' } } });
      assert.equal(ok.status, 200);
      assert.equal(process.env.DELHIVERY_PICKUP_LOCATION, 'ABL Hyderabad');
      assert.equal(process.env.DELHIVERY_API_TOKEN, token0); // empty secret = keep
      assert.equal(ok.body.delhivery.keys.find((k) => k.key === 'DELHIVERY_PICKUP_LOCATION').source, 'panel');
      const test1 = await http('POST', '/api/admin/settings/integrations/delhivery/test', { token });
      assert.equal(test1.status, 200);
      assert.match(test1.body.message, /test \(staging\)/);
      const wa = await http('POST', '/api/admin/settings/integrations/whatsapp/test', { token });
      assert.match(wa.body.message, /Connected: Al Barakah Lifestyle/);
      await http('PUT', '/api/admin/settings/integrations/delhivery', { token, body: { clear: ['DELHIVERY_PICKUP_LOCATION'] } });
      assert.equal(process.env.DELHIVERY_PICKUP_LOCATION, before);
      process.env.SETTINGS_FROM_DB = 'off'; // e.g. a local copy sharing the live database
      const off = await http('PUT', '/api/admin/settings/integrations/delhivery', { token, body: { values: { DELHIVERY_PICKUP_LOCATION: 'Elsewhere' } } });
      process.env.SETTINGS_FROM_DB = 'on';
      assert.equal(off.status, 400);
      assert.match(off.body.message, /switched off on this server/);
      assert.equal(process.env.DELHIVERY_PICKUP_LOCATION, before);
      const manager = (await makeUser('manager')).token;
      assert.equal((await http('GET', '/api/admin/settings/integrations', { token: manager })).status, 403);
    } finally {
      process.env.DELHIVERY_PICKUP_LOCATION = before;
      process.env.DELHIVERY_API_TOKEN = token0;
    }
  });
});
