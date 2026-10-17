import mongoose from 'mongoose';

// A print run of physical scratch cards. Every card is its own coupon
// (Coupon.batch points here): one unique code, one use, never listed on the
// website. The discount comes from the batch: a percent, optionally capped,
// with an optional minimum order and expiry.
const perCurrency = { INR: Number, AED: Number };

const couponBatchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    percent: { type: Number, required: true, min: 1, max: 100 },
    count: { type: Number, required: true, min: 1 },
    maxDiscount: perCurrency,
    minSubtotal: perCurrency,
    expiresAt: Date,
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('CouponBatch', couponBatchSchema);
