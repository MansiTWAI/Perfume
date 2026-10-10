// Store banners for the mobile app: the team uploads 1080 × 540 images; the
// app reads the live ones from GET /api/banners (a default banner until then).
import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { http, reset, close, makeUser, base } from './helpers.js';
import { imageSize } from '../src/services/imageSize.js';

after(close);
beforeEach(reset);

// A PNG header with the given size (all the server reads to check it).
function png(width, height) {
  const b = Buffer.alloc(64);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}
async function upload(path, token, file, fields = {}, name = 'banner.png', type = 'image/png') {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
  if (file) form.append('file', new Blob([file], { type }), name);
  const res = await fetch(base + path, { method: 'POST', headers: { ...(token && { Authorization: `Bearer ${token}` }), 'X-Forwarded-For': '10.3.3.3' }, body: form });
  return { status: res.status, body: await res.json() };
}

describe('app banners', () => {
  test('until one is uploaded, the app gets the default 1080 × 540 banner', async () => {
    const r = await http('GET', '/api/banners');
    assert.equal(r.status, 200);
    assert.equal(r.body.placement, 'app');
    assert.deepEqual(r.body.size, { width: 1080, height: 540 });
    assert.equal(r.body.items.length, 1);
    assert.equal(r.body.items[0].image, '/media/banners/app-banner-1.jpg');
    assert.match(r.body.items[0].imageUrl, /^https?:\/\/[^/]+\/media\/banners\/app-banner-1\.jpg$/);
    // The file shipped with the website really is 1080 × 540.
    const file = fs.readFileSync(new URL('../../client/public/media/banners/app-banner-1.jpg', import.meta.url));
    assert.deepEqual(imageSize(file), { width: 1080, height: 540 });
  });

  test('a manager uploads a 1080 × 540 banner; it replaces the default', async () => {
    const { token } = await makeUser('manager');
    const r = await upload('/api/admin/banners/upload', token, png(1080, 540), { title: 'Eid edit', link: '/fragrances/zafreon', buttonLabel: 'Shop', sortOrder: 2 });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.placement, 'app');
    assert.equal(r.body.width, 1080);
    assert.equal(r.body.height, 540);
    assert.match(r.body.image, /^\/uploads\/banner-eid-edit-[a-z0-9]{5}\.png$/);
    const list = await http('GET', '/api/banners');
    assert.equal(list.body.items.length, 1);
    assert.equal(list.body.items[0].title, 'Eid edit');
    assert.match(list.body.items[0].imageUrl, /\/uploads\/banner-eid-edit-/);
    // The image itself is served.
    assert.equal((await fetch(base + r.body.image)).status, 200);
  });

  test('any other size is refused, with the size that was sent', async () => {
    const { token } = await makeUser('admin');
    for (const [w, h] of [[1080, 541], [1920, 1080], [540, 1080], [1079, 540]]) {
      const r = await upload('/api/admin/banners/upload', token, png(w, h));
      assert.equal(r.status, 400, `${w}x${h}`);
      assert.equal(r.body.code, 'BANNER_SIZE');
      assert.match(r.body.message, new RegExp(`${w} × ${h}`));
    }
    assert.equal((await http('GET', '/api/banners')).body.items[0].image, '/media/banners/app-banner-1.jpg', 'nothing saved');
  });

  test('no file, a fake image or a non-image is refused', async () => {
    const { token } = await makeUser('admin');
    assert.equal((await upload('/api/admin/banners/upload', token, null, { title: 'x' })).status, 400);
    assert.equal((await upload('/api/admin/banners/upload', token, Buffer.from('<html>not an image</html>'), {}, 'banner.png')).status, 400);
    assert.equal((await upload('/api/admin/banners/upload', token, Buffer.from('plain text'), {}, 'notes.txt', 'text/plain')).status, 400);
  });

  test('customers, support staff and visitors cannot upload', async () => {
    const customer = await makeUser('customer');
    const support = await makeUser('support');
    assert.equal((await upload('/api/admin/banners/upload', customer.token, png(1080, 540))).status, 403);
    assert.equal((await upload('/api/admin/banners/upload', support.token, png(1080, 540))).status, 403);
    assert.equal((await upload('/api/admin/banners/upload', null, png(1080, 540))).status, 401);
  });

  test('replace the image of a banner; hidden, scheduled and ended banners are not shown', async () => {
    const { token } = await makeUser('admin');
    const a = (await upload('/api/admin/banners/upload', token, png(1080, 540), { title: 'Live' })).body;
    await upload('/api/admin/banners/upload', token, png(1080, 540), { title: 'Hidden', active: 'false' });
    await upload('/api/admin/banners/upload', token, png(1080, 540), { title: 'Later', startsAt: new Date(Date.now() + 864e5).toISOString() });
    await upload('/api/admin/banners/upload', token, png(1080, 540), { title: 'Ended', endsAt: new Date(Date.now() - 864e5).toISOString() });
    const titles = (await http('GET', '/api/banners')).body.items.map((b) => b.title);
    assert.deepEqual(titles, ['Live']);

    assert.equal((await upload(`/api/admin/banners/${a._id}/image`, token, png(800, 400))).body.code, 'BANNER_SIZE');
    const swapped = await upload(`/api/admin/banners/${a._id}/image`, token, png(1080, 540), {}, 'new-look.png');
    assert.equal(swapped.status, 200);
    assert.notEqual(swapped.body.image, a.image);
    assert.equal((await upload('/api/admin/banners/0123456789abcdef01234567/image', token, png(1080, 540))).status, 404);
    // Website placements are untouched by the app list.
    assert.equal((await http('GET', '/api/banners?placement=hero')).body.items.length, 0);
  });

  test('the size reader handles JPEG, PNG and WebP headers', () => {
    const jpg = fs.readFileSync(new URL('../../client/public/media/banners/app-banner-1.jpg', import.meta.url));
    assert.deepEqual(imageSize(jpg), { width: 1080, height: 540 });
    assert.deepEqual(imageSize(png(1080, 540)), { width: 1080, height: 540 });
    const webp = fs.readFileSync(new URL('../../client/public/media/emblem.webp', import.meta.url));
    const size = imageSize(webp);
    assert.ok(size.width > 0 && size.height > 0);
    assert.equal(imageSize(Buffer.from('not an image at all, just text')), null);
  });
});
