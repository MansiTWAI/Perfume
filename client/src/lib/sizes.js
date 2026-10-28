// Fragrances sold in several sizes. The API lists the main product with
// `sizes` (itself included, smallest first); each size is a product of its
// own for the bag and the checkout, sharing the fragrance's name and photos.

export const sizesOf = (p) => (p?.sizes?.length > 1 ? p.sizes : null);

// The fragrance as one particular size: its slug, price, stock and size label.
export function asSize(main, size) {
  if (!size || size.slug === main.slug) return main;
  return { ...main, _id: size._id, slug: size.slug, price: size.price, compareAt: size.compareAt, stock: size.stock, sizeMl: size.sizeMl, sizeLabel: size.sizeLabel, sizes: undefined };
}

// The size to show first: the one asked for, else the main product's own.
export const chosenSize = (main, slug) => sizesOf(main)?.find((s) => s.slug === slug) || sizesOf(main)?.find((s) => s.slug === main.slug) || null;

// The lowest price across sizes, for "From ₹…" on cards.
export function fromPrice(p, priceOf) {
  const all = (sizesOf(p) || [p]).map((s) => priceOf(s)).filter((n) => n != null);
  return all.length ? Math.min(...all) : undefined;
}

// Every product the bag can hold, by slug: main products and their sizes.
export function bySlug(list) {
  const map = new Map();
  for (const p of list || []) {
    map.set(p.slug, p);
    for (const s of sizesOf(p) || []) if (s.slug !== p.slug) map.set(s.slug, asSize(p, s));
  }
  return map;
}
