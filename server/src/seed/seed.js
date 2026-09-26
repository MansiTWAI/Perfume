// Seeds products, Journal posts and the admin account.
//   npm run seed            -> inserts only what is missing (safe to re-run)
//   npm run seed -- --reset -> replaces all products and posts with the defaults
import '../env.js';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Product from '../models/Product.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import products from '../../../shared/catalog.js';
import posts from './posts.js';

const reset = process.argv.includes('--reset');

async function upsertAll(Model, docs, label) {
  let created = 0;
  for (const doc of docs) {
    if (reset) {
      await Model.deleteOne({ slug: doc.slug });
    } else if (await Model.exists({ slug: doc.slug })) {
      continue;
    }
    await new Model(doc).save();
    created++;
  }
  console.log(`${label}: ${created} written, ${docs.length - created} left unchanged`);
}

async function run() {
  await connectDB();
  await upsertAll(Product, products, 'Products');
  await upsertAll(Post, posts, 'Journal posts');

  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const passwordHash = await User.hashPassword(password);
    await User.updateOne(
      { email },
      { $set: { role: 'admin', passwordHash }, $setOnInsert: { name: 'Al Barakah Admin', email } },
      { upsert: true }
    );
    console.log(`Admin account ready: ${email}`);
  } else {
    console.log('ADMIN_EMAIL / ADMIN_PASSWORD not set, so no admin account was created.');
  }
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
