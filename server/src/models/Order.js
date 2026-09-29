import mongoose from 'mongoose';
import { ORDER_STAGES, ORDER_STATUSES } from '../config/commerce.js';

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true },
    trackingId: { type: String, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true, lowercase: true },
      phone: { type: String, required: true },
      address: {
        line1: { type: String, required: true },
        line2: String,
        city: { type: String, required: true },
        state: String,
        postalCode: { type: String, required: true },
        country: { type: String, required: true },
      },
    },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        slug: String,
        name: String,
        image: String,
        qty: { type: Number, min: 1 },
        unitPrice: Number,
        _id: false,
      },
    ],
    currency: { type: String, enum: ['INR', 'AED'], required: true },
    subtotal: Number,
    shipping: Number,
    total: Number,
    paymentMethod: { type: String, default: 'pay-on-confirmation' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'refunded'], default: 'pending' },
    // Online payment (Razorpay): the provider's ids, for reconciliation and refunds.
    payment: { provider: String, providerOrderId: String, amount: Number, providerPaymentId: String, paidAt: Date },
    giftNote: { enabled: Boolean, name: String, occasion: String, message: String },
    status: { type: String, enum: ORDER_STATUSES, default: ORDER_STAGES[0] },
    history: [{ status: String, at: { type: Date, default: Date.now }, note: String, _id: false }],
    carrier: String,
    carrierUrl: String,
    trackingNumber: String, // courier AWB / consignment number
    eta: String,
    notes: String,
    // Changes the customer made to the order before it shipped.
    edits: [{ at: { type: Date, default: Date.now }, by: { type: String, default: 'customer' }, summary: String, _id: false }],
  },
  { timestamps: true }
);

// Admin lists, reports and "My orders" look orders up by these.
orderSchema.index({ createdAt: -1 });
orderSchema.index({ user: 1 });
orderSchema.index({ 'customer.email': 1 });

export default mongoose.model('Order', orderSchema);
