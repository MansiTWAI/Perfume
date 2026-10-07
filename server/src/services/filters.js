// Shared admin filters: report periods and order filters. The order list, the
// Excel exports and the user reports all build their queries here, so a
// filter always means the same thing on screen and in the file.
import mongoose from 'mongoose';
import User from '../models/User.js';
import { ORDER_STATUSES } from '../config/commerce.js';
import { escapeRegex } from '../utils.js';

const DAY = 24 * 60 * 60 * 1000;

export const PERIODS = {
  '24h': 'Last 24 hours',
  '1d': 'Last 1 day (yesterday)',
  '7d': 'Last 7 days',
  '1m': 'Last 1 month',
  '2m': 'Last 2 months',
  '3m': 'Last 3 months',
  custom: 'Custom range',
  all: 'All time',
};

// `tz` is the admin's browser offset (Date#getTimezoneOffset, minutes), so
// calendar boundaries such as "yesterday" and custom dates follow their clock.
function localMidnight(date, tz) {
  const shifted = new Date(date.getTime() - tz * 60000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() + tz * 60000);
}

function parseDay(s, tz) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getTime() + tz * 60000);
}

// Returns { from, to, label, key } or throws a 400 for a bad custom range.
export function periodRange(q = {}, now = new Date()) {
  const key = PERIODS[q.period] ? q.period : 'all';
  const tz = Math.max(-840, Math.min(840, parseInt(q.tz, 10) || 0));
  let from = null;
  let to = null;
  if (key === '24h') from = new Date(now.getTime() - DAY);
  if (key === '1d') {
    to = localMidnight(now, tz);
    from = new Date(to.getTime() - DAY);
  }
  if (key === '7d') from = new Date(now.getTime() - 7 * DAY);
  if (['1m', '2m', '3m'].includes(key)) {
    from = new Date(now);
    from.setMonth(from.getMonth() - Number(key[0]));
  }
  if (key === 'custom') {
    from = parseDay(q.from, tz);
    const end = parseDay(q.to, tz);
    to = end ? new Date(end.getTime() + DAY) : null; // the "to" day is included
    if (!from && !to) throw Object.assign(new Error('Choose a start or end date for the custom range.'), { status: 400 });
    if (from && to && from >= to) throw Object.assign(new Error('The start date must be on or before the end date.'), { status: 400 });
  }
  const label = key === 'custom' ? `${from ? q.from : 'Start'} to ${to ? q.to : 'today'}` : PERIODS[key];
  return { key, from, to, label, tz };
}

export const dateMatch = ({ from, to }) => {
  if (!from && !to) return null;
  const m = {};
  if (from) m.$gte = from;
  if (to) m.$lt = to;
  return m;
};

// Everything the admin order screen can filter by. `customer` is a user id:
// their orders are the ones linked to the account or placed with its email,
// exactly as the customer's own "My orders" page finds them.
export async function orderFilter(q = {}, { withPeriod = true } = {}) {
  const and = [];
  if (q.status && ORDER_STATUSES.includes(q.status)) and.push({ status: q.status });
  if (['pending', 'paid', 'partially_refunded', 'refunded'].includes(q.paymentStatus)) and.push({ paymentStatus: q.paymentStatus });
  if (['INR', 'AED'].includes(q.currency)) and.push({ currency: q.currency });
  if (q.product) {
    and.push(mongoose.isValidObjectId(q.product) ? { 'items.product': new mongoose.Types.ObjectId(q.product) } : { 'items.slug': String(q.product) });
  }
  if (q.customer && mongoose.isValidObjectId(q.customer)) {
    const u = await User.findById(q.customer).select('email').lean();
    and.push(u ? { $or: [{ user: u._id }, { 'customer.email': u.email }] } : { _id: null });
  }
  const text = String(q.q || '').trim().slice(0, 80);
  if (text) {
    const rx = new RegExp(escapeRegex(text), 'i');
    and.push({ $or: [{ orderNumber: rx }, { trackingId: rx }, { 'customer.name': rx }, { 'customer.email': rx }, { 'customer.phone': rx }, { 'customer.address.city': rx }] });
  }
  let period = null;
  if (withPeriod) {
    period = periodRange(q);
    const m = dateMatch(period);
    if (m) and.push({ createdAt: m });
  }
  return { filter: and.length ? { $and: and } : {}, period };
}

// A short, readable description of the active filters, for report headers.
export function describeFilters(q = {}) {
  const parts = [];
  if (q.status) parts.push(`status: ${q.status}`);
  if (q.paymentStatus) parts.push(`payment: ${q.paymentStatus}`);
  if (q.currency) parts.push(`market: ${q.currency === 'INR' ? 'India (INR)' : 'UAE (AED)'}`);
  if (q.product) parts.push(`product: ${q.product}`);
  if (q.customer) parts.push(`customer: ${q.customer}`);
  if (q.q) parts.push(`search: "${q.q}"`);
  if (q.role) parts.push(`role: ${q.role}`);
  if (q.activity && q.activity !== 'all') parts.push(`users: ${q.activity === 'ordered' ? 'ordered in period' : q.activity === 'registered' ? 'registered in period' : 'never ordered'}`);
  return parts.join(' · ') || 'none';
}
