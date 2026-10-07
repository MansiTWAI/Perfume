import { Router } from 'express';
import { validPhone } from '../models/User.js';
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
    // The website asks for a mobile number; the app API keeps it optional.
    if (!phone && !req.apiV1) return res.status(400).json({ message: 'Please enter your mobile number.', errors: [{ field: 'phone', message: 'phone is required' }] });
    if (phone && !validPhone(String(phone))) return res.status(400).json({ message: 'Please enter a valid mobile number, e.g. +91 98765 43210.', errors: [{ field: 'phone', message: 'Invalid phone number' }] });
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
    const { status } = req.body || {};
    if (!['new', 'replied', 'closed'].includes(status)) return res.status(400).json({ message: 'Status must be new, replied or closed.' });
    const e = await Enquiry.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!e) return res.status(404).json({ message: 'Enquiry not found.' });
    res.json(e);
  })
);

r.get('/subscribers', requireAdmin, asyncHandler(async (_req, res) => res.json(await Subscriber.find().sort({ createdAt: -1 }))));

export default r;
