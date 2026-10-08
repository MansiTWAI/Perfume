// WhatsApp notifications to customers who agreed to receive them (Meta
// WhatsApp Cloud API, the same account as the sign-in codes).
//
// Business-initiated WhatsApp messages must use an approved template, so the
// team's text goes into the template's body variables. Set on the server:
//   WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID   (already used for codes)
//   WHATSAPP_NOTIFY_TEMPLATE      approved template name, body e.g.
//                                 "Hello {{1}}, {{2}}"  (footer: Reply STOP to unsubscribe)
//   WHATSAPP_NOTIFY_PARAMS        "name,message" (default) or "message"
//   WHATSAPP_NOTIFY_MEDIA_TEMPLATE optional: the same body with an IMAGE
//                                 header and a URL button "https://<site>/{{1}}";
//                                 used when a notification has a picture
//   WHATSAPP_TEMPLATE_LANG        template language, default en
//   WHATSAPP_APP_SECRET           verifies status webhooks (X-Hub-Signature-256)
//   WHATSAPP_WEBHOOK_VERIFY_TOKEN answers Meta's webhook verification
// The access token and secrets never leave the server.
//
// Sending is a queue in the database: every recipient is one message row.
// A worker sends due rows one at a time, retries passing failures with a
// back-off, and stops for good on failures that will not get better. The
// subscription is checked again just before each send.
import crypto from 'crypto';
import WhatsAppContact from '../models/WhatsAppContact.js';
import WhatsAppMessage, { WhatsAppCampaign } from '../models/WhatsAppMessage.js';
import Lead, { scoreLead } from '../models/Lead.js';
import { normalizePhone, validPhone, phoneKeys } from '../models/User.js';
import { readContent, loadRefs, render } from './notifyContent.js';

const GRAPH = 'https://graph.facebook.com/v20.0';
export const MAX_ATTEMPTS = 4;
const BACKOFF_MIN = [1, 5, 15]; // minutes before attempts 2, 3 and 4
const STALE_MIN = 5;
export const MAX_SELECTED = 500;

export const whatsappNotifyConfigured = () =>
  !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_NOTIFY_TEMPLATE);
export const mediaTemplate = () => process.env.WHATSAPP_NOTIFY_MEDIA_TEMPLATE || '';
const params = () => (process.env.WHATSAPP_NOTIFY_PARAMS || 'name,message').split(',').map((s) => s.trim()).filter((s) => ['name', 'message'].includes(s));

// Log lines carry ids and outcomes only, never message text or full numbers.
const masked = (phone) => `${String(phone).slice(0, 3)}••••${String(phone).slice(-3)}`;
const waLog = (event, data = {}) => console.log(`[whatsapp] ${event}`, JSON.stringify(data));

// WhatsApp refuses template variables with line breaks, tabs or long runs of
// spaces, so text goes as one paragraph.
export const oneLine = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
export const firstName = (name) => oneLine(name, 80).split(' ')[0] || 'there';
export const renderBody = (message, name) => (params().includes('name') ? `Hello ${firstName(name)}, ${message}` : message);

// ----- subscription -----
export async function subscribe({ phone, name, email, user, lead, source = 'website' }) {
  const n = normalizePhone(phone);
  if (!validPhone(n)) throw Object.assign(new Error('Please enter a valid WhatsApp number with country code.'), { status: 400 });
  const now = new Date();
  let c = await WhatsAppContact.findOne({ phone: n });
  if (!c) c = new WhatsAppContact({ phone: n, source, subscribedAt: now });
  if (!c.subscribed) Object.assign(c, { subscribed: true, subscribedAt: now, unsubscribedAt: undefined, unsubscribeReason: undefined, source });
  if (name) c.name = oneLine(name, 80);
  if (email) c.email = String(email).toLowerCase().slice(0, 160);
  if (user) c.user = user;
  if (lead) c.lead = lead;
  if (!c.lead) {
    const l = await Lead.findOne({ $or: [{ phone: { $in: [...phoneKeys(n), String(phone).trim()] } }, ...(user ? [{ user }] : [])] }).sort({ lastInteractionAt: -1 }).select('_id');
    if (l) c.lead = l._id;
  }
  await c.save();
  // The number is verified now: an AI lead without a way to reach them gets it.
  if (c.lead) {
    const l = await Lead.findById(c.lead);
    if (l && (!l.phone || (!l.name && c.name))) {
      if (!l.phone) l.phone = n;
      if (!l.name && c.name) l.name = c.name;
      l.score = scoreLead(l);
      await l.save();
    }
  }
  return c;
}

export async function unsubscribe(phone, reason = 'customer') {
  const n = normalizePhone(phone);
  if (!n) return null;
  return WhatsAppContact.findOneAndUpdate(
    { phone: n, subscribed: true },
    { subscribed: false, unsubscribedAt: new Date(), unsubscribeReason: reason },
    { new: true }
  );
}

// ----- sending -----
// Meta error codes that will not get better by trying again soon.
const PERMANENT = new Set(['100', '131008', '131009', '131026', '131030', '131047', '131049', '131050', '131051', '132000', '132001', '132005', '132007', '132012', '132015', '132016', '132068', '132069', '133010', '190', '200', '10']);
const REASONS = {
  131026: 'WhatsApp could not deliver to this number (it may not be on WhatsApp).',
  131030: 'This number is not on the allowed test list of the WhatsApp account.',
  131047: 'More than 24 hours since the customer last wrote; a template is needed.',
  131049: 'WhatsApp held this message back to protect the customer experience. Try again in a few days.',
  131050: 'The customer turned off marketing messages in WhatsApp.',
  132000: 'The message does not match the template’s variables.',
  132001: 'The WhatsApp template does not exist in this language.',
  132015: 'The WhatsApp template is paused.',
  132016: 'The WhatsApp template is disabled.',
  130429: 'WhatsApp rate limit reached; trying again shortly.',
  131056: 'Too many messages to this number in a short time; trying again shortly.',
  190: 'The WhatsApp access token has expired. Renew it on the server, then retry.',
};
const fail = (message, code, permanent) => Object.assign(new Error(message), { code: code ? String(code) : undefined, permanent: !!permanent });

async function graphSend(to, body) {
  let res;
  try {
    res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: to.replace(/\D/g, ''), ...body }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw fail(e?.name === 'TimeoutError' ? 'WhatsApp did not answer in time.' : 'Could not reach WhatsApp.', 'network', false);
  }
  const data = await res.json().catch(() => ({}));
  if (res.ok && data?.messages?.[0]?.id) return data.messages[0].id;
  const err = data?.error || {};
  const code = String(err.code ?? res.status);
  const permanent = PERMANENT.has(code) || (res.status >= 400 && res.status < 500 && res.status !== 429 && !['4', '80007', '130429', '131056', '131048'].includes(code));
  throw fail(REASONS[code] || oneLine(err.error_data?.details || err.message || `WhatsApp answered ${res.status}.`, 280), code, permanent);
}

// The approved template filled in for one customer. With a picture (and the
// picture template set up) it carries the image and a "Shop Now" button;
// otherwise the button's link goes at the end of the text.
function templateFor({ name, out, withMedia }) {
  const line = withMedia || !out.cta?.url ? out.line : `${out.line} ${out.cta.label}: ${out.cta.url}`;
  const values = { name: firstName(name), message: line.slice(0, 1000) };
  const components = [{ type: 'body', parameters: params().map((p) => ({ type: 'text', text: values[p] })) }];
  if (withMedia) {
    components.unshift({ type: 'header', parameters: [{ type: 'image', image: { link: out.image } }] });
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: out.cta.path.replace(/^\//, '') }] });
  }
  return {
    type: 'template',
    template: { name: withMedia ? mediaTemplate() : process.env.WHATSAPP_NOTIFY_TEMPLATE, language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' }, components },
  };
}

// A notification's product and coupon are checked again right before it goes
// out (a scheduled one may wait days). If one is gone, nothing more is sent
// and the team sees why.
const refsCache = new Map();
async function campaignRefs(campaign) {
  const key = String(campaign._id);
  const hit = refsCache.get(key);
  if (hit && Date.now() - hit.at < 60000) return hit.refs;
  const refs = await loadRefs(readContent(campaign).content);
  refsCache.set(key, { at: Date.now(), refs });
  return refs;
}
async function stopCampaign(campaign, problem) {
  await WhatsAppCampaign.updateOne({ _id: campaign._id }, { problem, finishedAt: new Date() });
  await WhatsAppMessage.updateMany({ campaign: campaign._id, status: { $in: ['queued', 'sending'] } }, { status: 'failed', error: `Not sent: ${problem}`, failedAt: new Date(), lockAt: null });
  waLog('campaign_stopped', { campaign: String(campaign._id) });
}

// Sends one claimed message row.
async function sendOne(m) {
  const contact = await WhatsAppContact.findById(m.contact);
  if (!contact?.subscribed) {
    await WhatsAppMessage.updateOne({ _id: m._id }, { status: 'skipped', error: 'Unsubscribed before sending.', lockAt: null });
    return;
  }
  const campaign = await WhatsAppCampaign.findById(m.campaign).lean();
  if (!campaign || campaign.cancelledAt) {
    await WhatsAppMessage.updateOne({ _id: m._id }, { status: 'skipped', error: 'The notification was cancelled.', lockAt: null });
    return;
  }
  const refs = await campaignRefs(campaign);
  if (refs.problems.length) {
    await stopCampaign(campaign, refs.problems[0]);
    return;
  }
  const out = render(readContent(campaign).content, { name: m.name || contact.name, phone: contact.phone, product: refs.product, coupon: refs.coupon, image: refs.image });
  const withMedia = !!(out.image && out.cta && mediaTemplate());
  let waId;
  try {
    waId = await graphSend(contact.phone, templateFor({ name: m.name || contact.name, out, withMedia }));
  } catch (e) {
    const attempts = (m.attempts || 0) + 1;
    const last = e.permanent || attempts >= MAX_ATTEMPTS;
    await WhatsAppMessage.updateOne(
      { _id: m._id },
      last
        ? { status: 'failed', error: e.message, errorCode: e.code, failedAt: new Date(), attempts, lockAt: null }
        : { status: 'queued', error: e.message, errorCode: e.code, attempts, lockAt: null, nextAttemptAt: new Date(Date.now() + BACKOFF_MIN[attempts - 1] * 60000) }
    );
    if (e.code === '131050') await unsubscribe(contact.phone, 'blocked');
    waLog(last ? 'failed' : 'retry_later', { message: String(m._id), to: masked(contact.phone), code: e.code, attempts });
    return;
  }
  // Sent: from here on it is never sent again, whatever happens next.
  await WhatsAppMessage.updateOne({ _id: m._id }, { status: 'sent', waId, sentAt: new Date(), body: renderBody(out.line, m.name || contact.name).slice(0, 700), error: null, errorCode: null, lockAt: null, $inc: { attempts: 1 } });
  await WhatsAppContact.updateOne({ _id: contact._id }, { lastMessageAt: new Date() });
}

// Sends every due message, one at a time. Only one pump runs per process.
let pumping = null;
const inFlight = new Set();
export const whatsappIdle = () => Promise.allSettled([...inFlight]);
export function pumpWhatsApp() {
  if (pumping || !whatsappNotifyConfigured()) return pumping;
  pumping = (async () => {
    // A send that never finished (the server stopped mid-request) may or may
    // not have gone out, so it is not repeated on its own: the team decides.
    await WhatsAppMessage.updateMany(
      { status: 'sending', lockAt: { $lt: new Date(Date.now() - STALE_MIN * 60000) } },
      { status: 'failed', error: 'Sending was interrupted, so it may or may not have arrived. Retry only if the customer did not get it.', failedAt: new Date(), lockAt: null }
    );
    for (;;) {
      const m = await WhatsAppMessage.findOneAndUpdate(
        { status: 'queued', nextAttemptAt: { $lte: new Date() } },
        { status: 'sending', lockAt: new Date() },
        { sort: { nextAttemptAt: 1 }, new: true }
      );
      if (!m) break;
      await sendOne(m);
    }
    await finishCampaigns();
  })()
    .catch((e) => waLog('pump_error', { reason: oneLine(e.message, 120) }))
    .finally(() => { pumping = null; });
  inFlight.add(pumping);
  pumping.finally(() => inFlight.delete(pumping));
  return pumping;
}

async function finishCampaigns() {
  const open = await WhatsAppCampaign.find({ finishedAt: null }).select('_id').lean();
  for (const c of open) {
    if (!(await WhatsAppMessage.exists({ campaign: c._id, status: { $in: ['queued', 'sending'] } }))) await WhatsAppCampaign.updateOne({ _id: c._id }, { finishedAt: new Date() });
  }
}

export function startWhatsAppJobs() {
  if (!whatsappNotifyConfigured()) return null;
  const t = setInterval(() => pumpWhatsApp(), 60 * 1000);
  t.unref?.();
  setTimeout(() => pumpWhatsApp(), 20 * 1000).unref?.();
  return t;
}

// ----- campaigns -----
// Who receives it: everyone subscribed, chosen people, or subscribers who
// came from the AI concierge. Unsubscribed people are never included.
async function audienceFor(audience, contactIds) {
  if (!['all', 'selected', 'leads'].includes(audience)) throw Object.assign(new Error('Choose who receives it: all subscribers, selected customers or AI leads.'), { status: 400 });
  let filter = { subscribed: true };
  if (audience === 'leads') filter = { subscribed: true, lead: { $ne: null } };
  if (audience === 'selected') {
    const ids = [...new Set((Array.isArray(contactIds) ? contactIds : []).map(String))].filter((id) => /^[a-f0-9]{24}$/i.test(id));
    if (!ids.length) throw Object.assign(new Error('Select at least one customer.'), { status: 400 });
    if (ids.length > MAX_SELECTED) throw Object.assign(new Error(`Select up to ${MAX_SELECTED} customers, or notify all subscribers.`), { status: 400 });
    filter = { _id: { $in: ids }, subscribed: true };
  }
  return WhatsAppContact.find(filter).select('_id phone name').lean();
}
export async function audienceCount(audience, contactIds) {
  return (await audienceFor(audience, contactIds)).length;
}

// Creates a notification (sent now or at `scheduledAt`). The content is a
// saved template, typed content, or both (typed changes win). Nothing is
// sent without this call, which only an admin's confirmed click makes.
export async function createCampaign({ message, title, product, image, coupon, cta, templateId, audience, contactIds = [], scheduledAt, by }) {
  if (!whatsappNotifyConfigured()) throw Object.assign(new Error('WhatsApp notifications are not set up on the server yet.'), { status: 503, code: 'WHATSAPP_NOT_CONFIGURED' });
  let tpl = null;
  if (templateId) {
    const { default: NotificationTemplate } = await import('../models/NotificationTemplate.js');
    tpl = /^[a-f0-9]{24}$/i.test(String(templateId)) ? await NotificationTemplate.findById(templateId) : null;
    if (!tpl) throw Object.assign(new Error('That template no longer exists.'), { status: 400 });
    if (!tpl.active) throw Object.assign(new Error('That template is switched off. Switch it on or choose another.'), { status: 400 });
  }
  const pick = (v, fallback) => (v === undefined ? fallback : v);
  const { content, errors } = readContent({
    title: pick(title, tpl?.title), message: pick(message, tpl?.message), product: pick(product, tpl?.product),
    image: pick(image, tpl?.image), coupon: pick(coupon, tpl?.coupon), cta: pick(cta, tpl?.cta),
  });
  if (errors.length) throw Object.assign(new Error(errors[0].message), { status: 400, errors });
  const refs = await loadRefs(content);
  if (refs.problems.length) throw Object.assign(new Error(refs.problems[0]), { status: 400, code: 'CONTENT_PROBLEM', problems: refs.problems });

  let when = null;
  if (scheduledAt) {
    when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) throw Object.assign(new Error('Choose a valid date and time.'), { status: 400 });
    if (when < new Date(Date.now() - 60000)) throw Object.assign(new Error('That time has passed. Choose a time in the future or send now.'), { status: 400 });
    if (when > new Date(Date.now() + 60 * 864e5)) throw Object.assign(new Error('Schedule within the next 60 days.'), { status: 400 });
  }

  // The same message to the same audience twice within a minute is a double click.
  const recent = await WhatsAppCampaign.findOne({ message: content.message, title: content.title, audience, createdAt: { $gte: new Date(Date.now() - 60000) } }).lean();
  if (recent) throw Object.assign(new Error('This notification was just created. Check History.'), { status: 409, campaign: recent._id });

  const contacts = await audienceFor(audience, contactIds);
  if (!contacts.length) throw Object.assign(new Error({ all: 'There are no subscribers yet.', leads: 'No AI leads have subscribed yet.', selected: 'None of the selected customers are subscribed.' }[audience]), { status: 400 });

  const withMedia = !!(refs.image.url && mediaTemplate() && (content.cta.path || content.product || content.coupon));
  const campaign = await WhatsAppCampaign.create({
    message: content.message, title: content.title, product: content.product, image: content.image, coupon: content.coupon, cta: content.cta,
    templateRef: tpl?._id, templateName: tpl?.name, audience, template: withMedia ? mediaTemplate() : process.env.WHATSAPP_NOTIFY_TEMPLATE,
    scheduledAt: when || undefined, createdBy: by?._id, createdByEmail: by?.email, recipients: contacts.length,
  });
  if (tpl) await tpl.updateOne({ lastUsedAt: new Date(), $inc: { timesUsed: 1 } });
  const due = when || new Date();
  await WhatsAppMessage.insertMany(contacts.map((c) => {
    const out = render(content, { name: c.name, phone: c.phone, product: refs.product, coupon: refs.coupon, image: refs.image });
    return { campaign: campaign._id, contact: c._id, phone: c.phone, name: c.name, body: renderBody(out.line, c.name).slice(0, 700), nextAttemptAt: due };
  }));
  waLog('campaign_created', { campaign: String(campaign._id), audience, recipients: contacts.length, scheduled: !!when });
  if (!when) pumpWhatsApp();
  return campaign;
}

// Cancels a scheduled notification (or what is still waiting of one).
export async function cancelCampaign(id) {
  const c = await WhatsAppCampaign.findById(id);
  if (!c) return null;
  const r = await WhatsAppMessage.updateMany({ campaign: c._id, status: 'queued' }, { status: 'skipped', error: 'Cancelled before sending.', lockAt: null });
  if (!r.modifiedCount && c.finishedAt) throw Object.assign(new Error('Nothing is waiting to be sent in this notification.'), { status: 409 });
  c.cancelledAt = new Date();
  if (!(await WhatsAppMessage.exists({ campaign: c._id, status: 'sending' }))) c.finishedAt = new Date();
  await c.save();
  return { campaign: c, cancelled: r.modifiedCount };
}

export async function campaignCounts(ids) {
  const rows = await WhatsAppMessage.aggregate([{ $match: { campaign: { $in: ids } } }, { $group: { _id: { c: '$campaign', s: '$status' }, n: { $sum: 1 } } }]);
  const out = {};
  for (const r of rows) (out[String(r._id.c)] ||= {})[r._id.s] = r.n;
  return out;
}

// Puts failed messages back in the queue (one, or every failed one in a campaign).
export async function retryFailed(filter) {
  const camp = filter.campaign ? await WhatsAppCampaign.findById(filter.campaign).lean() : filter._id ? await WhatsAppCampaign.findById((await WhatsAppMessage.findById(filter._id).select('campaign').lean())?.campaign).lean() : null;
  if (camp?.cancelledAt) throw Object.assign(new Error('This notification was cancelled.'), { status: 409 });
  if (camp) {
    refsCache.delete(String(camp._id));
    const refs = await loadRefs(readContent(camp).content);
    if (refs.problems.length) throw Object.assign(new Error(refs.problems[0]), { status: 409, code: 'CONTENT_PROBLEM' });
    await WhatsAppCampaign.updateOne({ _id: camp._id }, { $unset: { problem: 1 } });
  }
  const r = await WhatsAppMessage.updateMany({ ...filter, status: 'failed' }, { status: 'queued', nextAttemptAt: new Date(), attempts: 0, error: null, errorCode: null, failedAt: null });
  if (r.modifiedCount) {
    const camps = await WhatsAppMessage.distinct('campaign', filter);
    await WhatsAppCampaign.updateMany({ _id: { $in: camps } }, { finishedAt: null });
    pumpWhatsApp();
  }
  return r.modifiedCount;
}

// ----- webhook (delivery statuses and replies) -----
export function webhookSignatureOk(req) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  const got = String(req.get('x-hub-signature-256') || '');
  if (!secret || !req.rawBody || !got.startsWith('sha256=')) return false;
  const want = `sha256=${crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex')}`;
  const a = Buffer.from(got);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const RANK = { queued: 0, sending: 1, sent: 2, delivered: 3, read: 4 };
const STOP_WORDS = /^(stop|stop all|unsubscribe|cancel|end|quit|إيقاف|الغاء|إلغاء)$/i;
const START_WORDS = /^(start|subscribe|resume)$/i;

export async function handleWebhook(payload) {
  const out = { statuses: 0, replies: 0 };
  for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const v = change?.value || {};
      for (const s of Array.isArray(v.statuses) ? v.statuses : []) {
        if (typeof s?.id !== 'string' || !['sent', 'delivered', 'read', 'failed'].includes(s.status)) continue;
        const m = await WhatsAppMessage.findOne({ waId: s.id });
        if (!m) continue;
        const at = Number(s.timestamp) ? new Date(Number(s.timestamp) * 1000) : new Date();
        if (s.status === 'failed') {
          const err = s.errors?.[0] || {};
          const code = String(err.code ?? '');
          Object.assign(m, { status: 'failed', failedAt: at, errorCode: code, error: REASONS[code] || oneLine(err.error_data?.details || err.title || err.message || 'WhatsApp could not deliver this message.', 280) });
          if (code === '131050') await unsubscribe(m.phone, 'blocked');
        } else {
          if (s.status === 'delivered' && !m.deliveredAt) m.deliveredAt = at;
          if (s.status === 'read') { m.readAt ||= at; m.deliveredAt ||= at; }
          // Statuses can arrive out of order: never step back (read stays read).
          if (m.status !== 'failed' && (RANK[s.status] ?? -1) > (RANK[m.status] ?? -1)) m.status = s.status;
        }
        await m.save();
        out.statuses++;
      }
      for (const msg of Array.isArray(v.messages) ? v.messages : []) {
        const text = oneLine(msg?.text?.body || msg?.button?.text || '', 40);
        if (!msg?.from || !text) continue;
        if (STOP_WORDS.test(text)) { await unsubscribe(`+${String(msg.from).replace(/\D/g, '')}`, 'reply'); out.replies++; }
        else if (START_WORDS.test(text)) {
          // Only someone who subscribed before can switch updates back on by reply.
          const n = normalizePhone(`+${String(msg.from).replace(/\D/g, '')}`);
          await WhatsAppContact.updateOne({ phone: n, subscribed: false }, { subscribed: true, subscribedAt: new Date(), $unset: { unsubscribedAt: 1, unsubscribeReason: 1 } });
          out.replies++;
        }
      }
    }
  }
  return out;
}
