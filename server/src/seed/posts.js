import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const flagship = fs.readFileSync(path.join(__dirname, 'flagship.md'), 'utf8');
const M = '/media';
const day = (d) => new Date(Date.UTC(2026, 8, d, 9));

export default [
  {
    title: 'The Art of Leaving a Signature: Why Fragrance Is More Than a Scent',
    slug: 'the-art-of-leaving-a-signature',
    excerpt: 'A fragrance is invisible, yet it can become one of the most recognisable parts of a person’s presence. The story and philosophy behind AL BARAKAH LIFESTYLE.',
    category: 'Brand Stories',
    tags: ['signature fragrance', 'brand story', 'ELARISSE', 'ZAFREON', 'luxury perfume India'],
    cover: { src: `${M}/elarisse-campaign.webp`, alt: 'ELARISSE bottle and ivory box beneath palace arches at sunset' },
    featured: true,
    status: 'published',
    publishedAt: day(20),
    relatedProducts: ['elarisse', 'zafreon', 'signature-duo'],
    content: flagship,
    seo: {
      title: 'The Art of Leaving a Signature | AL BARAKAH LIFESTYLE Journal',
      description: 'Why fragrance is more than a scent: the passion, heritage and philosophy behind AL BARAKAH LIFESTYLE, ELARISSE and ZAFREON.',
    },
  },
  {
    title: 'From Passion to Perfume House',
    slug: 'from-passion-to-perfume-house',
    excerpt: 'A young collector, a career that began in 2013 and years of research into raw materials. How AL BARAKAH LIFESTYLE came to be.',
    category: 'Brand Stories',
    tags: ['founder', 'our story', 'Hyderabad'],
    cover: { src: `${M}/business-card.webp`, alt: 'AL BARAKAH LIFESTYLE stationery in burgundy and gold' },
    status: 'published',
    publishedAt: day(18),
    relatedProducts: ['elarisse', 'zafreon'],
    content: `At a very young age, I started testing my skills through my passionate perfume collection. I was always curious about why certain fragrances felt different, why some stayed in memory and how different raw materials could create completely different impressions.

> "I did not want to create just another perfume. I wanted to create a signature."

## A collector's curiosity

Every bottle was a question. Why did one fragrance feel warm while another felt fresh? Why did one scent seem powerful while another stayed soft and intimate? Why did some fragrances evolve beautifully through the day while others faded?

## 2013: into the industry

In 2013, that curiosity became a profession. I started my career in the perfume industry and began deeper research into the many raw materials used in perfumery: the woods, resins, florals and spices that give a composition its character.

The journey has been about continuous learning. Understanding materials. Experimenting with fragrance directions. Observing what people connect with. And learning that great perfumery is a balance between creativity, structure, quality and patience.

## A contemporary house

AL BARAKAH LIFESTYLE brings that journey into a contemporary brand. The ambition is to respect the richness of traditional perfumery while creating a collection that feels modern, elegant and distinctive.

Our first two fragrances, **ELARISSE** and **ZAFREON**, are two sides of the same philosophy. The journey continues into oud, amber, musk, woods and the other great traditions of perfume, each interpreted through a modern lens.

*From Hyderabad, with passion. Leave your signature.*`,
  },
  {
    title: 'What Is Eau de Parfum?',
    slug: 'what-is-eau-de-parfum',
    excerpt: 'Parfum, Eau de Parfum, Eau de Toilette, attar. What the words on the bottle actually mean, and why concentration matters.',
    category: 'Guides',
    tags: ['Eau de Parfum', 'perfume concentration', 'attar', 'fragrance guide'],
    cover: { src: `${M}/elarisse-bottle.webp`, alt: 'ELARISSE Eau de Parfum bottle' },
    status: 'published',
    publishedAt: day(15),
    relatedProducts: ['elarisse', 'zafreon'],
    content: `The words on a perfume bottle describe how much perfume oil is dissolved in the fragrance. That concentration shapes how the fragrance opens, how it projects and how it develops on your skin.

## The common concentrations

The ranges below are typical, but every house sets its own formulas.

| Name | Typical concentration | Character |
| --- | --- | --- |
| Parfum / Extrait | 20–30% | Rich and close to the skin |
| **Eau de Parfum** | **15–20%** | Full, balanced and expressive |
| Eau de Toilette | 5–15% | Lighter and brighter |
| Eau de Cologne | 2–4% | Fresh and fleeting |

## Why Eau de Parfum

An Eau de Parfum gives the perfumer room to build a complete composition, with a clear opening, a heart and a lasting base. It is rich enough to develop through the day without feeling heavy. That is why both **ELARISSE** and **ZAFREON** are presented as Eau de Parfum.

## And attar?

Attar (*ittar*) is a concentrated perfume oil with no alcohol, traditionally distilled into a sandalwood base in places such as Kannauj in Uttar Pradesh. Across India and the Gulf, attar is applied in tiny amounts directly to the skin. Many people layer a spray fragrance over an attar or oud oil. It is a beautiful ritual that works well with a rich Eau de Parfum.

## How much to wear

With an Eau de Parfum, two to four sprays is usually enough. Start with less. You can always add, but you cannot take away.`,
  },
  {
    title: 'Top, Heart and Base Notes Explained',
    slug: 'top-heart-and-base-notes-explained',
    excerpt: 'Why a fragrance smells different after ten minutes, and how to read the note pyramid on every AL BARAKAH product page.',
    category: 'Guides',
    tags: ['fragrance notes', 'olfactive pyramid', 'how to read a perfume'],
    cover: { src: `${M}/zafreon-campaign.webp`, alt: 'ZAFREON with saffron and oud wood' },
    status: 'published',
    publishedAt: day(12),
    relatedProducts: ['zafreon', 'elarisse'],
    content: `A fragrance is not a single smell. It is a sequence. Perfumers describe it as a pyramid of three layers that reveal themselves over time.

## Top notes: the first impression

These are the lightest, most volatile materials: citrus, light spices and bright herbs. They are what you smell in the first minutes. In **ZAFREON**, saffron, cardamom and black pepper create the opening spark. In **ELARISSE**, saffron and bergamot bring the light.

## Heart notes: the character

As the top notes lift, the heart appears. Florals, resins and richer spices usually live here. The heart is the personality of the fragrance, and it is what most people will recognise on you. Think of the jasmine and rose in ELARISSE, or the frankincense and dark rose in ZAFREON.

## Base notes: the memory

Woods, resins, musks, amber and oud are the heaviest materials. They anchor the composition and stay closest to the skin for the longest time. The base is what remains on a scarf the next morning. It is the part of a fragrance that becomes a memory.

## How to test a fragrance properly

1. Spray on skin, not only on paper. Your skin changes everything.
2. Smell it immediately, then again after 20 minutes, then after two hours.
3. Decide on the heart and base, not the first spray.

Every product page in our collection shows its pyramid. Tap a note to learn what it brings to the composition.`,
  },
  {
    title: 'Understanding Oud',
    slug: 'understanding-oud',
    excerpt: 'Agarwood, dehn al oud, bakhoor. The dark, precious material that connects Assam to Arabia, and why it sits at the base of ZAFREON.',
    category: 'Heritage',
    tags: ['oud', 'agarwood', 'Arabic perfume', 'oud perfume India'],
    cover: { src: `${M}/zafreon-campaign.webp`, alt: 'Oud wood pieces beside the ZAFREON bottle' },
    status: 'published',
    publishedAt: day(10),
    relatedProducts: ['zafreon'],
    content: `Few materials in perfumery carry as much meaning as oud. It is complex, mysterious and deeply connected to both Indian and Middle Eastern culture.

## What oud is

Oud comes from **agarwood**, the heartwood of *Aquilaria* trees. When a tree is wounded and infected by a particular mould, it defends itself by producing a dark, fragrant resin. Over many years, that resin transforms the pale wood into something dense, dark and precious.

## From Assam to Arabia

For centuries, agarwood from the forests of Assam and North-East India travelled west to Arabia, where oud became part of daily life. In the Gulf, it is burned as wood chips and **bakhoor** to perfume homes and clothing, and worn as **dehn al oud**, the concentrated oil. It is offered to guests, worn on Fridays and brought out for Eid and weddings.

## Why most modern oud is an accord

Wild *Aquilaria* is protected under international trade rules, and genuine oud oil is among the most expensive materials in the world. Most contemporary perfumes therefore use an **oud accord**: a blend of natural and responsibly produced materials that captures oud's smoky, woody and leathery character in a wearable way.

## How oud feels on the skin

Oud can smell smoky, leathery, woody, sweet or even animalic. It is powerful, so it is usually balanced with saffron, rose, amber or incense. That is exactly the conversation at the heart of **ZAFREON**, where saffron and frankincense meet a dark oud base.

## Wearing oud in India

In the heat, a little oud goes a long way. Choose one spray on the chest or clothing for daytime, and save a fuller application for cooler evenings.`,
  },
  {
    title: 'How to Choose a Perfume for Indian Weather',
    slug: 'perfume-for-indian-weather',
    excerpt: 'Heat, humidity, monsoon and winter all change how a fragrance behaves. A season-by-season guide for wearing perfume in India and the Gulf.',
    category: 'Guides',
    tags: ['perfume for Indian weather', 'summer perfume', 'monsoon', 'how to choose perfume'],
    cover: { src: `${M}/elarisse-campaign.webp`, alt: 'ELARISSE in golden evening light' },
    status: 'published',
    publishedAt: day(8),
    relatedProducts: ['elarisse', 'zafreon'],
    content: `Heat makes fragrance travel. Humidity holds it in the air. Air conditioning dries the skin. Wearing perfume well in India, or in the Gulf, is mostly about adjusting to the climate.

## Summer: less, and brighter

Warm skin makes a fragrance project further and develop faster. In peak summer, choose luminous, floral or citrus-led compositions and wear fewer sprays. **ELARISSE**, with its saffron, jasmine and amber, is a natural daytime choice. Apply after a cool shower on moisturised skin.

## Monsoon: clean and close

Humidity can make heavy fragrances feel dense. Keep to one or two sprays, and favour clean musks and florals. This is the season of *mitti attar*, the scent of first rain on earth, which perfumers in Kannauj have distilled for generations.

## Winter and evenings: go deeper

Cooler air lets rich materials breathe. This is the time for oud, amber, incense and woods. **ZAFREON** comes into its own on winter evenings, at weddings and at late celebrations.

## In the Gulf

Days are hot, but interiors are cool and dry. Many people layer a light oud oil with a spray fragrance and refresh during the day. Spraying on clothing and a scarf helps a fragrance last in air-conditioned spaces.

## Three rules for any season

1. Moisturised skin holds fragrance better than dry skin.
2. Pulse points are warm, so they help a fragrance develop.
3. Carry it with you rather than over-applying in the morning.`,
  },
  {
    title: 'How to Apply Perfume Correctly',
    slug: 'how-to-apply-perfume',
    excerpt: 'Where to spray, how far to hold the bottle, and the one habit that dulls a fragrance. A short ritual for getting more from every bottle.',
    category: 'Rituals',
    tags: ['how to apply perfume', 'perfume tips', 'pulse points'],
    cover: { src: `${M}/zafreon-film-spray.jpg`, alt: 'Spraying ZAFREON onto the neck' },
    status: 'published',
    publishedAt: day(5),
    relatedProducts: ['zafreon', 'elarisse'],
    content: `The moment before you leave is part of the ritual. A few small habits make a real difference to how your fragrance develops and how long you enjoy it.

## 1. Start with moisturised skin

Fragrance clings to hydrated skin. Apply just after a shower, or over an unscented moisturiser.

## 2. Choose your pulse points

The base of the neck, behind the ears, the inner wrists and the inner elbows are warm spots that help a fragrance open. For a softer trail, spray the chest instead of the neck.

## 3. Hold it about 15 cm away

Too close and the fragrance pools in one spot. At a hand's length, it spreads into a fine, even mist.

## 4. Do not rub your wrists

Rubbing creates friction and heat that rush the top notes. Press your wrists together lightly, or simply let them dry.

## 5. Mind your fabrics

Spraying on clothing and scarves helps a fragrance last, especially in the heat. Test on an inside seam first, as some delicate silks and light fabrics can mark.

## 6. Know when to stop

Two to four sprays of an Eau de Parfum is plenty. If you can still smell it strongly after an hour, the people around you certainly can.`,
  },
  {
    title: 'How to Store Perfume',
    slug: 'how-to-store-perfume',
    excerpt: 'Heat, light and humidity are the three enemies of a fragrance. Where to keep your bottles, especially in an Indian or Gulf summer.',
    category: 'Rituals',
    tags: ['how to store perfume', 'perfume care'],
    cover: { src: `${M}/elarisse-bottle.webp`, alt: 'ELARISSE bottle beside its box' },
    status: 'published',
    publishedAt: day(3),
    relatedProducts: ['elarisse', 'signature-duo'],
    content: `A well-stored fragrance stays true to the way the perfumer intended it. A poorly stored one can darken, turn sharp or lose its top notes.

## Keep it away from light

Sunlight breaks down fragrance materials. Keep bottles in their box or a closed cupboard, not on a sunny windowsill or dressing table.

## Keep it cool and steady

Heat speeds up change, and so do sudden swings in temperature. **Never leave perfume in a car**, especially in an Indian or Gulf summer.

## Avoid the bathroom

Steam and humidity make the bathroom the worst place for a fragrance, however convenient it is. A bedroom wardrobe is ideal.

## Keep the cap on

Air exposure slowly changes a fragrance. Replace the cap after every use.

## Travel smart

For travel, carry the bottle in its box inside your hand luggage, where temperatures are more stable than in the hold.

With good care, the last spray should feel as considered as the first.`,
  },
  {
    title: 'Indian & Middle Eastern Fragrance Heritage',
    slug: 'indian-and-middle-eastern-fragrance-heritage',
    excerpt: 'Kannauj attars, Hyderabad’s old-city perfumers, Arabian bakhoor and Taif roses. Two great fragrance cultures, and where they meet.',
    category: 'Heritage',
    tags: ['Indian perfumery', 'Arabic perfume India', 'attar', 'bakhoor', 'Hyderabad'],
    cover: { src: `${M}/duo-triptych.webp`, alt: 'Arches and lanterns framing ELARISSE and ZAFREON' },
    status: 'published',
    publishedAt: day(1),
    relatedProducts: ['signature-duo', 'zafreon', 'elarisse'],
    content: `India and the Middle East share one of the oldest fragrance conversations in the world. Spices, woods and resins crossed the Arabian Sea for centuries, and each culture shaped the other.

## India: attar, sandalwood and flowers

In **Kannauj**, often called India's perfume capital, attars are still distilled using the traditional *deg-bhapka* method. Flowers such as rose, jasmine and kewda are distilled into a sandalwood-oil base. Indian perfumery also gave the world a love of sandalwood, vetiver (*khus*) and the jasmine known as *mogra*.

## Arabia: oud, bakhoor and rose

In the Gulf, fragrance is part of hospitality. Guests are welcomed with the smoke of **bakhoor**, clothes are perfumed with oud and homes carry the scent of resins and rose. The roses of **Taif**, grown in the mountains of Saudi Arabia, are prized for their spiced, honeyed character.

## Where they meet

Agarwood from Assam fed Arabia's love of oud. Arabian rose water and distillation knowledge travelled east. Saffron, prized in Kashmir and Iran alike, became a shared luxury in the kitchens and perfumes of both regions.

## Hyderabad: a natural bridge

Hyderabad sits at the centre of this story. The attar shops of the old city, the Nizams' taste for luxury and the city's long ties with the Gulf make it a natural home for a house that speaks both languages.

That is the vocabulary of **AL BARAKAH LIFESTYLE**: Indian richness, Middle Eastern artistry and contemporary design. Heritage provides the soul, and modern design gives it a place in today's world.`,
  },
];
