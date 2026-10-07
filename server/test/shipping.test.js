// Delhivery shipping: creation after payment, idempotency, failures and
// retries, scan push (webhook) security and ordering, polling, customer
// privacy, admin roles and notification de-duplication. Delhivery is faked
// (see helpers.js); nothing leaves this machine.
import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  http, pay, reset, close, makeUser, makeProduct, placeOnline, customer, Order, dlv, outbox, shipping,
} from './helpers.js';

after(close);
beforeEach(reset);

const { mapScan, courierTime, summarize, shippingTick, shippingIdle } = shipping;
const load = (orderNumber) => Order.findOne({ orderNumber }).lean();
const creates = () => dlv.calls.filter((c) => c === 'POST /api/cmu/create.json').length;
const mails = (orderNumber, word) => outbox.filter((m) => m.subject.includes(orderNumber) && (!word || m.subject.includes(word))).length;
const push = (body, token = process.env.DELHIVERY_WEBHOOK_TOKEN) => http('POST', '/api/shipping/delhivery/webhook', { body, headers: token ? { Authorization: `Bearer ${token}` } : {} });

async function paidOrder({ token, email = 'buyer@example.test' } = {}) {
  const p = await makeProduct({ inr: 2799 });
  const placed = await placeOnline([{ slug: p.slug, qty: 1 }], { token, email });
  const session = await http('POST', '/api/payments/razorpay/order', { token, body: { orderNumber: placed.body.orderNumber, email } });
  const { response } = pay(session.body.razorpayOrderId);
  const v = await http('POST', '/api/payments/razorpay/verify', { body: { orderNumber: placed.body.orderNumber, email, ...response } });
  assert.equal(v.status, 200);
  await shippingIdle();
  return placed.body.orderNumber;
}
async function codOrder(extra = {}) {
  const p = await makeProduct({ inr: 1250 });
  const r = await http('POST', '/api/orders', { body: { region: 'IN', paymentMethod: 'cod', items: [{ slug: p.slug, qty: 2 }], customer: customer(), ...extra } });
  assert.equal(r.status, 201);
  return r.body.orderNumber;
}
// An order with a fresh Delhivery shipment, created from the admin.
async function shipped() {
  const n = await codOrder();
  const { token } = await makeUser('admin');
  const r = await http('POST', `/api/admin/orders/${n}/shipment`, { token });
  assert.equal(r.status, 201);
  const o = await load(n);
  return { n, awb: o.shipment.awb, admin: token };
}
const scan = (awb, ref, status, type, at, note = '', location = 'Mumbai_Andheri_DC (Maharashtra)') => {
  const ist = new Date(at.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 23);
  return { Shipment: { AWB: awb, ReferenceNo: ref, Status: { Status: status, StatusType: type, StatusDateTime: ist, StatusLocation: location, Instructions: note } } };
};
const t0 = Date.now() - 3 * 24 * 3600 * 1000;
const at = (h) => new Date(t0 + h * 3600 * 1000);

describe('status mapping', () => {
  test('Delhivery status + type → shipment status', () => {
    const cases = [
      ['Manifested', 'UD', '', 'awb_assigned'], ['Not Picked', 'UD', '', 'awb_assigned'],
      ['In Transit', 'UD', 'Shipment picked up', 'picked_up'], ['In Transit', 'UD', 'Bag received at facility', 'in_transit'],
      ['Pending', 'UD', 'Shipment received at facility', 'in_transit'], ['Pending', 'UD', 'Consignee unavailable', 'exception'],
      ['Dispatched', 'UD', 'Out for delivery', 'out_for_delivery'], ['Delivered', 'DL', '', 'delivered'],
      ['In Transit', 'RT', '', 'rto'], ['Dispatched', 'RT', '', 'rto'], ['RTO', 'DL', '', 'returned'], ['DTO', 'DL', '', 'returned'],
      ['Canceled', 'CN', '', 'cancelled'], ['LOST', 'UD', '', 'exception'], ['Something new', 'UD', '', null], ['', '', '', null],
    ];
    for (const [s, t, n, want] of cases) assert.equal(mapScan(s, t, n), want, `${s}/${t}/${n}`);
  });
  test('Delhivery times are India time', () => {
    assert.equal(courierTime('2019-01-09T17:10:42.767').toISOString(), '2019-01-09T11:40:42.767Z');
    assert.equal(courierTime('2013-10-18T10:44:25.328000').toISOString(), '2013-10-18T05:14:25.328Z');
    assert.equal(courierTime('nonsense'), null);
  });
  test('out-of-order scans never move the status backwards; delivered stands', () => {
    const ev = (status, h) => ({ status, at: at(h), source: 'webhook' });
    assert.equal(summarize({ events: [ev('out_for_delivery', 5), ev('in_transit', 2)] }).status, 'out_for_delivery');
    assert.equal(summarize({ events: [ev('delivered', 6), ev('in_transit', 7)] }).status, 'delivered');
    assert.equal(summarize({ events: [ev('awb_assigned', 0), ev('picked_up', 1), ev('in_transit', 2)] }).pickedUpAt.getTime(), at(1).getTime());
  });
});

describe('creating shipments', () => {
  test('successful online payment → one shipment, AWB stored, Prepaid', async () => {
    const n = await paidOrder();
    const o = await load(n);
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(o.shipment.status, 'awb_assigned');
    assert.match(o.shipment.awb, /^\d{13}$/);
    assert.equal(o.carrier, 'Delhivery');
    assert.equal(o.trackingNumber, o.shipment.awb);
    assert.match(o.carrierUrl, /delhivery\.com\/track/);
    assert.equal(creates(), 1);
    const body = dlv.bodies[0].shipments[0];
    assert.equal(body.order, n);
    assert.equal(body.payment_mode, 'Prepaid');
    assert.equal(body.cod_amount, 0);
    assert.equal(body.pin, '400001');
    assert.equal(body.phone, '9876543210');
    assert.equal(dlv.bodies[0].pickup_location.name, 'Test Warehouse');
    assert.equal(mails(n, 'confirmed'), 1);
    assert.equal(mails(n, 'prepared for dispatch'), 1);
  });
  test('unpaid or failed payment → no shipment', async () => {
    const p = await makeProduct();
    const placed = await placeOnline([{ slug: p.slug, qty: 1 }]);
    const session = await http('POST', '/api/payments/razorpay/order', { body: { orderNumber: placed.body.orderNumber, email: 'buyer@example.test' } });
    const { response } = pay(session.body.razorpayOrderId, { status: 'failed' });
    await http('POST', '/api/payments/razorpay/verify', { body: { orderNumber: placed.body.orderNumber, email: 'buyer@example.test', ...response } });
    await shippingIdle();
    await shippingTick();
    const o = await load(placed.body.orderNumber);
    assert.equal(o.paymentStatus, 'pending');
    assert.ok(!o.shipment?.awb);
    assert.equal(creates(), 0);
    const { token } = await makeUser('admin');
    const r = await http('POST', `/api/admin/orders/${o.orderNumber}/shipment`, { token });
    assert.equal(r.status, 409);
    assert.match(r.body.message, /payment has not been received/);
  });
  test('cash on delivery waits for confirmation, then ships as COD', async () => {
    const n = await codOrder();
    await shippingTick();
    assert.equal(creates(), 0);
    const { token } = await makeUser('admin');
    const r = await http('PATCH', `/api/admin/orders/${(await load(n))._id}/status`, { token, body: { status: 'confirmed' } });
    assert.equal(r.status, 200);
    await shippingIdle();
    const o = await load(n);
    assert.equal(o.shipment.status, 'awb_assigned');
    assert.equal(dlv.bodies[0].shipments[0].payment_mode, 'COD');
    assert.equal(dlv.bodies[0].shipments[0].cod_amount, o.total);
  });
  test('UAE orders are not sent to Delhivery', async () => {
    const p = await makeProduct();
    const r = await http('POST', '/api/orders', { body: { region: 'AE', paymentMethod: 'pay-on-confirmation', items: [{ slug: p.slug, qty: 1 }], customer: { ...customer(), address: { line1: '1 Road', city: 'Dubai', postalCode: '00000' } } } });
    const { token } = await makeUser('admin');
    await Order.updateOne({ orderNumber: r.body.orderNumber }, { paymentStatus: 'paid' });
    const c = await http('POST', `/api/admin/orders/${r.body.orderNumber}/shipment`, { token });
    assert.equal(c.status, 409);
    assert.match(c.body.message, /within India only/);
  });
  test('duplicate requests create exactly one shipment', async () => {
    const n = await codOrder();
    const { token } = await makeUser('admin');
    const results = await Promise.all(Array.from({ length: 6 }, () => http('POST', `/api/admin/orders/${n}/shipment`, { token })));
    assert.equal(results.filter((x) => x.status === 201).length, 1);
    assert.ok(results.every((x) => [201, 409].includes(x.status)));
    assert.equal(creates(), 1);
    const again = await http('POST', `/api/admin/orders/${n}/shipment`, { token });
    assert.equal(again.status, 409);
    assert.match(again.body.message, /already has a Delhivery shipment/);
    assert.equal(creates(), 1);
  });
  test('Delhivery down → failed with a retry scheduled; retry later succeeds', async () => {
    const n = await codOrder();
    const { token } = await makeUser('admin');
    dlv.down = true;
    const r = await http('POST', `/api/admin/orders/${n}/shipment`, { token });
    assert.equal(r.status, 502);
    let o = await load(n);
    assert.equal(o.shipment.status, 'failed');
    assert.match(o.shipment.error, /Could not reach Delhivery/);
    assert.equal(o.shipment.attempts, 1);
    assert.ok(o.shipment.nextAttemptAt > new Date());
    dlv.down = false;
    await Order.updateOne({ orderNumber: n }, { 'shipment.nextAttemptAt': new Date(Date.now() - 1000) });
    const tick = await shippingTick();
    assert.equal(tick.retried, 1);
    o = await load(n);
    assert.equal(o.shipment.status, 'awb_assigned');
    assert.equal(o.shipment.error, '');
  });
  test('timeout after Delhivery created it → looked up on retry, never created twice', async () => {
    const n = await codOrder();
    const { token } = await makeUser('admin');
    dlv.timeoutAfterCreate = true;
    const r = await http('POST', `/api/admin/orders/${n}/shipment`, { token });
    assert.equal(r.status, 502);
    let o = await load(n);
    assert.equal(o.shipment.status, 'failed');
    assert.ok(o.shipment.unknownSince);
    const retry = await http('POST', `/api/admin/orders/${n}/shipment`, { token });
    assert.equal(retry.status, 201);
    o = await load(n);
    assert.equal(creates(), 1);
    assert.equal(o.shipment.awb, [...dlv.shipments.keys()][0]);
  });
  test('a refusal (e.g. pincode not serviceable) is not retried automatically and shows as an error', async () => {
    const n = await codOrder();
    const { token } = await makeUser('admin');
    dlv.rejectNext = 'Non serviceable pincode';
    const r = await http('POST', `/api/admin/orders/${n}/shipment`, { token });
    assert.equal(r.status, 502);
    const o = await load(n);
    assert.equal(o.shipment.nextAttemptAt, null);
    const list = await http('GET', '/api/admin/shipments?status=errors', { token });
    assert.equal(list.body.items[0].shipment.error, 'Non serviceable pincode');
  });
});

describe('scan push (webhook)', () => {
  test('rejects missing / wrong tokens and malformed payloads', async () => {
    const { n, awb } = await shipped();
    const good = scan(awb, n, 'In Transit', 'UD', at(1), 'Shipment picked up');
    assert.equal((await push(good, null)).status, 401);
    assert.equal((await push(good, 'x'.repeat(40))).status, 401);
    assert.equal((await push({ hello: 1 })).status, 400);
    assert.equal((await push({ Shipment: { AWB: 'abc', Status: {} } })).status, 400);
    assert.equal((await push({ Shipment: { AWB: awb, Status: { Status: 'In Transit' } } })).status, 400); // no time
    assert.equal((await push({ Shipment: { AWB: { $ne: null }, Status: good.Shipment.Status } })).status, 400);
    assert.equal((await push(scan('99999999999', 'X', 'In Transit', 'UD', at(1)))).status, 202); // not ours
    assert.equal((await push(scan(awb, 'SOMEONE-ELSE', 'Delivered', 'DL', at(2)))).status, 409); // wrong order
    const o = await load(n);
    assert.equal(o.shipment.status, 'awb_assigned');
  });
  test('journey: picked up → in transit → out for delivery → delivered; order status follows', async () => {
    const { n, awb } = await shipped();
    assert.equal((await push(scan(awb, n, 'In Transit', 'UD', at(1), 'Shipment picked up'))).body.outcome, 'applied');
    let o = await load(n);
    assert.equal(o.shipment.status, 'picked_up');
    assert.equal(o.status, 'Shipped');
    await push(scan(awb, n, 'In Transit', 'UD', at(10), 'Bag received at facility'));
    await push(scan(awb, n, 'Dispatched', 'UD', at(30), 'Out for delivery'));
    o = await load(n);
    assert.equal(o.shipment.status, 'out_for_delivery');
    assert.equal(o.status, 'Out for Delivery');
    await push(scan(awb, n, 'Delivered', 'DL', at(33), 'Delivered to consignee'));
    o = await load(n);
    assert.equal(o.shipment.status, 'delivered');
    assert.equal(o.status, 'Delivered');
    assert.equal(o.shipment.deliveredAt.getTime(), Math.floor(at(33).getTime()));
    assert.equal(o.shipment.pickedUpAt.getTime(), Math.floor(at(1).getTime()));
  });
  test('duplicates and out-of-order pushes are harmless; one email per milestone', async () => {
    const { n, awb } = await shipped();
    const pick = scan(awb, n, 'In Transit', 'UD', at(1), 'Shipment picked up');
    await push(pick);
    assert.equal((await push(pick)).body.outcome, 'duplicate');
    await push(scan(awb, n, 'Dispatched', 'UD', at(30), 'Out for delivery'));
    await push(scan(awb, n, 'In Transit', 'UD', at(12), 'Bag received')); // late arrival
    let o = await load(n);
    assert.equal(o.shipment.status, 'out_for_delivery');
    await push(scan(awb, n, 'Delivered', 'DL', at(33)));
    await push(scan(awb, n, 'Delivered', 'DL', at(33)));
    await push(scan(awb, n, 'In Transit', 'UD', at(40))); // stray scan after delivery
    o = await load(n);
    assert.equal(o.shipment.status, 'delivered');
    assert.equal(o.shipment.events.filter((e) => e.status === 'delivered').length, 1);
    assert.equal(mails(n, 'on its way'), 1);
    assert.equal(mails(n, 'arrives today'), 1);
    assert.equal(mails(n, 'has been delivered'), 1);
    assert.equal(o.history.filter((h) => h.status === 'Delivered').length, 1);
  });
  test('RTO: returning, then returned; the order is not marked delivered', async () => {
    const { n, awb } = await shipped();
    await push(scan(awb, n, 'In Transit', 'UD', at(1), 'Shipment picked up'));
    await push(scan(awb, n, 'Pending', 'UD', at(20), 'Consignee refused to accept'));
    let o = await load(n);
    assert.equal(o.shipment.status, 'exception');
    await push(scan(awb, n, 'In Transit', 'RT', at(30)));
    o = await load(n);
    assert.equal(o.shipment.status, 'rto');
    await push(scan(awb, n, 'RTO', 'DL', at(60), 'RTO Delivered'));
    o = await load(n);
    assert.equal(o.shipment.status, 'returned');
    assert.equal(o.status, 'Shipped');
    assert.equal(mails(n, 'An update'), 2); // delay, then returning (returned shares the RTO email)
  });
  test('a batch of scans', async () => {
    const { n, awb } = await shipped();
    const r = await push([scan(awb, n, 'In Transit', 'UD', at(1), 'Shipment picked up'), scan(awb, n, 'In Transit', 'UD', at(5))]);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.results, ['applied', 'applied']);
  });
});

describe('tracking (polling) and the customer', () => {
  test('polling stores new scans and the expected delivery date, but no courier copy of personal data', async () => {
    const { n, awb } = await shipped();
    dlv.scan(awb, 'In Transit', 'UD', { at: new Date(Date.now() + 60000), note: 'Shipment picked up' });
    dlv.shipments.get(awb).edd = '2030-01-05T18:00:00';
    await Order.updateOne({ orderNumber: n }, { 'shipment.lastCheckedAt': new Date(0) });
    const tick = await shippingTick();
    assert.equal(tick.checked, 1);
    // GET /api/v1/packages/json/?waybill=<awb>&ref_ids=<order id>
    assert.deepEqual(dlv.trackQueries.at(-1), { waybill: awb, ref_ids: n });
    const o = await load(n);
    assert.equal(o.shipment.status, 'picked_up');
    assert.ok(o.shipment.expectedDelivery);
    assert.ok(!JSON.stringify(o).includes('should-not-be-stored'));
    const again = await shippingTick(); // nothing stale
    assert.equal(again.checked, 0);
  });
  test('owner sees shipment details; other customers and visitors do not', async () => {
    const owner = await makeUser('customer', 'buyer@example.test');
    const n = await paidOrder({ token: owner.token });
    const o = await load(n);
    dlv.scan(o.shipment.awb, 'In Transit', 'UD', { at: new Date(Date.now() + 60000), note: 'Shipment picked up' });
    const mine = await http('GET', `/api/orders/${n}`, { token: owner.token });
    assert.equal(mine.status, 200);
    assert.equal(mine.body.shipment.awb, o.shipment.awb);
    assert.equal(mine.body.shipment.carrier, 'Delhivery');
    assert.equal(mine.body.shipment.status, 'picked_up'); // refreshed by the server on open
    assert.ok(mine.body.shipment.events.length >= 3);
    assert.equal(mine.body.shipment.location, 'Telangana');
    assert.equal(mine.body.paymentStatus, 'paid');
    for (const k of ['error', 'attempts', 'notified', 'orderRef', 'reference', 'rev']) assert.ok(!(k in mine.body.shipment), k);
    const tr = await http('GET', `/api/orders/${n}/tracking`, { token: owner.token });
    assert.equal(tr.body.shipment.awb, o.shipment.awb);
    const other = await makeUser('customer', 'someone@example.test');
    assert.equal((await http('GET', `/api/orders/${n}`, { token: other.token })).status, 404);
    assert.equal((await http('GET', `/api/orders/${n}/tracking`, { token: other.token })).status, 404);
    assert.equal((await http('GET', `/api/orders/${n}/tracking`)).status, 401);
    const pub = await http('GET', `/api/orders/track/${o.trackingId}?email=wrong@example.test`);
    assert.equal(pub.status, 404);
  });
  test('tracking temporarily unavailable: the page still loads', async () => {
    const owner = await makeUser('customer', 'buyer@example.test');
    const n = await paidOrder({ token: owner.token });
    dlv.trackDown = true;
    const r = await http('GET', `/api/orders/${n}/tracking`, { token: owner.token });
    assert.equal(r.status, 200);
    assert.equal(r.body.trackingUnavailable, true);
    assert.equal(r.body.shipment.status, 'awb_assigned');
  });
  test('a failed creation is shown to the customer as "awaiting shipment", without the error', async () => {
    const owner = await makeUser('customer', 'buyer@example.test');
    dlv.down = true;
    const n = await paidOrder({ token: owner.token });
    const r = await http('GET', `/api/orders/${n}`, { token: owner.token });
    assert.equal(r.body.shipment.status, 'pending');
    assert.equal(r.body.shipment.awb, '');
    assert.ok(!JSON.stringify(r.body).includes('Could not reach'));
  });
  test('booked orders: address can no longer change; another courier cannot be typed over', async () => {
    const owner = await makeUser('customer', 'buyer@example.test');
    const n = await paidOrder({ token: owner.token });
    const r = await http('PATCH', `/api/orders/mine/${n}`, { token: owner.token, body: { customer: { address: { line1: 'New road' } } } });
    assert.equal(r.status, 409);
    const { token } = await makeUser('admin');
    const o = await load(n);
    const typed = await http('PATCH', `/api/orders/${o._id}`, { token, body: { carrier: 'Blue Dart', trackingNumber: '123' } });
    assert.equal(typed.status, 400);
    assert.match(typed.body.message, /ships with Delhivery/);
  });
});

describe('cancelling', () => {
  test('the customer cancels before pickup → the Delhivery shipment is cancelled too', async () => {
    const owner = await makeUser('customer', 'buyer@example.test');
    const n = await paidOrder({ token: owner.token });
    const awb = (await load(n)).shipment.awb;
    const r = await http('POST', `/api/orders/mine/${n}/cancel`, { token: owner.token, body: { reason: 'Changed my mind' } });
    assert.equal(r.status, 200);
    assert.deepEqual(dlv.cancelled, [awb]);
    assert.equal(r.body.shipment.status, 'cancelled');
    const o = await load(n);
    assert.equal(o.shipment.status, 'cancelled');
    // Delhivery later reports the cancelled prepaid parcel as "Returned": still cancelled.
    await push(scan(awb, n, 'Returned', 'RT', new Date()));
    assert.equal((await load(n)).shipment.status, 'cancelled');
  });
  test('cannot cancel once picked up', async () => {
    const owner = await makeUser('customer', 'buyer@example.test');
    const n = await paidOrder({ token: owner.token });
    const awb = (await load(n)).shipment.awb;
    await push(scan(awb, n, 'In Transit', 'UD', new Date(), 'Shipment picked up'));
    const r = await http('POST', `/api/orders/mine/${n}/cancel`, { token: owner.token });
    assert.equal(r.status, 409);
  });
  test('admin cancels the order → shipment cancelled; a new shipment gets a new reference', async () => {
    const { n, admin } = await shipped();
    const o = await load(n);
    const c = await http('POST', `/api/admin/orders/${n}/shipment/cancel`, { token: admin });
    assert.equal(c.status, 200);
    assert.equal(c.body.shipment.status, 'cancelled');
    const again = await http('POST', `/api/admin/orders/${n}/shipment`, { token: admin });
    assert.equal(again.status, 201);
    assert.equal(again.body.shipment.orderRef, `${n}-R2`);
    assert.notEqual(again.body.shipment.awb, o.shipment.awb);
    const cancelOrder = await http('POST', `/api/admin/orders/${n}/cancel`, { token: admin });
    assert.equal(cancelOrder.status, 200);
    assert.equal(dlv.cancelled.length, 2);
  });
});

describe('admin', () => {
  test('roles: customers and visitors are refused; support can create but not cancel', async () => {
    const { n } = await shipped();
    const cust = await makeUser('customer');
    assert.equal((await http('GET', '/api/admin/shipments', { token: cust.token })).status, 403);
    assert.equal((await http('POST', `/api/admin/orders/${n}/shipment`, { token: cust.token })).status, 403);
    assert.equal((await http('GET', '/api/admin/shipments')).status, 401);
    const support = await makeUser('support');
    assert.equal((await http('GET', '/api/admin/shipments', { token: support.token })).status, 200);
    assert.equal((await http('POST', `/api/admin/orders/${n}/shipment/cancel`, { token: support.token })).status, 403);
    assert.equal((await http('POST', `/api/admin/orders/${n}/shipment/refresh`, { token: support.token })).status, 200);
  });
  test('list: awaiting, by status, search by order ID / AWB / customer, date filter', async () => {
    const waiting = await codOrder();
    await http('PATCH', `/api/admin/orders/${(await load(waiting))._id}/status`, { token: (await makeUser('admin')).token, body: { status: 'confirmed' } });
    await shippingIdle();
    const { n, awb, admin } = await shipped();
    const another = await codOrder();
    await Order.updateOne({ orderNumber: another }, { status: 'Confirmed' });
    const awaiting = await http('GET', '/api/admin/shipments?status=awaiting', { token: admin });
    assert.deepEqual(awaiting.body.items.map((x) => x.orderNumber), [another]);
    assert.equal(awaiting.body.counts.awaiting, 1);
    assert.equal((await http('GET', `/api/admin/shipments?q=${awb}`, { token: admin })).body.items[0].orderNumber, n);
    assert.equal((await http('GET', `/api/admin/shipments?q=${n.toLowerCase()}`, { token: admin })).body.items[0].shipment.awb, awb);
    assert.equal((await http('GET', '/api/admin/shipments?q=98765%2043210', { token: admin })).body.total, 3);
    assert.equal((await http('GET', '/api/admin/shipments?status=awb_assigned', { token: admin })).body.total, 2);
    assert.equal((await http('GET', '/api/admin/shipments?from=2001-01-01&to=2001-01-02', { token: admin })).body.total, 0);
    assert.equal((await http('GET', '/api/admin/shipments?q[$ne]=x', { token: admin })).status, 200);
  });
  test('refresh needs an AWB; status endpoint never reveals credentials', async () => {
    const n = await codOrder();
    const { token } = await makeUser('admin');
    assert.equal((await http('POST', `/api/admin/orders/${n}/shipment/refresh`, { token })).status, 409);
    const st = await http('GET', '/api/admin/shipments/status', { token });
    assert.equal(st.body.configured, true);
    assert.equal(st.body.mode, 'staging');
    const all = JSON.stringify(st.body) + JSON.stringify((await http('GET', '/api/admin/shipments', { token })).body);
    assert.ok(!all.includes(process.env.DELHIVERY_API_TOKEN));
    assert.ok(!all.includes(process.env.DELHIVERY_WEBHOOK_TOKEN));
  });
});
