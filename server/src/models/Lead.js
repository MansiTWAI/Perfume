import mongoose from 'mongoose';

// A shopper the AI concierge talked with who showed buying interest. Only
// details the shopper chose to give are stored. One lead per chat session,
// and a returning email/phone joins the open lead it already has.
export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];
export const LEAD_INTENTS = ['browsing', 'considering', 'ready'];

const leadSchema = new mongoose.Schema(
  {
    sessionIds: [String], // chat sessions that fed this lead
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, maxlength: 80 },
    email: { type: String, lowercase: true, maxlength: 160 },
    phone: { type: String, maxlength: 20 },
    interestedProducts: [{ type: String, maxlength: 90 }], // product slugs
    budget: { amount: Number, currency: String },
    useCase: { type: String, maxlength: 160 }, // occasion, gift, self…
    quantity: { type: Number, min: 1, max: 100 },
    intent: { type: String, enum: LEAD_INTENTS, default: 'browsing' },
    wantsCallback: { type: Boolean, default: false },
    handoff: { reason: String, at: Date },
    score: { type: Number, default: 0, min: 0, max: 100 }, // worked out by the server, never by the model
    status: { type: String, enum: LEAD_STATUSES, default: 'NEW' },
    notes: [{ text: { type: String, maxlength: 1000 }, by: String, at: { type: Date, default: Date.now }, _id: false }],
    summary: { type: String, maxlength: 400 }, // one line about what they want
    region: String,
    lastInteractionAt: { type: Date, default: Date.now },
    followUpAt: Date,
  },
  { timestamps: true }
);

leadSchema.index({ sessionIds: 1 });
leadSchema.index({ email: 1 });
leadSchema.index({ phone: 1 });
leadSchema.index({ status: 1, score: -1 });
leadSchema.index({ lastInteractionAt: -1 });

// Score 0–100 from what is known: intent, reachability, specifics.
export function scoreLead(l) {
  let s = { browsing: 5, considering: 20, ready: 40 }[l.intent] || 0;
  if (l.email) s += 12;
  if (l.phone) s += 15;
  if (l.wantsCallback) s += 13;
  if (l.interestedProducts?.length) s += 8;
  if (l.budget?.amount) s += 5;
  if ((l.quantity || 0) > 1) s += 7;
  return Math.min(100, s);
}

export default mongoose.model('Lead', leadSchema);
