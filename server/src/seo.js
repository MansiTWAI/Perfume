// Server-side page metadata for the single-page app.
// The React app refines these tags after it loads (react-helmet-async
// replaces any tag marked data-rh), so they never appear twice.
import Product from './models/Product.js';
import Post from './models/Post.js';

const SITE = 'AL BARAKAH LIFESTYLE';
const DEFAULT_IMAGE = '/media/duo-triptych-800.webp';

const PAGES = {
  '/': ['Luxury Perfume & Fragrance House in India | AL BARAKAH LIFESTYLE', 'AL BARAKAH LIFESTYLE is a contemporary luxury fragrance house from Hyderabad. Discover ELARISSE and ZAFREON Eau de Parfum, delivered across India and to the UAE.'],
  '/fragrances': ['Premium Eau de Parfum Collection | AL BARAKAH LIFESTYLE', 'The AL BARAKAH LIFESTYLE collection: ELARISSE, ZAFREON and the Signature Duo gift set. Premium Eau de Parfum delivered across India and to the UAE.'],
  '/our-story': ['Our Story | The House Behind AL BARAKAH LIFESTYLE', 'From a young perfume collector to a career in the perfume industry from 2013: the story behind AL BARAKAH LIFESTYLE.'],
  '/mission-vision': ['Mission, Vision & Goals | AL BARAKAH LIFESTYLE', 'The mission, vision and 2030 goals of AL BARAKAH LIFESTYLE in India and the United Arab Emirates.'],
  '/fragrance-heritage': ['Fragrance Heritage | India, Arabia & the Art of Scent', 'Attar, oud, bakhoor, saffron and jasmine: the Indian and Middle Eastern fragrance heritage behind AL BARAKAH LIFESTYLE.'],
  '/gallery': ['Luxury Perfume Gallery | AL BARAKAH LIFESTYLE', 'ELARISSE and ZAFREON campaigns, packaging and details from AL BARAKAH LIFESTYLE.'],
  '/journal': ['Luxury Fragrance Journal | Perfume Guides & Stories', 'Fragrance guides, perfume rituals, the heritage of oud and attar, and the story of AL BARAKAH LIFESTYLE.'],
  '/contact': ['Contact AL BARAKAH LIFESTYLE | Perfume & Lifestyle Brand India', 'Contact AL BARAKAH LIFESTYLE in Hyderabad for orders, gifting and fragrance questions.'],
  '/faq': ['Frequently Asked Questions | AL BARAKAH LIFESTYLE', 'Answers about our fragrances, delivery, gift notes, tracking and perfume care.'],
  '/shipping-returns': ['Shipping & Returns | AL BARAKAH LIFESTYLE', 'Delivery across India and to the UAE, tracking and returns.'],
  '/privacy-policy': ['Privacy Policy | AL BARAKAH LIFESTYLE', 'How AL BARAKAH LIFESTYLE collects, uses and protects personal information.'],
  '/terms': ['Terms & Conditions | AL BARAKAH LIFESTYLE', 'Terms and conditions for the AL BARAKAH LIFESTYLE website and online orders.'],
  '/track': ['Track your order | AL BARAKAH LIFESTYLE', 'Track your AL BARAKAH LIFESTYLE order.'],
};
const PRIVATE = ['/checkout', '/account', '/order'];

const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function lookup(pathname) {
  if (PAGES[pathname]) return { title: PAGES[pathname][0], description: PAGES[pathname][1] };
  let m = pathname.match(/^\/fragrances\/([a-z0-9-]+)$/);
  if (m) {
    const p = await Product.findOne({ slug: m[1], published: true }).lean();
    if (!p) return null;
    const img = p.images?.[0]?.src;
    return { title: p.seo?.title || `${p.name} ${p.subtitle} | ${SITE}`, description: p.seo?.description || p.description, image: img, type: 'product' };
  }
  m = pathname.match(/^\/journal\/([a-z0-9-]+)$/);
  if (m) {
    const p = await Post.findOne({ slug: m[1], status: 'published' }).lean();
    if (!p) return null;
    return { title: p.seo?.title || `${p.title} | ${SITE}`, description: p.seo?.description || p.excerpt, image: p.cover?.src, type: 'article' };
  }
  if (PRIVATE.some((x) => pathname.startsWith(x)) || pathname.startsWith('/admin')) {
    return { title: SITE, description: PAGES['/'][1], noindex: true };
  }
  return null;
}

export async function renderPage(template, pathname, siteUrl) {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const meta = await lookup(clean);
  const found = !!meta;
  const m = meta || { title: `Page not found | ${SITE}`, description: PAGES['/'][1], noindex: true };
  const image = siteUrl + (m.image || DEFAULT_IMAGE);
  const tags = [
    `<meta data-rh="true" name="description" content="${esc(m.description)}" />`,
    `<link data-rh="true" rel="canonical" href="${esc(siteUrl + clean)}" />`,
    `<meta data-rh="true" property="og:site_name" content="${SITE}" />`,
    `<meta data-rh="true" property="og:title" content="${esc(m.title)}" />`,
    `<meta data-rh="true" property="og:description" content="${esc(m.description)}" />`,
    `<meta data-rh="true" property="og:type" content="${m.type || 'website'}" />`,
    `<meta data-rh="true" property="og:url" content="${esc(siteUrl + clean)}" />`,
    `<meta data-rh="true" property="og:image" content="${esc(image)}" />`,
    `<meta data-rh="true" name="twitter:card" content="summary_large_image" />`,
    `<meta data-rh="true" name="twitter:title" content="${esc(m.title)}" />`,
    `<meta data-rh="true" name="twitter:description" content="${esc(m.description)}" />`,
    `<meta data-rh="true" name="twitter:image" content="${esc(image)}" />`,
    m.noindex ? '<meta data-rh="true" name="robots" content="noindex" />' : '',
  ].join('\n    ');
  const html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(m.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, '')
    .replace('</head>', `    ${tags}\n  </head>`);
  return { html, status: found ? 200 : 404 };
}
