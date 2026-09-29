// Creates an order: the checkout and the admin's "Add order" both come here,
// so prices are always recalculated from the database and stock is reserved
// the same way. Throws an error with `status` for anything the caller should
// show to the person placing the order.
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { ORDER_STAGES, regionByCode, shippingFor } from '../config/commerce.js';
import { code } from '../utils.js';

const fail = (status, message) => Object.assign(new Error(message), { status });

export async function placeOrder({ items = [], customer, regionCode = 'IN', paymentMethod, giftNote, userId, historyNote = 'We have received your order.' }) {
  const region = regionByCode(regionCode);
  if (!region?.ships) throw fail(400, 'We do not deliver to this country yet. Please contact us on WhatsApp.');
  const { currency } = region;
  if (!Array.isArray(items) || !items.length) throw fail(400, 'Your bag is empty.');
  const a = customer?.address || {};
  if (!customer?.name || !customer?.email || !customer?.phone || !a.line1 || !a.city || !a.postalCode) {
    throw fail(400, 'Please complete your name, contact details and delivery address.');
  }
  const method = region.payments.includes(paymentMethod) ? paymentMethod : region.payments[0];

  const lines = [];
  for (const it of items.slice(0, 20)) {
    const qty = Math.min(Math.max(parseInt(it.qty, 10) || 1, 1), 10);
    const p = await Product.findOne({ slug: it.slug, published: true });
    if (!p) throw fail(400, `${it.slug} is no longer available.`);
    if (p.stock < qty) throw fail(409, `Only ${p.stock} of ${p.name} left in stock.`);
    lines.push({ p, qty });
  }

  // Reserve stock atomically; roll back if any line fails.
  const reserved = [];
  for (const { p, qty } of lines) {
    const ok = await Product.updateOne({ _id: p._id, stock: { $gte: qty } }, { $inc: { stock: -qty } });
    if (!ok.modifiedCount) {
      for (const x of reserved) await Product.updateOne({ _id: x.p._id }, { $inc: { stock: x.qty } });
      throw fail(409, `${p.name} just sold out. Please update your bag.`);
    }
    reserved.push({ p, qty });
  }

  const orderItems = lines.map(({ p, qty }) => ({
    product: p._id,
    slug: p.slug,
    name: p.name,
    image: p.images?.[0]?.src,
    qty,
    unitPrice: p.price[currency],
  }));
  const subtotal = orderItems.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const shipping = shippingFor(region, subtotal);

  return Order.create({
    orderNumber: 'AB-' + new Date().getFullYear().toString().slice(2) + code(5),
    trackingId: 'ABL' + code(9),
    user: userId,
    customer: { ...customer, address: { ...a, country: region.name } },
    items: orderItems,
    currency,
    subtotal,
    shipping,
    total: subtotal + shipping,
    paymentMethod: method,
    giftNote: giftNote?.enabled
      ? {
          enabled: true,
          name: String(giftNote.name || '').slice(0, 40),
          occasion: String(giftNote.occasion || '').slice(0, 40),
          message: String(giftNote.message || '').slice(0, 160),
        }
      : { enabled: false },
    history: [{ status: ORDER_STAGES[0], note: historyNote }],
  });
}
