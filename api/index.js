// Vercel serverless entry: the whole Express app runs as one function.
// Static files (the built React app, /media, /assets) are served by Vercel's
// CDN from client/dist; everything else is rewritten here (see vercel.json).
import app from '../server/src/app.js';

export default app;
