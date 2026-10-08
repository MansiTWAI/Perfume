import mongoose from 'mongoose';

// One notification the team sent (a campaign) and every message in it, one
// per recipient, with what WhatsApp reported back.
export const WA_MESSAGE_STATUSES = ['queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'skipped'];

const campaignSchema = new mongoose.Schema(
  {
    message: { type: String, required: true, maxlength: 600 },
    title: { type: String, maxlength: 60 },
    product: String, // product slug, checked again just before sending
    image: String, // JPG/PNG shown above the message
    coupon: String, // coupon code, checked again just before sending
    cta: { label: String, path: String },
    templateRef: { type: mongoose.Schema.Types.ObjectId, ref: 'NotificationTemplate' },
    templateName: String, // the saved template it came from, if any
    audience: { type: String, enum: ['all', 'selected', 'leads'], required: true },
    template: String, // the approved WhatsApp (Meta) template it went out with
    scheduledAt: Date, // sends at this time; empty = straight away
    cancelledAt: Date,
    problem: String, // why it stopped before sending (product removed, coupon expired…)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByEmail: String,
    recipients: { type: Number, default: 0 },
    finishedAt: Date,
  },
  { timestamps: true }
);
campaignSchema.index({ createdAt: -1 });

const messageSchema = new mongoose.Schema(
  {
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppCampaign', required: true },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppContact', required: true },
    phone: { type: String, required: true },
    name: String,
    body: { type: String, maxlength: 700 }, // the text the customer receives
    status: { type: String, enum: WA_MESSAGE_STATUSES, default: 'queued' },
    waId: String, // WhatsApp's message id, matched by the status webhook
    error: { type: String, maxlength: 300 },
    errorCode: String,
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lockAt: Date,
    sentAt: Date,
    deliveredAt: Date,
    readAt: Date,
    failedAt: Date,
  },
  { timestamps: true }
);
messageSchema.index({ campaign: 1, status: 1 });
messageSchema.index({ status: 1, nextAttemptAt: 1 });
messageSchema.index({ waId: 1 }, { unique: true, partialFilterExpression: { waId: { $type: 'string' } } });
messageSchema.index({ contact: 1, createdAt: -1 });

export const WhatsAppCampaign = mongoose.model('WhatsAppCampaign', campaignSchema);
export default mongoose.model('WhatsAppMessage', messageSchema);
