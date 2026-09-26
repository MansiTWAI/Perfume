import mongoose from 'mongoose';

// One shared connection per process. Serverless instances reuse it across
// requests instead of opening a new connection every time.
let pending = null;

export function connectDB(uri = process.env.MONGODB_URI) {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (!uri) return Promise.reject(new Error('MONGODB_URI is not set.'));
  if (!pending) {
    mongoose.set('strictQuery', true);
    pending = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 5 })
      .then((m) => {
        console.log(`MongoDB connected: ${m.connection.name}`);
        return m.connection;
      })
      .catch((e) => {
        pending = null;
        throw e;
      });
  }
  return pending;
}
