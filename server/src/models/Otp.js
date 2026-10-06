import mongoose from 'mongoose';

// One-time codes sent to a phone. Only a hash of the code is stored; it
// expires after a few minutes and allows a limited number of attempts.
const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true }, // normalised, e.g. +919111279997
    purpose: { type: String, enum: ['login', 'verify_phone'], required: true },
    hash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    usedAt: Date,
  },
  { timestamps: true }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Otp', otpSchema);
