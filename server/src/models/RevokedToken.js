import mongoose from 'mongoose';

// Access tokens signed out before they expire (e.g. "Sign out" on one
// device). Stored as a hash, and removed by MongoDB once the token would
// have expired anyway.
const revokedTokenSchema = new mongoose.Schema({
  hash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
});
revokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('RevokedToken', revokedTokenSchema);
