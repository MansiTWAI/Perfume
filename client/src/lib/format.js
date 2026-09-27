export const CONTACT = {
  name: 'Mrs Nizam',
  phone: '+91 91112 79997',
  phoneRaw: '919111279997',
  email: 'you@albarakah.me',
  web: 'albarakah.me',
  address: 'Plot Number 61, Friends Colony, Jalpally, Hyderabad, Telangana, India',
};

export const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACT.address)}`;

const LOCALE = { INR: 'en-IN', AED: 'en-AE', SAR: 'en-SA', QAR: 'en-QA', KWD: 'en-KW', OMR: 'en-OM', BHD: 'en-BH' };

// Whole units everywhere, dinars included. In Arabic the currency takes its
// Arabic symbol (د.إ, ر.س …) while the digits stay Latin, as Gulf retailers do.
export function money(amount, currency = 'INR', lang = 'en') {
  const n = Number(amount || 0);
  try {
    return new Intl.NumberFormat(lang === 'ar' ? 'ar-u-nu-latn' : LOCALE[currency] || 'en', {
      style: 'currency',
      currency,
      currencyDisplay: currency === 'INR' || lang === 'ar' ? 'symbol' : 'code',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
}

export function currencySymbol(currency, lang = 'en') {
  if (currency === 'INR') return '₹';
  if (lang !== 'ar') return currency;
  try {
    return new Intl.NumberFormat('ar', { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value || currency;
  } catch {
    return currency;
  }
}

export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

export const whatsappLink = (text) => `https://wa.me/${CONTACT.phoneRaw}?text=${encodeURIComponent(text)}`;

export const cx = (...a) => a.filter(Boolean).join(' ');

// Bundled media above 900px wide also ship an 800px version (name-800.webp).
const HAS_SMALL = /^\/media\/(business-card|duo-triptych|elarisse-bottle|elarisse-campaign|elarisse-logo-dark|elarisse-logo-ivory|elarisse-still|zafreon-campaign|zafreon-logo|zaymara-logo)\.webp$/;
export function srcSet(src) {
  if (!src || !HAS_SMALL.test(src)) return undefined;
  return `${src.replace('.webp', '-800.webp')} 800w, ${src} 1600w`;
}
