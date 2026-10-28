// Cut-out product renders: a bottle on a transparent background, shown
// floating across the store.
//
// A product's own render (uploaded in the admin, stored as product.render)
// always wins. The house's fragrances also ship built-in renders with a
// half-size copy for phones, used when the product has none of its own.
const R = (name, w, h, sw) => ({
  src: `/media/${name}.webp`,
  sm: `/media/${name}-sm.webp`,
  w,
  h,
  sw,
});

export const RENDERS = {
  elarisse: R('render-elarisse', 411, 726, 246),
  zafreon: R('render-zafreon', 427, 736, 256),
  'signature-duo': R('render-duo', 1045, 716, 522),
  // Cut out of the 2026 product photos (abl-memdb/cutout.py).
  'after-dark': R('render-after-dark', 500, 1145, 250),
  'sovereign-musk': R('render-sovereign-musk', 461, 891, 230),
  'mukhallat-al-zayer': R('render-mukhallat-al-zayer', 403, 891, 201),
  'blue-dive': R('render-blue-dive', 396, 883, 198),
};

// Accepts a product (preferred) or a slug.
export function renderFor(product) {
  if (product && typeof product === 'object' && product.render?.src) {
    const { src, width, height } = product.render;
    return { src, w: width || 600, h: height || 1000 };
  }
  const slug = typeof product === 'string' ? product : product?.slug;
  return RENDERS[slug];
}

// Only built-in renders have a phone-size copy.
export const renderSrcSet = (r) => (r.sm ? `${r.sm} ${r.sw}w, ${r.src} ${r.w}w` : undefined);
