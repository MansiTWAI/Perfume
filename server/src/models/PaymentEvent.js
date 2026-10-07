import mongoose from 'mongoose';

// Razorpay webhook deliveries already handled, keyed by the event id Razorpay
// sends (x-razorpay-event-id), so a retried delivery is not processed twice.
// Kept for 90 days as an audit trail of what the provider told us.
const paymentEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    event: String,
    providerOrderId: String,
    providerPaymentId: String,
    outcome: String,
    receivedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
  },
  { versionKey: false }
);

export default mongoose.model('PaymentEvent', paymentEventSchema);
