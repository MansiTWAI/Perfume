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
import { Router } from 'express';
import mongoose from 'mongoose';
import { requireRole, asyncHandler } from '../middleware/auth.js';
import WhatsAppContact from '../models/WhatsAppContact.js';
import WhatsAppMessage, { WhatsAppCampaign, WA_MESSAGE_STATUSES } from '../models/WhatsAppMessage.js';
import Lead from '../models/Lead.js';
import { escapeRegex } from '../utils.js';
import { whatsappNotifyConfigured, createCampaign, campaignCounts, retryFailed, unsubscribe, renderBody, MAX_SELECTED } from '../services/whatsapp.js';

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
    const [subscribed, unsubscribed, leads] = await Promise.all([
      WhatsAppContact.countDocuments({ subscribed: true }),
      WhatsAppContact.countDocuments({ subscribed: false }),
      WhatsAppContact.countDocuments({ subscribed: true, lead: { $ne: null } }),
    ]);
    res.json({
      configured: whatsappNotifyConfigured(),
      template: process.env.WHATSAPP_NOTIFY_TEMPLATE || null,
      statusUpdates: !!process.env.WHATSAPP_APP_SECRET,
      greeting: renderBody('', 'Aisha').trim().replace(/,$/, ''), // how the message opens, e.g. "Hello Aisha"
      subscribed,
      unsubscribed,
      leads,
      maxSelected: MAX_SELECTED,
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
    message: c.message,
    audience: c.audience,
    template: c.template,
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
      const c = await createCampaign({ message: b.message, audience: b.audience, contactIds: b.contactIds, by: req.user });
      res.status(201).json(campaignView(c, { queued: c.recipients }));
    } catch (e) {
      if (!e.status) throw e;
      res.status(e.status).json({ message: e.message, ...(e.code && { code: e.code }), ...(e.campaign && { campaign: e.campaign }) });
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
    const n = await retryFailed({ campaign: new mongoose.Types.ObjectId(req.params.id) });
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
    await retryFailed({ _id: m._id });
    res.json({ ok: true, retried: 1, message: 'Sending again.' });
  })
);

export default r;
