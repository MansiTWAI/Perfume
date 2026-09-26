import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import Media from '../models/Media.js';
import { requireAdmin, asyncHandler } from '../middleware/auth.js';
import { code, slugify } from '../utils.js';

// Uploads are stored in MongoDB so they survive on hosts with a read-only or
// temporary filesystem (Vercel). Serverless request bodies are capped at
// about 4.5 MB, so images must stay under 4 MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.mimetype)),
});

const r = Router();
r.post(
  '/',
  requireAdmin,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Upload a JPG, PNG, WebP or AVIF image under 4 MB.' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    const name = `${slugify(path.basename(req.file.originalname, ext)) || 'image'}-${code(5).toLowerCase()}${ext}`;
    await Media.create({ name, contentType: req.file.mimetype, size: req.file.size, data: req.file.buffer });
    res.status(201).json({ src: `/uploads/${name}` });
  })
);

export const serveUpload = asyncHandler(async (req, res) => {
  const file = await Media.findOne({ name: req.params.name });
  if (!file) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.type(file.contentType).send(file.data);
});

export default r;
