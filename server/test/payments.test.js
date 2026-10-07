// Razorpay payment flow: order creation, amounts, ownership, signature and
// webhook checks, idempotency, races, recovery and refunds. Razorpay itself
// is faked (see helpers.js); nothing leaves this machine.
import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  http, webhook, pay, sign, rzp, reset, close, makeUser, makeProduct, placeOnline, customer, Order, Product, PaymentEvent,
} from './helpers.js';
import { verifyPaymentSignature, verifyWebhookSignature, toMinor } from '../src/services/razorpay.js';

after(close);
beforeEach(reset);

const startPay = (orderNumber, email = 'buyer@example.test', token) => http('POST', '/api/payments/razorpay/order', { token, body: { orderNumber, email } });
const verify = (orderNumber, response, email = 'buyer@example.test') => http('POST', '/api/payments/razorpay/verify', { body: { orderNumber, email, ...response } });
const load = (orderNumber) => Order.findOne({ orderNumber }).lean();
const confirmedNotes = (o) => o.history.filter((h) => h.status === 'Confirmed').length;

async function paidOrder({ inr = 2799, qty = 1 } = {}) {
  const p = await makeProduct({ inr });
  const placed = await placeOnline([{ slug: p.slug, qty }]);
  const session = await startPay(placed.body.orderNumber);
  const { payment, response } = pay(session.body.razorpayOrderId);
  const v = await verify(placed.body.orderNumber, response);
  assert.equal(v.status, 200);
  return { product: p, orderNumber: placed.body.orderNumber, payment, session: session.body };
}

describe('amounts and signatures', () => {
  test('toMinor converts to paise without float drift', () => {
    assert.equal(toMinor(2898), 289800);
    assert.equal(toMinor(19.99), 1999);
    assert.equal(toMinor(0.1 + 0.2), 30);
  });
  test('checkout signature: valid accepted, tampered / wrong length / empty rejected', () => {
    const s = sign('order_ABCDEF1|pay_ABCDEF1');
    assert.ok(verifyPaymentSignature({ orderId: 'order_ABCDEF1', paymentId: 'pay_ABCDEF1', signature: s }));
    assert.ok(!verifyPaymentSignature({ orderId: 'order_ABCDEF1', paymentId: 'pay_ABCDEF2', signature: s }));
    assert.ok(!verifyPaymentSignature({ orderId: 'order_ABCDEF1', paymentId: 'pay_ABCDEF1', signature: s.slice(0, 10) }));
    assert.ok(!verifyPaymentSignature({ orderId: 'order_ABCDEF1', paymentId: 'pay_ABCDEF1', signature: '' }));
  });
  test('webhook signature uses the webhook secret over the raw body', () => {
    const raw = Buffer.from('{"a":1}');
    assert.ok(verifyWebhookSignature(raw, sign(raw, process.env.RAZORPAY_WEBHOOK_SECRET)));
    assert.ok(!verifyWebhookSignature(raw, sign(raw))); // key secret is not the webhook secret
    assert.ok(!verifyWebhookSignature(raw, undefined));
  });
});

describe('placing an order', () => {
  test('prices come from the database; client price/total fields are ignored', async () => {
    const p = await makeProduct({ inr: 2799 });
    const r = await placeOnline([{ slug: p.slug, qty: 2, price: 1, unitPrice: 1 }], { extra: { total: 1, subtotal: 1, shipping: 0, discount: 999 } });
    assert.equal(r.status, 201);
    const o = await load(r.body.orderNumber);
    assert.equal(o.subtotal, 5598);
    assert.equal(o.shipping, 0); // free over 2999
    assert.equal(o.total, 5598);
    assert.equal(o.paymentMethod, 'online');
    assert.equal(o.paymentStatus, 'pending');
  });
  test('expectedTotal that no longer matches stops the order before stock is reserved', async () => {
    const p = await makeProduct({ inr: 2799, stock: 5 });
    const r = await placeOnline([{ slug: p.slug, qty: 1 }], { extra: { expectedTotal: 2500 } });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'PRICE_CHANGED');
    assert.equal(r.body.total, 2898);
    assert.equal((await Product.findById(p._id)).stock, 5);
    assert.equal(await Order.countDocuments(), 0);
    const ok = await placeOnline([{ slug: p.slug, qty: 1 }], { extra: { expectedTotal: 2898 } });
    assert.equal(ok.status, 201);
  });
  test('empty bag, unknown product, out of stock and silly quantities', async () => {
    const p = await makeProduct({ stock: 2 });
    assert.equal((await placeOnline([])).status, 400);
    assert.equal((await placeOnline([{ slug: 'no-such-thing', qty: 1 }])).status, 400);
    const oos = await placeOnline([{ slug: p.slug, qty: 3 }]);
    assert.equal(oos.status, 409);
    assert.equal(oos.body.code, 'OUT_OF_STOCK');
    const weird = await placeOnline([{ slug: p.slug, qty: -4 }]);
    assert.equal(weird.status, 201); // clamped to 1
    assert.equal((await load(weird.body.orderNumber)).items[0].qty, 1);
    assert.equal((await placeOnline([{ slug: { $ne: null }, qty: 1 }])).status, 400); // no NoSQL operator injection
  });
});

describe('starting a payment', () => {
  test('amount is the saved order total in paise; retries re-use the same Razorpay order', async () => {
    const p = await makeProduct({ inr: 2799 });
    const placed = await placeOnline([{ slug: p.slug, qty: 1 }]);
    const a = await startPay(placed.body.orderNumber);
    assert.equal(a.status, 200);
    assert.equal(a.body.amount, 289800);
    assert.equal(a.body.currency, 'INR');
    assert.equal(a.body.keyId, process.env.RAZORPAY_KEY_ID);
    assert.ok(!JSON.stringify(a.body).includes(process.env.RAZORPAY_KEY_SECRET));
    assert.equal(rzp.orders.get(a.body.razorpayOrderId).amount, 289800);
    const b = await startPay(placed.body.orderNumber);
    assert.equal(b.body.razorpayOrderId, a.body.razorpayOrderId);
    assert.equal(rzp.orders.size, 1);
  });
  test('two tabs at once get the same Razorpay order', async () => {
    const p = await makeProduct();
    const placed = await placeOnline([{ slug: p.slug, qty: 1 }]);
    const [a, b, c] = await Promise.all([1, 2, 3].map(() => startPay(placed.body.orderNumber)));
    assert.equal(new Set([a, b, c].map((x) => x.body.razorpayOrderId)).size, 1);
    assert.equal((await load(placed.body.orderNumber)).payment.attempts.length, 1);
  });
  test('ownership: wrong email, other customer and missing proof are refused', async () => {
    const p = await makeProduct();
    const placed = await placeOnline([{ slug: p.slug, qty: 1 }]);
    assert.equal((await startPay(placed.body.orderNumber, 'someone-else@example.test')).status, 404);
    assert.equal((await http('POST', '/api/payments/razorpay/order', { body: { orderNumber: placed.body.orderNumber } })).status, 404);
    const other = await makeUser();
    assert.equal((await startPay(placed.body.orderNumber, '', other.token)).status, 404);
    assert.equal((await http('POST', '/api/payments/razorpay/order', { body: { orderNumber: { $gt: '' }, email: { $gt: '' } } })).status, 404);
  });
  test('signed-in owner can pay without the email', async () => {
    const me = await makeUser('customer', 'owner@example.test');
    const p = await makeProduct();
    const placed = await placeOnline([{ slug: p.slug, qty: 1 }], { email: 'owner@example.test', token: me.token });
    assert.equal((await startPay(placed.body.orderNumber, '', me.token)).status, 200);
  });
  test('Razorpay down: 502, nothing saved; already paid: 409; cancelled: 409', async () => {
    const p = await makeProduct();
    const placed = await placeOnline([{ slug: p.slug, qty: 1 }]);
    rzp.down = true;
    const r = await startPay(placed.body.orderNumber);
    assert.equal(r.status, 502);
    assert.equal(r.body.code, 'PAYMENT_PROVIDER_ERROR');
    assert.equal((await load(placed.body.orderNumber)).payment?.attempts?.length || 0, 0);
    rzp.down = false;
    const { orderNumber } = await paidOrder();
    const again = await startPay(orderNumber);
    assert.equal(again.status, 409);
    assert.equal(again.body.code, 'ALREADY_PAID');
    await Order.updateOne({ orderNumber: placed.body.orderNumber }, { status: 'Cancelled' });
    assert.equal((await startPay(placed.body.orderNumber)).status, 409);
  });
});

describe('verifying a payment', () => {
  test('valid payment marks the order paid and confirmed, once', async () => {
    const { orderNumber, payment } = await paidOrder();
    const o = await load(orderNumber);
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(o.status, 'Confirmed');
    assert.equal(o.payment.providerPaymentId, payment.id);
    assert.equal(o.payment.amount, 289800);
    assert.equal(o.payment.currency, 'INR');
    assert.equal(o.payment.method, 'upi');
    assert.equal(o.payment.verifiedBy, 'checkout');
    assert.ok(o.payment.paidAt);
    assert.equal(confirmedNotes(o), 1);
  });
  test('replayed verification is harmless', async () => {
    const p = await makeProduct();
    const placed = await placeOnline([{ slug: p.slug, qty: 1 }]);
    const s = await startPay(placed.body.orderNumber);
    const { response } = pay(s.body.razorpayOrderId);
    for (let i = 0; i < 3; i++) assert.equal((await verify(placed.body.orderNumber, response)).status, 200);
    assert.equal(confirmedNotes(await load(placed.body.orderNumber)), 1);
  });
  test('invalid, missing or malformed fields are rejected and nothing changes', async () => {
    const p = await makeProduct();
    const placed = await placeOnline([{ slug: p.slug, qty: 1 }]);
    const s = await startPay(placed.body.orderNumber);
    const { response } = pay(s.body.razorpayOrderId);
    const cases = [
      { ...response, razorpay_signature: sign('tampered') },
      { ...response, razorpay_signature: undefined },
      { ...response, razorpay_payment_id: undefined },
      { ...response, razorpay_order_id: { $ne: null } },
      { ...response, razorpay_signature: sign(`${response.razorpay_order_id}|${response.razorpay_payment_id}`, 'guessed-secret') },
    ];
    for (const c of cases) assert.equal((await verify(placed.body.orderNumber, c)).status, 400);
    assert.equal((await load(placed.body.orderNumber)).paymentStatus, 'pending');
  });
  test("a genuine payment for another order cannot pay this one", async () => {
    const p = await makeProduct({ inr: 100, stock: 10 });
    const cheap = await placeOnline([{ slug: p.slug, qty: 1 }]);
    const dear = await placeOnline([{ slug: p.slug, qty: 5 }]);
    const s = await startPay(cheap.body.orderNumber);
    await startPay(dear.body.orderNumber);
    const { response } = pay(s.body.razorpayOrderId); // pays the cheap one
    const r = await verify(dear.body.orderNumber, response);
    assert.equal(r.status, 400);
    assert.equal((await load(dear.body.orderNumber)).paymentStatus, 'pending');
  });
  test('payment for a different amount than the order is not accepted as paid', async () => {
    const p = await makeProduct();
    const placed = await placeOnline([{ slug: p.slug, qty: 1 }]);
    const s = await startPay(placed.body.orderNumber);
    const { response } = pay(s.body.razorpayOrderId, { amount: 100 });
    const r = await verify(placed.body.orderNumber, response);
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'PAYMENT_NEEDS_REVIEW');
    const o = await load(placed.body.orderNumber);
    assert.equal(o.paymentStatus, 'pending');
    assert.equal(o.payment.issues[0].kind, 'amount_mismatch');
  });
  test('raising quantities after opening the payment window cannot underpay', async () => {
    const me = await makeUser('customer', 'edit@example.test');
    const p = await makeProduct({ inr: 1000, stock: 10 });
    const placed = await placeOnline([{ slug: p.slug, qty: 1 }], { email: 'edit@example.test', token: me.token });
    const s = await startPay(placed.body.orderNumber, 'edit@example.test'); // ₹1,099 window opened
    const edit = await http('PATCH', `/api/orders/mine/${placed.body.orderNumber}`, { token: me.token, body: { items: [{ slug: p.slug, qty: 5 }] } });
    assert.equal(edit.status, 200);
    assert.equal(edit.body.total, 5000);
    const { response } = pay(s.body.razorpayOrderId); // pays the old ₹1,099
    const r = await verify(placed.body.orderNumber, response, 'edit@example.test');
    assert.equal(r.status, 409);
    const o = await load(placed.body.orderNumber);
    assert.equal(o.paymentStatus, 'pending');
    assert.equal(o.payment.issues[0].kind, 'amount_mismatch');
    // Paying again opens a new Razorpay order for the new total.
    const s2 = await startPay(placed.body.orderNumber, 'edit@example.test');
    assert.notEqual(s2.body.razorpayOrderId, s.body.razorpayOrderId);
    assert.equal(s2.body.amount, 500000);
  });
  test('items cannot change once the order is paid', async () => {
    const me = await makeUser('customer', 'locked@example.test');
    const p = await makeProduct({ inr: 1000 });
    const placed = await placeOnline([{ slug: p.slug, qty: 1 }], { email: 'locked@example.test', token: me.token });
    const s = await startPay(placed.body.orderNumber, 'locked@example.test');
    await verify(placed.body.orderNumber, pay(s.body.razorpayOrderId).response, 'locked@example.test');
    const edit = await http('PATCH', `/api/orders/mine/${placed.body.orderNumber}`, { token: me.token, body: { items: [{ slug: p.slug, qty: 4 }] } });
    assert.equal(edit.status, 409);
  });
  test('authorised-only payment is captured by the server for the right amount', async () => {
    const p = await makeProduct();
    const placed = await placeOnline([{ slug: p.slug, qty: 1 }]);
    const s = await startPay(placed.body.orderNumber);
    const { payment, response } = pay(s.body.razorpayOrderId, { status: 'authorized' });
    assert.equal((await verify(placed.body.orderNumber, response)).status, 200);
    assert.equal(rzp.payments.get(payment.id).status, 'captured');
    assert.equal((await load(placed.body.orderNumber)).paymentStatus, 'paid');
  });
  test('Razorpay unreachable during verify: 202 confirming, settled later by the status check', async () => {
    const p = await makeProduct();
    const placed = await placeOnline([{ slug: p.slug, qty: 1 }]);
    const s = await startPay(placed.body.orderNumber);
    const { response } = pay(s.body.razorpayOrderId);
    rzp.down = true;
    const r = await verify(placed.body.orderNumber, response);
    assert.equal(r.status, 202);
    assert.equal(r.body.confirming, true);
    assert.equal((await load(placed.body.orderNumber)).paymentStatus, 'pending');
    rzp.down = false;
    const st = await http('POST', '/api/payments/razorpay/status', { body: { orderNumber: placed.body.orderNumber, email: 'buyer@example.test' } });
    assert.equal(st.body.paid, true);
    assert.equal((await load(placed.body.orderNumber)).payment.verifiedBy, 'reconcile');
  });
});

describe('webhooks', () => {
  async function pendingWithPayment() {
    const p = await makeProduct();
    const placed = await placeOnline([{ slug: p.slug, qty: 1 }]);
    const s = await startPay(placed.body.orderNumber);
    return { orderNumber: placed.body.orderNumber, ...pay(s.body.razorpayOrderId) };
  }
  test('bad or missing signature is rejected', async () => {
    const { orderNumber, payment } = await pendingWithPayment();
    assert.equal((await webhook('payment.captured', { payment: { entity: payment } }, { secret: 'wrong' })).status, 400);
    const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: payment } } });
    assert.equal((await http('POST', '/api/payments/razorpay/webhook', { body: {}, raw })).status, 400);
    assert.equal((await load(orderNumber)).paymentStatus, 'pending');
  });
  test('payment.captured settles the order when the browser never reported back', async () => {
    const { orderNumber, payment } = await pendingWithPayment();
    const r = await webhook('payment.captured', { payment: { entity: payment } });
    assert.equal(r.status, 200);
    const o = await load(orderNumber);
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(o.payment.verifiedBy, 'webhook');
  });
  test('webhook first, then the browser callback: one confirmation', async () => {
    const { orderNumber, payment, response } = await pendingWithPayment();
    await webhook('payment.captured', { payment: { entity: payment } });
    assert.equal((await verify(orderNumber, response)).status, 200);
    assert.equal(confirmedNotes(await load(orderNumber)), 1);
  });
  test('callback first, then the webhook (and order.paid): one confirmation', async () => {
    const { orderNumber, payment, response } = await pendingWithPayment();
    await verify(orderNumber, response);
    await webhook('payment.captured', { payment: { entity: payment } });
    await webhook('order.paid', { payment: { entity: payment }, order: { entity: { id: payment.order_id } } });
    const o = await load(orderNumber);
    assert.equal(confirmedNotes(o), 1);
    assert.equal(o.payment.issues.length, 0);
  });
  test('the same event delivered twice is handled once', async () => {
    const { payment } = await pendingWithPayment();
    await webhook('payment.captured', { payment: { entity: payment } }, { eventId: 'evt_SAME123' });
    await webhook('payment.captured', { payment: { entity: payment } }, { eventId: 'evt_SAME123' });
    assert.equal(await PaymentEvent.countDocuments({ eventId: 'evt_SAME123' }), 1);
  });
  test('callback and webhooks racing each other: one confirmation, no issue', async () => {
    const { orderNumber, payment, response } = await pendingWithPayment();
    await Promise.all([
      verify(orderNumber, response),
      webhook('payment.captured', { payment: { entity: payment } }),
      webhook('order.paid', { payment: { entity: payment }, order: { entity: { id: payment.order_id } } }),
      verify(orderNumber, response),
    ]);
    const o = await load(orderNumber);
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(confirmedNotes(o), 1);
    assert.equal(o.payment.issues.length, 0);
  });
  test('payment.failed keeps the order payable and records why', async () => {
    const p = await makeProduct();
    const placed = await placeOnline([{ slug: p.slug, qty: 1 }]);
    const s = await startPay(placed.body.orderNumber);
    const { payment } = pay(s.body.razorpayOrderId, { status: 'failed' });
    await webhook('payment.failed', { payment: { entity: payment } });
    const o = await load(placed.body.orderNumber);
    assert.equal(o.paymentStatus, 'pending');
    assert.equal(o.payment.attempts[0].lastError, 'Payment declined by bank');
    // Retry on the same Razorpay order succeeds.
    const retry = await startPay(placed.body.orderNumber);
    assert.equal(retry.body.razorpayOrderId, s.body.razorpayOrderId);
    assert.equal((await verify(placed.body.orderNumber, pay(s.body.razorpayOrderId).response)).status, 200);
  });
  test('a second payment for a paid order is flagged for refund, not double counted', async () => {
    const { orderNumber, session } = await paidOrder();
    rzp.orders.get(session.razorpayOrderId).status = 'created'; // pretend a second capture slipped through
    const second = pay(session.razorpayOrderId);
    await webhook('payment.captured', { payment: { entity: second.payment } });
    const o = await load(orderNumber);
    assert.equal(o.payment.issues.length, 1);
    assert.equal(o.payment.issues[0].kind, 'duplicate_payment');
    assert.notEqual(o.payment.providerPaymentId, second.payment.id);
  });
  test('payment after cancellation is recorded and flagged for refund', async () => {
    const { orderNumber, payment } = await pendingWithPayment();
    await Order.updateOne({ orderNumber }, { status: 'Cancelled' });
    await webhook('payment.captured', { payment: { entity: payment } });
    const o = await load(orderNumber);
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(o.status, 'Cancelled');
    assert.equal(o.payment.issues[0].kind, 'paid_after_cancel');
  });
  test('unknown Razorpay order is acknowledged and ignored', async () => {
    const r = await webhook('payment.captured', { payment: { entity: { id: 'pay_UNKNOWN1', order_id: 'order_UNKNOWN1', amount: 100, currency: 'INR', status: 'captured' } } });
    assert.equal(r.status, 200);
  });
});

describe('admin and refunds', () => {
  const refund = (orderNumber, body, token) => http('POST', `/api/admin/orders/${orderNumber}/refund`, { token, body });
  test('only admins can refund; customers and support staff are refused', async () => {
    const { orderNumber } = await paidOrder();
    const cust = await makeUser('customer');
    const support = await makeUser('support');
    const manager = await makeUser('manager');
    assert.equal((await refund(orderNumber, {}, cust.token)).status, 403);
    assert.equal((await refund(orderNumber, {}, support.token)).status, 403);
    assert.equal((await refund(orderNumber, {}, manager.token)).status, 403);
    assert.equal((await refund(orderNumber, {})).status, 401);
    assert.equal((await load(orderNumber)).paymentStatus, 'paid');
  });
  test('partial then full refund; over-refund and repeat refunds refused', async () => {
    const { orderNumber } = await paidOrder(); // ₹2,898
    const admin = await makeUser('admin');
    assert.equal((await refund(orderNumber, { amount: 5000 }, admin.token)).status, 400);
    assert.equal((await refund(orderNumber, { amount: 'abc' }, admin.token)).status, 400);
    const part = await refund(orderNumber, { amount: 898, reason: 'Damaged box' }, admin.token);
    assert.equal(part.status, 200);
    assert.equal(part.body.paymentStatus, 'partially_refunded');
    assert.equal(part.body.payment.refundedAmount, 89800);
    const rest = await refund(orderNumber, {}, admin.token);
    assert.equal(rest.body.paymentStatus, 'refunded');
    assert.equal(rest.body.payment.refundedAmount, 289800);
    assert.equal((await refund(orderNumber, {}, admin.token)).status, 409);
  });
  test('double-clicked refund sends money back only once', async () => {
    const { orderNumber } = await paidOrder();
    const admin = await makeUser('admin');
    const results = await Promise.all([1, 2, 3].map(() => refund(orderNumber, {}, admin.token)));
    assert.equal(results.filter((r) => r.status === 200).length, 1);
    assert.equal(rzp.refunds.size, 1);
  });
  test('refund webhooks update state, out of order and from the Dashboard', async () => {
    const { orderNumber, payment } = await paidOrder();
    const rf = { id: 'rfnd_DASH12345', payment_id: payment.id, amount: 289800, currency: 'INR', status: 'processed', notes: {} };
    await webhook('refund.processed', { refund: { entity: rf } });
    await webhook('refund.created', { refund: { entity: { ...rf, status: 'pending' } } }); // late, older event
    const o = await load(orderNumber);
    assert.equal(o.payment.refunds.length, 1);
    assert.equal(o.payment.refunds[0].status, 'processed');
    assert.equal(o.paymentStatus, 'refunded');
  });
  test('failed refund frees the amount again', async () => {
    const { orderNumber, payment } = await paidOrder();
    const rf = { id: 'rfnd_FAIL12345', payment_id: payment.id, amount: 100000, currency: 'INR', status: 'pending', notes: {} };
    await webhook('refund.created', { refund: { entity: rf } });
    assert.equal((await load(orderNumber)).paymentStatus, 'partially_refunded');
    await webhook('refund.failed', { refund: { entity: { ...rf, status: 'failed' } } });
    const o = await load(orderNumber);
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(o.payment.refundedAmount, 0);
  });
  test('an extra (issue) payment can be refunded and is marked resolved', async () => {
    const { orderNumber, session } = await paidOrder();
    rzp.orders.get(session.razorpayOrderId).status = 'created';
    const second = pay(session.razorpayOrderId);
    await webhook('payment.captured', { payment: { entity: second.payment } });
    const admin = await makeUser('admin');
    const r = await refund(orderNumber, { paymentId: second.payment.id }, admin.token);
    assert.equal(r.status, 200);
    assert.equal(r.body.paymentStatus, 'paid'); // the real payment stays
    assert.equal(r.body.payment.issues[0].resolved, true);
  });
  test('payment status of an online-paid order cannot be typed over by hand', async () => {
    const { orderNumber } = await paidOrder();
    const admin = await makeUser('admin');
    const o = await load(orderNumber);
    const r = await http('PATCH', `/api/orders/${o._id}`, { token: admin.token, body: { paymentStatus: 'refunded' } });
    assert.equal(r.status, 400);
    assert.equal((await load(orderNumber)).paymentStatus, 'paid');
    // Other edits still work.
    assert.equal((await http('PATCH', `/api/orders/${o._id}`, { token: admin.token, body: { status: 'Packed', paymentStatus: 'paid' } })).status, 200);
  });
  test('admin "check with Razorpay" settles a stuck order', async () => {
    const p = await makeProduct();
    const placed = await placeOnline([{ slug: p.slug, qty: 1 }]);
    const s = await startPay(placed.body.orderNumber);
    pay(s.body.razorpayOrderId); // paid, but neither callback nor webhook arrived
    const support = await makeUser('support');
    const r = await http('POST', `/api/admin/orders/${placed.body.orderNumber}/payment-check`, { token: support.token });
    assert.equal(r.status, 200);
    assert.equal(r.body.paymentStatus, 'paid');
  });
  test("payment lookup is limited to the owner's orders", async () => {
    const owner = await makeUser('customer', 'look@example.test');
    const p = await makeProduct();
    const placed = await placeOnline([{ slug: p.slug, qty: 1 }], { email: 'look@example.test', token: owner.token });
    const s = await startPay(placed.body.orderNumber, 'look@example.test');
    const { payment, response } = pay(s.body.razorpayOrderId);
    await verify(placed.body.orderNumber, response, 'look@example.test');
    const stranger = await makeUser();
    assert.equal((await http('GET', `/api/payments/${payment.id}`, { token: stranger.token })).status, 404);
    assert.equal((await http('GET', `/api/payments/${payment.id}`)).status, 401);
    const mine = await http('GET', `/api/payments/${payment.id}`, { token: owner.token });
    assert.equal(mine.status, 200);
    assert.equal(mine.body.status, 'paid');
  });
});

describe('abuse limits', () => {
  test('payment endpoints are rate limited per client', async () => {
    const statuses = [];
    for (let i = 0; i < 32; i++) statuses.push((await http('POST', '/api/payments/razorpay/verify', { ip: '10.9.9.9', body: { orderNumber: 'AB-NOPE', email: 'x@example.test' } })).status);
    assert.equal(statuses[0], 404);
    assert.equal(statuses.at(-1), 429);
  });
  test('oversized bodies are refused', async () => {
    const r = await http('POST', '/api/payments/razorpay/verify', { body: {}, raw: JSON.stringify({ pad: 'x'.repeat(1_100_000) }) });
    assert.equal(r.status, 413);
  });
});

describe('customer view', () => {
  test('shows payment state but no internal payment details', async () => {
    const owner = await makeUser('customer', 'view@example.test');
    const p = await makeProduct();
    await placeOnline([{ slug: p.slug, qty: 1 }], { email: 'view@example.test', token: owner.token });
    const r = await http('GET', '/api/orders/mine', { token: owner.token });
    assert.equal(r.body[0].statusKey, 'pending_payment');
    assert.equal(r.body[0].canPayOnline, true);
    assert.ok(!('payment' in r.body[0]));
    assert.ok(!('notes' in r.body[0]));
    void customer;
  });
});
