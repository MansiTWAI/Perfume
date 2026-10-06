import mongoose from 'mongoose';

// Push-notification tokens (FCM) for the mobile app, one per device.
const deviceTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true, maxlength: 4096 },
    platform: { type: String, enum: ['android', 'ios', 'web'], required: true },
    appVersion: { type: String, maxlength: 30 },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model('DeviceToken', deviceTokenSchema);
