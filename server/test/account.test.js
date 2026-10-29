// Account and back-office features without tests of their own: the Journal
// newsletter, changing a password from the account page, and the users
// spreadsheet export.
import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { http, reset, close, makeUser, User } from './helpers.js';

after(close);
beforeEach(reset);

describe('newsletter', () => {
  test('a valid email subscribes once; a bad one is refused; only admins see the list', async () => {
    assert.equal((await http('POST', '/api/subscribers', { body: { email: 'not-an-email' } })).status, 400);
    assert.equal((await http('POST', '/api/subscribers', { body: { email: 'Reader@Example.test', source: 'footer' } })).status, 201);
    assert.equal((await http('POST', '/api/subscribers', { body: { email: 'reader@example.test', source: 'footer' } })).status, 201);
    const { token: shopper } = await makeUser('customer');
    assert.equal((await http('GET', '/api/subscribers', { token: shopper })).status, 403);
    assert.equal((await http('GET', '/api/subscribers')).status, 401);
    const { token: admin } = await makeUser('admin');
    const list = await http('GET', '/api/subscribers', { token: admin });
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 1);
  });
});

describe('change password', () => {
  test('needs the current password; signs out other sessions; the new password works', async () => {
    const { user, token } = await makeUser('customer');
    await User.updateOne({ _id: user._id }, { passwordHash: await User.hashPassword('old-pass-123') });
    const wrong = await http('POST', '/api/me/change-password', { token, body: { current: 'nope-nope-1', next: 'new-pass-456' } });
    assert.equal(wrong.status, 401);
    const short = await http('POST', '/api/me/change-password', { token, body: { current: 'old-pass-123', next: 'short' } });
    assert.equal(short.status, 400);
    const ok = await http('POST', '/api/me/change-password', { token, body: { current: 'old-pass-123', next: 'new-pass-456' } });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token, 'this device gets a fresh session');
    assert.equal((await http('GET', '/api/me', { token })).status, 401, 'the old session is signed out');
    assert.equal((await http('GET', '/api/me', { token: ok.body.token })).status, 200);
    const login = await http('POST', '/api/auth/login', { body: { email: user.email, password: 'new-pass-456' } });
    assert.equal(login.status, 200);
    assert.equal((await http('POST', '/api/auth/login', { body: { email: user.email, password: 'old-pass-123' } })).status, 401);
  });
});

describe('users export', () => {
  test('admins download a spreadsheet; customers and signed-out visitors are refused', async () => {
    const { token: shopper } = await makeUser('customer');
    assert.equal((await http('GET', '/api/users/export/xlsx', { token: shopper })).status, 403);
    assert.equal((await http('GET', '/api/users/export/xlsx')).status, 401);
    const { token: admin } = await makeUser('admin');
    const r = await http('GET', '/api/users/export/xlsx', { token: admin });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /spreadsheetml|octet-stream/);
  });
});
