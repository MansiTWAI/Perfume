// WhatsApp notifications (subscribe → AI lead → notify all / selected →
// delivery → status tracking) and coupons (admin → listed on the site →
// apply → checkout → usage), end to end through the real API. WhatsApp's
// Cloud API is faked; nothing is sent anywhere.
import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  http, reset, close, makeUser, makeProduct, customer, Order, Product, Lead, ChatSession, Coupon,
  WhatsAppContact, WhatsAppMessage, WhatsAppCampaign, whatsapp, wa, waHook,
} from './helpers.js';

after(close);
beforeEach(reset);

// Codes are limited to one per 30 seconds per number; tests move earlier codes back in time.
const ageCodes = () => mongoose.connection.collection('otps').updateMany({}, { $set: { createdAt: new Date(Date.now() - 3600e3) } });
const sub = (phone, extra = {}, token) => http('POST', '/api/whatsapp/subscribe', { token, body: { phone, name: 'Aisha Khan', consent: true, ...extra } });
const notify = (token, body) => http('POST', '/api/admin/whatsapp/campaigns', { token, body });
const settle = () => whatsapp.whatsappIdle();

describe('WhatsApp subscription', () => {
  test('needs consent and a valid number; numbers are stored in one form', async () => {
    assert.equal((await sub('9876543210', { consent: false })).status, 400);
    assert.equal((await sub('12345', {})).status, 400);
    assert.equal((await sub('98765 43210')).status, 201);
    assert.equal((await sub('+91 98765-43210')).status, 201); // same number again
    const all = await WhatsAppContact.find().lean();
    assert.equal(all.length, 1);
    assert.equal(all[0].phone, '+919876543210');
    assert.equal(all[0].subscribed, true);
  });

  test('a concierge chat links the subscriber to its AI lead', async () => {
    const lead = await Lead.create({ name: 'Aisha', intent: 'ready', interestedProducts: ['zafreon'], sessionIds: ['sess-1'] });
    await ChatSession.create({ sessionId: 'sess-1', lead: lead._id, messages: [] });
    assert.equal((await sub('9876543211', { sessionId: 'sess-1' })).status, 201);
    const c = await WhatsAppContact.findOne({ phone: '+919876543211' }).lean();
    assert.equal(String(c.lead), String(lead._id));
    assert.equal(c.source, 'concierge');
    // The lead had no way to reach them; it now has the number.
    const updated = await Lead.findById(lead._id).lean();
    assert.equal(updated.phone, '+919876543211');
    assert.ok(updated.score > 0);
    // The lead's page shows the subscription.
    const { token } = await makeUser('admin');
    const l = await http('GET', `/api/admin/leads/${lead._id}`, { token });
    assert.equal(l.body.whatsapp.subscribed, true);
  });

  test('signed-in customers switch updates on and off from their account', async () => {
    const { user, token } = await makeUser('customer');
    assert.equal((await http('PUT', '/api/whatsapp/me', { token, body: { subscribed: true } })).status, 400); // no phone on the profile
    const on = await http('PUT', '/api/whatsapp/me', { token, body: { subscribed: true, phone: '9876543212' } });
    assert.equal(on.status, 200);
    assert.equal(on.body.subscribed, true);
    assert.equal((await http('GET', '/api/whatsapp/me', { token })).body.subscribed, true);
    assert.equal(String((await WhatsAppContact.findOne({ phone: '+919876543212' })).user), String(user._id));
    const off = await http('PUT', '/api/whatsapp/me', { token, body: { subscribed: false } });
    assert.equal(off.body.subscribed, false);
    assert.equal((await http('GET', '/api/whatsapp/me', { token })).body.subscribed, false);
    assert.equal((await http('PUT', '/api/whatsapp/me', { token, body: { subscribed: 'yes' } })).status, 400);
  });

  test('public unsubscribe answers the same for any number', async () => {
    await sub('9876543213');
    const a = await http('POST', '/api/whatsapp/unsubscribe', { body: { phone: '9876543213' } });
    const b = await http('POST', '/api/whatsapp/unsubscribe', { body: { phone: '9000000000' } });
    assert.deepEqual(a.body, b.body);
    const c = await WhatsAppContact.findOne({ phone: '+919876543213' }).lean();
    assert.equal(c.subscribed, false);
    assert.equal(c.unsubscribeReason, 'customer');
  });
});

describe('WhatsApp subscription without a code', () => {
  test('one tap: no code is asked for, the old code route is gone', async () => {
    assert.equal((await sub('9876543300')).status, 201);
    assert.equal((await WhatsAppContact.findOne({ phone: '+919876543300' })).subscribed, true);
    assert.equal((await http('POST', '/api/whatsapp/subscribe/code', { body: { phone: '9876543301' } })).status, 404);
  });

  test('a STOP sent on WhatsApp cannot be undone from the website', async () => {
    await sub('9876543310');
    await waHook({ messages: [{ from: '919876543310', id: 'wamid.stop1', timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: 'STOP' } }] });
    assert.equal((await WhatsAppContact.findOne({ phone: '+919876543310' })).subscribed, false);
    const again = await sub('9876543310');
    assert.equal(again.status, 409);
    assert.equal(again.body.code, 'WHATSAPP_STOPPED');
    const { token } = await makeUser('customer');
    assert.equal((await http('PUT', '/api/whatsapp/me', { token, body: { subscribed: true, phone: '9876543310' } })).status, 409);
    assert.equal((await WhatsAppContact.findOne({ phone: '+919876543310' })).subscribed, false);
    // START on WhatsApp turns it back on.
    await waHook({ messages: [{ from: '919876543310', id: 'wamid.start1', timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: 'START' } }] });
    assert.equal((await WhatsAppContact.findOne({ phone: '+919876543310' })).subscribed, true);
  });

  test('stopping from the website can be undone from the website; removed by the team cannot', async () => {
    await sub('9876543320');
    await http('POST', '/api/whatsapp/unsubscribe', { body: { phone: '9876543320' } });
    assert.equal((await sub('9876543320')).status, 201);
    await WhatsAppContact.updateOne({ phone: '+919876543320' }, { subscribed: false, unsubscribeReason: 'admin' });
    assert.equal((await sub('9876543320')).status, 409);
  });

  test('the owner of a number verified on their account can always switch it back on', async () => {
    const { user, token } = await makeUser('customer');
    user.phone = '9876543330';
    await user.save();
    user.phoneVerified = true;
    await user.save();
    await WhatsAppContact.create({ phone: '+919876543330', subscribed: false, unsubscribeReason: 'reply' });
    assert.equal((await http('GET', '/api/whatsapp/me', { token })).body.verified, true);
    const on = await http('PUT', '/api/whatsapp/me', { token, body: { subscribed: true } });
    assert.equal(on.status, 200);
    assert.equal(on.body.subscribed, true);
  });

  test('sign-in by code still works after sharing the code helpers', async () => {
    const { user } = await makeUser('customer');
    user.phone = '9876543340';
    await user.save();
    await ageCodes();
    const sent = await http('POST', '/api/auth/send-otp', { body: { phone: '9876543340', purpose: 'login' } });
    assert.equal(sent.status, 200);
    const wrong = String((Number(sent.body.devCode) + 1) % 1e6).padStart(6, '0');
    assert.equal((await http('POST', '/api/auth/verify-otp', { body: { phone: '9876543340', purpose: 'login', otp: wrong } })).body.code, 'OTP_INVALID');
    const ok = await http('POST', '/api/auth/verify-otp', { body: { phone: '9876543340', purpose: 'login', otp: sent.body.devCode } });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token);
  });
});

describe('WhatsApp notifications', () => {
  test('notify all: only subscribers get it, with their name; delivery is tracked', async () => {
    const { token } = await makeUser('admin');
    await sub('9876543220', { name: 'Aisha Khan' });
    await sub('9876543221', { name: 'Omar' });
    await sub('9876543222', { name: 'Gone' });
    await http('POST', '/api/whatsapp/unsubscribe', { body: { phone: '9876543222' } });

    const r = await notify(token, { audience: 'all', message: 'Our new attar, ZAFREON NOIR, is here.\n\nVisit albarakah.me' });
    assert.equal(r.status, 201);
    assert.equal(r.body.recipients, 2);
    await settle();
    assert.equal(wa.sent.length, 2);
    assert.deepEqual(wa.sent.map((m) => m.to).sort(), ['919876543220', '919876543221']);
    const first = wa.sent.find((m) => m.to === '919876543220').body.template;
    assert.equal(first.name, 'house_update');
    assert.deepEqual(first.components[0].parameters.map((p) => p.text), ['Aisha', 'Our new attar, ZAFREON NOIR, is here. Visit albarakah.me']); // one line, as WhatsApp requires

    // Meta reports delivered, then read (and a late "delivered" never steps back).
    const msg = await WhatsAppMessage.findOne({ phone: '+919876543220' }).lean();
    assert.equal(msg.status, 'sent');
    const ts = Math.floor(Date.now() / 1000);
    assert.equal((await waHook({ statuses: [{ id: msg.waId, status: 'delivered', timestamp: String(ts), recipient_id: '919876543220' }] })).status, 200);
    await waHook({ statuses: [{ id: msg.waId, status: 'read', timestamp: String(ts + 5) }] });
    await waHook({ statuses: [{ id: msg.waId, status: 'delivered', timestamp: String(ts + 9) }] });
    const after = await WhatsAppMessage.findById(msg._id).lean();
    assert.equal(after.status, 'read');
    assert.ok(after.deliveredAt && after.readAt);

    const detail = await http('GET', `/api/admin/whatsapp/campaigns/${r.body.id}`, { token });
    assert.equal(detail.body.counts.read, 1);
    assert.equal(detail.body.counts.sent, 1);
    assert.ok(detail.body.finishedAt);
    assert.equal(detail.body.messages.items.length, 2);
    const hist = await http('GET', '/api/admin/whatsapp/campaigns', { token });
    assert.equal(hist.body.items[0].counts.read, 1);
  });

  test('notify selected: unsubscribed picks are left out; nothing to send is refused', async () => {
    const { token } = await makeUser('manager');
    await sub('9876543230');
    await sub('9876543231');
    await sub('9876543232');
    await http('POST', '/api/whatsapp/unsubscribe', { body: { phone: '9876543232' } });
    const [a, , gone] = await Promise.all(['+919876543230', '+919876543231', '+919876543232'].map((phone) => WhatsAppContact.findOne({ phone }).lean()));
    const r = await notify(token, { audience: 'selected', contactIds: [String(a._id), String(gone._id), String(a._id)], message: 'Your saved fragrance is back in stock.' });
    assert.equal(r.status, 201);
    assert.equal(r.body.recipients, 1);
    await settle();
    assert.deepEqual(wa.sent.map((m) => m.to), ['919876543230']);
    assert.equal((await notify(token, { audience: 'selected', contactIds: [String(gone._id)], message: 'x' })).status, 400);
    assert.equal((await notify(token, { audience: 'selected', contactIds: [], message: 'x' })).status, 400);
    assert.equal((await notify(token, { audience: 'everyone', message: 'x' })).status, 400);
    assert.equal((await notify(token, { audience: 'all', message: '   ' })).status, 400);
    assert.equal((await notify(token, { audience: 'all', message: 'x'.repeat(601) })).status, 400);
  });

  test('a double click does not send twice; support staff cannot send', async () => {
    const { token } = await makeUser('admin');
    await sub('9876543240');
    assert.equal((await notify(token, { audience: 'all', message: 'Eid gift boxes are ready.' })).status, 201);
    assert.equal((await notify(token, { audience: 'all', message: 'Eid gift boxes are ready.' })).status, 409);
    await settle();
    assert.equal(wa.sent.length, 1);
    const { token: support } = await makeUser('support');
    assert.equal((await notify(support, { audience: 'all', message: 'Hello' })).status, 403);
    assert.equal((await http('GET', '/api/admin/whatsapp/campaigns', { token: support })).status, 200);
    const { token: shopper } = await makeUser('customer');
    assert.equal((await http('GET', '/api/admin/whatsapp/contacts', { token: shopper })).status, 403);
  });

  test('passing failures retry with a back-off; lasting ones fail with the reason; the team can retry', async () => {
    const { token } = await makeUser('admin');
    await sub('9876543250', { name: 'Rate' });
    await sub('9876543251', { name: 'Nowa' });
    // First send hits a rate limit (retry later), second is undeliverable (final).
    wa.fail.push({ status: 429, code: 130429 }, { status: 400, code: 131026, message: 'Message undeliverable' });
    const r = await notify(token, { audience: 'all', message: 'New arrivals this week.' });
    await settle();
    const rows = await WhatsAppMessage.find({ campaign: r.body.id }).lean();
    const waiting = rows.find((m) => m.status === 'queued');
    const failed = rows.find((m) => m.status === 'failed');
    assert.ok(waiting && failed, JSON.stringify(rows.map((m) => [m.status, m.errorCode])));
    assert.equal(waiting.attempts, 1);
    assert.ok(waiting.nextAttemptAt > new Date());
    assert.match(waiting.error, /rate limit/i);
    assert.match(failed.error, /could not deliver/i);
    assert.equal(wa.sent.length, 0);

    // The retry comes due: it goes out.
    await WhatsAppMessage.updateOne({ _id: waiting._id }, { nextAttemptAt: new Date(Date.now() - 1000) });
    await whatsapp.pumpWhatsApp();
    assert.equal((await WhatsAppMessage.findById(waiting._id)).status, 'sent');

    // The team retries the failed one.
    const again = await http('POST', `/api/admin/whatsapp/messages/${failed._id}/retry`, { token });
    assert.equal(again.status, 200);
    await settle();
    assert.equal((await WhatsAppMessage.findById(failed._id)).status, 'sent');
    assert.equal(wa.sent.length, 2);
    assert.equal((await http('POST', `/api/admin/whatsapp/messages/${failed._id}/retry`, { token })).status, 409);
  });

  test('WhatsApp down: retries stop after the limit and the reason is kept', async () => {
    const { token } = await makeUser('admin');
    await sub('9876543260');
    wa.down = true;
    const r = await notify(token, { audience: 'all', message: 'Hello from the house.' });
    for (let i = 0; i < whatsapp.MAX_ATTEMPTS; i++) {
      await settle();
      await WhatsAppMessage.updateMany({ status: 'queued' }, { nextAttemptAt: new Date(Date.now() - 1000) });
      await whatsapp.pumpWhatsApp();
    }
    const m = await WhatsAppMessage.findOne({ campaign: r.body.id }).lean();
    assert.equal(m.status, 'failed');
    assert.equal(m.attempts, whatsapp.MAX_ATTEMPTS);
    assert.match(m.error, /could not reach whatsapp/i);
  });

  test('someone who unsubscribes after the notification was queued is skipped', async () => {
    const { token } = await makeUser('admin');
    await sub('9876543270');
    wa.down = true; // keep it in the queue
    const r = await notify(token, { audience: 'all', message: 'Hello again.' });
    await settle();
    wa.down = false;
    await http('POST', '/api/whatsapp/unsubscribe', { body: { phone: '9876543270' } });
    await WhatsAppMessage.updateMany({ status: 'queued' }, { nextAttemptAt: new Date(Date.now() - 1000) });
    await whatsapp.pumpWhatsApp();
    const m = await WhatsAppMessage.findOne({ campaign: r.body.id }).lean();
    assert.equal(m.status, 'skipped');
    assert.equal(wa.sent.length, 0);
  });

  test('replying STOP unsubscribes; START switches back on; "turned off marketing" unsubscribes too', async () => {
    await sub('9876543280');
    await waHook({ messages: [{ from: '919876543280', id: 'wamid.in1', type: 'text', text: { body: ' Stop ' } }] });
    assert.equal((await WhatsAppContact.findOne({ phone: '+919876543280' })).subscribed, false);
    await waHook({ messages: [{ from: '919876543280', id: 'wamid.in2', type: 'text', text: { body: 'START' } }] });
    assert.equal((await WhatsAppContact.findOne({ phone: '+919876543280' })).subscribed, true);
    // A stranger writing START is not subscribed.
    await waHook({ messages: [{ from: '919000000001', id: 'wamid.in3', type: 'text', text: { body: 'start' } }] });
    assert.equal(await WhatsAppContact.countDocuments({ phone: '+919000000001' }), 0);

    const { token } = await makeUser('admin');
    const r = await notify(token, { audience: 'all', message: 'A note from the house.' });
    await settle();
    const m = await WhatsAppMessage.findOne({ campaign: r.body.id }).lean();
    await waHook({ statuses: [{ id: m.waId, status: 'failed', timestamp: String(Math.floor(Date.now() / 1000)), errors: [{ code: 131050, title: 'Unable to deliver the message. This recipient has chosen to stop receiving marketing messages on WhatsApp from your business.' }] }] });
    assert.equal((await WhatsAppMessage.findById(m._id)).status, 'failed');
    const c = await WhatsAppContact.findOne({ phone: '+919876543280' }).lean();
    assert.equal(c.subscribed, false);
    assert.equal(c.unsubscribeReason, 'blocked');
  });

  test('webhook: bad signatures are refused; verification echoes the challenge only with the right token', async () => {
    assert.equal((await waHook({ statuses: [] }, { secret: 'wrong' })).status, 401);
    assert.equal((await http('POST', '/api/whatsapp/webhook', { body: { entry: [] } })).status, 401);
    const ok = await http('GET', `/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN}&hub.challenge=12345`);
    assert.equal(ok.status, 200);
    assert.equal(String(ok.body), '12345');
    assert.equal((await http('GET', '/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1')).status, 403);
    // Junk payloads are ignored, not crashes.
    assert.equal((await waHook({ statuses: [{ id: { $ne: null }, status: 'read' }, null, 'x'] })).status, 200);
  });

  test('admin subscriber list: search, AI leads only, unsubscribe (never re-subscribe)', async () => {
    const { token } = await makeUser('admin');
    const lead = await Lead.create({ name: 'Lead Person', phone: '+919876543291', intent: 'considering', score: 47 });
    await sub('9876543290', { name: 'Plain Person' });
    await sub('9876543291', { name: 'Lead Person' });
    const all = await http('GET', '/api/admin/whatsapp/contacts', { token });
    assert.equal(all.body.total, 2);
    const leads = await http('GET', '/api/admin/whatsapp/contacts?leads=1', { token });
    assert.equal(leads.body.total, 1);
    assert.equal(leads.body.items[0].lead.id, String(lead._id));
    assert.equal(leads.body.items[0].lead.score, 47);
    assert.equal((await http('GET', '/api/admin/whatsapp/contacts?q=plain', { token })).body.total, 1);
    assert.equal((await http('GET', '/api/admin/whatsapp/contacts?q=3290', { token })).body.total, 1);
    const id = all.body.items.find((c) => c.name === 'Plain Person').id;
    assert.equal((await http('PATCH', `/api/admin/whatsapp/contacts/${id}`, { token, body: { subscribed: true } })).status, 400);
    const off = await http('PATCH', `/api/admin/whatsapp/contacts/${id}`, { token, body: { subscribed: false } });
    assert.equal(off.body.subscribed, false);
    assert.equal(off.body.unsubscribeReason, 'admin');
    const status = await http('GET', '/api/admin/whatsapp/status', { token });
    assert.equal(status.body.configured, true);
    assert.equal(status.body.subscribed, 1);
    assert.equal(status.body.leads, 1);
  });

  test('not configured: sending is refused clearly', async () => {
    const { token } = await makeUser('admin');
    await sub('9876543299');
    const saved = process.env.WHATSAPP_NOTIFY_TEMPLATE;
    process.env.WHATSAPP_NOTIFY_TEMPLATE = '';
    try {
      const r = await notify(token, { audience: 'all', message: 'Hello' });
      assert.equal(r.status, 503);
      assert.equal(r.body.code, 'WHATSAPP_NOT_CONFIGURED');
      assert.equal(await WhatsAppCampaign.countDocuments(), 0);
    } finally {
      process.env.WHATSAPP_NOTIFY_TEMPLATE = saved;
    }
  });
});

describe('coupons', () => {
  const create = (token, body) => http('POST', '/api/admin/coupons', { token, body: { type: 'percent', percent: 10, active: true, showOnSite: true, ...body } });
  const check = (code, items, extra = {}) => http('POST', '/api/coupons/check', { body: { code, region: 'IN', items, ...extra } });
  const place = (items, extra = {}) => http('POST', '/api/orders', { body: { region: 'IN', paymentMethod: 'cod', items, customer: customer(extra.email), ...extra } });

  test('only listed, usable coupons are shown, in the shopper\'s currency, without usage numbers', async () => {
    const { token } = await makeUser('admin');
    const day = 24 * 3600 * 1000;
    await create(token, { code: 'SHOWN10', description: '10% off your order', maxDiscount: { INR: 500 }, minSubtotal: { INR: 1500 }, usageLimit: 100, expiresAt: new Date(Date.now() + 7 * day) });
    await create(token, { code: 'HIDDEN', showOnSite: false });
    await create(token, { code: 'OFF', active: false });
    await create(token, { code: 'OLD', expiresAt: new Date(Date.now() - day), startsAt: new Date(Date.now() - 2 * day) });
    await create(token, { code: 'SOON', startsAt: new Date(Date.now() + day) });
    await create(token, { code: 'AEDONLY', type: 'fixed', amount: { AED: 20 } });
    const r = await http('GET', '/api/coupons?region=IN');
    assert.deepEqual(r.body.items.map((c) => c.code), ['SHOWN10']);
    const c = r.body.items[0];
    assert.equal(c.percent, 10);
    assert.equal(c.maxDiscount, 500);
    assert.equal(c.minSubtotal, 1500);
    assert.equal(c.currency, 'INR');
    assert.equal(c.usedCount, undefined);
    assert.equal(c.usageLimit, undefined);
    const ae = await http('GET', '/api/coupons?region=AE');
    assert.deepEqual(ae.body.items.map((x) => x.code).sort(), ['AEDONLY', 'SHOWN10']);
  });

  test('apply from the bag: savings from catalogue prices; invalid, early, expired, minimum and over-limit codes are refused', async () => {
    const { token } = await makeUser('admin');
    const p = await makeProduct({ inr: 2000 });
    const items = [{ slug: p.slug, qty: 2 }];
    await create(token, { code: 'CAP', percent: 20, maxDiscount: { INR: 500 } });
    await create(token, { code: 'BIGMIN', minSubtotal: { INR: 10000 } });
    await create(token, { code: 'SOON', startsAt: new Date(Date.now() + 3600e3) });
    await create(token, { code: 'DONE', usageLimit: 1 });
    await Coupon.updateOne({ code: 'DONE' }, { usedCount: 1 });
    await create(token, { code: 'PAST', startsAt: new Date(Date.now() - 7200e3), expiresAt: new Date(Date.now() - 3600e3) });

    const ok = await check(' cap ', items);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.subtotal, 4000);
    assert.equal(ok.body.discount, 500); // 20% = 800, capped at 500
    assert.equal(ok.body.total, 4000 - 500 + ok.body.shipping);
    assert.equal((await check('NOPE', items)).body.code, 'COUPON_INVALID');
    assert.equal((await check('BIGMIN', items)).body.code, 'COUPON_MIN_NOT_MET');
    assert.equal((await check('SOON', items)).status, 400);
    assert.equal((await check('DONE', items)).body.code, 'COUPON_EXPIRED');
    assert.equal((await check('PAST', items)).body.code, 'COUPON_EXPIRED');
    assert.equal((await check('CAP', [])).body.code, 'CART_EMPTY');
    assert.notEqual((await check({ $ne: null }, items)).status, 500);
  });

  test('checkout: the order gets the discount, usage is counted, the same customer cannot use it twice (account or guest email)', async () => {
    const { token } = await makeUser('admin');
    const p = await makeProduct({ inr: 3000, stock: 20 });
    const items = [{ slug: p.slug, qty: 1 }];
    await create(token, { code: 'ONCE15', percent: 15, perUserLimit: 1, usageLimit: 10 });

    const first = await place(items, { couponCode: 'once15', email: 'repeat@example.test' });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const o = await Order.findOne({ orderNumber: first.body.orderNumber }).lean();
    assert.equal(o.discount, 450);
    assert.equal(o.coupon.code, 'ONCE15');
    assert.equal((await Coupon.findOne({ code: 'ONCE15' })).usedCount, 1);

    // Same email again: refused at the bag and at checkout.
    assert.equal((await check('ONCE15', items, { email: 'Repeat@Example.test' })).body.code, 'COUPON_ALREADY_USED');
    const second = await place(items, { couponCode: 'ONCE15', email: 'repeat@example.test' });
    assert.equal(second.status, 400);
    assert.equal(second.body.code, 'COUPON_ALREADY_USED');
    assert.equal((await Coupon.findOne({ code: 'ONCE15' })).usedCount, 1);

    // Admin sees the use and the sales it brought.
    const list = await http('GET', '/api/admin/coupons', { token });
    const row = list.body.items.find((c) => c.code === 'ONCE15');
    assert.equal(row.usage.orders, 1);
    assert.equal(row.usage.discount.INR, 450);
    assert.equal(row.state, 'active');
    const orders = await http('GET', `/api/admin/coupons/${row.id}/orders`, { token });
    assert.equal(orders.body.items[0].orderNumber, first.body.orderNumber);
  });

  test('the usage limit holds when shoppers race for the last use', async () => {
    const { token } = await makeUser('admin');
    const p = await makeProduct({ inr: 1000, stock: 50 });
    await create(token, { code: 'LAST1', usageLimit: 1, perUserLimit: 1 });
    const tries = await Promise.all([1, 2, 3, 4].map((i) => place([{ slug: p.slug, qty: 1 }], { couponCode: 'LAST1', email: `racer${i}@example.test` })));
    assert.equal(tries.filter((t) => t.status === 201).length, 1);
    assert.equal((await Coupon.findOne({ code: 'LAST1' })).usedCount, 1);
    assert.equal((await Product.findById(p._id)).stock, 49); // refused orders gave their stock back
  });

  test('admin: edit, deactivate, expire, filter by state, delete; bad input refused', async () => {
    const { token } = await makeUser('manager');
    const c = (await create(token, { code: 'EDITME', percent: 5 })).body;
    assert.equal((await create(token, { code: 'EDITME' })).status, 409);
    assert.equal((await create(token, { code: 'x' })).status, 400);
    assert.equal((await create(token, { code: 'PCT0', percent: 0 })).status, 400);
    assert.equal((await create(token, { code: 'FIX0', type: 'fixed' })).status, 400);
    assert.equal((await create(token, { code: 'DATES', startsAt: '2026-12-10', expiresAt: '2026-12-01' })).status, 400);

    const edited = await http('PUT', `/api/admin/coupons/${c.id}`, { token, body: { percent: 12, description: 'Twelve off' } });
    assert.equal(edited.body.percent, 12);
    const off = await http('PUT', `/api/admin/coupons/${c.id}`, { token, body: { active: false } });
    assert.equal(off.body.state, 'inactive');
    assert.equal((await http('GET', '/api/admin/coupons?state=inactive', { token })).body.total, 1);
    await http('PUT', `/api/admin/coupons/${c.id}`, { token, body: { active: true } });
    const exp = await http('POST', `/api/admin/coupons/${c.id}/expire`, { token });
    assert.equal(exp.body.state, 'expired');
    assert.equal((await http('GET', '/api/admin/coupons?state=expired', { token })).body.items[0].code, 'EDITME');
    assert.equal((await http('GET', '/api/admin/coupons?state=active', { token })).body.total, 0);
    assert.deepEqual((await http('GET', '/api/coupons?region=IN')).body.items, []);
    assert.equal((await http('DELETE', `/api/admin/coupons/${c.id}`, { token })).status, 200);
    assert.equal(await Coupon.countDocuments(), 0);
    const { token: support } = await makeUser('support');
    assert.equal((await http('GET', '/api/admin/coupons', { token: support })).status, 403);
  });
});

