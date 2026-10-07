import './env.js';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import postRoutes from './routes/posts.js';
import orderRoutes from './routes/orders.js';
import contactRoutes from './routes/contact.js';
import reviewRoutes from './routes/reviews.js';
import uploadRoutes, { serveUpload } from './routes/uploads.js';
import userRoutes from './routes/users.js';
import cartRoutes from './routes/cart.js';
import paymentRoutes from './routes/payments.js';
import accountRoutes from './routes/account.js';
import storefrontRoutes from './routes/storefront.js';
import adminRoutes from './routes/admin.js';
import { openapi, docsPage } from './docs/openapi.js';
import { errorCodes } from './middleware/errors.js';
import { envelope } from './middleware/envelope.js';
import Product from './models/Product.js';
import Post from './models/Post.js';
import { publicRegions } from './config/commerce.js';
import { renderPage } from './seo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');
const SITE_URL = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : `http://localhost:${process.env.PORT || 5000}`)
).replace(/\/$/, '');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // behind Vercel / Nginx: real client IPs for rate limiting
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || true }));
// The raw body is kept for verifying payment webhook signatures.
app.use(express.json({ limit: '1mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
// NoSQL injection guard: no request may smuggle MongoDB operators ($ne, $gt,
// $where…) into a query through the body or the query string.
const stripOperators = (v, depth = 0) => {
  if (!v || typeof v !== 'object' || depth > 20) return v;
  for (const k of Object.keys(v)) {
    if (k.startsWith('$')) delete v[k];
    else stripOperators(v[k], depth + 1);
  }
  return v;
};
app.use((req, _res, next) => {
  stripOperators(req.body);
  stripOperators(req.query);
  next();
});
// Versioned API: /api/v1/... is the app contract (every response wrapped as
// { success, message, data }); /api/... is the same API with plain responses,
// used by the website and the admin studio.
app.use((req, res, next) => {
  if (req.url === '/api/v1' || req.url.startsWith('/api/v1/') || req.url.startsWith('/api/v1?')) {
    req.url = `/api${req.url.slice(7)}`;
    req.apiV1 = true;
  }
  if (req.url.startsWith('/api')) res.set('API-Version', '1');
  next();
});
app.use(errorCodes);
app.use(envelope);
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// Every request waits for the (cached) database connection. On serverless
// hosts the connection is reused between invocations of a warm instance.
app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (e) {
    next(e);
  }
});

app.get('/uploads/:name', serveUpload);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
// API reference for the website, the admin studio and the mobile app.
app.get('/api/openapi.json', (_req, res) => res.json(openapi(SITE_URL)));
app.get('/api/docs', (_req, res) => res.type('html').send(docsPage));
app.get('/api/settings', (_req, res) => res.json({ regions: publicRegions() }));
// The visitor's country, from the edge network's geolocation header, so a
// first visit from Dubai opens in dirhams. Nothing is stored.
app.get('/api/geo', (req, res) => {
  const country = String(req.get('x-vercel-ip-country') || req.get('cf-ipcountry') || '').toUpperCase();
  res.set('Cache-Control', 'private, no-store').json({ country: /^[A-Z]{2}$/.test(country) ? country : null });
});
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', cartRoutes); // /api/cart and /api/wishlist
app.use('/api', accountRoutes); // /me, /addresses, /devices, /checkout/preview, /coupons/validate
app.use('/api', storefrontRoutes); // /config, /categories, /search, /home
app.use('/api', contactRoutes);

// Renamed page: keep old links and search results working.
app.get('/shipping-returns', (_req, res) => res.redirect(301, '/shipping-policy'));

// SEO: sitemap and robots, built from live data.
const STATIC_PATHS = ['/', '/fragrances', '/our-story', '/mission-vision', '/fragrance-heritage', '/gallery', '/journal', '/about-us', '/contact', '/faq', '/shipping-policy', '/refund-policy', '/privacy-policy', '/terms'];
app.get('/sitemap.xml', async (_req, res, next) => {
  try {
    const [products, posts] = await Promise.all([
      Product.find({ published: true }).select('slug updatedAt'),
      Post.find({ status: 'published' }).select('slug updatedAt'),
    ]);
    const urls = [
      ...STATIC_PATHS.map((p) => ({ loc: p })),
      ...products.map((p) => ({ loc: `/fragrances/${p.slug}`, lastmod: p.updatedAt })),
      ...posts.map((p) => ({ loc: `/journal/${p.slug}`, lastmod: p.updatedAt })),
    ];
    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls
          .map((u) => `  <url><loc>${SITE_URL}${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod.toISOString().slice(0, 10)}</lastmod>` : ''}</url>`)
          .join('\n') +
        `\n</urlset>`
    );
  } catch (e) {
    next(e);
  }
});
app.get('/robots.txt', (_req, res) =>
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /account\nDisallow: /profile\nDisallow: /checkout\nSitemap: ${SITE_URL}/sitemap.xml\n`)
);

app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found.' }));

// Serve the built React app in production.
if (fs.existsSync(CLIENT_DIST)) {
  const template = fs.readFileSync(path.join(CLIENT_DIST, 'index.html'), 'utf8');
  app.use('/assets', express.static(path.join(CLIENT_DIST, 'assets'), { maxAge: '1y', immutable: true }));
  app.use(express.static(CLIENT_DIST, { maxAge: '7d', index: false }));
  // Every page gets its own title, description and share tags in the HTML,
  // so WhatsApp, Instagram and search crawlers see them without running JS.
  app.get('*', async (req, res, next) => {
    try {
      const { html, status } = await renderPage(template, req.path, SITE_URL);
      res.status(status).type('html').send(html);
    } catch (e) {
      next(e);
    }
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // Bad JSON or a body over the 1 MB limit: the client's mistake, not ours.
  if (err?.type === 'entity.too.large') return res.status(413).json({ message: 'The request is too large.' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ message: 'The request body is not valid JSON.' });
  if (err?.code === 11000) return res.status(409).json({ message: 'That slug or email is already in use.' });
  if (err?.name === 'ValidationError') return res.status(400).json({ message: err.message });
  // A malformed id in the URL (e.g. /api/orders/abc) is simply not found.
  if (err?.name === 'CastError' && err.kind === 'ObjectId') return res.status(404).json({ message: 'Not found.' });
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on our side. Please try again.' });
});

export default app;
