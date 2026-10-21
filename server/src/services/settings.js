// Integration keys the admin can set from the studio (Admin → Settings)
// instead of editing server/.env: WhatsApp (Meta Cloud API) and Delhivery.
//
// Saved values are encrypted in the database (AES-256-GCM, key derived from
// JWT_SECRET) and applied to process.env, so every service keeps reading its
// settings the way it always has. A value saved here wins over server/.env;
// clearing it goes back to the server file's value. Secrets are write-only:
// the API says whether one is set, never what it is.
import crypto from 'crypto';
import mongoose from 'mongoose';

export const GROUPS = {
  whatsapp: {
    label: 'WhatsApp (Meta Cloud API)',
    keys: [
      { env: 'WHATSAPP_ACCESS_TOKEN', label: 'Permanent access token', secret: true, max: 600, pattern: /^\S+$/ },
      { env: 'WHATSAPP_PHONE_NUMBER_ID', label: 'Phone number ID', pattern: /^\d{6,25}$/, max: 25 },
      { env: 'WHATSAPP_NOTIFY_TEMPLATE', label: 'Campaign template name', pattern: /^[a-z0-9_]{1,512}$/, max: 512 },
      { env: 'WHATSAPP_NOTIFY_MEDIA_TEMPLATE', label: 'Picture template name (optional)', pattern: /^[a-z0-9_]{1,512}$/, max: 512 },
      { env: 'WHATSAPP_NOTIFY_PARAMS', label: 'Template variables', options: ['name,message', 'message'] },
      { env: 'WHATSAPP_TEMPLATE_LANG', label: 'Template language', pattern: /^[a-z]{2,3}(_[A-Z]{2})?$/, max: 10 },
      { env: 'WHATSAPP_APP_SECRET', label: 'App secret (delivery receipts)', secret: true, max: 200, pattern: /^\S+$/ },
      { env: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN', label: 'Webhook verify token', secret: true, max: 200, pattern: /^\S+$/ },
    ],
  },
  delhivery: {
    label: 'Delhivery',
    keys: [
      { env: 'DELHIVERY_API_TOKEN', label: 'API token', secret: true, max: 200, pattern: /^\S+$/ },
      { env: 'DELHIVERY_ENV', label: 'Mode', options: ['staging', 'production'] },
      { env: 'DELHIVERY_PICKUP_LOCATION', label: 'Pickup location (warehouse name)', max: 120, pattern: /^[^\r\n]+$/ },
      { env: 'DELHIVERY_WEBHOOK_TOKEN', label: 'Scan-push (webhook) token', secret: true, max: 200, min: 16, pattern: /^\S+$/ },
    ],
  },
};
const ALL = Object.values(GROUPS).flatMap((g) => g.keys);
const byEnv = new Map(ALL.map((k) => [k.env, k]));

const Setting = mongoose.models.Setting || mongoose.model('Setting', new mongoose.Schema(
  { key: { type: String, required: true, unique: true }, data: { type: String, default: '' }, updatedBy: String },
  { timestamps: true }
));

// What server/.env said at start-up, to go back to when a saved value is cleared.
const original = Object.fromEntries(ALL.map((k) => [k.env, process.env[k.env]]));
const fromPanel = new Set();

const keyBytes = () => crypto.createHash('sha256').update(`integration-settings:${process.env.JWT_SECRET || ''}`).digest();
function seal(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', keyBytes(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString('base64')).join('.');
}
function open(text) {
  if (!text) return {};
  const [iv, tag, body] = text.split('.').map((x) => Buffer.from(x, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', keyBytes(), iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(body), d.final()]).toString('utf8'));
}

function apply(values) {
  for (const k of ALL) {
    if (values[k.env]) {
      process.env[k.env] = values[k.env];
      fromPanel.add(k.env);
    } else if (fromPanel.has(k.env)) {
      if (original[k.env] === undefined) delete process.env[k.env];
      else process.env[k.env] = original[k.env];
      fromPanel.delete(k.env);
    }
  }
}

// SETTINGS_FROM_DB=off keeps a server on its own .env only. Set it on any
// copy that shares the live database (e.g. a local dev API), so saved live
// keys never start WhatsApp sending or Delhivery polling from that machine.
export const settingsEnabled = () => String(process.env.SETTINGS_FROM_DB || '').toLowerCase() !== 'off';

let saved = {};
// Reads the saved settings into process.env. Called once after the database
// connects, before the background jobs start.
export async function loadSettings() {
  if (!settingsEnabled()) return {};
  try {
    const doc = await Setting.findOne({ key: 'integrations' }).lean();
    saved = doc ? open(doc.data) : {};
    apply(saved);
  } catch (e) {
    // A changed JWT_SECRET makes old values unreadable: keep server/.env.
    console.error('Saved integration settings could not be read (was JWT_SECRET changed?). Using server/.env:', e.message);
    saved = {};
  }
  return saved;
}

// Each key of a group: whether it is set, where from, and the value unless secret.
export function describe(group) {
  const g = GROUPS[group];
  return g.keys.map((k) => {
    const v = process.env[k.env] || '';
    return {
      key: k.env, label: k.label, secret: !!k.secret, options: k.options || null,
      set: !!v, source: fromPanel.has(k.env) ? 'panel' : v ? 'server' : '',
      ...(k.secret ? { hint: v ? `ends …${v.slice(-4)}` : '' } : { value: v }),
    };
  });
}

// Saves a group: { values: { KEY: 'value' }, clear: ['KEY'] }. An empty or
// missing secret keeps the current one. Returns { errors } or { ok }.
export async function saveGroup(group, { values = {}, clear = [] } = {}, by = '') {
  const g = GROUPS[group];
  if (!g) return { errors: [{ field: 'group', message: 'Unknown settings group.' }] };
  if (!settingsEnabled()) return { errors: [{ field: 'group', message: 'Settings from the studio are switched off on this server (SETTINGS_FROM_DB=off). Change them on the live site.' }] };
  const next = { ...saved };
  const errors = [];
  for (const k of g.keys) {
    if (clear.includes(k.env)) {
      delete next[k.env];
      continue;
    }
    if (!(k.env in values)) continue;
    const v = String(values[k.env] ?? '').trim();
    if (!v) {
      if (!k.secret) delete next[k.env];
      continue;
    }
    if (k.max && v.length > k.max) errors.push({ field: k.env, message: `${k.label} is too long.` });
    else if (k.min && v.length < k.min) errors.push({ field: k.env, message: `${k.label} must be at least ${k.min} characters.` });
    else if (k.options && !k.options.includes(v)) errors.push({ field: k.env, message: `${k.label} must be one of: ${k.options.join(', ')}.` });
    else if (k.pattern && !k.pattern.test(v)) errors.push({ field: k.env, message: `${k.label} does not look right.` });
    else next[k.env] = v;
  }
  if (errors.length) return { errors };
  await Setting.updateOne({ key: 'integrations' }, { $set: { data: seal(next), updatedBy: by } }, { upsert: true });
  saved = next;
  apply(saved);
  return { ok: true };
}

export const isSettingKey = (env) => byEnv.has(env);
