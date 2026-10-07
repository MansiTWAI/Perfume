import mongoose from 'mongoose';
import { ORDER_STAGES, ORDER_STATUSES, SHIPMENT_STATUSES } from '../config/commerce.js';

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
    // Coupon discount (whole units), taken off the subtotal. total = subtotal - discount + shipping.
    discount: { type: Number, default: 0 },
    coupon: { code: String, type: { type: String }, percent: Number, amount: Number, maxDiscount: Number },
    shipping: Number,
    total: Number,
    paymentMethod: { type: String, default: 'pay-on-confirmation' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'partially_refunded', 'refunded'], default: 'pending' },
    // Online payment (Razorpay): the provider's ids, for reconciliation and
    // refunds. Amounts here are in paise. No card or bank details are stored.
    payment: {
      provider: String,
      providerOrderId: String, // the Razorpay order the customer paid (or is paying)
      amount: Number, // paise paid (or due on providerOrderId)
      currency: String,
      providerPaymentId: String,
      method: String, // upi, card, netbanking, wallet… as Razorpay reports it
      paidAt: Date,
      verifiedBy: String, // checkout | webhook | reconcile
      // Every Razorpay order created for this order. A retry re-uses the
      // latest one unless the total changed, so a late payment on an older
      // one can still be matched (and refunded) instead of being lost.
      attempts: [{ providerOrderId: String, amount: Number, currency: String, status: { type: String, default: 'created' }, lastError: String, createdAt: { type: Date, default: Date.now }, _id: false }],
      // Money that arrived but could not count towards the order (wrong
      // amount, a second payment, paid after cancelling): refund these.
      issues: [{ kind: String, providerPaymentId: String, amount: Number, note: String, resolved: { type: Boolean, default: false }, at: { type: Date, default: Date.now }, _id: false }],
      refunds: [{ providerRefundId: String, providerPaymentId: String, amount: Number, status: String, reason: String, by: String, createdAt: { type: Date, default: Date.now }, processedAt: Date, _id: false }],
      refundedAmount: { type: Number, default: 0 }, // paise, refunds not failed
      refundLockAt: Date,
    },
    giftNote: { enabled: Boolean, name: String, occasion: String, message: String },
    status: { type: String, enum: ORDER_STATUSES, default: ORDER_STAGES[0] },
    history: [{ status: String, at: { type: Date, default: Date.now }, note: String, _id: false }],
    carrier: String,
    carrierUrl: String,
    trackingNumber: String, // courier AWB / consignment number
    eta: String,
    // Courier shipment (Delhivery), separate from the order and payment
    // status. carrier / trackingNumber / carrierUrl above are kept in step so
    // existing screens and apps keep working. No courier credentials or
    // courier copies of the customer's address are stored.
    shipment: {
      provider: String, // delhivery
      status: { type: String, enum: SHIPMENT_STATUSES },
      awb: String,
      reference: String, // Delhivery upload reference
      orderRef: String, // order id sent to Delhivery (order number, -R2… after a cancelled shipment)
      rev: { type: Number, default: 0 }, // bumped on every change to events, for safe recomputes
      courierStatus: String, // Delhivery's own words for the latest scan
      location: String,
      events: [{
        key: String, // dedupe: the same scan from webhook and polling is stored once
        status: String, courierStatus: String, statusType: String, location: String, note: String,
        at: Date, source: String, receivedAt: { type: Date, default: Date.now }, _id: false,
      }],
      lastEventAt: Date, // time of the latest scan (Delhivery's clock)
      lastTrackingUpdate: Date, // when we last learned something new
      lastCheckedAt: Date, // when we last asked Delhivery
      createdAt: Date,
      pickedUpAt: Date,
      outForDeliveryAt: Date,
      deliveredAt: Date,
      returnedAt: Date,
      cancelledAt: Date,
      expectedDelivery: Date,
      error: String,
      errorAt: Date,
      attempts: { type: Number, default: 0 },
      nextAttemptAt: Date,
      lockAt: Date, // a creation in progress; stale after two minutes
      unknownSince: Date, // a creation whose result was lost (timeout): look it up before retrying
      notified: [String], // customer emails already sent, one per milestone
    },
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
orderSchema.index({ 'coupon.code': 1, user: 1 });
// Payment lookups (webhooks, reconciliation). One Razorpay payment can settle
// only one order.
orderSchema.index({ 'payment.attempts.providerOrderId': 1 });
orderSchema.index({ 'payment.providerOrderId': 1 });
orderSchema.index({ 'payment.providerPaymentId': 1 }, { unique: true, partialFilterExpression: { 'payment.providerPaymentId': { $type: 'string' } } });

// Shipping: webhook / tracking lookups by waybill (one order per waybill),
// the tracking poller and the admin shipments list.
orderSchema.index({ 'shipment.awb': 1 }, { unique: true, partialFilterExpression: { 'shipment.awb': { $type: 'string' } } });
orderSchema.index({ 'shipment.status': 1, 'shipment.lastCheckedAt': 1 });

export default mongoose.model('Order', orderSchema);
