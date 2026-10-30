import mongoose from 'mongoose';

// Banners for the website and the mobile app, managed in the admin. `app`
// banners are the store banners of the mobile app: 1080 × 540 images, also
// shown on the website's home and shop pages unless `web` is turned off.
const bannerSchema = new mongoose.Schema(
  {
    eyebrow: { type: String, trim: true, maxlength: 40 }, // small line above the title on the website
    title: { type: String, trim: true, maxlength: 120 },
    subtitle: { type: String, trim: true, maxlength: 240 },
    image: { type: String, required: true }, // desktop / default image
    mobileImage: String,
    webImage: String, // website banner, 2400 × 480 (else the app image is used)
    webPhoneImage: String, // website banner on phones, 1080 × 720
    link: { type: String, maxlength: 500 }, // e.g. /fragrances/zafreon
    buttonLabel: { type: String, maxlength: 40 },
    placement: { type: String, enum: ['hero', 'strip', 'offer', 'app'], default: 'hero' },
    width: Number, // pixels, for uploaded images
    height: Number,
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    web: { type: Boolean, default: true }, // app banners: also shown on the website
    startsAt: Date,
    endsAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model('Banner', bannerSchema);
