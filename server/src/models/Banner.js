import mongoose from 'mongoose';

// Banners for the website and the mobile app, managed in the admin. `app`
// banners are the store banners of the mobile app: 1080 × 540 images.
const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, maxlength: 120 },
    subtitle: { type: String, trim: true, maxlength: 240 },
    image: { type: String, required: true }, // desktop / default image
    mobileImage: String,
    link: { type: String, maxlength: 500 }, // e.g. /fragrances/zafreon
    buttonLabel: { type: String, maxlength: 40 },
    placement: { type: String, enum: ['hero', 'strip', 'offer', 'app'], default: 'hero' },
    width: Number, // pixels, for uploaded images
    height: Number,
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    startsAt: Date,
    endsAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model('Banner', bannerSchema);
