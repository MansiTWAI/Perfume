// Delhivery scan push (webhook): POST /api/shipping/delhivery/webhook
//
// Delhivery's team sets this up with the URL and the header we give them
// ("Authorization: Bearer <DELHIVERY_WEBHOOK_TOKEN>"). Every request must
// carry that token; the scan must name a waybill that belongs to one of our
// shipments (and the order reference must match when sent). Repeats are
// harmless: each scan is stored once and the status is recomputed from all
// scans in time order, so late or duplicate pushes never move it backwards.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/auth.js';
import { webhookAuthorized, shipLog } from '../services/delhivery.js';
import { applyPushedScan } from '../services/shipping.js';

const r = Router();
const limiter = rateLimit({ windowMs: 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many requests.' } });

r.post(
  '/delhivery/webhook',
  limiter,
  asyncHandler(async (req, res) => {
    if (!process.env.DELHIVERY_WEBHOOK_TOKEN) return res.status(503).json({ message: 'Not configured.' });
    if (!webhookAuthorized(req)) {
      shipLog('webhook_rejected', { outcome: 'unauthorized' });
      return res.status(401).json({ message: 'Unauthorized.' });
    }
    // One scan, or a batch of up to 50.
    const scans = Array.isArray(req.body) ? req.body : [req.body];
    if (!scans.length || scans.length > 50) return res.status(400).json({ message: 'Send between 1 and 50 scans.' });
    const results = [];
    for (const s of scans) results.push(await applyPushedScan(s));
    if (scans.length === 1) {
      const [one] = results;
      return res.status(one.status).json({ ok: one.status < 300, outcome: one.outcome });
    }
    const bad = results.filter((x) => x.status === 400 || x.status === 409).length;
    res.status(bad === results.length ? 400 : 200).json({ ok: bad < results.length, results: results.map((x) => x.outcome) });
  })
);

export default r;
