import mongoose from 'mongoose';

// Who changed what through the admin API. Kept for a year.
const auditSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorEmail: String,
    actorRole: String,
    method: String,
    path: String,
    status: Number,
    target: String, // id from the URL, when there is one
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 3600 });

export default mongoose.model('AuditLog', auditSchema);
