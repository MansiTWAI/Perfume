// Cut-out product renders (transparent WebP, with a half-size copy for
// phones). Keyed by product slug; products without a render keep their
// photographs everywhere.
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
};

export const renderFor = (slug) => RENDERS[slug];

export const renderSrcSet = (r) => `${r.sm} ${r.sw}w, ${r.src} ${r.w}w`;
