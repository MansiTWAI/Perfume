// Staff two-step sign-in: password, then a code sent by email. Codes expire,
// allow five tries, work once and only with the challenge from the password
// step; resending waits 30 seconds; staff sessions without the code are
// refused on every staff endpoint.
import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { http, reset, close, User, outbox, wa } from './helpers.js';

after(close);
beforeEach(reset);

const Otp = () => mongoose.model('Otp');
const PASSWORD = 'staff-pass-123';
async function staff(role = 'admin', email = `${role}-${Date.now()}@example.test`) {
  return User.create({ name: `Test ${role}`, email, role, passwordHash: await User.hashPassword(PASSWORD) });
}
const login = (email, password = PASSWORD) => http('POST', '/api/auth/login', { body: { email, password } });
const lastCode = (to) => outbox.filter((m) => m.to === to).at(-1)?.subject.match(/\d{6}/)?.[0];
const verify = (challengeToken, code) => http('POST', '/api/auth/2fa/verify', { body: { challengeToken, code } });
const other = (code) => String((Number(code) + 1) % 1e6).padStart(6, '0');
// Moves the latest code's clock back, as if time had passed.
const age = (ms) => Otp().updateMany({ purpose: 'staff_2fa' }, [{ $set: { lastSentAt: { $subtract: ['$lastSentAt', ms] }, createdAt: { $subtract: ['$createdAt', ms] } } }]);

describe('staff two-step sign-in', () => {
  test('the password alone gives no session; the emailed code does', async () => {
    const u = await staff('admin');
    const before = wa.sent.length;
    const r = await login(u.email);
    assert.equal(r.status, 200);
    assert.equal(r.body.twoFactorRequired, true);
    assert.equal(r.body.token, undefined);
    assert.equal(r.body.refreshToken, undefined);
    assert.equal(r.body.devCode, undefined, 'never in the response when email works');
    assert.match(r.body.sentTo, /^a\*+@example\.test$/);
    assert.equal(wa.sent.length, before, 'no WhatsApp');
    const code = lastCode(u.email);
    assert.ok(code, 'code emailed');
    const ok = await verify(r.body.challengeToken, code);
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token && ok.body.refreshToken);
    assert.equal((await http('GET', '/api/admin/products', { token: ok.body.token })).status, 200);
    // Works once.
    assert.equal((await verify(r.body.challengeToken, code)).status, 401);
  });

  test('managers and support staff need the code too; customers do not', async () => {
    for (const role of ['manager', 'support']) {
      const u = await staff(role);
      assert.equal((await login(u.email)).body.twoFactorRequired, true, role);
    }
    const c = await staff('customer');
    const r = await login(c.email);
    assert.ok(r.body.token);
    assert.equal(r.body.twoFactorRequired, undefined);
  });

  test('wrong codes: five tries, then the challenge ends', async () => {
    const u = await staff('admin');
    const r = await login(u.email);
    const code = lastCode(u.email);
    for (let i = 0; i < 5; i++) assert.equal((await verify(r.body.challengeToken, other(code))).body.code, 'OTP_INVALID');
    const late = await verify(r.body.challengeToken, code);
    assert.equal(late.status, 401);
    assert.equal(late.body.code, 'OTP_EXPIRED');
  });

  test('the code needs its own challenge token, and expires', async () => {
    const u = await staff('admin');
    const r = await login(u.email);
    const code = lastCode(u.email);
    assert.equal((await verify('x'.repeat(43), code)).status, 401);
    assert.equal((await verify(undefined, code)).status, 401);
    await Otp().updateMany({ purpose: 'staff_2fa' }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await verify(r.body.challengeToken, code)).body.code, 'OTP_EXPIRED');
  });

  test('a new password sign-in cancels the older challenge', async () => {
    const u = await staff('admin');
    const first = await login(u.email);
    const firstCode = lastCode(u.email);
    await login(u.email);
    assert.equal((await verify(first.body.challengeToken, firstCode)).status, 401);
  });

  test('resend: 30-second wait, a new code replaces the old one, limited sends', async () => {
    const u = await staff('admin');
    const r = await login(u.email);
    const old = lastCode(u.email);
    const soon = await http('POST', '/api/auth/2fa/resend', { body: { challengeToken: r.body.challengeToken } });
    assert.equal(soon.status, 429);
    assert.equal(soon.body.code, 'OTP_COOLDOWN');
    assert.ok(soon.body.retryAfter > 0 && soon.body.retryAfter <= 30);
    await age(31000);
    const again = await http('POST', '/api/auth/2fa/resend', { body: { challengeToken: r.body.challengeToken } });
    assert.equal(again.status, 200);
    const fresh = lastCode(u.email);
    if (fresh !== old) assert.equal((await verify(r.body.challengeToken, old)).body.code, 'OTP_INVALID');
    for (let i = 0; i < 3; i++) {
      await age(31000);
      assert.equal((await http('POST', '/api/auth/2fa/resend', { body: { challengeToken: r.body.challengeToken } })).status, 200);
    }
    await age(31000);
    assert.equal((await http('POST', '/api/auth/2fa/resend', { body: { challengeToken: r.body.challengeToken } })).body.code, 'OTP_RATE_LIMITED');
    assert.equal((await verify(r.body.challengeToken, lastCode(u.email))).status, 200);
  });

  test('wrong password: no code is sent', async () => {
    const u = await staff('admin');
    assert.equal((await login(u.email, 'not-the-password')).status, 401);
    assert.equal(lastCode(u.email), undefined);
  });

  test('blocked staff cannot finish signing in', async () => {
    const u = await staff('admin');
    const r = await login(u.email);
    await User.updateOne({ _id: u._id }, { $set: { status: 'blocked' } });
    assert.equal((await verify(r.body.challengeToken, lastCode(u.email))).status, 403);
  });
});

describe('staff sessions without the code', () => {
  test('a staff token without the two-step mark is refused on staff endpoints', async () => {
    const u = await staff('admin');
    const { signToken } = await import('../src/middleware/auth.js');
    const old = signToken(u); // as issued before two-step sign-in
    const r = await http('GET', '/api/admin/products', { token: old });
    assert.equal(r.status, 401);
    assert.equal(r.body.code, 'MFA_REQUIRED');
    assert.equal((await http('GET', '/api/users', { token: old })).status, 401);
    // Hidden products stay hidden without a two-step session.
    const list = await http('GET', '/api/products?all=1', { token: old });
    assert.equal(list.status, 200);
  });

  test('refresh keeps the two-step mark; phone/email codes cannot sign staff in', async () => {
    const u = await staff('admin');
    u.phone = '9876543777';
    await u.save();
    const r = await login(u.email);
    const ok = await verify(r.body.challengeToken, lastCode(u.email));
    const next = await http('POST', '/api/auth/refresh', { body: { refreshToken: ok.body.refreshToken } });
    assert.equal(next.status, 200);
    assert.equal((await http('GET', '/api/admin/products', { token: next.body.token })).status, 200);

    const before = outbox.length;
    const sent = await http('POST', '/api/auth/send-otp', { body: { phone: '9876543777' } });
    assert.equal(sent.status, 200, 'same answer as for anyone');
    assert.equal(outbox.length, before, 'no code for a staff account');
  });

  test('a staff password reset signs in again with the code', async () => {
    const u = await staff('admin');
    await http('POST', '/api/auth/forgot-password', { body: { email: u.email } });
    const token = outbox.find((m) => m.to === u.email).text.match(/token=([A-Za-z0-9_-]+)/)[1];
    const r = await http('POST', '/api/auth/reset-password', { body: { token, password: 'brand-new-pass' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.token, undefined);
    assert.equal(r.body.signInRequired, true);
    assert.equal((await login(u.email, 'brand-new-pass')).body.twoFactorRequired, true);
  });
});
