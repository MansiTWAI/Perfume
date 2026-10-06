import mongoose from 'mongoose';

// A customer's saved delivery addresses (address book). The default one is
// also copied to the account's single `address`, which the website's checkout
// and profile use.
const addressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, trim: true, maxlength: 30 }, // Home, Office…
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 40 },
    addressLine1: { type: String, required: true, trim: true, maxlength: 200 },
    addressLine2: { type: String, trim: true, maxlength: 200 },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    state: { type: String, trim: true, maxlength: 80 },
    postalCode: { type: String, required: true, trim: true, maxlength: 20 },
    countryCode: { type: String, required: true, uppercase: true, trim: true, maxlength: 2 },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

addressSchema.methods.toPublic = function () {
  return {
    id: this._id,
    label: this.label || '',
    fullName: this.fullName,
    phone: this.phone,
    addressLine1: this.addressLine1,
    addressLine2: this.addressLine2 || '',
    city: this.city,
    state: this.state || '',
    postalCode: this.postalCode,
    countryCode: this.countryCode,
    isDefault: !!this.isDefault,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model('Address', addressSchema);
