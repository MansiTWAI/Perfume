import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    // Saved on the profile and used to fill in checkout.
    phone: { type: String, trim: true, maxlength: 40 },
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
  },
  { timestamps: true }
);

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
    phone: this.phone || '',
    address: { line1: a.line1 || '', line2: a.line2 || '', city: a.city || '', state: a.state || '', postalCode: a.postalCode || '', region: a.region || '' },
    createdAt: this.createdAt,
  };
};

export default mongoose.model('User', userSchema);
