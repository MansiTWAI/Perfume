// The only things the shopping concierge can do. Gemini picks a tool and
// arguments; every argument is validated here, every query is written by us
// (never by the model), and results carry only what a shopper may see.
// Contact details never travel to the model: lead and order tools read them
// from the chat session on the server.
import mongoose from 'mongoose';
import Product from '../../models/Product.js';
import Order from '../../models/Order.js';
import Lead, { LEAD_INTENTS, scoreLead } from '../../models/Lead.js';
import { statusKey } from '../../config/commerce.js';
import { escapeRegex } from '../../utils.js';
import { policy, POLICY_TOPICS, CONTACT } from './policies.js';

// ----- validation helpers -----
const str = (v, max = 120) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const num = (v, min, max) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(/[^\d.]/g, '')) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};
const oneOf = (v, list) => (list.includes(v) ? v : undefined);
const slugOf = (v) => (typeof v === 'string' && /^[a-z0-9-]{1,90}$/.test(v.trim().toLowerCase()) ? v.trim().toLowerCase() : '');

const availability = (stock) => (stock > 5 ? 'in_stock' : stock > 0 ? 'only_a_few_left' : 'out_of_stock');
const names = (list) => (list || []).map((n) => n.name).filter(Boolean);

function card(p, ctx) {
  const price = p.price?.[ctx.currency];
  if (typeof price === 'number') ctx.prices.add(price);
  ctx.cards.set(p.slug, { slug: p.slug, name: p.name, subtitle: p.subtitle || '', price, currency: ctx.currency, image: p.images?.[0]?.src || '', availability: availability(p.stock) });
  return {
    slug: p.slug, name: p.name, subtitle: p.subtitle, family: p.family, gender: p.gender,
    price, currency: ctx.currency, availability: availability(p.stock), size: p.sizeLabel, longevity: p.longevity || undefined,
    notes: { top: names(p.notes?.top), heart: names(p.notes?.heart), base: names(p.notes?.base) },
    mood: p.mood?.slice(0, 5), occasions: p.occasions?.slice(0, 5), summary: str(p.tagline || p.description, 220),
  };
}

const PUBLIC = { published: true };
const FIELDS = 'slug name subtitle family gender price stock sizeLabel longevity notes mood occasions tagline description images featured sortOrder';

// ----- declarations (what Gemini sees) -----
const S = (description, properties = {}, required = []) => ({ type: 'object', description, properties, required });
export const CUSTOMER_TOOLS = [
  {
    name: 'searchProducts',
    description: 'Search the fragrances on sale by words (notes, mood, family, occasion, name) and/or price range in the shopper currency. Returns real products with live prices and availability.',
    parameters: S('Search filters', {
      query: { type: 'string', description: 'Words to match, e.g. "oud", "fresh office", "rose gift"' },
      maxPrice: { type: 'number' }, minPrice: { type: 'number' },
      gender: { type: 'string', enum: ['men', 'women', 'unisex'] },
    }),
  },
  { name: 'getProductDetails', description: 'Full details of one fragrance by its slug (from search results).', parameters: S('Product', { slug: { type: 'string' } }, ['slug']) },
  { name: 'getAvailableProducts', description: 'Every fragrance currently on sale, with prices and availability.', parameters: S('No arguments') },
  {
    name: 'getOrderStatus',
    description: 'Status of an order. Works for a signed-in shopper\'s own orders, or with the tracking ID (ABL…) once the shopper has typed the email used at checkout in this chat (it is kept private from you; you will see [email shared]).',
    parameters: S('Order reference', { trackingId: { type: 'string', description: 'ABL… tracking ID' }, orderNumber: { type: 'string', description: 'AB-… order number (signed-in shoppers)' } }),
  },
  { name: 'getStorePolicy', description: 'Official store facts on a topic. Use before answering any delivery, returns, payment, tracking, gifting, order-change or contact question.', parameters: S('Topic', { topic: { type: 'string', enum: POLICY_TOPICS } }, ['topic']) },
  {
    name: 'createLead',
    description: 'Record buying interest when the shopper shows purchase intent (wants to buy, asks about bulk/gifting quantities, budget, or a callback). Contact details the shopper typed are attached automatically; never invent them.',
    parameters: S('What the shopper said', {
      name: { type: 'string', description: 'First name if the shopper gave it' },
      interestedProducts: { type: 'array', items: { type: 'string' }, description: 'Product slugs' },
      budget: { type: 'number', description: 'Budget in the shopper currency' },
      useCase: { type: 'string', description: 'Occasion / for whom, short' },
      quantity: { type: 'integer' },
      intent: { type: 'string', enum: LEAD_INTENTS },
      wantsCallback: { type: 'boolean' },
      summary: { type: 'string', description: 'One short line on what they want' },
    }),
  },
  { name: 'updateLead', description: 'Update the buying-interest record of this conversation with new details (same fields as createLead).', parameters: null },
  {
    name: 'humanHandoff',
    description: 'Connect the shopper with a person (WhatsApp, email or a callback) when they ask for a human, when you cannot help, or for complaints, damaged items and refunds.',
    parameters: S('Handoff', { reason: { type: 'string' }, channel: { type: 'string', enum: ['whatsapp', 'email', 'callback'] } }, ['reason']),
  },
];
CUSTOMER_TOOLS.find((t) => t.name === 'updateLead').parameters = CUSTOMER_TOOLS.find((t) => t.name === 'createLead').parameters;

// ----- implementations -----
async function searchProducts(a, ctx) {
  const filter = { ...PUBLIC };
  const words = str(a.query, 80).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2).slice(0, 6);
  if (words.length) {
    const rx = new RegExp(words.map(escapeRegex).join('|'), 'i');
    filter.$or = ['name', 'family', 'tagline', 'description', 'mood', 'occasions', 'notes.top.name', 'notes.heart.name', 'notes.base.name'].map((f) => ({ [f]: rx }));
  }
  const max = num(a.maxPrice, 0, 1e7);
  const min = num(a.minPrice, 0, 1e7);
  if (max !== undefined || min !== undefined) filter[`price.${ctx.currency}`] = { ...(min !== undefined && { $gte: min }), ...(max !== undefined && { $lte: max }) };
  const gender = oneOf(a.gender, ['men', 'women', 'unisex']);
  if (gender && gender !== 'unisex') filter.gender = { $in: [gender, 'unisex'] };
  const found = await Product.find(filter).select(FIELDS).sort({ featured: -1, sortOrder: 1 }).limit(6).lean();
  if (!found.length) return { results: [], note: 'Nothing on sale matches. Say so honestly and offer the closest alternatives from getAvailableProducts.' };
  return { results: found.map((p) => card(p, ctx)) };
}

async function getProductDetails(a, ctx) {
  const slug = slugOf(a.slug);
  const p = slug && (await Product.findOne({ ...PUBLIC, slug }).lean());
  if (!p) return { error: 'No fragrance with that slug is on sale. Use searchProducts.' };
  return {
    ...card(p, ctx), tagline: p.tagline, description: str(p.description, 700), howToWear: str(p.howToWear, 300),
    faq: (p.faq || []).slice(0, 4).map((f) => ({ q: str(f.q, 160), a: str(f.a, 300) })), includes: p.includes?.slice(0, 6), page: `/fragrances/${p.slug}`,
  };
}

async function getAvailableProducts(_a, ctx) {
  const all = await Product.find({ ...PUBLIC, stock: { $gt: 0 } }).select(FIELDS).sort({ featured: -1, sortOrder: 1 }).limit(20).lean();
  return { results: all.map((p) => card(p, ctx)) };
}

async function getOrderStatus(a, ctx) {
  const trackingId = str(a.trackingId, 20).toUpperCase();
  const orderNumber = str(a.orderNumber, 20).toUpperCase();
  if (ctx.session.orderLookups >= 6) return { error: 'Too many lookups in this chat. Ask the shopper to use the Track Order page or WhatsApp.' };
  ctx.session.orderLookups = (ctx.session.orderLookups || 0) + 1;
  let order = null;
  const ref = trackingId && /^ABL[A-Z0-9]{6,12}$/.test(trackingId) ? { trackingId } : orderNumber && /^AB-[A-Z0-9]{4,12}$/.test(orderNumber) ? { orderNumber } : null;
  if (ref && ctx.user) order = await Order.findOne({ $and: [ref, { $or: [{ user: ctx.user._id }, { 'customer.email': ctx.user.email }] }] }).lean();
  if (!order && ref?.trackingId && ctx.session.contact?.email) order = await Order.findOne({ trackingId: ref.trackingId, 'customer.email': ctx.session.contact.email }).lean();
  if (!order) {
    return { error: ctx.user ? 'No order of this signed-in shopper matches.' : 'Not found. Ask for the tracking ID (ABL…) and the email used at checkout, or point to the Track Order page.' };
  }
  const last = [...(order.history || [])].reverse().find((h) => h.note);
  return {
    orderNumber: order.orderNumber, status: order.status, statusKey: statusKey(order), paymentStatus: order.paymentStatus,
    latestUpdate: str(last?.note, 200) || undefined, carrier: order.carrier || undefined, eta: order.eta || undefined,
    items: (order.items || []).map((i) => `${i.name} × ${i.qty}`), page: '/track',
  };
}

async function getStorePolicy(a) {
  const topic = oneOf(a.topic, POLICY_TOPICS) || 'contact';
  return { topic, ...policy(topic) };
}

// One lead per chat; an open lead with the same email/phone is reused.
export async function upsertLead(ctx, fields = {}) {
  const { session } = ctx;
  let lead = session.lead ? await Lead.findById(session.lead) : null;
  const { email, phone } = session.contact || {};
  if (!lead && (email || phone)) {
    lead = await Lead.findOne({
      $or: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
      status: { $in: ['NEW', 'CONTACTED', 'QUALIFIED'] },
      updatedAt: { $gte: new Date(Date.now() - 60 * 24 * 3600 * 1000) },
    });
  }
  if (!lead && ctx.user) lead = await Lead.findOne({ user: ctx.user._id, status: { $in: ['NEW', 'CONTACTED', 'QUALIFIED'] } });
  lead ||= new Lead({ region: ctx.region });
  if (!lead.sessionIds.includes(session.sessionId)) lead.sessionIds.push(session.sessionId);
  if (ctx.user && !lead.user) lead.user = ctx.user._id;
  // A signed-in shopper is known: take the contact from their account
  // (server-side only; never sent to the model).
  if (ctx.user) {
    if (!lead.name && ctx.user.name) lead.name = String(ctx.user.name).slice(0, 80);
    if (!lead.email && ctx.user.email) lead.email = ctx.user.email;
    if (!lead.phone && ctx.user.phone) lead.phone = String(ctx.user.phone).slice(0, 20);
  }
  if (email) lead.email = email;
  if (phone) lead.phone = phone;
  if (fields.name) lead.name = fields.name;
  if (fields.interestedProducts?.length) lead.interestedProducts = [...new Set([...(lead.interestedProducts || []), ...fields.interestedProducts])].slice(0, 10);
  if (fields.budget) lead.budget = { amount: fields.budget, currency: ctx.currency };
  if (fields.useCase) lead.useCase = fields.useCase;
  if (fields.quantity) lead.quantity = fields.quantity;
  // Intent only moves up within a conversation.
  if (fields.intent && LEAD_INTENTS.indexOf(fields.intent) > LEAD_INTENTS.indexOf(lead.intent)) lead.intent = fields.intent;
  if (fields.wantsCallback) lead.wantsCallback = true;
  if (fields.summary) lead.summary = fields.summary;
  if (fields.handoff) lead.handoff = { reason: fields.handoff, at: new Date() };
  lead.lastInteractionAt = new Date();
  lead.score = scoreLead(lead);
  await lead.save();
  session.lead = lead._id;
  ctx.leadSaved = true;
  return lead;
}

async function saveLead(a, ctx) {
  const products = [];
  for (const s of (Array.isArray(a.interestedProducts) ? a.interestedProducts : []).slice(0, 6)) {
    const slug = slugOf(s);
    if (slug && (await Product.exists({ ...PUBLIC, slug }))) products.push(slug);
  }
  const lead = await upsertLead(ctx, {
    name: str(a.name, 60).replace(/[^\p{L}\s.'-]/gu, ''),
    interestedProducts: products,
    budget: num(a.budget, 1, 1e7),
    useCase: str(a.useCase, 160),
    quantity: num(a.quantity, 1, 100),
    intent: oneOf(a.intent, LEAD_INTENTS),
    wantsCallback: a.wantsCallback === true,
    summary: str(a.summary, 300),
  });
  return { saved: true, haveEmail: !!lead.email, havePhone: !!lead.phone, note: lead.email || lead.phone ? 'Contact on file.' : 'If the shopper wants us to follow up, they may share an email or phone (optional).' };
}

async function humanHandoff(a, ctx) {
  const reason = str(a.reason, 200) || 'Asked for a person';
  const channel = oneOf(a.channel, ['whatsapp', 'email', 'callback']) || 'whatsapp';
  await upsertLead(ctx, { handoff: reason, wantsCallback: channel === 'callback', intent: 'considering' });
  ctx.actions.push({ type: 'handoff', channel, whatsapp: `${CONTACT.whatsappLink}?text=${encodeURIComponent('Hello Al Barakah, I was chatting with your concierge and would like some help.')}`, email: CONTACT.email });
  return { ok: true, whatsapp: CONTACT.whatsapp, email: CONTACT.email, callback: channel === 'callback' ? (ctx.session.contact?.phone ? 'Phone on file; the team will call.' : 'Ask for a phone number (optional) so the team can call.') : undefined };
}

const RUN = { searchProducts, getProductDetails, getAvailableProducts, getOrderStatus, getStorePolicy, createLead: saveLead, updateLead: saveLead, humanHandoff };

export async function runCustomerTool(name, args, ctx) {
  const fn = RUN[name];
  if (!fn) return { error: 'Unknown tool.' };
  const safeArgs = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
  try {
    return await fn(safeArgs, ctx);
  } catch (e) {
    if (e instanceof mongoose.Error) console.error(JSON.stringify({ scope: 'ai', event: 'tool_error', tool: name, reason: e.name }));
    else console.error(JSON.stringify({ scope: 'ai', event: 'tool_error', tool: name }));
    return { error: 'That lookup failed. Apologise briefly and offer WhatsApp help.' };
  }
}
