import mongoose from 'mongoose';

// A reusable WhatsApp notification the team wrote (or asked the AI to draft
// and then edited): a title, a message with variables such as {name} and
// {product}, an optional product with its picture, an optional coupon and a
// button. Saving a template never sends anything.
export const TEMPLATE_VARIABLES = ['name', 'product', 'price', 'coupon', 'discount', 'link'];

const templateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    source: { type: String, enum: ['manual', 'ai'], default: 'manual' }, // how it was first written
    title: { type: String, trim: true, maxlength: 60 },
    message: { type: String, required: true, maxlength: 500 },
    product: { type: String, trim: true, maxlength: 120 }, // product slug
    image: { type: String, trim: true, maxlength: 500 }, // JPG/PNG shown above the message
    coupon: { type: String, trim: true, uppercase: true, maxlength: 30 },
    cta: {
      label: { type: String, trim: true, maxlength: 20, default: 'Shop Now' },
      path: { type: String, trim: true, maxlength: 200 }, // a page on the site, e.g. /fragrances/zafreon
    },
    active: { type: Boolean, default: true },
    createdBy: String,
    updatedBy: String,
    lastUsedAt: Date,
    timesUsed: { type: Number, default: 0 },
  },
  { timestamps: true }
);
templateSchema.index({ active: 1, updatedAt: -1 });

templateSchema.methods.toAdmin = function () {
  return {
    id: this._id,
    name: this.name,
    source: this.source,
    title: this.title || '',
    message: this.message,
    product: this.product || '',
    image: this.image || '',
    coupon: this.coupon || '',
    cta: { label: this.cta?.label || 'Shop Now', path: this.cta?.path || '' },
    active: this.active,
    createdBy: this.createdBy || '',
    updatedAt: this.updatedAt,
    lastUsedAt: this.lastUsedAt || null,
    timesUsed: this.timesUsed || 0,
  };
};

export default mongoose.model('NotificationTemplate', templateSchema);
