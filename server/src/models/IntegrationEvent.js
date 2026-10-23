import mongoose from 'mongoose';

// What the shop's outside services did, for Admin → Integrations: real
// activity (a booking, a payment, an email), connection checks and tests, and
// setting changes. Messages carry ids and outcomes only, never personal data,
// tokens or passwords. Kept 90 days.
export const INTEGRATIONS = ['delhivery', 'payments', 'email', 'whatsapp', 'ai'];
export const EVENT_KINDS = ['activity', 'check', 'test', 'config'];

const schema = new mongoose.Schema({
  integration: { type: String, enum: INTEGRATIONS, required: true },
  kind: { type: String, enum: EVENT_KINDS, required: true },
  ok: { type: Boolean, required: true },
  message: { type: String, maxlength: 300 },
  by: String, // staff email for checks, tests and changes; empty for the shop's own activity
  ms: Number, // how long a check took
  at: { type: Date, default: Date.now },
});
schema.index({ integration: 1, at: -1 });
schema.index({ at: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

export default mongoose.models.IntegrationEvent || mongoose.model('IntegrationEvent', schema);
