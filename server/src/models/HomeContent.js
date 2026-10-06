import mongoose from 'mongoose';

// The homepage layout shared by the website and the app (one document).
// Banners live in their own collection; this holds everything else the admin
// arranges: which products are featured, curated collections and offers.
const homeSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'home', unique: true },
    featuredProducts: [String], // product slugs, in order; empty = products marked "featured"
    collections: [
      {
        title: { type: String, required: true, maxlength: 80 },
        subtitle: { type: String, maxlength: 200 },
        image: String,
        products: [String], // product slugs
        link: String,
        _id: false,
      },
    ],
    offers: [
      {
        title: { type: String, required: true, maxlength: 80 },
        text: { type: String, maxlength: 240 },
        couponCode: { type: String, maxlength: 30 },
        image: String,
        link: String,
        _id: false,
      },
    ],
    bestsellersLimit: { type: Number, default: 8, min: 0, max: 24 },
    blogsLimit: { type: Number, default: 3, min: 0, max: 12 },
  },
  { timestamps: true }
);

export default mongoose.model('HomeContent', homeSchema);
