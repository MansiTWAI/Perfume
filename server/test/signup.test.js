// Email codes are used once: to confirm the email of a new account. After
// that, sign-in is email and password only (customers and staff alike).
import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { http, reset, close, User, outbox, makeUser } from './helpers.js';

after(close);
beforeEach(reset);

const PASSWORD = 'signup-pass-123';
let n = 0;
const signUp = (email, extra = {}) => http('POST', '/api/auth/register', { body: { name: 'New Person', email, phone: `98${String(++n).padStart(8, '0')}`, password: PASSWORD, ...extra } });
const codeFor = (email) => outbox.filter((m) => m.to === email).at(-1)?.subject.match(/\d{6}/)?.[0];
const verify = (email, code) => http('POST', '/api/auth/verify-email', { body: { email, code } });
const login = (email, password = PASSWORD) => http('POST', '/api/auth/login', { body: { email, password } });
const other = (code) => String((Number(code) + 1) % 1e6).padStart(6, '0');

describe('sign-up confirms the email once', () => {
  test('sign-up emails a code and gives no session until it is entered', async () => {
    const r = await signUp('new@example.test');
    assert.equal(r.status, 201);
    assert.equal(r.body.verificationRequired, true);
    assert.equal(r.body.token, undefined);
    assert.equal(r.body.devCode, undefined);
    const mail = outbox.filter((m) => m.to === 'new@example.test').at(-1);
    assert.match(mail.subject, /verification code/);
    assert.equal((await User.findOne({ email: 'new@example.test' })).emailVerified, false);

    assert.equal((await verify('new@example.test', other(codeFor('new@example.test')))).body.code, 'OTP_INVALID');
    const ok = await verify('new@example.test', codeFor('new@example.test'));
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token);
    assert.equal(ok.body.user.emailVerified, true);
    assert.equal((await http('GET', '/api/auth/me', { token: ok.body.token })).status, 200);
  });

  test('after confirming, sign-in is the password only: no code is sent', async () => {
    await signUp('a@example.test');
    await verify('a@example.test', codeFor('a@example.test'));
    const sent = outbox.length;
    const r = await login('a@example.test');
    assert.equal(r.status, 200);
    assert.ok(r.body.token);
    assert.equal(outbox.length, sent, 'no email on sign-in');
    assert.equal((await login('a@example.test', 'wrong-pass-1')).status, 401);
  });

  test('signing in before confirming sends a code and asks for it', async () => {
    await signUp('late@example.test');
    await mongoose.model('Otp').collection.updateMany({}, { $set: { createdAt: new Date(Date.now() - 60000) } }); // past the 30 s wait
    const r = await login('late@example.test');
    assert.equal(r.status, 403);
    assert.equal(r.body.code, 'EMAIL_NOT_VERIFIED');
    assert.equal(r.body.verificationRequired, true);
    assert.equal(r.body.token, undefined);
    const ok = await verify('late@example.test', codeFor('late@example.test'));
    assert.equal(ok.status, 200);
    assert.equal((await login('late@example.test')).status, 200);
  });

  test('a code works once, only for its own email, and expires', async () => {
    await signUp('one@example.test');
    await signUp('two@example.test');
    const c1 = codeFor('one@example.test');
    assert.equal((await verify('two@example.test', c1)).status, 400);
    assert.equal((await verify('one@example.test', c1)).status, 200);
    assert.equal((await verify('one@example.test', c1)).status, 400);
    await mongoose.model('Otp').updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await verify('two@example.test', codeFor('two@example.test'))).body.code, 'OTP_EXPIRED');
  });

  test('five wrong codes end that code', async () => {
    await signUp('guess@example.test');
    const code = codeFor('guess@example.test');
    for (let i = 0; i < 5; i++) await verify('guess@example.test', other(code));
    assert.equal((await verify('guess@example.test', code)).body.code, 'OTP_EXPIRED');
  });

  test('resend: waits 30 seconds, same answer for unknown emails', async () => {
    await signUp('again@example.test');
    const soon = await http('POST', '/api/auth/verify-email/resend', { body: { email: 'again@example.test' } });
    assert.equal(soon.status, 200);
    assert.match(soon.body.message, /on its way/);
    await mongoose.model('Otp').collection.updateMany({}, { $set: { createdAt: new Date(Date.now() - 60000) } });
    const before = outbox.length;
    assert.equal((await http('POST', '/api/auth/verify-email/resend', { body: { email: 'again@example.test' } })).status, 200);
    assert.equal(outbox.length, before + 1);
    const unknown = await http('POST', '/api/auth/verify-email/resend', { body: { email: 'nobody@example.test' } });
    assert.equal(unknown.status, 200);
    assert.equal(outbox.length, before + 1);
  });

  test('an unconfirmed sign-up can be started again; a confirmed email cannot be taken', async () => {
    await signUp('retry@example.test');
    const again = await signUp('retry@example.test', { name: 'Second Try' });
    assert.equal(again.status, 201);
    assert.equal((await User.countDocuments({ email: 'retry@example.test' })), 1);
    await verify('retry@example.test', codeFor('retry@example.test'));
    assert.equal((await User.findOne({ email: 'retry@example.test' })).name, 'Second Try');
    assert.equal((await signUp('retry@example.test')).status, 409);
  });

  test('accounts from before email confirmation sign in as they always did', async () => {
    const { user } = await makeUser('customer', 'old@example.test');
    user.passwordHash = await User.hashPassword(PASSWORD);
    await user.save();
    const r = await login('old@example.test');
    assert.equal(r.status, 200);
    assert.equal(r.body.user.emailVerified, true);
  });

  test('sign-in by code alone is switched off', async () => {
    const r = await http('POST', '/api/auth/send-otp', { body: { email: 'old@example.test' } });
    assert.equal(r.status, 503);
    assert.equal((await http('POST', '/api/auth/verify-otp', { body: { email: 'old@example.test', otp: '123456' } })).status, 503);
  });

  test('a password reset also confirms the email', async () => {
    await signUp('reset@example.test');
    await http('POST', '/api/auth/forgot-password', { body: { email: 'reset@example.test' } });
    const token = outbox.filter((m) => m.to === 'reset@example.test').at(-1).text.match(/token=([A-Za-z0-9_-]+)/)[1];
    const r = await http('POST', '/api/auth/reset-password', { body: { token, password: 'brand-new-pass' } });
    assert.equal(r.status, 200);
    assert.equal((await login('reset@example.test', 'brand-new-pass')).status, 200);
  });
});
