# AL BARAKAH LIFESTYLE — REST API guide

One backend, one MongoDB database and one set of REST endpoints serve the website, the admin studio and the mobile app. A product, price, stock level or order changed in one place is immediately what every other client reads. There is no separate mobile database or mobile-only business logic.

- **Interactive reference (every endpoint, schema and example):** `GET /api/docs`
- **PDF edition:** [docs/API-Reference.pdf](API-Reference.pdf) (guide, every endpoint with examples, data models)
- **Machine-readable spec (OpenAPI 3.0):** `GET /api/openapi.json` — import it into Postman, Insomnia, or an OpenAPI code generator for the app.

The spec is checked against the Express routes: every route in the code is documented, and nothing documented is missing from the code.

## Base URL

| Environment | Base URL |
| --- | --- |
| Production | `https://perfume-tau-nine.vercel.app/api` (Vercel; or your custom domain once it is added, see `SITE_URL`) |
| Local | `http://localhost:5000/api` (or `http://localhost:5173/api` through the Vite proxy) |

All paths below are relative to the base URL.

## Headers

| Header | When |
| --- | --- |
| `Content-Type: application/json` | Every request with a JSON body |
| `Authorization: Bearer <token>` | Signed-in and admin endpoints |
| `Content-Type: multipart/form-data` | `POST /uploads` and `POST /orders/import/preview` (field name `file`) |

Responses are JSON (`application/json`), except Excel downloads (`.xlsx`, with `Content-Disposition: attachment; filename="…"`).

## Authentication and the token flow

1. `POST /auth/register` `{ name, email, password }` or `POST /auth/login` `{ email, password }`.
2. The response is `{ token, user }`. Store the token securely (Keychain / Keystore on mobile, `localStorage` on the website).
3. Send `Authorization: Bearer <token>` on every request that needs a signed-in user.
4. Tokens are JWTs valid for **7 days**. On any `401`, drop the token and ask the customer to sign in again. There is no refresh token; signing in again issues a new one.
5. `GET /auth/me` returns the current user (use it on app start to check the stored token).
6. Sign-out is client-side: delete the token (and, on the website, the local bag).

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "mansi@example.com", "password": "a-long-password" }
```

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs…",
  "user": {
    "id": "6a1f0c2e9b1d4c0000000001",
    "name": "Mansi Shukla",
    "email": "mansi@example.com",
    "role": "customer",
    "phone": "+91 91259 19516",
    "address": { "line1": "12 Kamakhya Road", "line2": "", "city": "Lucknow", "state": "Uttar Pradesh", "postalCode": "226010", "region": "IN" },
    "createdAt": "2026-09-01T10:00:00.000Z"
  }
}
```

Password hashes and tokens are never returned by any endpoint.

## Roles and permissions

| Role | Can |
| --- | --- |
| Guest (no token) | Browse products, journal and reviews; place an order; track an order with tracking ID + email; contact and newsletter |
| `customer` | Everything a guest can, plus profile, saved address, cart, wishlist, **My orders**, change or cancel own orders before they ship |
| `admin` | Everything, plus the admin endpoints (products, journal, orders, Excel, users, reviews, enquiries, uploads) |

Permissions are enforced on the server for every request. A customer asking for someone else's order gets `404` (not `403`), so order IDs cannot be probed. Admin accounts are created with `npm run seed` (from `ADMIN_EMAIL` / `ADMIN_PASSWORD`).

## Errors

Every error is JSON with a human-readable `message` you can show to the customer:

```json
{ "message": "Only 2 of ZAFREON left in stock." }
```

| Status | Meaning |
| --- | --- |
| `200` / `201` | OK / created |
| `400` | Invalid input (missing field, bad email, bad status…) |
| `401` | Not signed in, or the token is invalid/expired |
| `403` | Signed in but not an admin |
| `404` | Not found — also a malformed id, and other people's orders |
| `409` | Conflict: out of stock, email already used, order already shipped/paid/cancelled, Excel import already applied |
| `410` | Excel preview older than one hour |
| `413` | Upload larger than 4 MB |
| `429` | Rate limit (checkout 20 / 15 min, reviews 10 / hour, contact + newsletter 10 / 15 min, email/password changes 20 / 15 min) |
| `500` | Unexpected server error (`"Something went wrong on our side. Please try again."`) |
| `502` | Cloud image storage rejected an upload |

## Conventions

- **Money** is in whole units of the currency (`2799` = ₹2,799). Products carry `price: { INR, AED }`. Carts and orders carry one `currency`.
- **Prices are always computed by the server.** Any price a client sends is ignored.
- **Markets** come from `GET /settings` (`regions`): India (INR) and the UAE (AED) ship; other GCC markets show indicative prices (`estimate: true`) and order by WhatsApp.
- **Dates** are ISO 8601 UTC strings.
- **IDs:** products and articles are addressed by `slug` for reading and by `_id` for admin edits. Orders are addressed by their **Order ID** (`orderNumber`, e.g. `AB-26K7Q2M`, immutable) or `_id`. The **Tracking ID** (`ABL…`) is for public tracking.
- **Pagination:** `GET /posts`, `GET /users` and `GET /orders?paged=1` return `{ items, total, page, pages, limit }` with `page` (from 1) and `limit`. `GET /products` returns an array (the catalogue is small); use `limit` to cap it.
- **Sorting / filtering** parameters are listed per endpoint in `/api/docs` (products: `q`, `category`, `family`, `featured`, `inStock`, `minPrice`, `maxPrice`, `currency`, `sort=price-asc|price-desc|newest|name`, `limit`).

## Endpoint map

| Area | Endpoints |
| --- | --- |
| Health & settings | `GET /health`, `GET /settings`, `GET /geo` |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Profile & address | `PATCH /auth/me` (name, phone, saved address), `POST /auth/me/email`, `POST /auth/me/password` |
| Products, search & filter | `GET /products`, `GET /products/{slug}` |
| Cart | `GET /cart`, `PUT /cart`, `DELETE /cart`, `POST /cart/items`, `PATCH /cart/items/{slug}`, `DELETE /cart/items/{slug}` |
| Wishlist | `GET /wishlist`, `POST /wishlist/{slug}`, `DELETE /wishlist/{slug}` |
| Checkout & orders | `POST /orders`, `GET /orders/mine`, `GET /orders/{orderId}`, `PATCH /orders/mine/{orderId}`, `POST /orders/mine/{orderId}/cancel` |
| Order status | `GET /orders/{orderId}` (signed in), `GET /orders/track/{trackingId}?email=` (public) |
| Payments | Methods per market in `GET /settings` → `regions[].payments`; status in each order's `paymentStatus` |
| Reviews | `GET /reviews/product/{slug}`, `GET /reviews/eligible/{trackingId}?email=`, `POST /reviews` |
| Journal | `GET /posts`, `GET /posts/categories`, `GET /posts/{slug}` |
| Contact | `POST /enquiries`, `POST /subscribers` |
| Admin | products, journal, orders, Excel import/export, users, reviews, enquiries, subscribers, uploads — see `/api/docs` (tags starting "Admin") |

## Cart and wishlist

The bag and saved fragrances are stored on the account, so the website and the app share them. The website merges its local bag into the account bag at sign-in (the larger quantity wins) and saves every change after that.

```http
POST /api/cart/items?region=IN
Authorization: Bearer <token>
Content-Type: application/json

{ "slug": "zafreon", "qty": 1 }
```

```json
{
  "region": "IN", "currency": "INR", "estimate": false, "ships": true,
  "items": [{ "slug": "zafreon", "name": "ZAFREON", "image": "/media/render-zafreon.webp", "sizeLabel": "100 ML / 3.4 FL.OZ.", "qty": 1, "unitPrice": 2799, "lineTotal": 2799, "stock": 42, "available": true, "message": null }],
  "count": 1, "subtotal": 2799, "shipping": 99, "total": 2898, "freeShippingOver": 2999
}
```

Rules: quantities 1–10 per line, at most 20 lines; unknown or hidden products are dropped; sold-out lines stay in the bag with `available: false` and a `message`, and are left out of the total.

## Checkout, payments and order status

1. Read the bag: `GET /cart?region=IN`.
2. Place the order: `POST /orders` with the items, customer details, `region` and `paymentMethod` (one of `regions[].payments`). The server recalculates prices, delivery (India ₹99 under ₹2,999; UAE AED 35 under AED 300) and reserves stock atomically.
3. Empty the bag: `DELETE /cart`.
4. Show the order: `GET /orders/{orderNumber}`. Poll it (every ~30 s while the screen is open) to follow the status.

Payment methods today are `cod` (cash on delivery, India) and `pay-on-confirmation` (the house confirms on WhatsApp/email and sends a payment link). There is no card gateway yet, so there is no payment-intent endpoint; `paymentStatus` (`pending` → `paid` / `refunded`) is set by the house. When a gateway is added, its endpoints will be documented here.

**Statuses:** `Order Placed → Confirmed → Packed → Shipped → Out for Delivery → Delivered`, or `Cancelled` from any step. Each change adds a `history` entry `{ status, at, note }`; the order's `stages` array is the timeline to draw. The customer sees the courier name, `trackingNumber` and `eta` — not a courier link.

**Changing an order** (`PATCH /orders/mine/{orderId}`): check `editable` first.

| `editable` | When | What |
| --- | --- | --- |
| `details` | Order Placed, Confirmed, Packed | name, phone, address, gift card |
| `items` | Order Placed, Confirmed, and unpaid | quantities (`qty: 0` removes a line; at least one must remain) |
| `cancel` | Order Placed, Confirmed, Packed | `POST /orders/mine/{orderId}/cancel` — stock is returned |

## Images

Admins upload with `POST /uploads` (multipart field `file`; JPG, PNG, WebP or AVIF; max 4 MB). The response `{ src }` is the URL to save on a product (`images[].src`) or article (`cover.src`). With `CLOUDINARY_*` set on the server the file goes to Cloudinary (absolute `https://res.cloudinary.com/…` URL); otherwise it is stored in MongoDB and served at `/uploads/{name}`. Image URLs may be absolute or site-relative — prefix relative ones with the site origin.

## Mobile app notes

- Use the same base URL and endpoints as the website; no mobile-specific backend is needed.
- CORS applies only to browsers. Native apps send no `Origin`, so they are unaffected. Browser clients on other domains must be listed in `CLIENT_ORIGIN`.
- Relative media paths (`/media/…`, `/uploads/…`) are served by the website origin.
- Handle `401` globally (sign in again) and show `message` from any error response.
- Use `GET /settings` at start-up for markets, currencies, delivery rules and payment methods instead of hard-coding them.
