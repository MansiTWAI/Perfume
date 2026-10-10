import mongoose from 'mongoose';

// Long-lived sign-in for the mobile app. Only a SHA-256 hash of the token is
// stored. Each use replaces the token (rotation); presenting a replaced token
// again revokes the whole family, since it means the token was copied.
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    replacedBy: String,
    userAgent: String,
    mfa: Boolean, // the sign-in passed the staff two-step code
  },
  { timestamps: true }
);

// MongoDB deletes expired tokens by itself.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('RefreshToken', refreshTokenSchema);
