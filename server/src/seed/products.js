// Fragrance notes below are the proposed olfactive direction for each
// fragrance, drawn from the campaign imagery. Confirm them against the
// perfumer's final specification, then tick "Notes approved" in the admin.
const M = '/media';

export default [
  {
    name: 'ELARISSE',
    slug: 'elarisse',
    subtitle: 'Eau de Parfum',
    tagline: 'A Fragrance Beyond Time',
    family: 'Luminous Floral Amber',
    description:
      'Some fragrances announce themselves. Others become part of the memory. ELARISSE is created around the second kind: polished at first encounter, and more personal as the day unfolds.',
    story:
      'Presented in luminous ivory and gold, ELARISSE brings together refined architecture, warm light and precious-ingredient imagery. The clear crystal bottle, golden liquid, sculpted cap and ornate presentation box are its visual anchors. It is more than a fragrance. It is an atmosphere: warm, radiant and quietly distinctive, designed for moments when elegance should feel effortless.',
    sizeMl: 100,
    sizeLabel: '100 ML / 3.4 FL.OZ.',
    price: { INR: 2499, AED: 115 },
    stock: 24,
    badge: 'Signature',
    theme: 'ivory',
    featured: true,
    sortOrder: 1,
    images: [
      { src: `${M}/panel-elarisse.webp`, alt: 'ELARISSE bottle framed by ivory arches, jasmine and saffron' },
      { src: `${M}/elarisse-campaign.webp`, alt: 'ELARISSE Eau de Parfum bottle and ivory box on black marble beneath palace arches at sunset' },
      { src: `${M}/elarisse-bottle.webp`, alt: 'ELARISSE crystal bottle with golden liquid beside its ornate ivory and gold presentation box' },
      { src: `${M}/elarisse-logo-dark.webp`, alt: 'ELARISSE crowned E emblem in gold on black' },
      { src: `${M}/elarisse-logo-ivory.webp`, alt: 'ELARISSE emblem in gold on ivory' },
    ],
    notes: {
      approved: false,
      top: [
        { name: 'Saffron', description: 'A golden thread of warmth that opens the fragrance with quiet richness.', image: `${M}/ing-saffron.webp` },
        { name: 'Bergamot', description: 'Bright Italian citrus that lifts the first spray and lets the light in.' },
        { name: 'Pink Pepper', description: 'A soft, rosy sparkle that keeps the opening lively rather than sweet.' },
      ],
      heart: [
        { name: 'Jasmine Sambac', description: 'The creamy white mogra of Indian gardens and Arabian courtyards alike.', image: `${M}/ing-jasmine.webp` },
        { name: 'Taif Rose', description: 'A honeyed, spiced rose from the highlands above Makkah.' },
        { name: 'Orange Blossom', description: 'Clean, radiant and gently sweet. The glow at the centre of the composition.' },
      ],
      base: [
        { name: 'Amber', description: 'Warm, resinous and golden. The glow that stays on skin.', image: `${M}/ing-amber.webp` },
        { name: 'Sandalwood', description: 'Creamy, soft woods with a long history in Indian perfumery.' },
        { name: 'White Musk', description: 'A clean, skin-like finish that makes the fragrance feel personal.' },
        { name: 'Vanilla', description: 'A soft, rounded sweetness that settles everything into place.' },
      ],
    },
    wear: [
      { time: 'The opening', label: 'Polished', text: 'Saffron and citrus arrive first, bright and golden, like light through a jharokha.' },
      { time: 'The heart', label: 'Radiant', text: 'Jasmine and rose unfold as the fragrance warms to your skin.' },
      { time: 'The trail', label: 'Personal', text: 'Amber, sandalwood and musk remain: soft, close and unmistakably yours.' },
    ],
    mood: ['Luminous', 'Graceful', 'Warm', 'Timeless'],
    occasions: ['Daytime', 'Nikah & weddings', 'Eid mornings', 'Office', 'Family gatherings'],
    howToWear:
      'Spray two or three times from about 15 cm onto pulse points such as the neck, the inner wrists and behind the ears. Apply to moisturised skin just after a shower. Let it dry naturally rather than rubbing your wrists together.',
    howToStore:
      'Keep the bottle in its box, away from sunlight, heat and humidity. A wardrobe shelf is ideal. Avoid the bathroom and never leave it in a car during an Indian or Gulf summer.',
    faq: [
      { q: 'Is ELARISSE unisex?', a: 'ELARISSE is designed to be worn by anyone who likes a luminous, floral-amber fragrance. Many people wear it as a daytime signature.' },
      { q: 'What size is the bottle?', a: 'ELARISSE is presented as a 100 ml (3.4 fl. oz.) Eau de Parfum in its ivory and gold presentation box.' },
      { q: 'Can I layer it with ZAFREON?', a: 'Yes. A spray of ZAFREON on the wrists over ELARISSE on the neck creates a warmer, deeper evening version.' },
    ],
    includes: ['100 ml Eau de Parfum', 'Ivory & gold presentation box'],
    seo: {
      title: 'ELARISSE Eau de Parfum | A Fragrance Beyond Time | AL BARAKAH LIFESTYLE',
      description: 'ELARISSE is a luminous floral-amber Eau de Parfum by AL BARAKAH LIFESTYLE. 100 ml, ivory and gold. Delivered across India and to the UAE.',
    },
  },
  {
    name: 'ZAFREON',
    slug: 'zafreon',
    subtitle: 'Eau de Parfum',
    tagline: 'A Bold Fragrance · A Higher Story',
    family: 'Oriental Woody Oud',
    description:
      'Dark, polished and unmistakable. ZAFREON is imagined for the person who wants fragrance to become part of their presence, something felt before it is fully understood.',
    story:
      'Its black-and-gold identity creates the most dramatic expression of the Al Barakah house. Oud wood, saffron, incense, polished metal and burgundy velvet form the vocabulary of its world. ZAFREON is a study in contrast: darkness and light, tradition and modernity, depth and refinement. It is a signature for evenings, occasions and moments when individuality deserves to be remembered.',
    sizeMl: 100,
    sizeLabel: '100 ML / 3.4 FL.OZ.',
    price: { INR: 2799, AED: 129 },
    stock: 18,
    badge: 'Bold',
    theme: 'onyx',
    featured: true,
    sortOrder: 2,
    images: [
      { src: `${M}/panel-zafreon.webp`, alt: 'ZAFREON bottle with oud wood and incense smoke beneath a black arch' },
      { src: `${M}/zafreon-campaign.webp`, alt: 'ZAFREON black Eau de Parfum bottle with saffron, oud wood and burgundy velvet' },
      { src: `${M}/zafreon-bottle-marble.jpg`, alt: 'ZAFREON bottle standing on black marble in warm evening light' },
      { src: `${M}/zafreon-logo.webp`, alt: 'ZAFREON Arabic calligraphy and Latin logotype in gold on black' },
      { src: `${M}/zafreon-film-spray.jpg`, alt: 'A woman in an embroidered ivory kurta spraying ZAFREON' },
    ],
    video: { src: `${M}/zafreon-film.mp4`, poster: `${M}/zafreon-film-poster.jpg` },
    notes: {
      approved: false,
      top: [
        { name: 'Saffron', description: 'Za\'faran, kesar: deep, leathery and golden. The signature of the house.', image: `${M}/ing-saffron.webp` },
        { name: 'Cardamom', description: 'Green, cool spice, the scent of qahwa and of masala chai.' },
        { name: 'Black Pepper', description: 'A dry, electric spark that sharpens the opening.' },
      ],
      heart: [
        { name: 'Frankincense', description: 'Luban. Resinous smoke that recalls bakhoor drifting through a majlis.', image: `${M}/ing-frankincense.webp` },
        { name: 'Damask Rose', description: 'A darker, velvet rose that gives the heart its depth.' },
        { name: 'Leather', description: 'Supple and polished. The confidence in the composition.' },
      ],
      base: [
        { name: 'Oud', description: 'Agarwood: dark, animalic and precious, the soul of Arabian perfumery.', image: `${M}/ing-oud.webp` },
        { name: 'Patchouli', description: 'Earthy, dark and grounding. It gives the base its weight.' },
        { name: 'Amber', description: 'Resinous warmth that wraps the woods in gold.', image: `${M}/ing-amber.webp` },
        { name: 'Smoked Woods', description: 'Dry, polished woods that linger long after you leave the room.' },
      ],
    },
    wear: [
      { time: 'The opening', label: 'Electric', text: 'Saffron, cardamom and pepper strike first, like a match struck in a dark room.' },
      { time: 'The heart', label: 'Smouldering', text: 'Incense and dark rose rise and settle as the fragrance warms.' },
      { time: 'The trail', label: 'Unforgettable', text: 'Oud, amber and smoked woods leave the impression people remember.' },
    ],
    mood: ['Dramatic', 'Confident', 'Smoky', 'Magnetic'],
    occasions: ['Evenings', 'Sangeet & receptions', 'Eid nights', 'Winter', 'Special occasions'],
    howToWear:
      'ZAFREON is rich, so start with two sprays: one at the base of the neck and one on the chest or inner wrist. In the heat, spray once on clothing away from the skin. In the Gulf tradition, it layers beautifully over a light oud oil.',
    howToStore:
      'Keep it upright in its box, away from sunlight, heat and humidity. Richer compositions like ZAFREON mature beautifully when stored well.',
    faq: [
      { q: 'Is ZAFREON only for evenings?', a: 'It was designed as an evening and occasion signature, but a single spray works on cooler days too.' },
      { q: 'Is ZAFREON a men\'s fragrance?', a: 'No. ZAFREON is for anyone drawn to a dark, woody, saffron-and-oud character.' },
      { q: 'What size is the bottle?', a: 'ZAFREON is presented as a 100 ml (3.4 fl. oz.) Eau de Parfum.' },
    ],
    includes: ['100 ml Eau de Parfum', 'Black & gold presentation box'],
    seo: {
      title: 'ZAFREON Eau de Parfum | A Bold Fragrance • A Higher Story | AL BARAKAH LIFESTYLE',
      description: 'ZAFREON is a bold saffron, incense and oud Eau de Parfum by AL BARAKAH LIFESTYLE. 100 ml, black and gold. Delivered across India and to the UAE.',
    },
  },
  {
    name: 'SIGNATURE DUO',
    slug: 'signature-duo',
    subtitle: 'ELARISSE + ZAFREON',
    tagline: 'Two Signatures · One Philosophy',
    family: 'Gift Set',
    description:
      'Both houses in one gift. ELARISSE for luminous days and ZAFREON for unforgettable evenings. A considered pairing for weddings, Eid, Diwali or the person who deserves both.',
    story:
      'ELARISSE explores luminous elegance: ivory, gold, crystal and warmth. ZAFREON takes a darker route: black, gold, oud-inspired textures and incense. Together they express the full philosophy of the house. Wear one by day, the other by night, or layer them into something entirely your own.',
    sizeMl: 200,
    sizeLabel: '2 × 100 ML',
    price: { INR: 4999, AED: 229 },
    stock: 12,
    badge: 'Gift',
    theme: 'duo',
    category: 'Gift Sets',
    featured: false,
    sortOrder: 3,
    images: [
      { src: `${M}/panel-house.webp`, alt: 'ELARISSE and ZAFREON side by side beneath a burgundy arch: two signatures, one philosophy' },
      { src: `${M}/duo-triptych.webp`, alt: 'ELARISSE and ZAFREON bottles side by side in a triptych of burgundy, ivory and black arches' },
      { src: `${M}/elarisse-campaign.webp`, alt: 'ELARISSE campaign image' },
      { src: `${M}/zafreon-campaign.webp`, alt: 'ZAFREON campaign image' },
    ],
    notes: { approved: false, top: [], heart: [], base: [] },
    wear: [
      { time: 'By day', label: 'ELARISSE', text: 'Luminous saffron, jasmine and amber for daylight and celebrations.' },
      { time: 'By night', label: 'ZAFREON', text: 'Saffron, incense and oud for evenings that deserve to be remembered.' },
      { time: 'Layered', label: 'Your own', text: 'ZAFREON on the wrists over ELARISSE on the neck: warm, deep and personal.' },
    ],
    mood: ['Giftable', 'Complete', 'Day to night'],
    occasions: ['Weddings', 'Eid', 'Diwali', 'Anniversaries', 'Corporate gifting'],
    howToWear: 'Wear ELARISSE by day and ZAFREON by night, or layer them: ZAFREON on the wrists over ELARISSE on the neck.',
    howToStore: 'Keep both bottles in their boxes, away from sunlight, heat and humidity.',
    faq: [{ q: 'Can I add a gift note?', a: 'Yes. At checkout you can add a Signature Card with the recipient\'s name, the occasion and a personal line. It is printed and placed in the box.' }],
    includes: ['ELARISSE 100 ml Eau de Parfum', 'ZAFREON 100 ml Eau de Parfum', 'Optional Signature Card'],
    seo: {
      title: 'Signature Duo Gift Set | ELARISSE + ZAFREON | AL BARAKAH LIFESTYLE',
      description: 'A luxury perfume gift set with ELARISSE and ZAFREON Eau de Parfum. Ideal for weddings, Eid and Diwali. Delivered across India and to the UAE.',
    },
  },
];
