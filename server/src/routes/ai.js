import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { optionalAuth, asyncHandler } from '../middleware/auth.js';
import { geminiConfigured } from '../services/ai/gemini.js';
import { chatTurn, chatHistory } from '../services/ai/chat.js';

// The website's AI concierge. Gemini is reached only from the server.
const r = Router();
const chatLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 30, message: { message: 'You are sending messages very quickly. Please wait a few minutes, or message us on WhatsApp.' } });

r.get('/status', (_req, res) => res.set('Cache-Control', 'no-store').json({ enabled: geminiConfigured() }));

r.post(
  '/chat',
  chatLimiter,
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (!geminiConfigured()) return res.status(503).json({ code: 'AI_UNAVAILABLE', message: 'Our concierge is not available right now. Please message us on WhatsApp.' });
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) return res.status(400).json({ message: 'Type a message first.' });
    if (message.length > 600) return res.status(400).json({ message: 'Please keep messages under 600 characters.' });
    const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
    try {
      res.json(await chatTurn({ sessionId: str(req.body.sessionId, 64), message, user: req.user, regionCode: str(req.body.region, 2).toUpperCase(), page: str(req.body.page, 120) }));
    } catch (e) {
      if (e.status) return res.status(e.status).json({ code: e.code, message: e.message });
      throw e;
    }
  })
);

r.get(
  '/chat/:sessionId',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const messages = await chatHistory(req.params.sessionId, req.user);
    if (!messages) return res.status(404).json({ message: 'Chat not found.' });
    res.set('Cache-Control', 'no-store').json({ messages });
  })
);

export default r;
