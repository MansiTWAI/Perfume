import mongoose from 'mongoose';

// One conversation with the AI concierge. The id is a random token the
// browser keeps for the visit, so nobody can open another shopper's chat.
// The history lives here (not in the browser), so a client cannot slip fake
// assistant turns into it. Contact details stay in `contact`, never in the
// text sent to the model. Kept for 90 days.
const chatSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    region: String,
    messages: [{ role: { type: String, enum: ['user', 'model'] }, text: { type: String, maxlength: 4000 }, products: [String], at: { type: Date, default: Date.now }, _id: false }],
    contact: { email: String, phone: String },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    turns: { type: Number, default: 0 },
    orderLookups: { type: Number, default: 0 },
    contactAsked: { type: Boolean, default: false }, // asked once for a name/number
    whatsappOffered: { type: Boolean, default: false }, // WhatsApp updates offered once per chat
    lastAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
  },
  { timestamps: true }
);

chatSessionSchema.index({ createdAt: -1 });

export default mongoose.model('ChatSession', chatSessionSchema);
