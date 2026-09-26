// The materials the house tells stories about. Images are details cropped
// from the brand's own ELARISSE and ZAFREON campaign photography.
export const INGREDIENTS = [
  {
    key: 'Saffron',
    names: 'Kesar · Za’faran',
    image: '/media/ing-saffron.webp',
    story: 'Hand-picked threads, prized in the kitchens of Kashmir and the souqs of Arabia alike. Saffron opens both of our fragrances with a leathery, golden warmth.',
  },
  {
    key: 'Jasmine Sambac',
    label: 'Jasmine',
    names: 'Mogra · Yasmin',
    image: '/media/ing-jasmine.webp',
    story: 'The white flower of Indian wedding garlands and Arabian courtyards. Creamy and luminous, it is the heart of ELARISSE.',
  },
  {
    key: 'Amber',
    names: 'Anbar',
    image: '/media/ing-amber.webp',
    story: 'Warm, resinous and golden, like the liquid in the bottle. Amber is the glow that stays on skin long after the first spray.',
  },
  {
    key: 'Frankincense',
    names: 'Loban · Luban',
    image: '/media/ing-frankincense.webp',
    story: 'The resin of the bakhoor burner and the temple lamp. Its smoke rises through the heart of ZAFREON.',
  },
  {
    key: 'Oud',
    names: 'Agar · Oud',
    image: '/media/ing-oud.webp',
    story: 'Dark agarwood that travelled for centuries from the forests of Assam to Arabia. Oud gives ZAFREON its depth and its trail.',
  },
];

// Which published products list this ingredient among their notes.
export function productsWith(products, key) {
  return products.filter((p) => ['top', 'heart', 'base'].some((t) => p.notes?.[t]?.some((n) => n.name === key)));
}
