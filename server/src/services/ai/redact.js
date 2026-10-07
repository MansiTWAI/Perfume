// What a customer types is checked here before anything reaches Gemini.
// Contact details are pulled out and kept on our side (for the lead and for
// order lookups); the model only sees a placeholder. Card numbers, CVVs,
// OTPs and passwords are never stored or forwarded.

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Phone: 10+ digits with optional +, spaces, dashes or brackets.
const PHONE = /(?:\+?\d[\d\s().-]{8,}\d)/g;
const CARD = /\b(?:\d[ -]?){15,19}\b/; // card lengths, longer than phone numbers
const SECRET_WORDS = /\b(password|passcode|pass word|cvv|cvc|otp|one[- ]time (?:password|code)|pin)\b/i;

const luhn = (digits) => {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = +digits[digits.length - 1 - i];
    if (i % 2) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
};

export function inspect(raw) {
  const text = String(raw || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  const card = text.match(CARD)?.[0]?.replace(/\D/g, '');
  if (card && card.length >= 15 && luhn(card)) return { blocked: 'card' };
  if (SECRET_WORDS.test(text) && /\d{4,}|:\s*\S+/.test(text)) return { blocked: 'secret' };

  const emails = [...new Set((text.match(EMAIL) || []).map((e) => e.toLowerCase()))];
  let safe = text.replace(EMAIL, '[email shared]');
  const phones = [];
  safe = safe.replace(PHONE, (m) => {
    const digits = m.replace(/\D/g, '');
    // Order numbers and prices are not phone numbers.
    if (digits.length < 10 || digits.length > 15) return m;
    phones.push((m.trim().startsWith('+') ? '+' : '') + digits);
    return '[phone shared]';
  });
  return { safe, email: emails[0] || null, phone: phones[0] || null };
}

// For text shown to the model from stored conversations (admin summaries).
export const scrub = (s) => String(s || '').replace(EMAIL, '[email]').replace(PHONE, (m) => (m.replace(/\D/g, '').length >= 10 ? '[phone]' : m));
