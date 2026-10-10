import mongoose from 'mongoose';

// One-time codes. Only a hash of the code is stored; it expires after a few
// minutes and allows a limited number of attempts. `phone` is the key the code
// belongs to: a normalised phone number, or `staff:<userId>` for the admin
// two-step code (sent by email; `challenge` is the hash of the token given to
// the browser that passed the password step).
const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true }, // normalised, e.g. +919111279997
    purpose: { type: String, enum: ['login', 'verify_phone', 'whatsapp_subscribe', 'staff_2fa', 'verify_email'], required: true },
    challenge: { type: String, index: true, sparse: true },
    sends: { type: Number, default: 1 },
    lastSentAt: Date,
    hash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    usedAt: Date,
  },
  { timestamps: true }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Otp', otpSchema);
