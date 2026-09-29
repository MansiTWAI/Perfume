# AL BARAKAH LIFESTYLE — Luxury Fragrance House

Storefront, Journal, order tracking and admin studio for AL BARAKAH LIFESTYLE, built with **MongoDB, Express, React and Node**. Deploys to **Vercel** with **MongoDB Atlas**.

```
├── api/index.js       Vercel serverless entry (runs the Express app)
├── vercel.json        build, static output and routing for Vercel
├── server/src         Express app, Mongoose models, routes, seed data
│   ├── app.js         the app (shared by Vercel and local)
│   ├── index.js       local / VPS entry point
│   ├── services/      order creation, stock, Excel, filters
│   └── docs/          OpenAPI spec (served at /api/openapi.json and /api/docs)
├── shared/            used by server and client: catalogue seed, couriers
├── docs/API.md        REST API guide (auth flow, conventions, mobile notes)
└── client             React 18 + Vite storefront (builds to client/dist)
    └── public/media   brand photography, the ZAFREON film, labels
```

**One API for every client.** The website, the admin studio and the mobile app use the same REST API and the same MongoDB database: products, prices, stock, carts, wishlists and orders are shared. Browse the API at **`/api/docs`** (OpenAPI 3 at `/api/openapi.json`); the guide is [docs/API.md](docs/API.md).

**Customer accounts:** the profile icon opens My orders, Edit profile and Sign out. `/profile` shows the account overview, `/profile/orders` every order with its live status timeline, and `/profile/orders/:orderId` the details. Customers can change the address, gift card and (before packing, unpaid) quantities, or cancel, until an order ships. Profile edits cover name, phone, the saved delivery address (used by checkout), email and password. Signed in, the bag is saved on the account.

## Run it locally

Requirements: Node 18.18+ and a MongoDB Atlas cluster (or local MongoDB).

```bash
npm install
cp server/.env.example server/.env   # then fill in MONGODB_URI, JWT_SECRET, ADMIN_PASSWORD
npm run seed                         # products, Journal articles and the admin account
npm run dev                          # API on :5000, site on http://localhost:5173
```

Admin studio: **/admin**, with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from your environment.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, **Add New → Project**, import the repository. Vercel reads `vercel.json`; leave the framework preset as **Other** and the root directory as the repository root.
3. Under **Settings → Environment Variables**, add:

   | Name | Value |
   | --- | --- |
   | `MONGODB_URI` | your Atlas connection string, ending in `/albarakah?retryWrites=true&w=majority` |
   | `JWT_SECRET` | a long random string |
   | `ADMIN_EMAIL` | admin login email |
   | `ADMIN_PASSWORD` | a strong admin password |
   | `SITE_URL` | your live URL, e.g. `https://albarakah.me` (used in the sitemap and share tags) |
   | `NODE_ENV` | `production` |
   | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | optional: admin image uploads go to Cloudinary (server-side, signed). Without them, uploads are stored in MongoDB. |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (`SMTP_SECURE=true` for port 465) | optional: sends password-reset emails. Without them, "Forgot password" answers that email is not set up. |
   | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | optional: turns on "Pay online" (UPI, cards, netbanking) for India. Webhook: Razorpay Dashboard → Webhooks → `https://<site>/api/payments/razorpay/webhook`, events `payment.captured` and `order.paid`. |

4. In **MongoDB Atlas → Network Access**, allow `0.0.0.0/0`. Vercel functions do not have fixed IP addresses.
5. Deploy. The database is seeded once, from your computer, with `npm run seed` using the same `MONGODB_URI`. Re-run it after changing `ADMIN_PASSWORD`.
6. Add your domain in Vercel, then submit `/sitemap.xml` in Google Search Console.

How it runs on Vercel: the built React app, `/assets` and `/media` are served by Vercel's CDN. Every other path (the API, `/sitemap.xml`, `/robots.txt`, `/uploads`, and page URLs) goes to one serverless function running the Express app, which writes each page's title, description and share tags into the HTML. Images uploaded in the admin go to Cloudinary when the `CLOUDINARY_*` variables are set, otherwise to MongoDB (4 MB limit per image either way), because Vercel's filesystem is not persistent. Existing `/media/…` and `/uploads/…` paths keep working.

## Other hosts

`npm run build && npm start` runs everything in a single Node process on `PORT`, suitable for a VPS (pm2 + Nginx) or any Node host.

## How the site is built

**The opening.** The ZAFREON bottle stands before a lit burgundy arch, pinned on stage while the story scrolls past it: the opening, then its top, heart and base notes, as the light warms from black to oxblood. As each tier arrives, its materials rise out of the bottle and orbit it in 3D (Three.js via React Three Fiber): saffron threads, cardamom and black pepper; rose petals, frankincense and incense smoke; oud wood, amber and patchouli. The notes are drawn on two transparent canvases, one behind the bottle render and one in front, so they pass both behind and in front of the glass. The 3D code loads in its own chunk, pauses off-screen, and is simply left out without WebGL.

**Product pages** open on the floating bottle with its own notes circling it tier by tier on a slow loop (ELARISSE has its own set: saffron, pink pepper, bergamot; jasmine, Taif rose, orange blossom; amber, sandalwood, vanilla), followed by the film, a zoomable gallery, interactive top/heart/base notes with ingredient photographs or line icons, Buy now, and a sticky buy bar on phones.

**Product renders** (`client/public/media/render-*.webp`, registered in `client/src/lib/renders.js`) are cut-out bottles shown floating on a lit stage in each fragrance's colours. Product cards show the bottle and fade to the campaign photograph on hover.

**The film:** the ZAFREON campaign film opens from a small arch to full height as you scroll, over a blurred copy of itself, and closes on the price and Add to bag. It also appears in the Gallery header and on the ZAFREON page.

**Motion:** Lenis smooth scroll, word-by-word headline reveals, scroll-lit text, parallax, arch-unveil page headers, magnetic buttons, a sliding nav underline, and an add-to-bag animation where the bottle drifts into the bag. The system cursor is used everywhere. All motion switches off for visitors with reduced motion turned on.

**Notes:** saffron, jasmine, amber, frankincense and oud use details cropped from the brand's own campaign photography. Every other note uses one consistent line-icon family (`NoteIcon.jsx`), matched by name.

**Markets:** India and the UAE check out in ₹ (incl. GST) and AED (incl. 5% VAT). Saudi Arabia, Qatar, Kuwait, Oman and Bahrain see AED prices and order through WhatsApp until delivery is confirmed. Add a market in `server/src/config/commerce.js`.

**SEO:** real URLs and one H1 per page. The server writes each page's title, description, canonical, Open Graph and Twitter tags into the HTML, so WhatsApp and search crawlers see them without JavaScript. Also Product/Offer, Article, Organization, Breadcrumb, FAQ and ItemList JSON-LD, plus `sitemap.xml` and `robots.txt` generated from the database. Unknown pages return a real 404.

## Admin: users, Excel orders and reports

- **Admin → Users**: every registered account with lifetime and selected-period order counts and value (₹ and AED kept separate), search, role/activity filters, sorting, pagination, a detail page with all their orders, and **Export Excel** (sheets *Users Summary* and *User Orders*, one row per item). Orders are linked to a user exactly as on their *My orders* page: placed while signed in, or with the account email. Password hashes and tokens are never returned.
- **Admin → Orders**: Add Order (same pricing and stock rules as checkout), filters (search, status, payment, market, product, customer, period: 24 h, yesterday, 7 days, 1/2/3 months, custom), **Export Excel** (respects every filter; sheets *Orders*, *Summary*, *Order Items*), **Download Template**, **Upload Excel** and **Import History**.
- **Excel import**: upload → validate → preview (row-level errors and before/after diffs; nothing saved) → confirm → result. Orders are matched by the immutable Order ID; only the gold columns (customer name/phone/address, payment status, order status + note, courier, tracking URL, expected delivery, internal notes) are written. Items and prices are read-only, and new orders cannot be created from Excel (they must reserve stock). Blank cells leave values unchanged; typing `CLEAR` empties an optional field. Updates run as one MongoDB transaction, and any order edited after the preview is reported as a conflict instead of being overwritten. Up to 20,000 rows / 4 MB per file.

## Before launch — needs the brand's confirmation

| Item | Where | Current state |
| --- | --- | --- |
| **Fragrance notes** | Admin → Products | Proposed notes based on the campaign imagery (saffron, jasmine, Taif rose, amber, frankincense, oud…). Confirm them with the perfumer, then tick **Notes approved**. |
| Note photography | `client/public/media` | Only saffron, jasmine, amber, frankincense and oud have real photos (cropped from the campaigns). Supply photos for rose, vanilla, sandalwood etc. and set each note's image in the admin; until then they show line icons. |
| Admin password | `ADMIN_PASSWORD` (Vercel env + `server/.env`) | Must be a long, unique password. Change it and re-run `npm run seed` before launch. |
| Prices | Admin → Products | ₹2,499 / ₹2,799 / ₹4,999 come from the earlier demo. The AED prices (115 / 129 / 229) are placeholders. |
| Delivery charges & GCC markets | `server/src/config/commerce.js` | ₹99 (free over ₹2,999), AED 35 (free over AED 300). Placeholders. Other GCC countries order by WhatsApp until delivery is confirmed. |
| Payment gateway | `server/src/routes/orders.js` | No gateway yet. Orders use cash on delivery (India) or "pay on confirmation", where you send a payment link. Connect Razorpay or Stripe (India) and a UAE gateway before taking cards. |
| Returns policy | `client/src/pages/InfoPages.jsx` | Standard wording (opened bottles are not returnable; report damage within 48 hours). Confirm it. |
| Privacy & Terms | same file | Taken from the Master Book. The book says they need review by an India-qualified lawyer. |
| Postal code | Footer / contact | The visiting card shows "50005". Indian PIN codes have six digits, so it has been left out until confirmed. |
| Arabic, Urdu and Hindi greetings | `SignatureCard.jsx` | Have a native speaker approve them. |
| ZAFREON film | `public/media/zafreon-film.mp4` | 352×624, with a generator watermark (✦) in the bottom-right corner. Replace it with the final export. |
| Reviews | — | Not shown until genuine reviews exist, as the brief requires. |
