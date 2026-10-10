import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import Media from '../models/Media.js';
import { requireAdmin, asyncHandler } from '../middleware/auth.js';
import { code, slugify } from '../utils.js';

// Images go to Cloudinary when it is configured (CLOUDINARY_* in the server
// environment; the secret never reaches the browser). Without it they are
// stored in MongoDB, as before, so they survive on hosts with a read-only or
// temporary filesystem (Vercel). Serverless request bodies are capped at
// about 4.5 MB, so images must stay under 4 MB.
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_BYTES = 4 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => cb(null, TYPES.includes(file.mimetype)),
});

// The real type, from the file's first bytes: the browser's word for it
// (and the file name) can be anything, e.g. an HTML page named photo.jpg.
export function sniffImage(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: 'image/jpeg', ext: '.jpg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { type: 'image/png', ext: '.png' };
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { type: 'image/webp', ext: '.webp' };
  if (buf.toString('ascii', 4, 8) === 'ftyp' && /^avi[fs]$/.test(buf.toString('ascii', 8, 12))) return { type: 'image/avif', ext: '.avif' };
  return null;
}

// CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud> or the three separate variables.
function cloudinaryConfig() {
  const fromUrl = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(process.env.CLOUDINARY_URL || '');
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || fromUrl?.[3];
  const key = process.env.CLOUDINARY_API_KEY || fromUrl?.[1];
  const secret = process.env.CLOUDINARY_API_SECRET || fromUrl?.[2];
  return cloud && key && secret ? { cloud, key, secret, folder: process.env.CLOUDINARY_FOLDER || 'albarakah' } : null;
}

// Signed upload through Cloudinary's REST API.
async function toCloudinary(cfg, file, publicId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder: cfg.folder, public_id: publicId, timestamp };
  const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  const form = new FormData();
  form.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
  for (const [k, v] of Object.entries(params)) form.append(k, String(v));
  form.append('api_key', cfg.key);
  form.append('signature', crypto.createHash('sha1').update(toSign + cfg.secret).digest('hex'));
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/image/upload`, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) {
    console.error('Cloudinary upload failed:', data?.error?.message || res.status);
    const err = new Error('The image could not be uploaded to cloud storage. Please try again.');
    err.status = 502;
    throw err;
  }
  return data.secure_url;
}

// Stores an uploaded image (req.file from multer, real type already checked):
// Cloudinary when configured, else the database. Returns { src, storage, warning? }.
export async function storeImage(file, ext, baseName) {
  const base = `${slugify(baseName) || 'image'}-${code(5).toLowerCase()}`;
  const cfg = cloudinaryConfig();
  let warning;
  if (cfg) {
    try {
      return { src: await toCloudinary(cfg, file, base), storage: 'cloud' };
    } catch {
      // Cloudinary refused (e.g. a key without upload permission) or is
      // down: keep the image in the database so the upload still works.
      // The reason is in the server log.
      warning = 'Cloud storage refused this image, so it was saved on our own server instead.';
    }
  }
  const name = base + ext;
  await Media.create({ name, contentType: file.mimetype, size: file.size, data: file.buffer });
  return { src: `/uploads/${name}`, storage: 'database', ...(warning && { warning }) };
}

export const receive = (req, res, next) =>
  upload.single('file')(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'That image is larger than 4 MB. Please choose a smaller one.' });
    next(err);
  });

const r = Router();
r.post(
  '/',
  requireAdmin,
  receive,
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Upload a JPG, PNG, WebP or AVIF image under 4 MB.' });
    const real = sniffImage(req.file.buffer);
    if (!real) return res.status(400).json({ message: 'That file is not a JPG, PNG, WebP or AVIF image. Please choose a photo.' });
    req.file.mimetype = real.type;
    res.status(201).json(await storeImage(req.file, real.ext, path.parse(req.file.originalname).name));
  })
);

export const serveUpload = asyncHandler(async (req, res) => {
  const file = await Media.findOne({ name: req.params.name });
  if (!file) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  // Images only, never rendered as a page even if something odd was stored.
  res.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.set('X-Content-Type-Options', 'nosniff');
  res.type(file.contentType && file.contentType.startsWith('image/') ? file.contentType : 'application/octet-stream').send(file.data);
});

export default r;
