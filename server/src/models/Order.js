import mongoose from 'mongoose';
import { ORDER_STAGES } from '../config/commerce.js';

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
    giftNote: { enabled: Boolean, name: String, occasion: String, message: String },
    status: { type: String, enum: ORDER_STAGES, default: ORDER_STAGES[0] },
    history: [{ status: String, at: { type: Date, default: Date.now }, note: String, _id: false }],
    carrier: String,
    carrierUrl: String,
    eta: String,
    notes: String,
  },
  { timestamps: true }
);

export default mongoose.model('Order', orderSchema);
