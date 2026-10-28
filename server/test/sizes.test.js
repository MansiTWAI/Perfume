// Fragrances in several sizes: each size is a product of its own linked to
// its main product (sizeOf). Listings show the main product with its sizes;
// the bag, checkout, stock and orders work per size.
import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { http, reset, close, makeUser, makeProduct, customer, Order, Product } from './helpers.js';

after(close);
beforeEach(reset);

async function fragrance() {
  const main = await makeProduct({ slug: 'after-dark', inr: 499, aed: 22, stock: 5 });
  await Product.updateOne({ _id: main._id }, { name: 'AFTER DARK', sizeMl: 50, sizeLabel: '50 ML' });
  const ten = await Product.create({ name: 'AFTER DARK', slug: 'after-dark-10ml', sizeOf: 'after-dark', sizeMl: 10, sizeLabel: '10 ML', price: { INR: 89, AED: 4 }, stock: 3, published: true });
  const eighty = await Product.create({ name: 'AFTER DARK', slug: 'after-dark-80ml', sizeOf: 'after-dark', sizeMl: 80, sizeLabel: '80 ML', price: { INR: 599, AED: 26 }, stock: 2, published: true });
  return { main, ten, eighty };
}

describe('sizes', () => {
  test('the shop lists the main product once, with every size smallest first', async () => {
    await fragrance();
    await makeProduct({ slug: 'zafreon' });
    const r = await http('GET', '/api/products');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.map((p) => p.slug).sort(), ['after-dark', 'zafreon']);
    const ad = r.body.find((p) => p.slug === 'after-dark');
    assert.deepEqual(ad.sizes.map((s) => [s.slug, s.sizeMl, s.price.INR]), [['after-dark-10ml', 10, 89], ['after-dark', 50, 499], ['after-dark-80ml', 80, 599]]);
    assert.equal(r.body.find((p) => p.slug === 'zafreon').sizes, undefined);
  });

  test("a size's address opens its fragrance with that size chosen", async () => {
    await fragrance();
    const r = await http('GET', '/api/products/after-dark-80ml');
    assert.equal(r.status, 200);
    assert.equal(r.body.product.slug, 'after-dark');
    assert.equal(r.body.selected, 'after-dark-80ml');
    assert.equal(r.body.product.sizes.length, 3);
  });

  test('ordering a size takes its own price and stock and names the size', async () => {
    const { main, ten } = await fragrance();
    const r = await http('POST', '/api/orders', { body: { region: 'IN', paymentMethod: 'cod', items: [{ slug: 'after-dark-10ml', qty: 2 }, { slug: 'after-dark', qty: 1 }], customer: customer() } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const o = await Order.findOne({ orderNumber: r.body.orderNumber }).lean();
    assert.deepEqual(o.items.map((i) => [i.name, i.unitPrice, i.qty]), [['AFTER DARK · 10 ML', 89, 2], ['AFTER DARK · 50 ML', 499, 1]]);
    assert.equal(o.subtotal, 89 * 2 + 499);
    assert.equal((await Product.findById(ten._id)).stock, 1);
    assert.equal((await Product.findById(main._id)).stock, 4);
  });

  test('a single-size fragrance keeps its plain name on orders', async () => {
    const p = await makeProduct({ slug: 'solo' });
    const r = await http('POST', '/api/orders', { body: { region: 'IN', paymentMethod: 'cod', items: [{ slug: p.slug, qty: 1 }], customer: customer() } });
    assert.equal(r.status, 201);
    const o = await Order.findOne({ orderNumber: r.body.orderNumber }).lean();
    assert.equal(o.items[0].name, 'SOLO');
  });

  test('the bag keeps sizes; a sold-out size is reported on its own', async () => {
    await fragrance();
    const { token } = await makeUser('customer');
    await http('PUT', '/api/cart', { token, body: { items: [{ slug: 'after-dark-80ml', qty: 3 }, { slug: 'after-dark', qty: 1 }] } });
    const r = await http('GET', '/api/cart', { token });
    assert.equal(r.status, 200);
    const big = r.body.items.find((i) => i.slug === 'after-dark-80ml');
    assert.equal(big.unitPrice, 599);
    assert.equal(big.sizeLabel, '80 ML');
    assert.equal(big.message, 'Only 2 left');
  });

  test('admin: sizes must belong to a fragrance; renaming and deleting carry them along', async () => {
    const { main } = await fragrance();
    const { token } = await makeUser('admin');
    const orphan = await http('POST', '/api/products', { token, body: { name: 'X', sizeOf: 'nope', price: { INR: 100, AED: 4 } } });
    assert.equal(orphan.status, 400);
    const ok = await http('POST', '/api/products', { token, body: { name: 'AFTER DARK', slug: 'after-dark-20ml', sizeOf: 'after-dark', sizeMl: 20, sizeLabel: '20 ML', price: { INR: 250, AED: 11 }, stock: 4 } });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    const all = await http('GET', '/api/products?all=1', { token });
    assert.equal(all.body.find((p) => p.slug === 'after-dark').sizes.length, 4);
    await http('PUT', `/api/products/${main._id}`, { token, body: { slug: 'after-dark-edp' } });
    assert.equal(await Product.countDocuments({ sizeOf: 'after-dark-edp' }), 3);
    await http('DELETE', `/api/products/${main._id}`, { token });
    assert.equal(await Product.countDocuments({ sizeOf: 'after-dark-edp' }), 0);
  });
});
