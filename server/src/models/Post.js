import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    excerpt: String,
    content: { type: String, default: '' }, // Markdown
    cover: { src: String, alt: String },
    category: { type: String, default: 'Journal' },
    tags: [String],
    author: { type: String, default: 'AL BARAKAH LIFESTYLE' },
    readingMinutes: { type: Number, default: 1 },
    featured: { type: Boolean, default: false },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    publishedAt: Date,
    relatedProducts: [String], // product slugs
    seo: { title: String, description: String },
  },
  { timestamps: true }
);

postSchema.pre('save', function (next) {
  const words = (this.content || '').split(/\s+/).filter(Boolean).length;
  this.readingMinutes = Math.max(1, Math.round(words / 220));
  if (this.status === 'published' && !this.publishedAt) this.publishedAt = new Date();
  next();
});

postSchema.index({ title: 'text', excerpt: 'text', content: 'text', tags: 'text' });

export default mongoose.model('Post', postSchema);
