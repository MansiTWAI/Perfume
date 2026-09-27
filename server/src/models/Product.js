import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  { name: { type: String, required: true }, description: String, image: String },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    subtitle: { type: String, default: 'Eau de Parfum' },
    tagline: String,
    family: String,
    description: String,
    story: String,
    sizeMl: { type: Number, default: 100 },
    sizeLabel: { type: String, default: '100 ML / 3.4 FL.OZ.' },
    price: { INR: { type: Number, required: true }, AED: { type: Number, required: true } },
    compareAt: { INR: Number, AED: Number },
    stock: { type: Number, default: 0, min: 0 },
    category: { type: String, default: 'Fragrances' },
    badge: String,
    theme: { type: String, enum: ['ivory', 'onyx', 'duo'], default: 'ivory' },
    images: [{ src: String, alt: String, _id: false }],
    video: { src: String, poster: String },
    // Cut-out bottle on a transparent background (PNG or WebP with alpha):
    // shown floating across the store. Without it, the main image is used.
    render: { src: String, width: Number, height: Number },
    // Arabic copy; any field left empty falls back to the built-in text or English.
    ar: {
      tagline: String,
      family: String,
      description: String,
      story: String,
      howToWear: String,
      howToStore: String,
      occasions: [String],
      includes: [String],
    },
    notes: {
      top: [noteSchema],
      heart: [noteSchema],
      base: [noteSchema],
      approved: { type: Boolean, default: false },
    },
    wear: [{ time: String, label: String, text: String, _id: false }],
    mood: [String],
    occasions: [String],
    howToWear: String,
    howToStore: String,
    faq: [{ q: String, a: String, _id: false }],
    includes: [String],
    featured: { type: Boolean, default: false },
    published: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    seo: { title: String, description: String },
  },
  { timestamps: true }
);

export default mongoose.model('Product', productSchema);
