import jwt from 'jsonwebtoken';
import User, { STAFF_ROLES } from '../models/User.js';

// `mfa` marks a sign-in that passed the emailed two-step code. Staff need it
// for every staff endpoint; customers never do.
export const signToken = (user, { mfa = false } = {}) =>
  jwt.sign({ sub: user._id.toString(), role: user.role, v: user.tokenVersion || 0, ...(mfa && { mfa: 1 }) }, process.env.JWT_SECRET, { expiresIn: '7d' });

async function readUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    // Tokens issued before a password change or 'sign out everywhere' stop working,
    // and so do those of blocked accounts.
    if (!user || (payload.v || 0) !== (user.tokenVersion || 0) || user.status === 'blocked') return null;
    req.authMfa = payload.mfa === 1;
    return user;
  } catch {
    return null;
  }
}

// A staff session from before two-step sign-in (or without it): sign in again.
const mfaNeeded = (res) =>
  res.status(401).json({ code: 'MFA_REQUIRED', message: 'Please sign in again with the code we email you.' });
export const isStaff = (user) => STAFF_ROLES.includes(user?.role);
// An admin who signed in with the two-step code (for routes that only show more to admins).
export const isAdminSession = (req) => req.user?.role === 'admin' && req.authMfa === true;

// Attaches req.user when a valid token is present, but never blocks.
export async function optionalAuth(req, _res, next) {
  req.user = await readUser(req);
  next();
}

export async function requireAuth(req, res, next) {
  req.user = await readUser(req);
  if (!req.user) return res.status(401).json({ message: 'Please sign in to continue.' });
  next();
}

export async function requireAdmin(req, res, next) {
  req.user = await readUser(req);
  if (!req.user) return res.status(401).json({ message: 'Please sign in to continue.' });
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access only.' });
  if (!req.authMfa) return mfaNeeded(res);
  next();
}

// Staff endpoints: the signed-in user must have one of the given roles.
// Admins can do everything.
export const requireRole = (...roles) =>
  async function (req, res, next) {
    req.user = req.user || (await readUser(req));
    if (!req.user) return res.status(401).json({ message: 'Please sign in to continue.' });
    if (req.user.role !== 'admin' && !roles.includes(req.user.role)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Your role does not have access to this.' });
    }
    if (!req.authMfa) return mfaNeeded(res);
    next();
  };

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
