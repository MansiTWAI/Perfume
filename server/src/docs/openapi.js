// OpenAPI 3.0 description of the REST API used by the website, the admin
// studio and the mobile app. Served at /api/openapi.json, browsable at
// /api/docs. A test checks that every Express route is listed here.
import { ORDER_STAGES, ORDER_STATUSES } from '../config/commerce.js';

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema, example) => ({ 'application/json': { schema, ...(example && { example }) } });
const ok = (description, schema, example) => ({ description, content: json(schema, example) });
const err = (description) => ({ description, content: json(ref('Error')) });
const E = {
  400: err('Invalid input. `message` says what to fix.'),
  401: err('Missing, invalid or expired token.'),
  403: err('Signed in, but not an admin.'),
  404: err('Not found (also returned for other people’s orders).'),
  409: err('Conflict, e.g. out of stock, already exists, or the order can no longer be changed.'),
  429: err('Too many requests from this connection; try again later.'),
};
const body = (schema, example, required = true) => ({ required, content: json(schema, example) });
const pathParam = (name, description, example) => ({ name, in: 'path', required: true, description, schema: { type: 'string' }, example });
const q = (name, description, schema = { type: 'string' }, example) => ({ name, in: 'query', required: false, description, schema, ...(example !== undefined && { example }) });
const user = [{ bearerAuth: [] }];
const admin = [{ bearerAuth: [] }];
const xlsx = (description) => ({
  description,
  headers: { 'Content-Disposition': { schema: { type: 'string' }, description: 'attachment; filename="…xlsx"' } },
  content: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { schema: { type: 'string', format: 'binary' } } },
});

const orderFilters = [
  q('status', 'Order status', { type: 'string', enum: ORDER_STATUSES }),
  q('paymentStatus', 'Payment status', { type: 'string', enum: ['pending', 'paid', 'refunded'] }),
  q('currency', 'Market currency', { type: 'string', enum: ['INR', 'AED'] }),
  q('product', 'Product id or slug'),
  q('customer', 'User id: orders placed by that account or with its email'),
  q('q', 'Search order ID, tracking ID, name, email, phone, city'),
  q('period', 'Report period', { type: 'string', enum: ['24h', '1d', '7d', '1m', '2m', '3m', 'custom', 'all'] }),
  q('from', 'Custom period start (YYYY-MM-DD, inclusive)', { type: 'string', format: 'date' }),
  q('to', 'Custom period end (YYYY-MM-DD, inclusive)', { type: 'string', format: 'date' }),
  q('tz', 'Browser offset in minutes (Date#getTimezoneOffset) for calendar periods', { type: 'integer' }, -330),
];

const productExample = {
  _id: '6a1f0c2e9b1d4c0012345678', name: 'ZAFREON', slug: 'zafreon', subtitle: 'Eau de Parfum', family: 'Oriental Woody Oud',
  price: { INR: 2799, AED: 129 }, stock: 42, images: [{ src: 'https://res.cloudinary.com/dch8n8kxm/image/upload/albarakah/zafreon.webp', alt: 'ZAFREON bottle' }],
  notes: { top: [{ name: 'Saffron' }], heart: [{ name: 'Rose' }], base: [{ name: 'Oud' }], approved: true }, published: true, featured: true,
};
const orderExample = {
  _id: '6a1f0c2e9b1d4c00abcdef01', orderNumber: 'AB-26K7Q2M', trackingId: 'ABLK6KWBQJBS', createdAt: '2026-09-29T07:23:06.000Z', updatedAt: '2026-09-29T09:10:00.000Z',
  status: 'Shipped', stages: ORDER_STAGES,
  history: [{ status: 'Order Placed', at: '2026-09-29T07:23:06.000Z', note: 'We have received your order.' }, { status: 'Shipped', at: '2026-09-30T10:00:00.000Z', note: 'Dispatched from Hyderabad.' }],
  items: [{ slug: 'zafreon', name: 'ZAFREON', image: '/media/render-zafreon.webp', qty: 1, unitPrice: 2799, lineTotal: 2799 }],
  currency: 'INR', taxLabel: 'incl. GST', subtotal: 2799, shipping: 99, total: 2898, paymentMethod: 'cod', paymentStatus: 'pending',
  customer: { name: 'Mansi Shukla', email: 'mansi@example.com', phone: '+91 91259 19516', address: { line1: '12 Kamakhya Road', line2: '', city: 'Lucknow', state: 'Uttar Pradesh', postalCode: '226010', country: 'India' } },
  giftNote: { enabled: false }, carrier: 'Delhivery', trackingNumber: '26554968', eta: '3 October 2026',
  editable: { details: false, items: false, cancel: false }, edits: [],
};
const cartExample = {
  region: 'IN', currency: 'INR', estimate: false, ships: true, count: 2, subtotal: 5598, shipping: 0, total: 5598, freeShippingOver: 2999,
  items: [{ slug: 'zafreon', name: 'ZAFREON', image: '/media/render-zafreon.webp', sizeLabel: '100 ML / 3.4 FL.OZ.', qty: 2, unitPrice: 2799, lineTotal: 5598, stock: 42, available: true, message: null }],
};
const userExample = {
  id: '6a1f0c2e9b1d4c0000000001', name: 'Mansi Shukla', email: 'mansi@example.com', role: 'customer', phone: '+91 91259 19516',
  address: { line1: '12 Kamakhya Road', line2: '', city: 'Lucknow', state: 'Uttar Pradesh', postalCode: '226010', region: 'IN' }, createdAt: '2026-09-01T10:00:00.000Z',
};
const addressSchema = {
  type: 'object',
  properties: { line1: { type: 'string', maxLength: 200 }, line2: { type: 'string', maxLength: 200 }, city: { type: 'string', maxLength: 80 }, state: { type: 'string', maxLength: 80 }, postalCode: { type: 'string', maxLength: 20 } },
};

export function openapi(serverUrl = '/') {
  return {
    openapi: '3.0.3',
    info: {
      title: 'AL BARAKAH LIFESTYLE API',
      version: '1.3.0',
      description:
        'One REST API and one database for the website, the admin studio and the mobile app. Everything the admin changes (products, prices, stock, orders) is live for every client immediately.\n\n' +
        '**Auth:** `POST /api/auth/login` (or `/register`) returns a JWT. Send it as `Authorization: Bearer <token>`. Tokens last 7 days; on `401`, sign in again.\n\n' +
        '**Errors** are JSON: `{ "message": "…" }` with the HTTP status. **Money** is in whole units of the order currency (INR or AED). Prices always come from the server.\n\n' +
        'See also docs/API.md in the repository for the token flow, conventions and mobile notes.',
    },
    servers: [
      { url: '/api', description: 'Same server as these docs' },
      ...(serverUrl && serverUrl !== '/' ? [{ url: `${serverUrl.replace(/\/$/, '')}/api`, description: 'Configured site URL (SITE_URL)' }] : []),
    ],
    tags: [
      { name: 'Health & settings' }, { name: 'Auth' }, { name: 'Profile & address' }, { name: 'Products' }, { name: 'Cart' }, { name: 'Wishlist' },
      { name: 'Checkout & orders' }, { name: 'Order status' }, { name: 'Payments' }, { name: 'Reviews' }, { name: 'Journal' }, { name: 'Contact' },
      { name: 'Admin: orders' }, { name: 'Admin: Excel' }, { name: 'Admin: users' }, { name: 'Admin: catalogue & content' }, { name: 'Uploads' },
    ],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Token from /auth/login or /auth/register. Admin endpoints need a token of a user with role "admin".' } },
      schemas: {
        Error: { type: 'object', required: ['message'], properties: { message: { type: 'string' } }, example: { message: 'Please sign in to continue.' } },
        User: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string', format: 'email' }, role: { type: 'string', enum: ['customer', 'admin'] }, phone: { type: 'string' }, address: { allOf: [addressSchema, { type: 'object', properties: { region: { type: 'string', example: 'IN' } } }] }, createdAt: { type: 'string', format: 'date-time' } }, example: userExample },
        AuthResult: { type: 'object', properties: { token: { type: 'string' }, user: ref('User') }, example: { token: 'eyJhbGciOiJIUzI1NiIs…', user: userExample } },
        Region: { type: 'object', properties: { code: { type: 'string' }, name: { type: 'string' }, currency: { type: 'string' }, ships: { type: 'boolean' }, taxLabel: { type: 'string' }, shipping: { type: 'object', properties: { flat: { type: 'number' }, freeOver: { type: 'number' } } }, payments: { type: 'array', items: { type: 'string', enum: ['cod', 'pay-on-confirmation'] } }, base: { type: 'string' }, fx: { type: 'number' } }, example: {"code":"IN","name":"India","currency":"INR","ships":true,"taxLabel":"incl. GST","shipping":{"flat":99,"freeOver":2999},"payments":["cod","pay-on-confirmation"]} },
        Product: { type: 'object', description: 'Full product document (see server/src/models/Product.js). Key fields shown.', properties: { _id: { type: 'string' }, name: { type: 'string' }, slug: { type: 'string' }, subtitle: { type: 'string' }, family: { type: 'string' }, description: { type: 'string' }, price: { type: 'object', properties: { INR: { type: 'number' }, AED: { type: 'number' } } }, stock: { type: 'integer' }, images: { type: 'array', items: { type: 'object', properties: { src: { type: 'string' }, alt: { type: 'string' } } } }, notes: { type: 'object' }, published: { type: 'boolean' }, featured: { type: 'boolean' }, sortOrder: { type: 'integer' } }, example: productExample },
        ProductInput: { type: 'object', required: ['name', 'price'], properties: { name: { type: 'string' }, slug: { type: 'string', description: 'Defaults to the name, slugified' }, price: { type: 'object', required: ['INR', 'AED'], properties: { INR: { type: 'number' }, AED: { type: 'number' } } }, stock: { type: 'integer', minimum: 0 }, images: { type: 'array', items: { type: 'object', properties: { src: { type: 'string' }, alt: { type: 'string' } } } }, published: { type: 'boolean' } }, additionalProperties: true },
        CartItem: { type: 'object', properties: { slug: { type: 'string' }, name: { type: 'string' }, image: { type: 'string', nullable: true }, sizeLabel: { type: 'string' }, qty: { type: 'integer', minimum: 1, maximum: 10 }, unitPrice: { type: 'number', nullable: true }, lineTotal: { type: 'number' }, stock: { type: 'integer' }, available: { type: 'boolean' }, message: { type: 'string', nullable: true, example: 'Only 2 left' } } },
        Cart: { type: 'object', properties: { region: { type: 'string' }, currency: { type: 'string' }, estimate: { type: 'boolean', description: 'True for enquiry markets (indicative prices, order on WhatsApp)' }, ships: { type: 'boolean' }, items: { type: 'array', items: ref('CartItem') }, count: { type: 'integer' }, subtotal: { type: 'number' }, shipping: { type: 'number' }, total: { type: 'number' }, freeShippingOver: { type: 'number', nullable: true } }, example: cartExample },
        Wishlist: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { slug: { type: 'string' }, name: { type: 'string' }, subtitle: { type: 'string' }, image: { type: 'string', nullable: true }, price: { type: 'object' }, inStock: { type: 'boolean' } } } } }, example: {"items":[{"slug":"zafreon","name":"ZAFREON","subtitle":"Eau de Parfum","image":"/media/render-zafreon.webp","price":{"INR":2799,"AED":129},"inStock":true}]} },
        OrderInput: {
          type: 'object', required: ['items', 'customer', 'region'],
          properties: {
            region: { type: 'string', enum: ['IN', 'AE'], description: 'Delivery market; other GCC markets order by WhatsApp' },
            paymentMethod: { type: 'string', enum: ['cod', 'pay-on-confirmation'], description: 'Must be allowed for the region, else the first allowed one is used' },
            items: { type: 'array', maxItems: 20, items: { type: 'object', required: ['slug'], properties: { slug: { type: 'string' }, qty: { type: 'integer', minimum: 1, maximum: 10, default: 1 } } } },
            customer: { type: 'object', required: ['name', 'email', 'phone', 'address'], properties: { name: { type: 'string' }, email: { type: 'string', format: 'email' }, phone: { type: 'string' }, address: { allOf: [addressSchema], required: ['line1', 'city', 'postalCode'] } } },
            giftNote: { type: 'object', properties: { enabled: { type: 'boolean' }, name: { type: 'string', maxLength: 40 }, occasion: { type: 'string', maxLength: 40, example: 'eid' }, message: { type: 'string', maxLength: 160 } } },
          },
          example: { region: 'IN', paymentMethod: 'cod', items: [{ slug: 'zafreon', qty: 1 }], customer: { name: 'Mansi Shukla', email: 'mansi@example.com', phone: '+91 91259 19516', address: { line1: '12 Kamakhya Road', city: 'Lucknow', state: 'Uttar Pradesh', postalCode: '226010' } }, giftNote: { enabled: false } },
        },
        Order: { type: 'object', description: 'An order as its customer sees it (no internal notes or courier links).', properties: { _id: { type: 'string' }, orderNumber: { type: 'string', description: 'Immutable Order ID' }, trackingId: { type: 'string' }, status: { type: 'string', enum: ORDER_STATUSES }, stages: { type: 'array', items: { type: 'string' } }, history: { type: 'array', items: { type: 'object', properties: { status: { type: 'string' }, at: { type: 'string', format: 'date-time' }, note: { type: 'string' } } } }, items: { type: 'array', items: { type: 'object' } }, currency: { type: 'string' }, taxLabel: { type: 'string' }, subtotal: { type: 'number' }, shipping: { type: 'number' }, total: { type: 'number' }, paymentMethod: { type: 'string' }, paymentStatus: { type: 'string', enum: ['pending', 'paid', 'refunded'] }, customer: { type: 'object' }, giftNote: { type: 'object' }, carrier: { type: 'string' }, trackingNumber: { type: 'string' }, eta: { type: 'string' }, editable: { type: 'object', properties: { details: { type: 'boolean' }, items: { type: 'boolean' }, cancel: { type: 'boolean' } } }, edits: { type: 'array', items: { type: 'object' } } }, example: orderExample },
        AdminOrder: { type: 'object', description: 'Full order document for the team, including notes, carrierUrl, user id and edits.', additionalProperties: true, example: { ...orderExample, user: '6a1f0c2e9b1d4c0000000001', carrierUrl: 'https://www.delhivery.com/track-v2/package/26554968', notes: 'Customer asked for evening delivery', editable: undefined, edits: [{ at: '2026-09-29T08:00:00.000Z', by: 'customer', summary: 'Changed delivery details' }] } },
        Tracking: { type: 'object', properties: { orderNumber: { type: 'string' }, trackingId: { type: 'string' }, status: { type: 'string' }, stages: { type: 'array', items: { type: 'string' } }, history: { type: 'array', items: { type: 'object' } }, carrier: { type: 'string' }, trackingNumber: { type: 'string' }, eta: { type: 'string' }, items: { type: 'array', items: { type: 'object' } }, city: { type: 'string' }, country: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' } }, example: {"orderNumber":"AB-26K7Q2M","trackingId":"ABLK6KWBQJBS","status":"Shipped","stages":["Order Placed","Confirmed","Packed","Shipped","Out for Delivery","Delivered"],"history":[{"status":"Order Placed","at":"2026-09-29T07:23:06.000Z","note":"We have received your order."},{"status":"Shipped","at":"2026-09-30T10:00:00.000Z","note":"Dispatched from Hyderabad."}],"carrier":"Delhivery","trackingNumber":"26554968","eta":"3 October 2026","items":[{"slug":"zafreon","name":"ZAFREON","qty":1,"image":"/media/render-zafreon.webp"}],"city":"Lucknow","country":"India","createdAt":"2026-09-29T07:23:06.000Z"} },
        Review: { type: 'object', properties: { _id: { type: 'string' }, name: { type: 'string', example: 'Mansi S.' }, city: { type: 'string' }, country: { type: 'string' }, rating: { type: 'integer', minimum: 1, maximum: 5 }, title: { type: 'string' }, body: { type: 'string' }, reply: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' }, verified: { type: 'boolean' } } },
        Post: { type: 'object', additionalProperties: true, properties: { _id: { type: 'string' }, title: { type: 'string' }, slug: { type: 'string' }, excerpt: { type: 'string' }, content: { type: 'string', description: 'Markdown' }, category: { type: 'string' }, status: { type: 'string', enum: ['draft', 'published'] }, publishedAt: { type: 'string', format: 'date-time' } }, example: {"_id":"6a1f0c2e9b1d4c00000000bb","title":"The Art of Leaving a Signature","slug":"the-art-of-leaving-a-signature","excerpt":"Why fragrance is more than a scent.","category":"Brand Stories","status":"published","publishedAt":"2026-09-01T08:00:00.000Z","readingMinutes":4} },
        Paged: { type: 'object', properties: { items: { type: 'array', items: {} }, total: { type: 'integer' }, page: { type: 'integer' }, pages: { type: 'integer' }, limit: { type: 'integer' } }, example: {"items":["…"],"total":181,"page":1,"pages":4,"limit":50} },
        ImportJob: { type: 'object', properties: { id: { type: 'string' }, fileName: { type: 'string' }, status: { type: 'string', enum: ['previewed', 'committed', 'cancelled', 'expired', 'failed'] }, totals: { type: 'object', properties: { rows: { type: 'integer' }, updated: { type: 'integer' }, created: { type: 'integer' }, failed: { type: 'integer' }, skipped: { type: 'integer' }, warnings: { type: 'integer' } } }, errors: { type: 'array', items: { type: 'object' } }, errorsTotal: { type: 'integer' }, warnings: { type: 'array', items: { type: 'object' } }, changes: { type: 'array', items: { type: 'object' } }, changesTotal: { type: 'integer' }, expiresAt: { type: 'string', format: 'date-time' } }, example: {"id":"6a1f0c2e9b1d4c00000000cc","fileName":"orders_last_7_days.xlsx","status":"previewed","totals":{"rows":176,"updated":0,"created":0,"failed":1,"skipped":174,"warnings":0},"errors":[{"row":12,"orderId":"AB-26NOPE1","field":"Order ID","message":"No order has this Order ID. Check it for typos (Order IDs look like AB-26K7Q2M). New orders cannot be created from Excel; use Add Order."}],"errorsTotal":1,"warnings":[],"changes":[{"row":5,"orderNumber":"AB-26K7Q2M","diffs":[{"field":"Order Status","from":"Confirmed","to":"Shipped"},{"field":"Courier","from":"","to":"Delhivery"}]}],"changesTotal":1,"expiresAt":"2026-09-29T08:23:06.000Z"} },
      },
    },
    paths: {
      // ---------- health & settings ----------
      '/health': { get: { tags: ['Health & settings'], summary: 'Liveness check', responses: { 200: ok('OK', { type: 'object' }, { ok: true }) } } },
      '/settings': { get: { tags: ['Health & settings', 'Payments'], summary: 'Markets, currencies, delivery rules and payment methods', description: 'Payment methods per market are in `regions[].payments`: `cod` (cash on delivery, India) and `pay-on-confirmation` (the house confirms and sends a payment link). There is no card gateway yet, so no payment-intent API.', responses: { 200: ok('Regions', { type: 'object', properties: { regions: { type: 'array', items: ref('Region') } } }) } } },
      '/geo': { get: { tags: ['Health & settings'], summary: 'Visitor country from the edge network (for the default market)', responses: { 200: ok('Country or null', { type: 'object' }, { country: 'AE' }) } } },

      // ---------- auth ----------
      '/auth/register': { post: { tags: ['Auth'], summary: 'Create a customer account', requestBody: body({ type: 'object', required: ['name', 'email', 'password'], properties: { name: { type: 'string' }, email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8 } } }, { name: 'Mansi Shukla', email: 'mansi@example.com', password: 'a-long-password' }), responses: { 201: ok('Signed in', ref('AuthResult')), 400: E[400], 409: err('Email already registered') } } },
      '/auth/login': { post: { tags: ['Auth'], summary: 'Sign in', requestBody: body({ type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } }, { email: 'mansi@example.com', password: 'a-long-password' }), responses: { 200: ok('Signed in', ref('AuthResult')), 401: err('Email and password do not match') } } },
      '/auth/me': {
        get: { tags: ['Auth', 'Profile & address'], summary: 'The signed-in user', security: user, responses: { 200: ok('User', { type: 'object', properties: { user: ref('User') } }), 401: E[401] } },
        patch: { tags: ['Profile & address'], summary: 'Update name, phone and the saved delivery address', description: 'This is the address API: one saved address per account, used to fill checkout. `role` and `email` are ignored here.', security: user, requestBody: body({ type: 'object', properties: { name: { type: 'string', maxLength: 80 }, phone: { type: 'string', maxLength: 40 }, address: { allOf: [addressSchema, { type: 'object', properties: { region: { type: 'string', enum: ['IN', 'AE'] } } }] } } }, { phone: '+91 91259 19516', address: { line1: '12 Kamakhya Road', city: 'Lucknow', state: 'Uttar Pradesh', postalCode: '226010', region: 'IN' } }), responses: { 200: ok('Updated user', { type: 'object', properties: { user: ref('User') } }), 400: E[400], 401: E[401] } },
      },
      '/auth/me/email': { post: { tags: ['Profile & address'], summary: 'Change the sign-in email', description: 'Needs the current password. Guest orders under the old email are linked to the account first.', security: user, requestBody: body({ type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } } }), responses: { 200: ok('Updated user', { type: 'object', properties: { user: ref('User') } }), 400: E[400], 401: err('Wrong current password'), 409: err('Email in use'), 429: E[429] } } },
      '/auth/me/password': { post: { tags: ['Profile & address'], summary: 'Change password', security: user, requestBody: body({ type: 'object', required: ['current', 'next'], properties: { current: { type: 'string' }, next: { type: 'string', minLength: 8 } } }), responses: { 200: ok('Changed', { type: 'object' }, { ok: true }), 400: E[400], 401: err('Wrong current password'), 429: E[429] } } },

      // ---------- products ----------
      '/products': {
        get: {
          tags: ['Products'], summary: 'List, search, filter and sort products',
          description: 'Returns an array. Without parameters: every published product in shop order. Admins can add `all=1` to include hidden products.',
          parameters: [q('q', 'Search name, family, tagline, description, mood, occasions and notes', undefined, 'oud'), q('category', 'Exact category'), q('family', 'Olfactive family (case-insensitive)'), q('featured', '`1` for featured only'), q('inStock', '`1` to hide sold-out'), q('currency', 'Currency for price filters and sorting', { type: 'string', enum: ['INR', 'AED'] }), q('minPrice', 'Minimum price', { type: 'number' }), q('maxPrice', 'Maximum price', { type: 'number' }), q('sort', 'Order', { type: 'string', enum: ['price-asc', 'price-desc', 'newest', 'name'] }), q('limit', 'At most this many (1–100)', { type: 'integer' }), q('all', 'Admins: `1` includes hidden products')],
          responses: { 200: ok('Products', { type: 'array', items: ref('Product') }) },
        },
        post: { tags: ['Admin: catalogue & content'], summary: 'Create a product', security: admin, requestBody: body(ref('ProductInput')), responses: { 201: ok('Created', ref('Product')), 400: E[400], 401: E[401], 403: E[403], 409: err('Slug in use') } },
      },
      '/products/{slug}': { get: { tags: ['Products'], summary: 'One product with up to three related ones', parameters: [pathParam('slug', 'Product slug', 'zafreon')], responses: { 200: ok('Product', { type: 'object', properties: { product: ref('Product'), related: { type: 'array', items: ref('Product') } } }), 404: E[404] } } },
      '/products/{id}': {
        put: { tags: ['Admin: catalogue & content'], summary: 'Update a product (partial)', security: admin, parameters: [pathParam('id', 'Product id')], requestBody: body(ref('ProductInput')), responses: { 200: ok('Updated', ref('Product')), 400: E[400], 401: E[401], 403: E[403], 404: E[404] } },
        delete: { tags: ['Admin: catalogue & content'], summary: 'Delete a product', security: admin, parameters: [pathParam('id', 'Product id')], responses: { 200: ok('Deleted', { type: 'object' }, { ok: true }), 401: E[401], 403: E[403] } },
      },

      // ---------- cart & wishlist ----------
      '/cart': {
        get: { tags: ['Cart'], summary: 'The signed-in customer’s bag, priced by the server', security: user, parameters: [q('region', 'Market to price in (default: saved address, else IN)', { type: 'string' }, 'IN')], responses: { 200: ok('Cart', ref('Cart')), 401: E[401] } },
        put: { tags: ['Cart'], summary: 'Replace the whole bag', description: 'Duplicate slugs are merged, unknown or hidden products dropped, quantities capped at 10, at most 20 lines.', security: user, parameters: [q('region', 'Market to price in')], requestBody: body({ type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'object', properties: { slug: { type: 'string' }, qty: { type: 'integer' } } } } } }, { items: [{ slug: 'zafreon', qty: 2 }] }), responses: { 200: ok('Cart', ref('Cart')), 400: E[400], 401: E[401] } },
        delete: { tags: ['Cart'], summary: 'Empty the bag', security: user, responses: { 200: ok('Cart', ref('Cart')), 401: E[401] } },
      },
      '/cart/items': { post: { tags: ['Cart'], summary: 'Add a fragrance (adds to any quantity already in the bag)', security: user, parameters: [q('region', 'Market to price in')], requestBody: body({ type: 'object', required: ['slug'], properties: { slug: { type: 'string' }, qty: { type: 'integer', default: 1 } } }, { slug: 'zafreon', qty: 1 }), responses: { 201: ok('Cart', ref('Cart')), 400: E[400], 401: E[401], 404: E[404] } } },
      '/cart/items/{slug}': {
        patch: { tags: ['Cart'], summary: 'Set a line’s quantity (0 removes it)', security: user, parameters: [pathParam('slug', 'Product slug', 'zafreon'), q('region', 'Market to price in')], requestBody: body({ type: 'object', required: ['qty'], properties: { qty: { type: 'integer', minimum: 0, maximum: 10 } } }, { qty: 2 }), responses: { 200: ok('Cart', ref('Cart')), 401: E[401], 404: E[404] } },
        delete: { tags: ['Cart'], summary: 'Remove a line', security: user, parameters: [pathParam('slug', 'Product slug')], responses: { 200: ok('Cart', ref('Cart')), 401: E[401] } },
      },
      '/wishlist': { get: { tags: ['Wishlist'], summary: 'Saved fragrances', security: user, responses: { 200: ok('Wishlist', ref('Wishlist')), 401: E[401] } } },
      '/wishlist/{slug}': {
        post: { tags: ['Wishlist'], summary: 'Save a fragrance', security: user, parameters: [pathParam('slug', 'Product slug', 'zafreon')], responses: { 201: ok('Wishlist', ref('Wishlist')), 401: E[401], 404: E[404] } },
        delete: { tags: ['Wishlist'], summary: 'Remove a fragrance', security: user, parameters: [pathParam('slug', 'Product slug')], responses: { 200: ok('Wishlist', ref('Wishlist')), 401: E[401] } },
      },

      // ---------- checkout & orders ----------
      '/orders': {
        post: { tags: ['Checkout & orders'], summary: 'Place an order (checkout)', description: 'Works signed in (the order is linked to the account) or as a guest. Prices, delivery and totals are recalculated from the catalogue; stock is reserved atomically. Rate limited to 20 orders per 15 minutes per connection. A signed-in client should empty its cart afterwards (`DELETE /cart`).', security: [{}, { bearerAuth: [] }], requestBody: body(ref('OrderInput')), responses: { 201: ok('Placed', { type: 'object', properties: { orderNumber: { type: 'string' }, trackingId: { type: 'string' }, total: { type: 'number' }, currency: { type: 'string' } } }, { orderNumber: 'AB-26K7Q2M', trackingId: 'ABLK6KWBQJBS', total: 2898, currency: 'INR' }), 400: E[400], 409: err('Not enough stock'), 429: E[429] } },
        get: { tags: ['Admin: orders'], summary: 'List orders with filters', description: 'Without `paged=1`: the latest 200 as an array. With `paged=1`: `{ items, total, page, pages, limit }`.', security: admin, parameters: [...orderFilters, q('paged', '`1` for a paged response'), q('page', 'Page (from 1)', { type: 'integer' }), q('limit', 'Per page (1–200, default 50)', { type: 'integer' })], responses: { 200: ok('Orders', { oneOf: [{ type: 'array', items: ref('AdminOrder') }, ref('Paged')] }), 400: E[400], 401: E[401], 403: E[403] } },
      },
      '/orders/mine': { get: { tags: ['Checkout & orders'], summary: 'My orders, newest first', description: 'Orders placed while signed in, plus orders placed with the account’s email.', security: user, responses: { 200: ok('Orders', { type: 'array', items: ref('Order') }), 401: E[401] } } },
      '/orders/{orderId}': {
        get: { tags: ['Checkout & orders', 'Order status'], summary: 'One of my orders (details and live status)', description: 'By Order ID (any case) or id. Poll this for status changes. Someone else’s order returns 404. Admins can open any order.', security: user, parameters: [pathParam('orderId', 'Order ID or id', 'AB-26K7Q2M')], responses: { 200: ok('Order', ref('Order')), 401: E[401], 404: E[404] } },
      },
      '/orders/mine/{orderId}': {
        patch: {
          tags: ['Checkout & orders'], summary: 'Change my order before it ships',
          description: 'Delivery details and the gift card: while `editable.details` (Order Placed, Confirmed, Packed). Quantities: while `editable.items` (Order Placed or Confirmed, and unpaid); `qty: 0` removes a line, at least one item must remain. Stock and totals are recalculated.',
          security: user, parameters: [pathParam('orderId', 'Order ID or id')],
          requestBody: body({ type: 'object', properties: { customer: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' }, address: addressSchema } }, giftNote: { type: 'object' }, items: { type: 'array', items: { type: 'object', properties: { slug: { type: 'string' }, qty: { type: 'integer', minimum: 0, maximum: 10 } } } } } }, { customer: { address: { line2: 'Gate 2' } }, items: [{ slug: 'zafreon', qty: 2 }] }),
          responses: { 200: ok('Updated order', ref('Order')), 400: E[400], 401: E[401], 404: E[404], 409: err('Shipped, paid (items) or not enough stock') },
        },
      },
      '/orders/mine/{orderId}/cancel': { post: { tags: ['Checkout & orders'], summary: 'Cancel my order before it ships', description: 'Items go back into stock. For a paid order the note says a refund will be arranged.', security: user, parameters: [pathParam('orderId', 'Order ID or id')], requestBody: body({ type: 'object', properties: { reason: { type: 'string', maxLength: 200 } } }, { reason: 'I ordered by mistake' }, false), responses: { 200: ok('Cancelled order', ref('Order')), 401: E[401], 404: E[404], 409: err('Already shipped or cancelled') } } },
      '/orders/track/{trackingId}': { get: { tags: ['Order status'], summary: 'Public tracking with tracking ID and checkout email', parameters: [pathParam('trackingId', 'Tracking ID (any case)', 'ABLK6KWBQJBS'), { name: 'email', in: 'query', required: true, schema: { type: 'string', format: 'email' } }], responses: { 200: ok('Tracking', ref('Tracking')), 404: err('No order matches that tracking ID and email') } } },

      // ---------- admin orders ----------
      '/orders/admin': { post: { tags: ['Admin: orders'], summary: 'Place an order for a customer (phone/WhatsApp orders)', description: 'Same pricing and stock rules as checkout; linked to the account with that email.', security: admin, requestBody: body({ allOf: [ref('OrderInput'), { type: 'object', properties: { paymentStatus: { type: 'string', enum: ['pending', 'paid'] }, notes: { type: 'string' } } }] }), responses: { 201: ok('Order', ref('AdminOrder')), 400: E[400], 401: E[401], 403: E[403], 409: E[409] } } },
      '/orders/stats': { get: { tags: ['Admin: orders'], summary: 'Dashboard counts and order value (cancelled excluded from value)', security: admin, responses: { 200: ok('Stats', { type: 'object' }, { byStatus: [{ _id: 'Shipped', n: 4 }], revenue: [{ _id: 'INR', total: 152718 }], count: 181, stages: ORDER_STAGES }), 401: E[401], 403: E[403] } } },
      '/orders/{id}': {
        patch: {
          tags: ['Admin: orders', 'Order status'], summary: 'Update an order (status, courier, payment, customer details)',
          description: 'A new `status` adds a history entry with `note`. Setting `Cancelled` returns stock; reopening reserves it again (409 if not available). For couriers in the list the customer link is built from `trackingNumber`.',
          security: admin, parameters: [pathParam('id', 'Order id')],
          requestBody: body({ type: 'object', properties: { status: { type: 'string', enum: ORDER_STATUSES }, note: { type: 'string' }, carrier: { type: 'string' }, trackingNumber: { type: 'string' }, carrierUrl: { type: 'string' }, eta: { type: 'string' }, paymentStatus: { type: 'string', enum: ['pending', 'paid', 'refunded'] }, notes: { type: 'string' }, customer: { type: 'object' } } }, { status: 'Shipped', note: 'Dispatched from Hyderabad.', carrier: 'Delhivery', trackingNumber: '26554968', eta: '3 October 2026' }),
          responses: { 200: ok('Order', ref('AdminOrder')), 400: E[400], 401: E[401], 403: E[403], 404: E[404], 409: E[409] },
        },
      },

      // ---------- admin Excel ----------
      '/orders/export': { get: { tags: ['Admin: Excel'], summary: 'Export orders (.xlsx) with the list filters', security: admin, parameters: orderFilters, responses: { 200: xlsx('Workbook: Orders, Summary, Order Items, How to edit'), 400: E[400], 401: E[401], 403: E[403] } } },
      '/orders/template': { get: { tags: ['Admin: Excel'], summary: 'Order update template (.xlsx)', description: '`prefill=1` plus the list filters pre-fills one row per matching order with its Order ID and the editable columns blank.', security: admin, parameters: [q('prefill', '`1` to pre-fill with the filtered orders'), ...orderFilters], responses: { 200: xlsx('Template'), 401: E[401], 403: E[403] } } },
      '/orders/import/preview': { post: { tags: ['Admin: Excel'], summary: 'Upload and validate an .xlsx (nothing is saved)', security: admin, requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary', description: '.xlsx up to 4 MB, 20,000 rows' } } } } } }, responses: { 201: ok('Preview', ref('ImportJob')), 400: E[400], 401: E[401], 403: E[403], 413: err('File over 4 MB') } } },
      '/orders/imports': { get: { tags: ['Admin: Excel'], summary: 'Import history', security: admin, parameters: [q('limit', 'At most (default 50, max 200)', { type: 'integer' })], responses: { 200: ok('Imports', { type: 'array', items: ref('ImportJob') }), 401: E[401], 403: E[403] } } },
      '/orders/imports/{id}': { get: { tags: ['Admin: Excel'], summary: 'One import with its errors, warnings and changes', security: admin, parameters: [pathParam('id', 'Import id')], responses: { 200: ok('Import', ref('ImportJob')), 404: E[404] } } },
      '/orders/imports/{id}/commit': { post: { tags: ['Admin: Excel'], summary: 'Apply a preview (one transaction)', description: 'Only within an hour of the preview. Orders edited since the preview are reported as conflicts, not overwritten.', security: admin, parameters: [pathParam('id', 'Import id')], responses: { 200: ok('Result', ref('ImportJob')), 404: E[404], 409: err('Already applied or cancelled'), 410: err('Preview expired') } } },
      '/orders/imports/{id}/cancel': { post: { tags: ['Admin: Excel'], summary: 'Discard a preview', security: admin, parameters: [pathParam('id', 'Import id')], responses: { 200: ok('Cancelled', ref('ImportJob')), 409: E[409] } } },
      '/orders/imports/{id}/report': { get: { tags: ['Admin: Excel'], summary: 'Full import report (.xlsx)', security: admin, parameters: [pathParam('id', 'Import id')], responses: { 200: xlsx('Errors, Warnings and Changes sheets'), 404: E[404] } } },

      // ---------- admin users ----------
      '/users': { get: { tags: ['Admin: users'], summary: 'Registered users with lifetime and period order stats', security: admin, parameters: [q('q', 'Name, email or user id'), q('role', 'Role', { type: 'string', enum: ['customer', 'admin'] }), q('activity', 'Filter', { type: 'string', enum: ['ordered', 'registered', 'none'] }), q('sort', 'Sort', { type: 'string', enum: ['createdAt', 'name', 'email', 'orders', 'lastOrder', 'periodOrders'] }), q('dir', 'Direction', { type: 'string', enum: ['asc', 'desc'] }), q('page', 'Page', { type: 'integer' }), q('limit', 'Per page (1–100, default 25)', { type: 'integer' }), q('period', 'Period for the period stats', { type: 'string' }), q('from', 'Custom start'), q('to', 'Custom end'), q('tz', 'Offset minutes', { type: 'integer' })], responses: { 200: ok('Users', ref('Paged')), 400: E[400], 401: E[401], 403: E[403] } } },
      '/users/{id}': { get: { tags: ['Admin: users'], summary: 'One user with all their orders', security: admin, parameters: [pathParam('id', 'User id')], responses: { 200: ok('User and orders', { type: 'object' }, {"user":{"id":"6a1f0c2e9b1d4c0000000001","name":"Mansi Shukla","email":"mansi@example.com","role":"customer","status":"Customer (has ordered)","createdAt":"2026-09-01T10:00:00.000Z","phone":"+91 91259 19516","address":{"line1":"12 Kamakhya Road","city":"Lucknow","state":"Uttar Pradesh","postalCode":"226010","country":"India"},"lifetime":{"orders":3,"value":{"INR":8395,"AED":0},"first":"2026-09-02T10:00:00.000Z","last":"2026-09-29T07:23:06.000Z"},"period":{"orders":3,"value":{"INR":8395,"AED":0}}},"orders":["… full order documents, newest first"],"period":{"key":"all","label":"All time"}}), 404: E[404] } } },
      '/users/export/xlsx': { get: { tags: ['Admin: users', 'Admin: Excel'], summary: 'Users report (.xlsx): Users Summary + User Orders', security: admin, parameters: [q('q', 'Search'), q('role', 'Role'), q('activity', 'Activity'), q('period', 'Period'), q('from', 'Custom start'), q('to', 'Custom end'), q('tz', 'Offset minutes', { type: 'integer' })], responses: { 200: xlsx('Users report'), 401: E[401], 403: E[403] } } },

      // ---------- reviews ----------
      '/reviews': {
        post: { tags: ['Reviews'], summary: 'Review a delivered fragrance', description: 'Proven by tracking ID + checkout email. One review per product per order; published after the house approves it. Rate limited (10/hour).', requestBody: body({ type: 'object', required: ['trackingId', 'email', 'slug', 'rating', 'body'], properties: { trackingId: { type: 'string' }, email: { type: 'string' }, slug: { type: 'string' }, rating: { type: 'integer', minimum: 1, maximum: 5 }, title: { type: 'string', maxLength: 80 }, body: { type: 'string', minLength: 20, maxLength: 1200 } } }), responses: { 201: ok('Received', { type: 'object' }, {"ok":true,"message":"Thank you. Your review will appear once the house has read it."}), 400: E[400], 404: E[404], 409: err('Already reviewed'), 429: E[429] } },
        get: { tags: ['Reviews'], summary: 'Admin: reviews to moderate', security: admin, parameters: [q('status', 'Status', { type: 'string', enum: ['pending', 'approved', 'rejected'] })], responses: { 200: ok('Reviews', { type: 'array', items: { type: 'object' } }, [{"_id":"6a1f0c2e9b1d4c00000000aa","product":"6a1f0c2e9b1d4c0012345678","slug":"zafreon","order":"6a1f0c2e9b1d4c00abcdef01","orderNumber":"AB-26K7Q2M","name":"Mansi S.","city":"Lucknow","country":"India","rating":5,"title":"Wonderful","body":"Rich saffron opening, lasts all day.","status":"pending","reply":"","createdAt":"2026-10-05T09:00:00.000Z"}]), 401: E[401], 403: E[403] } },
      },
      '/reviews/product/{slug}': { get: { tags: ['Reviews'], summary: 'Approved reviews and rating for a product', parameters: [pathParam('slug', 'Product slug')], responses: { 200: ok('Reviews', { type: 'object', properties: { average: { type: 'number' }, count: { type: 'integer' }, items: { type: 'array', items: ref('Review') } } }) } } },
      '/reviews/eligible/{trackingId}': { get: { tags: ['Reviews'], summary: 'Which fragrances of a delivered order can still be reviewed', parameters: [pathParam('trackingId', 'Tracking ID'), { name: 'email', in: 'query', required: true, schema: { type: 'string' } }], responses: { 200: ok('Eligibility', { type: 'object' }, {"delivered":true,"items":[{"slug":"zafreon","name":"ZAFREON","image":"/media/render-zafreon.webp","reviewed":false}]}), 404: E[404] } } },
      '/reviews/{id}': { patch: { tags: ['Reviews'], summary: 'Admin: approve / hide / reply', security: admin, parameters: [pathParam('id', 'Review id')], requestBody: body({ type: 'object', properties: { status: { type: 'string', enum: ['pending', 'approved', 'rejected'] }, reply: { type: 'string', maxLength: 600 } } }), responses: { 200: ok('Review', { type: 'object' }, {"_id":"6a1f0c2e9b1d4c00000000aa","product":"6a1f0c2e9b1d4c0012345678","slug":"zafreon","order":"6a1f0c2e9b1d4c00abcdef01","orderNumber":"AB-26K7Q2M","name":"Mansi S.","city":"Lucknow","country":"India","rating":5,"title":"Wonderful","body":"Rich saffron opening, lasts all day.","status":"approved","reply":"Thank you, Mansi.","createdAt":"2026-10-05T09:00:00.000Z"}), 404: E[404] } } },

      // ---------- journal ----------
      '/posts': {
        get: { tags: ['Journal'], summary: 'Published articles (paged)', parameters: [q('category', 'Category'), q('q', 'Search title, excerpt, tags'), q('page', 'Page', { type: 'integer' }), q('limit', 'Per page (max 50)', { type: 'integer' }), q('all', 'Admins: `1` includes drafts')], responses: { 200: ok('Posts', ref('Paged')) } },
        post: { tags: ['Admin: catalogue & content'], summary: 'Create an article', security: admin, requestBody: body(ref('Post')), responses: { 201: ok('Created', ref('Post')), 400: E[400], 401: E[401], 403: E[403] } },
      },
      '/posts/categories': { get: { tags: ['Journal'], summary: 'Categories with published articles', responses: { 200: ok('Categories', { type: 'array', items: { type: 'string' } }) } } },
      '/posts/{slug}': { get: { tags: ['Journal'], summary: 'Article with related articles and products', parameters: [pathParam('slug', 'Article slug')], responses: { 200: ok('Article', { type: 'object' }, {"post":{"_id":"6a1f0c2e9b1d4c00000000bb","title":"The Art of Leaving a Signature","slug":"the-art-of-leaving-a-signature","excerpt":"Why fragrance is more than a scent.","content":"## A signature…","category":"Brand Stories","status":"published","publishedAt":"2026-09-01T08:00:00.000Z","readingMinutes":4},"related":[{"_id":"6a1f0c2e9b1d4c00000000be","title":"From Passion to Perfume House","slug":"from-passion-to-perfume-house","excerpt":"Why fragrance is more than a scent.","category":"Brand Stories","status":"published","publishedAt":"2026-09-01T08:00:00.000Z","readingMinutes":4}],"products":["… related product documents"]}), 404: E[404] } } },
      '/posts/id/{id}': { get: { tags: ['Admin: catalogue & content'], summary: 'Article by id (drafts included)', security: admin, parameters: [pathParam('id', 'Post id')], responses: { 200: ok('Post', ref('Post')), 404: E[404] } } },
      '/posts/{id}': {
        put: { tags: ['Admin: catalogue & content'], summary: 'Update an article', security: admin, parameters: [pathParam('id', 'Post id')], requestBody: body(ref('Post')), responses: { 200: ok('Post', ref('Post')), 404: E[404] } },
        delete: { tags: ['Admin: catalogue & content'], summary: 'Delete an article', security: admin, parameters: [pathParam('id', 'Post id')], responses: { 200: ok('Deleted', { type: 'object' }, {"ok":true}) } },
      },

      // ---------- contact ----------
      '/enquiries': {
        post: { tags: ['Contact'], summary: 'Send a message to the house', description: 'Shares a limit of 10 per 15 minutes with /subscribers.', requestBody: body({ type: 'object', required: ['name', 'email', 'message'], properties: { name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, topic: { type: 'string' }, message: { type: 'string', maxLength: 3000 } } }), responses: { 201: ok('Sent', { type: 'object' }, {"ok":true}), 400: E[400], 429: E[429] } },
        get: { tags: ['Contact'], summary: 'Admin: enquiries', security: admin, responses: { 200: ok('Enquiries', { type: 'array', items: { type: 'object' } }, [{"_id":"6a1f0c2e9b1d4c00000000dd","name":"Zara","email":"zara@example.com","phone":"+91 90000 00000","topic":"Gifting & corporate orders","message":"Do you gift wrap for Eid?","status":"new","createdAt":"2026-09-29T09:00:00.000Z"}]) } },
      },
      '/enquiries/{id}': { patch: { tags: ['Contact'], summary: 'Admin: set enquiry status', security: admin, parameters: [pathParam('id', 'Enquiry id')], requestBody: body({ type: 'object', properties: { status: { type: 'string', enum: ['new', 'replied', 'closed'] } } }), responses: { 200: ok('Enquiry', { type: 'object' }, {"_id":"6a1f0c2e9b1d4c00000000dd","name":"Zara","email":"zara@example.com","phone":"+91 90000 00000","topic":"Gifting & corporate orders","message":"Do you gift wrap for Eid?","status":"replied","createdAt":"2026-09-29T09:00:00.000Z"}), 400: E[400], 404: E[404] } } },
      '/subscribers': {
        post: { tags: ['Contact'], summary: 'Join the newsletter (idempotent)', requestBody: body({ type: 'object', required: ['email'], properties: { email: { type: 'string' }, source: { type: 'string' } } }), responses: { 201: ok('Subscribed', { type: 'object' }, {"ok":true}), 400: E[400], 429: E[429] } },
        get: { tags: ['Contact'], summary: 'Admin: subscribers', security: admin, responses: { 200: ok('Subscribers', { type: 'array', items: { type: 'object' } }, [{"_id":"6a1f0c2e9b1d4c00000000ee","email":"reader@example.com","source":"footer","createdAt":"2026-09-29T09:00:00.000Z"}]) } },
      },

      // ---------- uploads ----------
      '/uploads': { post: { tags: ['Uploads'], summary: 'Upload an image (admin)', description: 'JPG, PNG, WebP or AVIF up to 4 MB. Stored on Cloudinary when configured on the server, otherwise in MongoDB (served from /uploads/{name}). Returns the URL to save on the product or article.', security: admin, requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } }, responses: { 201: ok('Uploaded', { type: 'object' }, { src: 'https://res.cloudinary.com/dch8n8kxm/image/upload/albarakah/zafreon-bottle-k2x9q.webp', storage: 'cloud' }), 400: E[400], 401: E[401], 403: E[403], 413: err('Over 4 MB'), 502: err('Cloud storage rejected the upload') } } },
    },
  };
}

// Swagger UI page for /api/docs (assets from the jsDelivr CDN).
export const docsPage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>AL BARAKAH LIFESTYLE API</title><meta name="robots" content="noindex">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css">
<style>body{margin:0;background:#fafafa}.topbar{display:none}</style></head>
<body><div id="ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
<script>window.ui = SwaggerUIBundle({ url: '/api/openapi.json', dom_id: '#ui', persistAuthorization: true, tryItOutEnabled: false });</script>
</body></html>`;
