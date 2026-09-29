// Stock moves for existing orders (cancel, reopen, quantity changes). Each
// reservation is conditional on enough stock, and a failed batch is undone,
// the same way the checkout reserves stock.
import Product from '../models/Product.js';

// lines: [{ product, qty, name }] — positive qty takes from stock.
export async function reserve(lines) {
  const done = [];
  for (const l of lines.filter((x) => x.product && x.qty > 0)) {
    const ok = await Product.updateOne({ _id: l.product, stock: { $gte: l.qty } }, { $inc: { stock: -l.qty } });
    if (!ok.modifiedCount) {
      await release(done);
      return { ok: false, failed: l };
    }
    done.push(l);
  }
  return { ok: true };
}

export async function release(lines) {
  for (const l of lines.filter((x) => x.product && x.qty > 0)) {
    await Product.updateOne({ _id: l.product }, { $inc: { stock: l.qty } });
  }
}
