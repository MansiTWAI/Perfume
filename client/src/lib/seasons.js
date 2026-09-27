// Gifting seasons. Islamic dates come from the browser's Umm al-Qura
// calendar (the one Saudi Arabia uses), so Ramadan and both Eids move each
// year without anyone updating the site. Moon-sighting can shift an Eid by a
// day; the copy never promises a date.
//
// Preview any season with ?season=ramadan (or eid-fitr-soon, eid-fitr,
// eid-adha-soon, eid-adha, uae-national-day, saudi-national-day,
// saudi-founding-day).

const RAMADAN = {
  id: 'ramadan', card: 'ramadan', moon: true,
  eyebrow: 'Ramadan Kareem', title: 'Gifts for the holy month',
  text: 'Send ELARISSE, ZAFREON or the Signature Duo with a printed Ramadan card, in your own words.',
  cta: ['Choose a gift', '/fragrances/signature-duo'],
};
const EID_SOON = (which) => ({
  id: `${which}-soon`, card: 'eid', moon: true,
  eyebrow: which === 'eid-fitr' ? 'Eid al-Fitr is near' : 'Eid al-Adha is near', title: 'Order early for Eid',
  text: 'Eid gifts with a printed Eid Mubarak card. Order early so your gift arrives in time.',
  cta: ['Choose a gift', '/fragrances/signature-duo'],
});
const EID = (which) => ({
  id: which, card: 'eid', moon: true,
  eyebrow: 'Eid Mubarak', title: 'From our house to yours',
  text: 'Wishing you a blessed Eid. Add a printed Eid card to any order.',
  cta: ['Explore the fragrances', '/fragrances'],
});
const NATIONAL = (id, eyebrow, title, region) => ({
  id, card: 'love', region,
  eyebrow, title,
  text: 'Mark the day with a fragrance gift and a personal Signature Card.',
  cta: ['Choose a gift', '/fragrances/signature-duo'],
});

const ALL = {
  ramadan: RAMADAN,
  'eid-fitr-soon': EID_SOON('eid-fitr'),
  'eid-fitr': EID('eid-fitr'),
  'eid-adha-soon': EID_SOON('eid-adha'),
  'eid-adha': EID('eid-adha'),
  'uae-national-day': NATIONAL('uae-national-day', 'UAE National Day', 'Celebrating the Union', 'AE'),
  'saudi-national-day': NATIONAL('saudi-national-day', 'Saudi National Day', 'Celebrating the Kingdom', 'SA'),
  'saudi-founding-day': NATIONAL('saudi-founding-day', 'Saudi Founding Day', 'Honouring the founding', 'SA'),
};

function hijri(date) {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric' }).formatToParts(date);
    const get = (t) => Number(parts.find((p) => p.type === t)?.value);
    return { month: get('month'), day: get('day') };
  } catch {
    return null; // calendar unsupported: no Islamic seasons
  }
}

// Days from `date` until the next month/day (0 on the day itself).
function daysUntil(date, month, day) {
  const y = date.getFullYear();
  const today = new Date(y, date.getMonth(), date.getDate());
  let target = new Date(y, month - 1, day);
  if (target < today) target = new Date(y + 1, month - 1, day);
  return Math.round((target - today) / 864e5);
}

export function seasonFor(regionCode, date = new Date()) {
  try {
    const forced = new URLSearchParams(window.location.search).get('season');
    if (forced && ALL[forced]) return ALL[forced];
  } catch {
    /* no window */
  }

  const h = hijri(date);
  if (h) {
    if (h.month === 9) return h.day >= 20 ? ALL['eid-fitr-soon'] : ALL.ramadan;
    if (h.month === 10 && h.day <= 3) return ALL['eid-fitr'];
    if (h.month === 12 && h.day <= 9) return ALL['eid-adha-soon'];
    if (h.month === 12 && h.day <= 13) return ALL['eid-adha'];
  }

  // National days, for visitors shopping in that country, from ten days before.
  const near = (m, d) => daysUntil(date, m, d) <= 10;
  if (regionCode === 'AE' && near(12, 2)) return ALL['uae-national-day'];
  if (regionCode === 'SA' && near(9, 23)) return ALL['saudi-national-day'];
  if (regionCode === 'SA' && near(2, 22)) return ALL['saudi-founding-day'];
  return null;
}
