import mongoose from 'mongoose';

// Discount codes. `percent` takes a share of the subtotal (optionally capped);
// `fixed` takes a set amount in the order's currency. Amounts are whole units.
const perCurrency = { INR: Number, AED: Number };

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 30 },
    description: { type: String, maxlength: 200 },
    type: { type: String, enum: ['percent', 'fixed'], required: true },
    percent: { type: Number, min: 1, max: 100 },
    amount: perCurrency, // fixed discount per currency
    maxDiscount: perCurrency, // cap for percent coupons
    minSubtotal: perCurrency,
    startsAt: Date,
    expiresAt: Date,
    usageLimit: { type: Number, min: 1 }, // total uses; empty = unlimited
    perUserLimit: { type: Number, min: 1, default: 1 },
    usedCount: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Coupon', couponSchema);
