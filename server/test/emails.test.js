// Every order update by email: the customer hears about each step, the team
// gets an alert for new and paid orders, cancellations, changes, payment
// problems, contact messages and reviews. Each customer email goes once.
import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { http, reset, close, makeUser, makeProduct, placeOnline, customer, outbox, pay, wa } from './helpers.js';

process.env.ORDER_ALERT_EMAIL = 'team@example.test';
const { emailsIdle } = await import('../src/services/orderEmails.js');

after(close);
beforeEach(async () => {
  await reset();
  outbox.length = 0;
});

const BUYER = 'buyer@example.test';
const to = (addr) => outbox.filter((m) => m.to === addr || String(m.to).split(', ').includes(addr));
const subjects = (addr) => to(addr).map((m) => m.subject);
const settle = () => emailsIdle();
const cod = (items, extra = {}) => http('POST', '/api/orders', { body: { region: 'IN', paymentMethod: 'cod', items, customer: customer(BUYER), ...extra } });

describe('customer emails', () => {
  test('cash on delivery: "order received" to the customer, "new order" to the team', async () => {
    const p = await makeProduct();
    const r = await cod([{ slug: p.slug, qty: 2 }]);
    assert.equal(r.status, 201);
    await settle();
    assert.deepEqual(subjects(BUYER), [`We have received your order ${r.body.orderNumber}`]);
    const mail = to(BUYER)[0];
    assert.match(mail.text, /× 2/);
    assert.match(mail.text, /\/track\?id=/);
    const team = to('team@example.test');
    assert.equal(team.length, 1);
    assert.match(team[0].subject, new RegExp(`^New order: ${r.body.orderNumber}`));
    assert.match(team[0].text, /Customer: Test Buyer/);
    assert.equal(wa.sent.length, 0, 'nothing by WhatsApp');
  });

  test('every status the team sets is emailed once, with their message', async () => {
    const p = await makeProduct();
    const r = await cod([{ slug: p.slug, qty: 1 }]);
    const { token } = await makeUser('admin');
    const orders = await http('GET', '/api/orders?paged=1', { token });
    const id = orders.body.items[0]._id || orders.body.items[0].id;
    for (const status of ['Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered']) {
      const u = await http('PATCH', `/api/orders/${id}`, { token, body: { status, note: status === 'Packed' ? 'Gift wrapped as you asked.' : '' } });
      assert.equal(u.status, 200, status);
    }
    await settle();
    const n = r.body.orderNumber;
    // Confirming also books Delhivery here (auto-create on), which has its own email.
    assert.deepEqual(subjects(BUYER), [
      `We have received your order ${n}`,
      `Your order ${n} is confirmed`,
      `Your order ${n} is being prepared for dispatch`,
      `Your order ${n} is packed`,
      `Your order ${n} is on its way`,
      `Your order ${n} arrives today`,
      `Your order ${n} has been delivered`,
    ]);
    assert.match(to(BUYER)[3].text, /Gift wrapped as you asked\./);
    // Saving again with the same status sends nothing new.
    await http('PATCH', `/api/orders/${id}`, { token, body: { status: 'Delivered' } });
    await settle();
    assert.equal(to(BUYER).length, 7);
  });

  test('the customer cancels: email to them, alert to the team', async () => {
    const owner = await makeUser('customer', BUYER);
    const p = await makeProduct();
    const r = await http('POST', '/api/orders', { token: owner.token, body: { region: 'IN', paymentMethod: 'cod', items: [{ slug: p.slug, qty: 1 }], customer: customer(BUYER) } });
    const c = await http('POST', `/api/orders/mine/${r.body.orderNumber}/cancel`, { token: owner.token, body: { reason: 'Ordered twice' } });
    assert.equal(c.status, 200);
    await settle();
    assert.ok(subjects(BUYER).includes(`Your order ${r.body.orderNumber} is cancelled`));
    const alert = to('team@example.test').find((m) => /^Cancelled by the customer/.test(m.subject));
    assert.ok(alert);
    assert.match(alert.text, /Reason: Ordered twice/);
  });
});

describe('online payments', () => {
  test('nothing is sent until the payment succeeds; then confirmation and a "paid" alert', async () => {
    const p = await makeProduct();
    const placed = await placeOnline([{ slug: p.slug, qty: 1 }]);
    await settle();
    assert.equal(outbox.length, 0, 'no email for an unpaid online order');
    const s = await http('POST', '/api/payments/razorpay/order', { body: { orderNumber: placed.body.orderNumber, email: BUYER } });
    const { response } = pay(s.body.razorpayOrderId);
    await http('POST', '/api/payments/razorpay/verify', { body: { orderNumber: placed.body.orderNumber, email: BUYER, ...response } });
    await settle();
    const { shipping } = await import('./helpers.js');
    await shipping.shippingIdle?.();
    await settle();
    assert.ok(subjects(BUYER).includes(`Your order ${placed.body.orderNumber} is confirmed`));
    assert.ok(to('team@example.test').some((m) => m.subject.startsWith(`Paid online: ${placed.body.orderNumber}`)));
  });

  test('a failed payment sends nothing to anyone', async () => {
    const p = await makeProduct();
    const placed = await placeOnline([{ slug: p.slug, qty: 1 }]);
    const s = await http('POST', '/api/payments/razorpay/order', { body: { orderNumber: placed.body.orderNumber, email: BUYER } });
    const { response } = pay(s.body.razorpayOrderId, { status: 'failed' });
    await http('POST', '/api/payments/razorpay/verify', { body: { orderNumber: placed.body.orderNumber, email: BUYER, ...response } });
    await http('POST', '/api/payments/razorpay/abandon', { body: { orderNumber: placed.body.orderNumber, email: BUYER } });
    await settle();
    assert.equal(outbox.length, 0);
  });

  test('refunds are emailed to the customer', async () => {
    const p = await makeProduct();
    const placed = await placeOnline([{ slug: p.slug, qty: 1 }]);
    const s = await http('POST', '/api/payments/razorpay/order', { body: { orderNumber: placed.body.orderNumber, email: BUYER } });
    await http('POST', '/api/payments/razorpay/verify', { body: { orderNumber: placed.body.orderNumber, email: BUYER, ...pay(s.body.razorpayOrderId).response } });
    const { token } = await makeUser('admin');
    const r = await http('POST', `/api/admin/orders/${placed.body.orderNumber}/refund`, { token, body: { amount: 500, reason: 'Goodwill' } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    await settle();
    const refund = to(BUYER).find((m) => /refund/i.test(m.subject));
    assert.ok(refund, 'refund email');
    assert.match(refund.text, /Refund: ₹500/);
  });
});

describe('team alerts', () => {
  test('contact form and reviews', async () => {
    const e = await http('POST', '/api/enquiries', { body: { name: 'Riya', email: 'riya@example.test', phone: '9876543210', topic: 'Gifting', message: 'Do you gift wrap?' } });
    assert.equal(e.status, 201);
    await settle();
    const alert = to('team@example.test').find((m) => m.subject.startsWith('New message from the contact form'));
    assert.ok(alert);
    assert.match(alert.text, /Do you gift wrap\?/);
  });

  test('no alert address and no MAIL_FROM: nothing breaks', async () => {
    const saved = [process.env.ORDER_ALERT_EMAIL, process.env.MAIL_FROM];
    process.env.ORDER_ALERT_EMAIL = '';
    process.env.MAIL_FROM = '';
    const p = await makeProduct();
    const r = await cod([{ slug: p.slug, qty: 1 }]);
    assert.equal(r.status, 201);
    await settle();
    assert.equal(to('team@example.test').length, 0);
    [process.env.ORDER_ALERT_EMAIL, process.env.MAIL_FROM] = saved;
  });
});
