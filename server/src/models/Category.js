import mongoose from 'mongoose';

// Shop categories managed in the admin (Oud, Floral…). A product belongs to a
// category through its `category` field, which holds the category's name.
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    image: String,
    description: { type: String, maxlength: 400 },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Category', categorySchema);
