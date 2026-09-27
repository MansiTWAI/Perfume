import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Enquiry, Subscriber } from '../models/Enquiry.js';
import { requireAdmin, asyncHandler } from '../middleware/auth.js';

const r = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { message: 'Too many messages from this connection. Please try again in a few minutes, or write to us on WhatsApp.' } });
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));

r.post(
  '/enquiries',
  limiter,
  asyncHandler(async (req, res) => {
    const { name, email, phone, topic, message } = req.body || {};
    if (!name || !isEmail(email) || !message) {
      return res.status(400).json({ message: 'Please add your name, a valid email and a message.' });
    }
    await Enquiry.create({ name, email, phone, topic, message });
    res.status(201).json({ ok: true });
  })
);

r.post(
  '/subscribers',
  limiter,
  asyncHandler(async (req, res) => {
    const { email, source } = req.body || {};
    if (!isEmail(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
    await Subscriber.updateOne({ email: email.toLowerCase() }, { $setOnInsert: { email, source } }, { upsert: true });
    res.status(201).json({ ok: true });
  })
);

r.get('/enquiries', requireAdmin, asyncHandler(async (_req, res) => res.json(await Enquiry.find().sort({ createdAt: -1 }).limit(300))));

r.patch(
  '/enquiries/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const e = await Enquiry.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.json(e);
  })
);

r.get('/subscribers', requireAdmin, asyncHandler(async (_req, res) => res.json(await Subscriber.find().sort({ createdAt: -1 }))));

export default r;
