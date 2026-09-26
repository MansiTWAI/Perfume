import { useEffect, useRef } from 'react';

export const OCCASIONS = [
  { id: 'eid', label: 'Eid', native: 'عيد مبارك', script: 'ar', en: 'Eid Mubarak' },
  { id: 'ramadan', label: 'Ramadan', native: 'رمضان كريم', script: 'ar', en: 'Ramadan Kareem' },
  { id: 'diwali', label: 'Diwali', native: 'शुभ दीपावली', script: 'hi', en: 'Happy Diwali' },
  { id: 'wedding', label: 'Wedding', native: 'شادی مبارک', script: 'ar', lang: 'ur', en: 'Shaadi Mubarak' },
  { id: 'birthday', label: 'Birthday', native: 'जन्मदिन मुबारक', script: 'hi', en: 'Happy Birthday' },
  { id: 'love', label: 'Just because', native: 'مع الحب', script: 'ar', en: 'With love' },
];

// The gift note, inked in gold. The recipient's name is drawn stroke by stroke.
export default function SignatureCard({ name, occasion, message, theme = 'ivory', fragrance }) {
  const o = OCCASIONS.find((x) => x.id === occasion) || OCCASIONS[0];
  const svg = useRef(null);
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    el.classList.remove('draw');
    void el.getBoundingClientRect();
    const t = setTimeout(() => el.classList.add('draw'), 30);
    return () => clearTimeout(t);
  }, [name, occasion, theme]);

  return (
    <div className={`sigcard sigcard-${theme}`}>
      <span className="sigcard-brand">Al Barakah Lifestyle</span>
      <div className="sigcard-greet">
        <span className={`sigcard-native script-${o.script}`} lang={o.lang || (o.script === 'ar' ? 'ar' : 'hi')}>{o.native}</span>
        <span className="sigcard-en">{o.en}</span>
      </div>
      <svg ref={svg} className="sigcard-name" viewBox="0 0 400 110" role="img" aria-label={name || 'Recipient name'}>
        <text x="200" y="78" textAnchor="middle">{name || 'Your name'}</text>
      </svg>
      <p className="sigcard-msg">{message}</p>
      <p className="sigcard-tag">{fragrance ? `with ${fragrance} · ` : ''}leave your signature</p>
    </div>
  );
}
