import mongoose from 'mongoose';

// One Excel upload: validated into a preview first, applied only when an
// admin confirms it. Kept afterwards as the import history.
const issueSchema = new mongoose.Schema({ row: Number, orderId: String, field: String, message: String }, { _id: false });

const orderImportSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    adminName: String,
    adminEmail: String,
    fileName: { type: String, required: true },
    fileSize: Number,
    sheetName: String,
    status: { type: String, enum: ['previewed', 'committed', 'cancelled', 'expired', 'failed'], default: 'previewed', index: true },
    totals: {
      rows: { type: Number, default: 0 },
      updated: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      warnings: { type: Number, default: 0 },
    },
    // Planned updates, applied on confirm. `patch` is cleared once applied; the
    // readable diffs stay for the audit trail.
    changes: [
      {
        row: Number,
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
        orderNumber: String,
        updatedAt: Date,
        patch: mongoose.Schema.Types.Mixed,
        statusChange: mongoose.Schema.Types.Mixed,
        diffs: [{ field: String, from: String, to: String, _id: false }],
        _id: false,
      },
    ],
    rowErrors: [issueSchema],
    rowWarnings: [issueSchema],
    transactional: Boolean,
    committedAt: Date,
    error: String,
  },
  { timestamps: true }
);

orderImportSchema.index({ createdAt: -1 });

export default mongoose.model('OrderImport', orderImportSchema);
