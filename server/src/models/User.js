import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['customer', 'admin', 'manager', 'support'];
export const STAFF_ROLES = ['admin', 'manager', 'support'];

// "+91 91112 79997", "0091-9111279997" → "+919111279997". Numbers without a
// country code are kept as digits only.
export function normalizePhone(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  let digits = s.replace(/\D/g, '');
  if (s.startsWith('00')) digits = digits.slice(2);
  return s.startsWith('+') || s.startsWith('00') ? `+${digits}` : digits;
}

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // admin: everything; manager: catalogue, orders, coupons, content;
    // support: orders, customers and reviews. Never taken from the client.
    role: { type: String, enum: ROLES, default: 'customer' },
    // Blocked accounts cannot sign in; their tokens stop working.
    status: { type: String, enum: ['active', 'blocked'], default: 'active' },
    // Saved on the profile and used to fill in checkout.
    phone: { type: String, trim: true, maxlength: 40 },
    // The phone in one comparable form (+ and digits), for sign-in by phone or OTP.
    phoneNormalized: { type: String, index: true },
    phoneVerified: { type: Boolean, default: false },
    address: {
      line1: { type: String, trim: true, maxlength: 200 },
      line2: { type: String, trim: true, maxlength: 200 },
      city: { type: String, trim: true, maxlength: 80 },
      state: { type: String, trim: true, maxlength: 80 },
      postalCode: { type: String, trim: true, maxlength: 20 },
      region: { type: String, trim: true, maxlength: 2 }, // market code, e.g. IN or AE
    },
    // Shared by the website and the mobile app: the bag and saved fragrances.
    cart: [{ slug: { type: String, required: true }, qty: { type: Number, min: 1, max: 10, default: 1 }, _id: false }],
    wishlist: [{ type: String }],
    // Raised to sign the account out everywhere (password change, reset, "sign out all devices").
    tokenVersion: { type: Number, default: 0 },
    // Password reset by email: only a hash of the one-time token is kept.
    passwordReset: { hash: String, expiresAt: Date },
  },
  { timestamps: true }
);

userSchema.pre('save', function (next) {
  if (this.isModified('phone')) {
    const n = normalizePhone(this.phone);
    if (n !== this.phoneNormalized) this.phoneVerified = false;
    this.phoneNormalized = n || undefined;
  }
  next();
});

userSchema.methods.checkPassword = function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.statics.hashPassword = (password) => bcrypt.hash(password, 11);

userSchema.methods.toSafe = function () {
  const a = this.address || {};
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    status: this.status || 'active',
    phone: this.phone || '',
    phoneVerified: !!this.phoneVerified,
    address: { line1: a.line1 || '', line2: a.line2 || '', city: a.city || '', state: a.state || '', postalCode: a.postalCode || '', region: a.region || '' },
    createdAt: this.createdAt,
  };
};

export default mongoose.model('User', userSchema);
