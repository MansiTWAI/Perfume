// Mobile numbers: required at website sign-up and on the contact form, one
// account per number in any format (+91 is the default), older stored forms
// still matched, optional for the app API.
import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { http, reset, close, makeUser, User } from './helpers.js';

after(close);
beforeEach(reset);

const register = (body, path = '/api/auth/register') => http('POST', path, { body: { name: 'Test Person', password: 'long-enough-1', ...body } });

describe('sign-up', () => {
  test('the website requires a valid mobile number', async () => {
    const none = await register({ email: 'a@example.test' });
    assert.equal(none.status, 400);
    assert.match(none.body.message, /mobile number/);
    assert.equal((await register({ email: 'a@example.test', phone: '12345' })).status, 400);
    assert.equal((await register({ email: 'a@example.test', phone: '5876543210' })).status, 400); // Indian numbers start 6–9
    const ok = await register({ email: 'a@example.test', phone: '98765 43210' });
    assert.equal(ok.status, 201);
    const u = await User.findOne({ email: 'a@example.test' }).lean();
    assert.equal(u.phone, '+91 98765 43210'); // stored in one readable form
    assert.equal(u.phoneNormalized, '+919876543210'); // +91 by default
  });
  test('one account per number, whatever the format', async () => {
    assert.equal((await register({ email: 'a@example.test', phone: '+91 98765 43210' })).status, 201);
    for (const [i, phone] of ['9876543210', '09876543210', '919876543210', '0091-98765-43210'].entries()) {
      const r = await register({ email: `b${i}@example.test`, phone });
      assert.equal(r.status, 409, phone);
      assert.match(r.body.message, /phone number already exists/);
    }
  });
  test('numbers stored the old way (digits only) still count as taken', async () => {
    await User.collection.insertOne({ name: 'Old', email: 'old@example.test', phone: '9876543210', phoneNormalized: '9876543210', role: 'customer', passwordHash: 'x' });
    assert.equal((await register({ email: 'new@example.test', phone: '+91 98765 43210' })).status, 409);
  });
  test('the app API keeps the number optional', async () => {
    const r = await register({ email: 'app@example.test' }, '/api/v1/auth/register');
    assert.equal(r.status, 201);
  });
  test('sign in with the number in another format', async () => {
    await register({ email: 'p@example.test', phone: '+91 98765 43210' });
    await User.updateOne({ email: 'p@example.test' }, { $set: { emailVerified: true } });
    const r = await http('POST', '/api/auth/login', { body: { identifier: '09876543210', password: 'long-enough-1' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.user.email, 'p@example.test');
  });
  test('profile: another account cannot take the same number', async () => {
    await register({ email: 'first@example.test', phone: '+91 98765 43210' });
    const second = await makeUser('customer', 'second@example.test');
    const r = await http('PATCH', '/api/auth/me', { token: second.token, body: { phone: '9876543210' } });
    assert.equal(r.status, 409);
  });
});

describe('contact form', () => {
  const send = (body, path = '/api/enquiries') => http('POST', path, { body: { name: 'Riya', email: 'riya@example.test', message: 'Hello', ...body } });
  test('the website asks for a valid mobile number; the app may skip it', async () => {
    assert.equal((await send({})).status, 400);
    assert.equal((await send({ phone: '123' })).status, 400);
    assert.equal((await send({ phone: '+91 98765 43210' })).status, 201);
    assert.equal((await send({}, '/api/v1/enquiries')).status, 201);
  });
});

describe('one phone format', () => {
  test('accounts and orders store valid numbers as "+91 98765 43210"; older accounts are tidied', async () => {
    const { tidyPhones, formatPhone } = await import('../src/models/User.js');
    assert.equal(formatPhone('09876543210'), '+91 98765 43210');
    assert.equal(formatPhone('0091-98765-43210'), '+91 98765 43210');
    assert.equal(formatPhone('+971501234567'), '+971 50 123 4567');
    assert.equal(formatPhone('12345'), '12345');
    await User.collection.insertMany([
      { name: 'Old A', email: 'olda@example.test', phone: '9876543210', phoneNormalized: '+919876543210', role: 'customer', passwordHash: 'x' },
      { name: 'Old B', email: 'oldb@example.test', phone: '+91-98765-43211', phoneNormalized: '+919876543211', role: 'customer', passwordHash: 'x' },
      { name: 'Odd', email: 'odd@example.test', phone: 'call me', role: 'customer', passwordHash: 'x' },
    ]);
    assert.equal(await tidyPhones(User), 2);
    assert.equal(await tidyPhones(User), 0);
    const all = await User.find({}).select('email phone phoneNormalized').lean();
    const by = Object.fromEntries(all.map((u) => [u.email, u]));
    assert.equal(by['olda@example.test'].phone, '+91 98765 43210');
    assert.equal(by['olda@example.test'].phoneNormalized, '+919876543210');
    assert.equal(by['oldb@example.test'].phone, '+91 98765 43211');
    assert.equal(by['odd@example.test'].phone, 'call me');
  });
});

describe('admin', () => {
  test("users list shows the account's own number", async () => {
    await register({ email: 'shown@example.test', phone: '+91 98765 43210' });
    const { token } = await makeUser('admin');
    const r = await http('GET', '/api/admin/customers?q=shown', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.items[0].phone, '+91 98765 43210');
  });
});
