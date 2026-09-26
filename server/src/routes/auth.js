import { Router } from 'express';
import User from '../models/User.js';
import { signToken, requireAuth, asyncHandler } from '../middleware/auth.js';

const r = Router();

r.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required.' });
    if (String(password).length < 8) return res.status(400).json({ message: 'Use a password of at least 8 characters.' });
    const exists = await User.findOne({ email: String(email).toLowerCase() });
    if (exists) return res.status(409).json({ message: 'An account with this email already exists. Sign in instead.' });
    const user = await User.create({ name, email, passwordHash: await User.hashPassword(password) });
    res.status(201).json({ token: signToken(user), user: user.toSafe() });
  })
);

r.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email: String(email || '').toLowerCase() });
    if (!user || !(await user.checkPassword(String(password || '')))) {
      return res.status(401).json({ message: 'That email and password do not match.' });
    }
    res.json({ token: signToken(user), user: user.toSafe() });
  })
);

r.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toSafe() }));

export default r;
