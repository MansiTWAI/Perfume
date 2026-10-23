// Admin → Integrations: the health of each outside service and its settings.
//
// Four separate questions per service, each answered from real data:
//   configured        its required settings are present on the server
//   connected         the provider accepted the credentials at the last check
//   operational       real work succeeded recently and nothing failed since
//   production-ready  live mode, plus whatever keeps it reliable (webhooks…)
//
// Settings live in one place, the server settings file (server/.env).
// Changing one from the studio rewrites that file (after a dated backup) and
// applies it at once; secrets are write-only and never leave the server.
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Order from '../models/Order.js';
import IntegrationEvent, { INTEGRATIONS } from '../models/IntegrationEvent.js';
import { noteAction } from './integrationLog.js';
import { delhiveryConfigured, delhiveryMode, checkPin, setupProblem, looksLikeUrl } from './delhivery.js';
import { razorpayConfigured, razorpayMode } from './razorpay.js';
import { whatsappNotifyConfigured, startWhatsAppJobs } from './whatsapp.js';
import { mailConfigured, mailStatus, sendMail } from './mail.js';
import { geminiConfigured } from './ai/gemini.js';
import { startShippingJobs } from './shipping.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The tests point this at a scratch file; the server uses server/.env.
const envFile = () => process.env.SETTINGS_FILE || path.join(__dirname, '..', '..', '.env');

const HEX40 = /^[0-9a-f]{40}$/i;
const NO_SPACE = /^\S+$/;

// What each service needs. `secret` settings are write-only.
export const REGISTRY = {
  delhivery: {
    name: 'Delhivery', role: 'Shipping and tracking', link: '/admin/shipping',
    settings: [
      { env: 'DELHIVERY_API_TOKEN', label: 'API token', secret: true, required: true, pattern: HEX40, hint: 'Delhivery One → Settings → API Setup → Existing API Token (40 letters and numbers).' },
      { env: 'DELHIVERY_ENV', label: 'Mode', options: [['staging', 'Test'], ['production', 'Live']], required: true, default: 'staging' },
      { env: 'DELHIVERY_PICKUP_LOCATION', label: 'Pickup location', required: true, max: 120, hint: 'The warehouse name exactly as in Delhivery One → Settings → Pickup Locations.' },
      { env: 'DELHIVERY_WEBHOOK_TOKEN', label: 'Scan-push token', secret: true, min: 16, pattern: NO_SPACE, hint: 'Optional. Any long random text; give the same to Delhivery support for instant tracking updates.' },
    ],
    canTest: { label: 'Check a PIN code', input: { name: 'pin', label: 'PIN code', pattern: '^[1-9][0-9]{5}$', placeholder: '500052' } },
  },
  payments: {
    name: 'Razorpay', role: 'Online payments (cards, UPI, net banking)', link: '',
    settings: [
      { env: 'RAZORPAY_KEY_ID', label: 'Key ID', required: true, pattern: /^rzp_(test|live)_[A-Za-z0-9]+$/, hint: 'Razorpay Dashboard → Account & Settings → API Keys. Starts with rzp_live_ (or rzp_test_).' },
      { env: 'RAZORPAY_KEY_SECRET', label: 'Key secret', secret: true, required: true, pattern: NO_SPACE },
      { env: 'RAZORPAY_WEBHOOK_SECRET', label: 'Webhook secret', secret: true, pattern: NO_SPACE, hint: 'Razorpay Dashboard → Webhooks, for https://albarakah.me/api/payments/razorpay/webhook.' },
    ],
  },
  email: {
    name: 'Email', role: 'Order updates, sign-up codes and team alerts', link: '',
    settings: [
      { env: 'MAIL_TRANSPORT', label: 'Sending method', options: [['sendmail', 'Hosting mail server'], ['smtp', 'SMTP mailbox']], required: true, default: 'smtp' },
      { env: 'MAIL_FROM', label: 'Sends from', required: true, max: 160, hint: 'e.g. AL BARAKAH LIFESTYLE <admin@albarakah.me>' },
      { env: 'ORDER_ALERT_EMAIL', label: 'Team alerts go to', max: 160, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, hint: 'Optional. Without it, alerts go to the sending address.' },
      { env: 'SMTP_HOST', label: 'SMTP server', max: 120, when: 'smtp' },
      { env: 'SMTP_PORT', label: 'SMTP port', pattern: /^\d{2,5}$/, when: 'smtp' },
      { env: 'SMTP_USER', label: 'SMTP user', max: 160, when: 'smtp' },
      { env: 'SMTP_PASS', label: 'SMTP password', secret: true, when: 'smtp' },
    ],
    canTest: { label: 'Send a test email', input: { name: 'to', label: 'Send to', type: 'email', placeholder: 'you@albarakah.me', defaultToMe: true } },
  },
  whatsapp: {
    name: 'WhatsApp', role: 'Campaigns to subscribers', link: '/admin/whatsapp',
    settings: [
      { env: 'WHATSAPP_ACCESS_TOKEN', label: 'Permanent access token', secret: true, required: true, pattern: NO_SPACE, hint: 'Meta Business Suite → System users → Generate token.' },
      { env: 'WHATSAPP_PHONE_NUMBER_ID', label: 'Phone number ID', required: true, pattern: /^\d{6,25}$/, hint: 'WhatsApp Manager → API setup.' },
      { env: 'WHATSAPP_NOTIFY_TEMPLATE', label: 'Campaign template', required: true, pattern: /^[a-z0-9_]{1,512}$/, hint: 'An approved Marketing template: “Hello {{1}}, {{2}}”.' },
      { env: 'WHATSAPP_NOTIFY_MEDIA_TEMPLATE', label: 'Picture template', pattern: /^[a-z0-9_]{1,512}$/, hint: 'Optional.' },
      { env: 'WHATSAPP_TEMPLATE_LANG', label: 'Template language', pattern: /^[a-z]{2,3}(_[A-Z]{2})?$/, hint: 'e.g. en' },
      { env: 'WHATSAPP_APP_SECRET', label: 'App secret', secret: true, pattern: NO_SPACE, hint: 'For delivery receipts and STOP replies.' },
      { env: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN', label: 'Webhook verify token', secret: true, pattern: NO_SPACE },
    ],
  },
  ai: {
    name: 'AI concierge', role: 'Website chat and AI leads', link: '/admin/leads',
    settings: [
      { env: 'GEMINI_API_KEY', label: 'Google AI key', secret: true, required: true, pattern: NO_SPACE, hint: 'Google AI Studio → Get API key.' },
      { env: 'GEMINI_MODEL', label: 'Model', pattern: /^[a-z0-9.-]{3,60}$/, hint: 'Optional; the default is used when empty.' },
    ],
    canTest: { label: 'Ask a test question' },
  },
};

const isSet = (env) => !!String(process.env[env] || '').trim();
const fromAddress = () => String(process.env.MAIL_FROM || '').replace(/^.*<|>$/g, '').trim();

// Live or test, where the service has the idea.
function modeOf(id) {
  if (id === 'delhivery') return delhiveryConfigured() ? (delhiveryMode() === 'production' ? 'live' : 'test') : null;
  if (id === 'payments') return razorpayConfigured() ? razorpayMode() : null;
  return null;
}

// Whether the service has what it needs to run at all.
function configuredOf(id) {
  if (id === 'delhivery') return delhiveryConfigured();
  if (id === 'payments') return razorpayConfigured();
  if (id === 'email') return mailConfigured();
  if (id === 'whatsapp') return whatsappNotifyConfigured();
  return geminiConfigured();
}

// Mis-set values the check can find without asking the provider.
function setupIssue(id) {
  if (id === 'delhivery') return setupProblem();
  if (id === 'whatsapp' && isSet('WHATSAPP_ACCESS_TOKEN') && !whatsappNotifyConfigured()) return 'The approved campaign template name is missing.';
  return '';
}

// What production use needs, as a checklist.
function productionChecklist(id) {
  if (id === 'delhivery') return [
    ['Live mode', delhiveryMode() === 'production'],
    ['Pickup location set', isSet('DELHIVERY_PICKUP_LOCATION') && !looksLikeUrl(process.env.DELHIVERY_PICKUP_LOCATION)],
    ['Instant tracking (scan push)', isSet('DELHIVERY_WEBHOOK_TOKEN'), true],
  ];
  if (id === 'payments') return [
    ['Live keys', razorpayMode() === 'live'],
    ['Payment webhook', isSet('RAZORPAY_WEBHOOK_SECRET')],
  ];
  if (id === 'email') return [
    ['Sending address set', !!fromAddress()],
    ['Separate team-alert address', isSet('ORDER_ALERT_EMAIL'), true],
  ];
  if (id === 'whatsapp') return [
    ['Approved campaign template', isSet('WHATSAPP_NOTIFY_TEMPLATE')],
    ['Delivery receipts and STOP replies', isSet('WHATSAPP_APP_SECRET') && isSet('WHATSAPP_WEBHOOK_VERIFY_TOKEN')],
  ];
  return [['Key set', isSet('GEMINI_API_KEY')]];
}

// Facts worth seeing at a glance (never a secret).
async function factsOf(id) {
  if (id === 'delhivery') {
    const last = await Order.findOne({ 'shipment.createdAt': { $ne: null } }).sort({ 'shipment.createdAt': -1 }).select('shipment.createdAt orderNumber').lean();
    const failed = await Order.countDocuments({ status: { $ne: 'Cancelled' }, 'shipment.status': 'failed' });
    return [
      ['Pickup location', process.env.DELHIVERY_PICKUP_LOCATION || '—'],
      ['Last booking', last ? { at: last.shipment.createdAt, text: last.orderNumber } : 'None yet'],
      ['Waiting in Problems', failed ? `${failed} shipment${failed === 1 ? '' : 's'}` : 'None'],
    ];
  }
  if (id === 'payments') return [['Key', isSet('RAZORPAY_KEY_ID') ? `${String(process.env.RAZORPAY_KEY_ID).slice(0, 9)}…` : '—']];
  if (id === 'email') {
    const m = mailStatus();
    return [['Sends from', fromAddress() || '—'], ['Last email sent', m.sentAt ? { at: m.sentAt } : 'None since the last restart'], ['Team alerts go to', process.env.ORDER_ALERT_EMAIL || fromAddress() || '—']];
  }
  if (id === 'whatsapp') return [['Phone number ID', isSet('WHATSAPP_PHONE_NUMBER_ID') ? `…${String(process.env.WHATSAPP_PHONE_NUMBER_ID).slice(-4)}` : '—'], ['Campaign template', process.env.WHATSAPP_NOTIFY_TEMPLATE || '—']];
  return [['Model', process.env.GEMINI_MODEL || 'default']];
}

// ----- checks: does the provider accept the credentials? -----
const timed = async (fn) => {
  const t = Date.now();
  const r = await fn();
  return { ...r, ms: Date.now() - t };
};

async function providerCheck(id) {
  if (!configuredOf(id)) return { ok: false, message: 'Not set up: required settings are missing.' };
  const issue = setupIssue(id);
  if (issue) return { ok: false, message: issue };
  try {
    if (id === 'delhivery') {
      const pin = await checkPin(String(process.env.DELHIVERY_PICKUP_PIN || '110001'));
      return pin ? { ok: true, message: `Delhivery ${delhiveryMode() === 'production' ? 'live' : 'test'} accepted the token.` } : { ok: false, message: 'Could not reach Delhivery.' };
    }
    if (id === 'payments') {
      const r = await fetch('https://api.razorpay.com/v1/payments?count=1', { headers: { Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}` }, signal: AbortSignal.timeout(10000) });
      if (r.status === 401) return { ok: false, message: 'Razorpay refused the key ID and secret.' };
      return r.ok ? { ok: true, message: `Razorpay accepted the ${razorpayMode()} keys.` } : { ok: false, message: `Razorpay answered HTTP ${r.status}.` };
    }
    if (id === 'whatsapp') {
      const r = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(process.env.WHATSAPP_PHONE_NUMBER_ID)}?fields=display_phone_number,verified_name,quality_rating`, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` }, signal: AbortSignal.timeout(10000) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, message: `Meta refused: ${String(d?.error?.message || `HTTP ${r.status}`).slice(0, 200)}` };
      return { ok: true, message: `Connected to ${d.verified_name || 'WhatsApp Business'} (${d.display_phone_number || 'number'})${d.quality_rating ? `, quality ${d.quality_rating}` : ''}.` };
    }
    if (id === 'ai') {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY }, signal: AbortSignal.timeout(10000) });
      return r.ok ? { ok: true, message: 'Google accepted the AI key.' } : { ok: false, message: r.status === 400 || r.status === 403 ? 'Google refused the AI key.' : `Google answered HTTP ${r.status}.` };
    }
    if (id === 'email') {
      // The hosting mail server cannot be asked without sending: the last real send stands in.
      const m = mailStatus();
      if (m.failedAt && (!m.sentAt || m.failedAt > m.sentAt)) return { ok: false, message: `The last email failed: ${m.error}` };
      return { ok: true, message: m.sentAt ? 'Email is set up and the last email went out.' : 'Email is set up. Send a test email to confirm delivery.' };
    }
  } catch (e) {
    if (e?.auth) return { ok: false, message: e.message };
    return { ok: false, message: `Could not reach the provider (${e?.name === 'TimeoutError' ? 'no answer in time' : 'network error'}).` };
  }
  return { ok: false, message: 'Unknown service.' };
}

export async function checkOne(id, by) {
  const r = await timed(() => providerCheck(id));
  await noteAction(id, 'check', r.ok, r.message, by, r.ms);
  return r;
}

// ----- tests: a small real round trip that touches no customer -----
export async function testOne(id, input = {}, user) {
  let r;
  if (!configuredOf(id)) r = { ok: false, message: 'Not set up: required settings are missing.' };
  else if (id === 'delhivery') {
    const pin = String(input.pin || '').trim();
    if (!/^[1-9]\d{5}$/.test(pin)) return { ok: false, message: 'Enter a 6-digit PIN code.', invalid: true };
    try {
      const p = await checkPin(pin);
      r = !p ? { ok: false, message: 'Could not reach Delhivery.' }
        : p.serviceable ? { ok: true, message: `Delhivery delivers to ${pin}${p.district ? ` (${p.district})` : ''}: ${[p.prepaid && 'prepaid', p.cod && 'cash on delivery'].filter(Boolean).join(' and ')}.` }
          : { ok: true, message: `Delhivery answered: it does not deliver to ${pin}${p.embargo ? ' for now' : ''}.` };
    } catch (e) {
      r = { ok: false, message: e.message };
    }
  } else if (id === 'email') {
    const to = String(input.to || user.email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false, message: 'Enter a valid email address.', invalid: true };
    try {
      await sendMail({ to, subject: 'Test email from your admin studio', text: `This test was sent from Admin → Integrations by ${user.email}. If you can read it, order emails are working.` });
      r = { ok: true, message: `Test email sent to ${to}. Check the inbox (and spam) in a minute.` };
    } catch (e) {
      r = { ok: false, message: `Sending failed: ${String(e.message).slice(0, 160)}` };
    }
  } else if (id === 'ai') {
    const { generate, textOf } = await import('./ai/gemini.js');
    try {
      const reply = textOf(await generate({ system: 'Answer in one short sentence.', contents: [{ role: 'user', parts: [{ text: 'Say hello to the Al Barakah team.' }] }], maxTokens: 60 }));
      r = reply ? { ok: true, message: `The AI answered: “${reply.slice(0, 160)}”` } : { ok: false, message: 'The AI gave an empty answer.' };
    } catch (e) {
      r = { ok: false, message: e.message };
    }
  } else return { ok: false, message: 'This service has no separate test; use Check connection.', invalid: true };
  await noteAction(id, 'test', r.ok, r.message, user.email);
  return r;
}

// ----- status -----
const DAY = 864e5;
export async function statusOf(id) {
  const def = REGISTRY[id];
  const [lastCheck, lastOk, lastFail] = await Promise.all([
    IntegrationEvent.findOne({ integration: id, kind: { $in: ['check', 'test'] } }).sort({ at: -1 }).lean(),
    IntegrationEvent.findOne({ integration: id, kind: 'activity', ok: true }).sort({ at: -1 }).lean(),
    IntegrationEvent.findOne({ integration: id, kind: 'activity', ok: false }).sort({ at: -1 }).lean(),
  ]);
  const configured = configuredOf(id);
  const issue = configured ? setupIssue(id) : '';
  const checklist = productionChecklist(id).map(([label, ok, optional]) => ({ label, ok: !!ok, optional: !!optional }));
  const recentFail = lastFail && (!lastOk || lastFail.at > lastOk.at) ? lastFail : null;
  const stages = {
    configured: { state: configured ? (issue ? 'bad' : 'ok') : 'off', detail: configured ? issue || 'Required settings present' : `Missing: ${def.settings.filter((s) => s.required && !isSet(s.env)).map((s) => s.label).join(', ') || 'settings'}` },
    connected: !configured || issue ? { state: 'off', detail: 'Not checked until it is set up' }
      : !lastCheck ? { state: 'unknown', detail: 'Not checked yet' }
        : { state: lastCheck.ok ? 'ok' : 'bad', detail: lastCheck.message, at: lastCheck.at },
    operational: !configured ? { state: 'off', detail: '—' }
      : recentFail ? { state: 'bad', detail: recentFail.message, at: recentFail.at }
        : lastOk && Date.now() - lastOk.at < 7 * DAY ? { state: 'ok', detail: lastOk.message, at: lastOk.at }
          : lastOk ? { state: 'unknown', detail: `No activity for a week (last: ${lastOk.message})`, at: lastOk.at }
            : { state: 'unknown', detail: 'No real activity recorded yet' },
    production: !configured ? { state: 'off', detail: '—' } : checklist.filter((c) => !c.optional).every((c) => c.ok) ? { state: 'ok', detail: 'Ready for real customers' } : { state: 'warn', detail: checklist.filter((c) => !c.optional && !c.ok).map((c) => c.label).join(', ') },
  };
  // One overall word for the row: the worst stage that matters.
  const overall = !configured ? 'off'
    : [stages.configured, stages.connected, stages.operational].some((s) => s.state === 'bad') ? 'bad'
      : stages.production.state === 'warn' ? 'warn'
        : [stages.connected, stages.operational].some((s) => s.state === 'unknown') ? 'unknown' : 'ok';
  return {
    id, name: def.name, role: def.role, link: def.link, mode: modeOf(id), overall, stages, checklist,
    facts: await factsOf(id),
    lastCheck: lastCheck ? { at: lastCheck.at, ok: lastCheck.ok, message: lastCheck.message, kind: lastCheck.kind, ms: lastCheck.ms ?? null } : null,
    canTest: def.canTest ? { label: def.canTest.label, input: def.canTest.input || null } : null,
  };
}

export const statusAll = () => Promise.all(INTEGRATIONS.map(statusOf));
// Services the shop cannot sell without, that are not working (menu alert).
export const needsAttention = (all) => all.filter((s) => ['delhivery', 'payments', 'email'].includes(s.id) && ['bad', 'off'].includes(s.overall)).length;

// ----- settings: one file, write-only secrets -----
const mask = (v) => (v.length > 8 ? `…${v.slice(-4)}` : '••••');
export function settingsOf(id) {
  const def = REGISTRY[id];
  return def.settings.map((s) => {
    const v = String(process.env[s.env] || '');
    return {
      key: s.env, label: s.label, secret: !!s.secret, required: !!s.required, hint: s.hint || '', when: s.when || null,
      options: s.options ? s.options.map(([value, label]) => ({ value, label })) : null,
      // What is in effect: the saved value, or the built-in default.
      set: !!v, ...(s.secret ? { preview: v ? mask(v) : '' } : { value: v || s.default || '' }),
    };
  });
}

function validate(def, values, clear) {
  const errors = [];
  const out = {};
  for (const s of def.settings) {
    if (clear.includes(s.env)) {
      if (s.required) errors.push({ field: s.env, message: `${s.label} is required and cannot be removed.` });
      else out[s.env] = '';
      continue;
    }
    if (!(s.env in values)) continue;
    const v = String(values[s.env] ?? '').trim();
    if (!v) {
      if (!s.secret) {
        if (s.required) errors.push({ field: s.env, message: `${s.label} is required.` });
        else out[s.env] = '';
      }
      continue; // an empty secret keeps the current one
    }
    if (/[\r\n"'`$\\]/.test(v)) errors.push({ field: s.env, message: `${s.label} contains characters that are not allowed.` });
    else if (s.max && v.length > s.max) errors.push({ field: s.env, message: `${s.label} is too long.` });
    else if (s.min && v.length < s.min) errors.push({ field: s.env, message: `${s.label} must be at least ${s.min} characters.` });
    else if (s.options && !s.options.some(([o]) => o === v)) errors.push({ field: s.env, message: `Choose a valid ${s.label.toLowerCase()}.` });
    else if (s.pattern && !s.pattern.test(v)) errors.push({ field: s.env, message: `${s.label} does not look right.` });
    else if (s.env === 'DELHIVERY_PICKUP_LOCATION' && looksLikeUrl(v)) errors.push({ field: s.env, message: 'Enter the warehouse name, not a web address.' });
    else out[s.env] = v;
  }
  return { out, errors };
}

// Rewrites only the changed lines of the settings file, keeping everything
// else (comments, order, other keys) as it was. A dated backup is kept first.
async function writeEnv(changes) {
  const file = envFile();
  const before = await fs.readFile(file, 'utf8').catch(() => '');
  const nl = before.includes('\r\n') ? '\r\n' : '\n';
  const lines = before ? before.split(/\r?\n/) : [];
  const done = new Set();
  const next = lines.map((line) => {
    const k = line.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1];
    if (!k || !(k in changes)) return line;
    done.add(k);
    return `${k}=${changes[k]}`;
  });
  const added = Object.keys(changes).filter((k) => !done.has(k) && changes[k] !== '');
  if (added.length) next.push(...(next.at(-1) === '' ? [] : ['']), ...added.map((k) => `${k}=${changes[k]}`));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  if (before) await fs.writeFile(`${file}.backup-${stamp}`, before, { mode: 0o600 });
  const tmp = `${file}.tmp-${process.pid}`;
  await fs.writeFile(tmp, next.join(nl), { mode: 0o600 });
  await fs.rename(tmp, file);
}

export async function saveSettings(id, { values = {}, clear = [] }, user) {
  const def = REGISTRY[id];
  const { out, errors } = validate(def, values, Array.isArray(clear) ? clear : []);
  if (errors.length) return { errors };
  const changed = Object.keys(out).filter((k) => String(process.env[k] || '') !== out[k]);
  if (!changed.length) return { ok: true, changed: [] };
  const changes = Object.fromEntries(changed.map((k) => [k, out[k]]));
  try {
    await writeEnv(changes);
  } catch (e) {
    await noteAction(id, 'config', false, `Settings could not be saved: ${e.code || e.message}`, user.email);
    return { errors: [{ field: 'form', message: 'The settings file could not be written on the server. Nothing was changed.' }] };
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v) process.env[k] = v;
    else delete process.env[k];
  }
  // Start the background work if it was waiting for these settings.
  startShippingJobs();
  startWhatsAppJobs();
  const labels = def.settings.filter((s) => changed.includes(s.env)).map((s) => s.label);
  await noteAction(id, 'config', true, `Changed: ${labels.join(', ')}`, user.email);
  // A changed credential is checked straight away.
  const check = await checkOne(id, user.email);
  return { ok: true, changed: labels, check };
}

export async function activity({ integration, limit = 50, before } = {}) {
  const filter = {};
  if (INTEGRATIONS.includes(integration)) filter.integration = integration;
  if (before && !Number.isNaN(new Date(before).getTime())) filter.at = { $lt: new Date(before) };
  const items = await IntegrationEvent.find(filter).sort({ at: -1 }).limit(Math.min(Math.max(Number(limit) || 50, 1), 200)).lean();
  return items.map((e) => ({ id: String(e._id), integration: e.integration, name: REGISTRY[e.integration]?.name, kind: e.kind, ok: e.ok, message: e.message, by: e.by || '', ms: e.ms ?? null, at: e.at }));
}
