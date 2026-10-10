# AL BARAKAH LIFESTYLE — REST API guide

One backend, one MongoDB database and one set of REST endpoints serve the website, the admin studio and the mobile app. A product, price, stock level or order changed in one place is immediately what every other client reads. There is no separate mobile database or mobile-only business logic.

- **Interactive reference (every endpoint, schema and example):** `GET /api/docs`
- **PDF edition:** [docs/API-Reference.pdf](API-Reference.pdf) (guide, every endpoint with examples, data models)
- **Machine-readable spec (OpenAPI 3.0):** `GET /api/openapi.json` — import it into Postman, Insomnia, or an OpenAPI code generator for the app.
- **Postman collection:** [docs/postman/](postman/) — import `AL-BARAKAH-API.postman_collection.json` and an environment (Production or Local). Every route is in it, grouped like this guide; signing in saves the token, and creating an order, product, coupon, template or campaign saves its id for the next requests. Rebuild after API changes with `npm run postman`.

The spec is checked against the Express routes by `server/test/openapi.test.js`: every route in the code is documented, and nothing documented is missing from the code.

## Base URL

| Environment | Base URL |
| --- | --- |
| Production | `https://albarakah.me/api/v1` |
| Local | `http://localhost:5000/api/v1` (or `http://localhost:5173/api/v1` through the Vite proxy) |

All paths below are relative to the base URL. **Use `/api/v1` in the app and the admin panel.** `/api/...` is the same API with plain response bodies; the website and the admin studio use it. Every API response carries the header `API-Version: 1`. Breaking changes, if ever needed, will go to `/api/v2` while `/api/v1` keeps working.

## Response format (/api/v1)

Every response has the same envelope:

```json
{ "success": true, "message": "Products fetched successfully", "data": { } }
```

Paginated lists put the list in `data` and add `pagination`:

```json
{ "success": true, "message": "Products fetched successfully", "data": [ ], "pagination": { "page": 1, "limit": 20, "total": 125, "totalPages": 7 } }
```

Errors:

```json
{ "success": false, "message": "Validation failed", "code": "VALIDATION_ERROR", "errors": [ { "field": "phone", "message": "Invalid phone number" } ] }
```

`errors` is present on validation failures. The examples further down show the `data` part.

## Headers

| Header | When |
| --- | --- |
| `Content-Type: application/json` | Every request with a JSON body |
| `Authorization: Bearer <token>` | Signed-in and admin endpoints |
| `Content-Type: multipart/form-data` | `POST /uploads` and `POST /orders/import/preview` (field name `file`) |

Responses are JSON (`application/json`), except Excel downloads (`.xlsx`, with `Content-Disposition: attachment; filename="…"`).

## Authentication and the token flow

1. `POST /auth/register` `{ name, email, phone, password }` or `POST /auth/login` `{ identifier, password }` (identifier = email or phone). Or sign in by WhatsApp code: `POST /auth/send-otp` `{ phone, purpose: "login" }`, then `POST /auth/verify-otp` `{ phone, otp, purpose: "login" }`.
2. The response is `{ accessToken, refreshToken, user }` (`token` is the same as `accessToken`). Store both tokens securely (Keychain / Keystore on mobile).
3. Send `Authorization: Bearer <token>` on every request that needs a signed-in user.
4. The access `token` is a JWT valid for **7 days**. The `refreshToken` is valid for **60 days** and can be used **once**.
5. On a `401` from any endpoint, call `POST /auth/refresh` `{ refreshToken }`. It returns a **new** `token` and a **new** `refreshToken`; save both (the old refresh token no longer works). If refresh also returns `401`, ask the customer to sign in again.
6. `GET /auth/me` returns the current user (use it on app start to check the stored token).
7. Sign out this device: `POST /auth/logout` `{ refreshToken }`, then delete both tokens. Sign out everywhere: `POST /auth/logout-all`.
8. Changing the password (`POST /auth/me/password`) returns a fresh session for this device and signs out every other device. Resetting it by email does the same.

**Security:** refresh tokens are stored only as hashes; presenting a refresh token that was already used ends that whole sign-in (it means the token was copied). Sign-in, sign-up, refresh and password reset are rate limited (30 per 15 minutes per connection).

### Forgotten password

1. `POST /auth/forgot-password` `{ email }`. The answer is always the same, so it cannot reveal who has an account.
2. The customer gets an email with a link `<SITE_URL>/reset-password?token=…` (one hour, single use). The website has the page; an app can open it in the browser or handle the link itself.
3. `POST /auth/reset-password` `{ token, password }` sets the password and returns a session (signed in).

```http
POST /api/auth/login
Content-Type: application/json

{ "identifier": "mansi@example.com", "password": "a-long-password" }
```

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs…",
  "accessToken": "eyJhbGciOiJIUzI1NiIs…",
  "refreshToken": "q3Zb7…Xk",
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

Every error is JSON with a stable, machine-readable `code` and a human-readable `message`:

```json
{ "code": "OUT_OF_STOCK", "message": "Only 2 of ZAFREON left in stock." }
```

**Branch on `code`**, and use it to show your own (e.g. Arabic) text; `message` is English and safe to show as is. Codes are never renamed or removed; new ones may be added, so treat unknown codes by their HTTP status.

| Code | When |
| --- | --- |
| `VALIDATION_ERROR`, `INVALID_EMAIL`, `INVALID_PHONE`, `WEAK_PASSWORD` | Input problems (400) |
| `AUTH_REQUIRED`, `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `WRONG_PASSWORD`, `REFRESH_TOKEN_INVALID`, `RESET_TOKEN_INVALID` | Sign-in problems |
| `ADMIN_ONLY`, `FORBIDDEN` | Not allowed (403) |
| `NOT_FOUND`, `ORDER_NOT_FOUND`, `CART_ITEM_NOT_FOUND` | Not found (404) |
| `OUT_OF_STOCK`, `PRODUCT_UNAVAILABLE`, `CART_EMPTY`, `CART_FULL`, `REGION_NOT_SUPPORTED` | Bag and checkout |
| `ORDER_NOT_EDITABLE`, `ORDER_ALREADY_CANCELLED`, `ORDER_NOT_DELIVERED`, `ALREADY_REVIEWED` | Order rules |
| `PAYMENT_NOT_CONFIGURED`, `PAYMENT_VERIFICATION_FAILED`, `PAYMENT_PROVIDER_ERROR`, `ALREADY_PAID` | Online payment |
| `ALREADY_EXISTS`, `CONFLICT` | Duplicates and other conflicts (409) |
| `RATE_LIMITED` | Too many requests (429) |
| `INVALID_SPREADSHEET`, `IMPORT_EXPIRED`, `IMPORT_NOT_PENDING`, `INVALID_UPLOAD`, `UPLOAD_FAILED`, `PAYLOAD_TOO_LARGE`, `GONE` | Admin files and uploads |
| `EMAIL_NOT_CONFIGURED`, `SERVICE_UNAVAILABLE`, `UPSTREAM_ERROR`, `SERVER_ERROR` | Server side (5xx) |

The full list is the `Error.code` enum in `/api/openapi.json`.

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
| `429` | Rate limit (sign-in / sign-up / refresh / reset 30 per 15 min, checkout 20 / 15 min, payments 30 / 15 min, reviews 10 / hour, contact + newsletter 10 / 15 min, email/password changes 20 / 15 min) |
| `500` | Unexpected server error (`"Something went wrong on our side. Please try again."`) |
| `502` | An outside service failed (image storage, email, payment provider) |
| `503` | A feature is not configured on the server (email, online payment) |

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
| Health & config | `GET /health`, `GET /config` (countries, currencies, symbols), `GET /settings`, `GET /geo` |
| Auth | `POST /auth/register` (name, email, phone, password), `POST /auth/login` (`identifier` = email or phone), `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`, `POST /auth/send-otp`, `POST /auth/verify-otp`, `POST /auth/forgot-password`, `POST /auth/reset-password` |
| Profile | `GET /me`, `PUT /me`, `POST /me/change-password` (also `GET/PATCH /auth/me`, `POST /auth/me/email`, `POST /auth/me/password`) |
| Home & catalogue | `GET /home`, `GET /categories`, `GET /products` (page, limit, search, category, gender, minPrice, maxPrice, sort, currency/country), `GET /products/{id}`, `GET /products/featured`, `GET /products/bestsellers`, `GET /products/new-arrivals`, `GET /search` |
| Wishlist | `GET /wishlist`, `POST /wishlist` `{ productId }`, `DELETE /wishlist/{productId}` |
| Cart | `GET /cart`, `POST /cart/items` `{ productId, quantity }`, `PATCH /cart/items/{productId}`, `DELETE /cart/items/{productId}`, `DELETE /cart`, `PUT /cart` |
| Addresses | `GET /addresses`, `POST /addresses`, `PUT /addresses/{id}`, `DELETE /addresses/{id}` |
| Checkout & coupons | `POST /checkout/preview`, `POST /coupons/validate` |
| Orders | `POST /orders` (app: `{ addressId, paymentMethod, couponCode }` from the cart), `GET /orders`, `GET /orders/{id}`, `GET /orders/{id}/tracking`, `PATCH /orders/mine/{id}`, `POST /orders/mine/{id}/cancel`, `GET /orders/track/{trackingId}?email=` (public) |
| Payments | `POST /payments/create-order`, `POST /payments/verify`, `POST /payments/webhook`, `GET /payments/{paymentId}` (also `/payments/razorpay/*`) |
| Reviews | `GET /products/{productId}/reviews`, `POST /products/{productId}/reviews` |
| Devices | `POST /devices/register`, `DELETE /devices/{id}` |
| Journal & contact | `GET /posts`, `GET /posts/{slug}`, `POST /enquiries`, `POST /subscribers` |
| Admin API (`/admin`) | products (+ `/status`), categories, orders (+ `/status`, `/cancel`), customers (+ `/status`, `/role`), coupons, reviews (+ `/approve`, `/reject`), home, banners, audit-logs |

Products are addressed by **id or slug** everywhere. On `/api/v1` a product has the app shape: `id`, `price` in the requested currency, `compareAtPrice`, `currency`, `volumeMl`, `fragrance { family, topNotes, heartNotes, baseNotes, longevity }`, `rating`, `reviewCount`, plus all stored fields (`prices` holds every currency).

**Order status keys** (`statusKey` on orders, `status` in tracking): `placed`, `pending_payment`, `confirmed`, `packed`, `shipped`, `out_for_delivery`, `delivered`, `cancelled`, `refunded`. Admins may also send `processing` (→ confirmed) and `in_transit` (→ shipped).

**Roles:** `customer`, `admin` (everything), `manager` (products, categories, orders, customers, coupons, reviews, homepage), `support` (orders, customers, reviews). Roles are set by an admin (`PATCH /admin/customers/{id}/role`), never by the app.

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

**Payment methods** (per market in `GET /settings` → `regions[].payments`):

| Method | Market | How it is paid |
| --- | --- | --- |
| `online` | India (when Razorpay is configured) | UPI, cards, netbanking, wallets through Razorpay, right after placing the order |
| `cod` | India | Cash on delivery |
| `pay-on-confirmation` | India, UAE | The house confirms by WhatsApp/email and sends a payment link |

**Paying online (Razorpay):**

1. Place the order with `paymentMethod: "online"` (`POST /orders`). The order is saved and stock reserved; `paymentStatus` is `pending`.
2. `POST /payments/razorpay/order` `{ orderNumber, email }` (or signed in) returns `keyId`, `razorpayOrderId`, `amount` (paise), `currency` and `prefill`.
3. Open Razorpay Checkout (web: `checkout.razorpay.com/v1/checkout.js`; Android/iOS: Razorpay's SDK) with those values.
4. On success, send its `razorpay_order_id`, `razorpay_payment_id` and `razorpay_signature` to `POST /payments/razorpay/verify`. The server checks the signature and marks the order `paid` (and Confirmed).
5. If the customer closes the payment window, the order stays `pending` with `canPayOnline: true`; they can pay later from the order page (repeat steps 2–4). The Razorpay webhook also marks the order paid if the app was closed mid-payment.

The amount is always the saved order total; the key secret never leaves the server. UAE online payment is not enabled yet.

**Statuses:** `Order Placed → Confirmed → Packed → Shipped → Out for Delivery → Delivered`, or `Cancelled` from any step. Each change adds a `history` entry `{ status, at, note }`; the order's `stages` array is the timeline to draw. The customer sees the courier name, `trackingNumber` and `eta` — not a courier link.

**Changing an order** (`PATCH /orders/mine/{orderId}`): check `editable` first.

| `editable` | When | What |
| --- | --- | --- |
| `details` | Order Placed, Confirmed, Packed | name, phone, address, gift card |
| `items` | Order Placed, Confirmed, and unpaid | quantities (`qty: 0` removes a line; at least one must remain) |
| `cancel` | Order Placed, Confirmed, Packed | `POST /orders/mine/{orderId}/cancel` — stock is returned |

## Changelog

| Version | Date | Changes |
| --- | --- | --- |
| **1.5.0** | 2026-10-06 | App contract on `/api/v1`: `{ success, message, data, pagination }` envelope; login by email or phone (`identifier`), `phone` on register, `accessToken`; WhatsApp OTP (`/auth/send-otp`, `/auth/verify-otp`); `/me`; `/config`, `/home`, `/categories`, `/search`; products by id, featured / bestsellers / new arrivals, gender filter, pagination, app product shape; wishlist and cart by `productId`; address book; `/checkout/preview`; coupons; orders from the cart with coupon; `/orders/{id}/tracking`; payment aliases and `/payments/{paymentId}`; product reviews; push device tokens; `/admin` API with manager and support roles, customer blocking, CMS (home, banners), audit log. `/api` (website) unchanged. |
| **1.4.0** | 2026-09-29 | `/api/v1` versioned base path (`/api` stays as an alias); `code` on every error; refresh tokens (`/auth/refresh`), `/auth/logout`, `/auth/logout-all`; password reset by email; a password change signs out other devices and returns a fresh session; online payment with Razorpay (`/payments/razorpay/*`, `canPayOnline` on orders, `online` payment method); sign-in rate limiting; fully typed Product and Order models in the spec. Additive: existing clients keep working. |
| 1.3.0 | 2026-09-29 | Cart and wishlist APIs; product search/filter/sort; customer order details, editing and cancelling; profile and address; Admin users, Excel import/export, order filters; OpenAPI spec and `/api/docs`. |

## Images

Admins upload with `POST /uploads` (multipart field `file`; JPG, PNG, WebP or AVIF; max 4 MB). The response `{ src }` is the URL to save on a product (`images[].src`) or article (`cover.src`). With `CLOUDINARY_*` set on the server the file goes to Cloudinary (absolute `https://res.cloudinary.com/…` URL); otherwise it is stored in MongoDB and served at `/uploads/{name}`. Image URLs may be absolute or site-relative — prefix relative ones with the site origin.

## Mobile app notes

- Use the same base URL and endpoints as the website; no mobile-specific backend is needed.
- CORS applies only to browsers. Native apps send no `Origin`, so they are unaffected. Browser clients on other domains must be listed in `CLIENT_ORIGIN`.
- Relative media paths (`/media/…`, `/uploads/…`) are served by the website origin.
- Handle `401` globally (sign in again) and show `message` from any error response.
- Use `GET /settings` at start-up for markets, currencies, delivery rules and payment methods instead of hard-coding them.
