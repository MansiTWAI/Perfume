// Admin: WhatsApp notifications (/api/admin/whatsapp/...). Mounted inside the
// admin router, so staff sign-in and the audit log already apply.
//   GET   /status                    set-up state and subscriber counts
//   GET   /contacts                  subscribers (search, AI leads only, unsubscribed)
//   PATCH /contacts/:id              unsubscribe someone (never re-subscribe: that is the customer's choice)
//   POST  /campaigns                 notify all subscribers or selected customers
//   GET   /campaigns                 history with delivery counts
//   GET   /campaigns/:id             one notification and every recipient's status
//   POST  /campaigns/:id/retry       send failed messages again
//   POST  /messages/:id/retry        send one failed message again
//   POST  /campaigns/:id/cancel      cancel a scheduled notification
//   POST  /audience                  how many people an audience reaches
//   GET   /options                   products (with WhatsApp-ready pictures) and usable coupons
//   POST  /preview                   a notification filled in for one customer, with problems/warnings
//   GET/POST/PUT/DELETE /templates   saved notifications; /templates/:id/duplicate, PATCH active
//   POST  /templates/generate        an AI draft to edit (never sends or saves)
import { Router } from 'express';
import mongoose from 'mongoose';
import { requireRole, asyncHandler } from '../middleware/auth.js';
import WhatsAppContact from '../models/WhatsAppContact.js';
import WhatsAppMessage, { WhatsAppCampaign, WA_MESSAGE_STATUSES } from '../models/WhatsAppMessage.js';
import Lead from '../models/Lead.js';
import { escapeRegex } from '../utils.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import NotificationTemplate, { TEMPLATE_VARIABLES } from '../models/NotificationTemplate.js';
import { whatsappNotifyConfigured, mediaTemplate, createCampaign, cancelCampaign, audienceCount, campaignCounts, retryFailed, unsubscribe, renderBody, MAX_SELECTED } from '../services/whatsapp.js';
import { readContent, loadRefs, render, whatsappImages, discountText, aiDraft } from '../services/notifyContent.js';
import { usableIn } from '../services/coupons.js';

const r = Router();
const MANAGE = ['manager'];
const SERVE = ['manager', 'support'];
const validId = (id) => mongoose.isValidObjectId(id);
const page = (q, fallback = 25) => {
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || fallback, 1), 100);
  return { limit, page: Math.max(parseInt(q.page, 10) || 1, 1) };
};
const paged = (items, total, p) => ({ items, total, page: p.page, pages: Math.max(1, Math.ceil(total / p.limit)), limit: p.limit });

r.get(
  '/status',
  requireRole(...SERVE),
  asyncHandler(async (_req, res) => {
    const monthAgo = new Date(Date.now() - 30 * 864e5);
    const [subscribed, unsubscribed, leads, joined, left, templates, scheduled, last] = await Promise.all([
      WhatsAppContact.countDocuments({ subscribed: true }),
      WhatsAppContact.countDocuments({ subscribed: false }),
      WhatsAppContact.countDocuments({ subscribed: true, lead: { $ne: null } }),
      WhatsAppContact.countDocuments({ subscribed: true, subscribedAt: { $gte: monthAgo } }),
      WhatsAppContact.countDocuments({ subscribed: false, unsubscribedAt: { $gte: monthAgo } }),
      NotificationTemplate.countDocuments({ active: true }),
      WhatsAppCampaign.countDocuments({ scheduledAt: { $gt: new Date() }, cancelledAt: null, finishedAt: null }),
      WhatsAppCampaign.find({ createdAt: { $gte: monthAgo }, cancelledAt: null }).select('_id').lean(),
    ]);
    // Delivery over the last 30 days.
    const counts = await campaignCounts(last.map((c) => c._id));
    const sum = { sent: 0, delivered: 0, read: 0, failed: 0 };
    for (const c of Object.values(counts)) for (const k of Object.keys(sum)) sum[k] += c[k] || 0;
    const out = sum.sent + sum.delivered + sum.read;
    res.json({
      configured: whatsappNotifyConfigured(),
      account: !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
      template: process.env.WHATSAPP_NOTIFY_TEMPLATE || null,
      mediaTemplate: mediaTemplate() || null,
      codesTemplate: !!process.env.WHATSAPP_OTP_TEMPLATE,
      statusUpdates: !!process.env.WHATSAPP_APP_SECRET,
      webhookVerify: !!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      greeting: renderBody('', 'Aisha').trim().replace(/,$/, ''), // how the message opens, e.g. "Hello Aisha"
      subscribed,
      unsubscribed,
      leads,
      month: { joined, left, notifications: last.length, ...sum, deliveredRate: out ? Math.round(((sum.delivered + sum.read) / (out + sum.failed)) * 100) : null, readRate: out ? Math.round((sum.read / (out + sum.failed)) * 100) : null },
      templates,
      scheduled,
      maxSelected: MAX_SELECTED,
      variables: TEMPLATE_VARIABLES,
    });
  })
);

// What the team needs to pick people: who they are and, for AI leads, what they wanted.
async function withLeads(contacts) {
  const ids = contacts.map((c) => c.lead).filter(Boolean);
  const leads = ids.length ? await Lead.find({ _id: { $in: ids } }).select('name score status intent interestedProducts lastInteractionAt').lean() : [];
  const byId = new Map(leads.map((l) => [String(l._id), l]));
  return contacts.map((c) => {
    const l = c.lead && byId.get(String(c.lead));
    return {
      ...c.toAdmin(),
      lead: l ? { id: String(l._id), score: l.score, status: l.status, intent: l.intent, interestedProducts: l.interestedProducts || [], lastInteractionAt: l.lastInteractionAt } : null,
    };
  });
}

r.get(
  '/contacts',
  requireRole(...SERVE),
  asyncHandler(async (req, res) => {
    const p = page(req.query, 25);
    const filter = {};
    if (req.query.status !== 'all') filter.subscribed = req.query.status !== 'unsubscribed';
    if (req.query.leads === '1') filter.lead = { $ne: null };
    // ?ids=a,b: these people (e.g. "Notify" from an AI lead).
    const ids = String(req.query.ids || '').split(',').filter((x) => validId(x)).slice(0, 100);
    if (ids.length) filter._id = { $in: ids };
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      const digits = q.replace(/\D/g, '');
      filter.$or = [{ name: rx }, { email: rx }, ...(digits.length >= 3 ? [{ phone: new RegExp(escapeRegex(digits)) }] : [])];
    }
    const [items, total] = await Promise.all([
      WhatsAppContact.find(filter).sort({ subscribedAt: -1, _id: -1 }).skip((p.page - 1) * p.limit).limit(p.limit),
      WhatsAppContact.countDocuments(filter),
    ]);
    res.json(paged(await withLeads(items), total, p));
  })
);

r.patch(
  '/contacts/:id',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const c = validId(req.params.id) && (await WhatsAppContact.findById(req.params.id));
    if (!c) return res.status(404).json({ message: 'Subscriber not found.' });
    if (req.body?.subscribed !== false) return res.status(400).json({ message: 'Only the customer can subscribe. You can unsubscribe them here.' });
    await unsubscribe(c.phone, 'admin');
    res.json((await withLeads([await WhatsAppContact.findById(c._id)]))[0]);
  })
);

const campaignView = (c, counts = {}) => {
  const n = (k) => counts[k] || 0;
  return {
    id: c._id,
    title: c.title || '',
    message: c.message,
    product: c.product || '',
    image: c.image || '',
    coupon: c.coupon || '',
    cta: c.cta?.path || c.product || c.coupon ? { label: c.cta?.label || 'Shop Now', path: c.cta?.path || '' } : null,
    templateName: c.templateName || '',
    audience: c.audience,
    template: c.template,
    scheduledAt: c.scheduledAt || null,
    cancelledAt: c.cancelledAt || null,
    problem: c.problem || '',
    createdBy: c.createdByEmail || '',
    createdAt: c.createdAt,
    finishedAt: c.finishedAt || null,
    recipients: c.recipients,
    counts: {
      waiting: n('queued') + n('sending'),
      sent: n('sent'),
      delivered: n('delivered'),
      read: n('read'),
      failed: n('failed'),
      skipped: n('skipped'),
    },
  };
};

r.post(
  '/campaigns',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    try {
      if (b.confirm !== undefined && b.confirm !== true) return res.status(400).json({ message: 'Confirm before sending.' });
      const c = await createCampaign({ ...b, by: req.user });
      res.status(201).json(campaignView(c, { queued: c.recipients }));
    } catch (e) {
      if (!e.status) throw e;
      res.status(e.status).json({ message: e.message, ...(e.code && { code: e.code }), ...(e.campaign && { campaign: e.campaign }), ...(e.errors && { errors: e.errors }), ...(e.problems && { problems: e.problems }) });
    }
  })
);

r.get(
  '/campaigns',
  requireRole(...SERVE),
  asyncHandler(async (req, res) => {
    const p = page(req.query, 20);
    const [items, total] = await Promise.all([
      WhatsAppCampaign.find().sort({ createdAt: -1 }).skip((p.page - 1) * p.limit).limit(p.limit).lean(),
      WhatsAppCampaign.countDocuments(),
    ]);
    const counts = await campaignCounts(items.map((c) => c._id));
    res.json(paged(items.map((c) => campaignView(c, counts[String(c._id)])), total, p));
  })
);

r.get(
  '/campaigns/:id',
  requireRole(...SERVE),
  asyncHandler(async (req, res) => {
    const c = validId(req.params.id) && (await WhatsAppCampaign.findById(req.params.id).lean());
    if (!c) return res.status(404).json({ message: 'Notification not found.' });
    const p = page(req.query, 50);
    const filter = { campaign: c._id };
    if (req.query.status === 'waiting') filter.status = { $in: ['queued', 'sending'] };
    else if (WA_MESSAGE_STATUSES.includes(req.query.status)) filter.status = req.query.status;
    const [messages, total, counts] = await Promise.all([
      WhatsAppMessage.find(filter).sort({ _id: 1 }).skip((p.page - 1) * p.limit).limit(p.limit).lean(),
      WhatsAppMessage.countDocuments(filter),
      campaignCounts([c._id]),
    ]);
    res.json({
      ...campaignView(c, counts[String(c._id)]),
      messages: paged(
        messages.map((m) => ({
          id: m._id, phone: m.phone, name: m.name || '', body: m.body, status: m.status, error: m.error || '', attempts: m.attempts,
          nextAttemptAt: m.status === 'queued' && m.attempts ? m.nextAttemptAt : null,
          sentAt: m.sentAt || null, deliveredAt: m.deliveredAt || null, readAt: m.readAt || null, failedAt: m.failedAt || null, updatedAt: m.updatedAt,
        })),
        total,
        p
      ),
    });
  })
);

r.post(
  '/campaigns/:id/retry',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    if (!validId(req.params.id) || !(await WhatsAppCampaign.exists({ _id: req.params.id }))) return res.status(404).json({ message: 'Notification not found.' });
    if (!whatsappNotifyConfigured()) return res.status(503).json({ code: 'WHATSAPP_NOT_CONFIGURED', message: 'WhatsApp notifications are not set up on the server yet.' });
    // Unsubscribed people stay skipped: they are checked again before sending.
    let n;
    try {
      n = await retryFailed({ campaign: new mongoose.Types.ObjectId(req.params.id) });
    } catch (e) {
      if (!e.status) throw e;
      return res.status(e.status).json({ message: e.message, ...(e.code && { code: e.code }) });
    }
    res.json({ ok: true, retried: n, message: n ? `Sending ${n} message${n === 1 ? '' : 's'} again.` : 'Nothing to retry.' });
  })
);

r.post(
  '/messages/:id/retry',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const m = validId(req.params.id) && (await WhatsAppMessage.findById(req.params.id).select('status').lean());
    if (!m) return res.status(404).json({ message: 'Message not found.' });
    if (m.status !== 'failed') return res.status(409).json({ message: 'Only failed messages can be retried.' });
    if (!whatsappNotifyConfigured()) return res.status(503).json({ code: 'WHATSAPP_NOT_CONFIGURED', message: 'WhatsApp notifications are not set up on the server yet.' });
    try {
      await retryFailed({ _id: m._id });
    } catch (e) {
      if (!e.status) throw e;
      return res.status(e.status).json({ message: e.message, ...(e.code && { code: e.code }) });
    }
    res.json({ ok: true, retried: 1, message: 'Sending again.' });
  })
);

r.post(
  '/campaigns/:id/cancel',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    if (!validId(req.params.id)) return res.status(404).json({ message: 'Notification not found.' });
    try {
      const out = await cancelCampaign(req.params.id);
      if (!out) return res.status(404).json({ message: 'Notification not found.' });
      res.json({ ok: true, cancelled: out.cancelled, message: out.cancelled ? `Cancelled. ${out.cancelled} message${out.cancelled === 1 ? '' : 's'} will not be sent.` : 'Cancelled.' });
    } catch (e) {
      if (!e.status) throw e;
      res.status(e.status).json({ message: e.message });
    }
  })
);

r.post(
  '/audience',
  requireRole(...SERVE),
  asyncHandler(async (req, res) => {
    try {
      res.json({ recipients: await audienceCount(req.body?.audience, req.body?.contactIds) });
    } catch (e) {
      if (!e.status) throw e;
      res.status(e.status).json({ message: e.message });
    }
  })
);

// Products with the pictures WhatsApp can show, and coupons usable now.
r.get(
  '/options',
  requireRole(...SERVE),
  asyncHandler(async (_req, res) => {
    const [products, coupons] = await Promise.all([
      Product.find({ published: true }).sort({ sortOrder: 1, name: 1 }).select('slug name price stock images video').lean(),
      Coupon.find({ active: true }).sort({ createdAt: -1 }).limit(100).lean(),
    ]);
    res.json({
      products: products.map((p) => ({ slug: p.slug, name: p.name, price: p.price, stock: p.stock, images: whatsappImages(p) })),
      coupons: coupons.filter((c) => usableIn(c, 'INR') || usableIn(c, 'AED')).map((c) => ({ code: c.code, description: c.description || '', discount: discountText(c, 'INR') || discountText(c, 'AED'), expiresAt: c.expiresAt || null, showOnSite: !!c.showOnSite })),
      variables: TEMPLATE_VARIABLES,
      mediaTemplate: !!mediaTemplate(),
    });
  })
);

// Exactly what one customer would receive, plus what stops or may affect the send.
r.post(
  '/preview',
  requireRole(...SERVE),
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    let base = {};
    if (b.templateId && validId(b.templateId)) base = (await NotificationTemplate.findById(b.templateId))?.toAdmin() || {};
    const { content, errors } = readContent({ ...base, ...Object.fromEntries(Object.entries(b).filter(([k, v]) => v !== undefined && k !== 'templateId')) });
    const refs = await loadRefs(content);
    let who = { name: 'Aisha Khan', phone: '+919876543210' };
    if (b.contactId && validId(b.contactId)) {
      const c = await WhatsAppContact.findById(b.contactId).select('name phone').lean();
      if (c) who = { name: c.name || 'there', phone: c.phone };
    }
    const out = render(content, { ...who, product: refs.product, coupon: refs.coupon, image: refs.image });
    const greeting = renderBody('', who.name).trim();
    const warnings = [...refs.warnings];
    if (out.image && !out.cta) warnings.push('Add a product or a button page so the picture can be sent with a Shop Now button.');
    if (out.image && !mediaTemplate()) warnings.push('Pictures and the Shop Now button need the picture template on the server; until then the message goes as text with the link at the end.');
    res.json({
      to: who,
      greeting,
      title: out.title,
      text: out.text,
      image: out.image,
      cta: out.cta,
      footer: 'Reply STOP to unsubscribe',
      asSent: { body: `${greeting}${greeting ? ' ' : ''}${out.line}`, picture: !!(out.image && out.cta && mediaTemplate()) },
      product: refs.product ? { name: refs.product.name, slug: refs.product.slug, price: refs.product.price?.[out.currency], currency: out.currency } : null,
      coupon: refs.coupon ? { code: refs.coupon.code, discount: discountText(refs.coupon, out.currency) } : null,
      errors,
      problems: refs.problems,
      warnings,
      canSend: !errors.length && !refs.problems.length,
    });
  })
);

// ----- saved notifications (templates) -----
const tplErrors = (res, errors) => res.status(400).json({ message: errors[0].message, errors });
async function readTemplate(b) {
  const { content, errors } = readContent(b);
  const name = String(b.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 81);
  if (!name) errors.unshift({ field: 'name', message: 'Give the template a name.' });
  if (name.length > 80) errors.unshift({ field: 'name', message: 'Keep the name to 80 characters.' });
  // A template may be saved while its coupon is off (it is checked again on
  // sending), but the product and coupon must exist, and the picture must work.
  if (content.product && !(await Product.exists({ slug: content.product }))) errors.push({ field: 'product', message: 'That product does not exist.' });
  if (content.coupon && !(await Coupon.exists({ code: content.coupon }))) errors.push({ field: 'coupon', message: 'That coupon does not exist.' });
  const { image } = await loadRefs({ ...content, product: '', coupon: '' });
  if (!image.ok) errors.push({ field: 'image', message: image.reason });
  return { doc: { name, ...content, ...(b.active !== undefined && { active: !!b.active }), ...(['manual', 'ai'].includes(b.source) && { source: b.source }) }, errors };
}

r.get(
  '/templates',
  requireRole(...SERVE),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.active === 'true') filter.active = true;
    if (req.query.active === 'false') filter.active = false;
    if (typeof req.query.q === 'string' && req.query.q.trim()) filter.name = new RegExp(escapeRegex(req.query.q.trim().slice(0, 60)), 'i');
    const items = await NotificationTemplate.find(filter).sort({ active: -1, updatedAt: -1 }).limit(200);
    res.json({ items: items.map((t) => t.toAdmin()), total: items.length });
  })
);
r.post(
  '/templates/generate',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const product = typeof b.product === 'string' && b.product ? await Product.findOne({ slug: b.product.toLowerCase() }).lean() : null;
    if (b.product && !product) return res.status(400).json({ message: 'That product does not exist.' });
    const coupon = typeof b.coupon === 'string' && b.coupon ? await Coupon.findOne({ code: b.coupon.toUpperCase() }).lean() : null;
    if (b.coupon && !coupon) return res.status(400).json({ message: 'That coupon does not exist.' });
    try {
      const draft = await aiDraft({ brief: b.brief, tone: b.tone, product, coupon });
      // A draft to read and edit: nothing is saved or sent here.
      res.json({ ...draft, source: 'ai', product: product?.slug || '', coupon: coupon?.code || '', image: product ? (whatsappImages(product).find((i) => i.ok)?.src || '') : '', cta: { ...draft.cta, path: '' } }); // the button opens the product page by default
    } catch (e) {
      if (!e.status) throw e;
      res.status(e.status).json({ message: e.message, code: e.code });
    }
  })
);
r.post(
  '/templates',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const { doc, errors } = await readTemplate(req.body || {});
    if (errors.length) return tplErrors(res, errors);
    const t = await NotificationTemplate.create({ ...doc, createdBy: req.user.email, updatedBy: req.user.email });
    res.status(201).json(t.toAdmin());
  })
);
r.get(
  '/templates/:id',
  requireRole(...SERVE),
  asyncHandler(async (req, res) => {
    const t = validId(req.params.id) && (await NotificationTemplate.findById(req.params.id));
    if (!t) return res.status(404).json({ message: 'Template not found.' });
    res.json(t.toAdmin());
  })
);
r.put(
  '/templates/:id',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const t = validId(req.params.id) && (await NotificationTemplate.findById(req.params.id));
    if (!t) return res.status(404).json({ message: 'Template not found.' });
    const { doc, errors } = await readTemplate({ ...t.toAdmin(), ...req.body, source: t.source });
    if (errors.length) return tplErrors(res, errors);
    t.set({ ...doc, updatedBy: req.user.email });
    await t.save();
    res.json(t.toAdmin());
  })
);
r.patch(
  '/templates/:id',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const t = validId(req.params.id) && (await NotificationTemplate.findById(req.params.id));
    if (!t) return res.status(404).json({ message: 'Template not found.' });
    if (typeof req.body?.active !== 'boolean') return res.status(400).json({ message: 'active must be true or false.' });
    t.active = req.body.active;
    t.updatedBy = req.user.email;
    await t.save();
    res.json(t.toAdmin());
  })
);
r.post(
  '/templates/:id/duplicate',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const t = validId(req.params.id) && (await NotificationTemplate.findById(req.params.id).lean());
    if (!t) return res.status(404).json({ message: 'Template not found.' });
    const { _id, createdAt, updatedAt, lastUsedAt, timesUsed, __v, ...rest } = t;
    const copy = await NotificationTemplate.create({ ...rest, name: `${t.name} (copy)`.slice(0, 80), createdBy: req.user.email, updatedBy: req.user.email });
    res.status(201).json(copy.toAdmin());
  })
);
r.delete(
  '/templates/:id',
  requireRole(...MANAGE),
  asyncHandler(async (req, res) => {
    const t = validId(req.params.id) && (await NotificationTemplate.findByIdAndDelete(req.params.id));
    if (!t) return res.status(404).json({ message: 'Template not found.' });
    res.json({ ok: true, message: 'Template deleted' });
  })
);

export default r;
