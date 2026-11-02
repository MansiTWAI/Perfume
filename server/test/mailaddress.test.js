// Email addresses that cannot receive mail ("name@gmail..com") are refused
// where they are typed, and an old one already saved on an order is skipped
// at sending without the email service being marked as broken.
import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { http, reset, close, makeProduct, customer, outbox } from './helpers.js';
import { isEmail } from '../src/utils.js';
import { sendMail } from '../src/services/mail.js';
import IntegrationEvent from '../src/models/IntegrationEvent.js';

after(close);
beforeEach(async () => {
  await reset();
  outbox.length = 0;
  await IntegrationEvent.deleteMany({});
});
const settle = () => new Promise((r) => setTimeout(r, 50));

describe('email addresses', () => {
  test('the check accepts real addresses and refuses typos', () => {
    for (const ok of ['a@b.co', 'me+tag@sub.example.in', 'admin@albarakah.me', 'First.Last@Gmail.com']) assert.ok(isEmail(ok), ok);
    for (const bad of ['name@gmail..com', 'name@gmail', 'x.@y.com', '.x@y.com', 'a b@c.com', 'user@gmail.com.', 'a@b', '', 'a@@b.com']) assert.ok(!isEmail(bad), bad);
  });

  test('checkout and sign-up refuse an address like name@gmail..com', async () => {
    const p = await makeProduct({ inr: 1250 });
    const order = await http('POST', '/api/orders', { body: { region: 'IN', paymentMethod: 'cod', items: [{ slug: p.slug, qty: 1 }], customer: customer('buyer@gmail..com') } });
    assert.equal(order.status, 400);
    assert.match(order.body.message, /valid email/i);
    const reg = await http('POST', '/api/auth/register', { body: { name: 'Typo', email: 'typo@gmail..com', password: 'long-enough-1', phone: '9876543210' } });
    assert.equal(reg.status, 400);
  });

  test('an invalid saved address is skipped, the valid ones still get the email', async () => {
    await sendMail({ to: 'team@example.test, old@gmail..com', subject: 'Hello', text: 'Hi' });
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].to, 'team@example.test');
    await settle();
    const notice = await IntegrationEvent.findOne({ integration: 'email', kind: 'notice' }).lean();
    assert.match(notice.message, /Not sent to ol…@gmail\.\.com/);
  });

  test('only invalid addresses: nothing is sent, and email is not marked as broken', async () => {
    await assert.rejects(sendMail({ to: 'old@gmail..com', subject: 'Hello', text: 'Hi' }), { code: 'EMAIL_INVALID' });
    assert.equal(outbox.length, 0);
    await settle();
    assert.equal(await IntegrationEvent.countDocuments({ integration: 'email', kind: 'activity', ok: false }), 0);
    assert.equal(await IntegrationEvent.countDocuments({ integration: 'email', kind: 'notice' }), 1);
  });
});
