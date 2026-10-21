import mongoose from 'mongoose';

// A customer review can only come from a delivered order that contained the
// product, and appears only once the house approves it. One review per
// product per order. The team can also add a review it received elsewhere
// (source 'house', e.g. sent on WhatsApp); those are never shown as a
// verified purchase and carry a placeholder order id of their own, so the
// one-per-order rule never collides.
const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    slug: { type: String, required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    source: { type: String, enum: ['customer', 'house'], default: 'customer' },
    addedBy: String,
    orderNumber: String,
    name: { type: String, required: true, trim: true, maxlength: 40 },
    city: { type: String, trim: true, maxlength: 60 },
    country: String,
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 80 },
    body: { type: String, required: true, trim: true, maxlength: 1200 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    reply: { type: String, trim: true, maxlength: 600 },
  },
  { timestamps: true }
);

reviewSchema.index({ order: 1, slug: 1 }, { unique: true });

export default mongoose.model('Review', reviewSchema);
