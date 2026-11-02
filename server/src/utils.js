import crypto from 'crypto';

export const slugify = (s = '') =>
  String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function code(len) {
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

// An address mail can actually be sent to: name@domain.tld with no spaces, no
// ".." and a real top-level domain, so typos like "name@gmail..com" or
// "name@gmail" are refused when typed instead of failing later at sending.
export const isEmail = (e) => {
  const s = String(e ?? '').trim();
  return s.length <= 254 && !s.includes('..') && !/\.@/.test(s) && /^[^\s@,;<>()"'.][^\s@,;<>()"']*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}$/i.test(s);
};

export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
