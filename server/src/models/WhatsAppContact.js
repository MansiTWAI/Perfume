import mongoose from 'mongoose';

// Someone who agreed to receive WhatsApp updates from the house (new
// launches, offers, replies to what they asked the concierge). One record per
// number. An unsubscribed number is kept, marked unsubscribed, so it is never
// messaged again by mistake and the history stays readable.
export const WA_SOURCES = ['account', 'concierge', 'website', 'admin'];

const contactSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true }, // +<country><number>
    name: { type: String, maxlength: 80 },
    email: { type: String, lowercase: true, maxlength: 160 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    subscribed: { type: Boolean, default: true },
    source: { type: String, enum: WA_SOURCES, default: 'website' },
    subscribedAt: Date,
    unsubscribedAt: Date,
    // customer (account / link), reply (they wrote STOP), admin, blocked (WhatsApp refused the number)
    unsubscribeReason: { type: String, maxlength: 40 },
    lastMessageAt: Date,
  },
  { timestamps: true }
);

contactSchema.index({ subscribed: 1, updatedAt: -1 });
contactSchema.index({ user: 1 });
contactSchema.index({ lead: 1 });

contactSchema.methods.toAdmin = function () {
  return {
    id: this._id,
    phone: this.phone,
    name: this.name || '',
    email: this.email || '',
    user: this.user || null,
    lead: this.lead || null,
    subscribed: this.subscribed,
    source: this.source,
    subscribedAt: this.subscribedAt,
    unsubscribedAt: this.unsubscribedAt || null,
    unsubscribeReason: this.unsubscribeReason || '',
    lastMessageAt: this.lastMessageAt || null,
  };
};

export default mongoose.model('WhatsAppContact', contactSchema);
