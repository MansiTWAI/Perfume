// One consistent line-icon family for fragrance materials: 40px grid,
// 1.2px stroke, round joins. Matched by keyword so "Taif Rose" and
// "Damask Rose" share the rose drawing.
const P = {
  saffron: <><path d="M20 34c-1-8-5-15-11-21" /><path d="M20 34c0-9 1-17 3-25" /><path d="M20 34c2-7 6-13 12-17" /><circle cx="9" cy="13" r="1.4" /><circle cx="23" cy="9" r="1.4" /><circle cx="32" cy="17" r="1.4" /></>,
  rose: <><path d="M20 13c4 0 7 3 7 7s-3 7-7 7-7-3-7-7" /><path d="M20 17c2 0 3 1.5 3 3s-1.5 3-3 3" /><path d="M13 20c-3-2-4-6-2-9 3 1 6 1 9-2 3 3 6 3 9 2 2 3 1 7-2 9" /><path d="M20 27v9" /><path d="M20 32c-3-3-6-3-8-2" /></>,
  jasmine: <><circle cx="20" cy="20" r="2.4" /><path d="M20 17.6c-2-4-1-9 0-11 1 2 2 7 0 11z" /><path d="M22.3 19.3c3-3 8-4 10-3.4-1 2-5.6 4.6-10 3.4z" /><path d="M21.4 22c2.4 3.6 3 8.6 2.4 10.6-1.8-1.2-3.6-6.4-2.4-10.6z" /><path d="M18.6 22c-2.4 3.6-3 8.6-2.4 10.6 1.8-1.2 3.6-6.4 2.4-10.6z" /><path d="M17.7 19.3c-3-3-8-4-10-3.4 1 2 5.6 4.6 10 3.4z" /></>,
  oud: <><path d="M7 25l20-12c3-2 7 0 7 3s-2 4-4 5L10 33c-3 1-5-1-5-3s0-4 2-5z" /><path d="M12 26l14-8" /><path d="M14 30l12-7" /><path d="M29 16c1 1 1 2 0 3" /></>,
  amber: <><path d="M20 6c6 8 9 13 9 18a9 9 0 0 1-18 0c0-5 3-10 9-18z" /><path d="M16 25c0 3 2 5 4 5" /><path d="M14 22l6 3 6-3" /></>,
  vanilla: <><path d="M9 32C15 22 22 14 31 8" /><path d="M11 33C17 23 24 15 33 10" /><path d="M9 32c0 1 1 2 2 1" /><circle cx="28" cy="27" r="2" /><path d="M28 25c0-3 1-4 3-5M30 27c3 0 4 1 5 3M28 29c0 3-1 4-3 5M26 27c-3 0-4-1-5-3" /></>,
  sandalwood: <><circle cx="20" cy="20" r="12" /><circle cx="20" cy="20" r="8" /><circle cx="20" cy="20" r="4" /><path d="M20 8v4M28 20h4" /></>,
  citrus: <><circle cx="20" cy="20" r="12" /><circle cx="20" cy="20" r="9" /><path d="M20 11v18M11 20h18M13.6 13.6l12.8 12.8M26.4 13.6L13.6 26.4" /></>,
  pepper: <><circle cx="15" cy="16" r="4" /><circle cx="24" cy="14" r="3.5" /><circle cx="21" cy="24" r="4" /><circle cx="29" cy="23" r="3" /><circle cx="13" cy="27" r="3" /></>,
  cardamom: <><path d="M12 30c-4-6 0-18 8-22 6 5 8 16 2 22-3 3-7 3-10 0z" /><path d="M13 29C15 22 18 15 20 8" /><path d="M20 8c1-2 2-3 4-3" /></>,
  blossom: <><circle cx="20" cy="20" r="3" /><path d="M20 17c-3-4-3-8 0-10 3 2 3 6 0 10zM23 20c4-3 8-3 10 0-2 3-6 3-10 0zM20 23c3 4 3 8 0 10-3-2-3-6 0-10zM17 20c-4 3-8 3-10 0 2-3 6-3 10 0z" /></>,
  incense: <><path d="M14 33h12" /><path d="M16 33c0-3 1-5 4-5s4 2 4 5" /><path d="M20 28V21" /><path d="M20 21c-3-2-3-5 0-7s3-5 0-7" /><path d="M23 18c2-1 2-3 1-4" /></>,
  musk: <><circle cx="20" cy="20" r="3" /><circle cx="20" cy="20" r="8" strokeDasharray="1.5 3" /><circle cx="20" cy="20" r="13" strokeDasharray="1 4" /></>,
  leaf: <><path d="M10 30C10 18 18 10 31 9c0 13-8 21-21 21z" /><path d="M10 30L25 15" /><path d="M16 24h6M19 21v-5M22 18h5" /></>,
  leather: <><path d="M9 11h22l-2 18H11z" /><path d="M12 14h16l-1.6 12H13.6z" strokeDasharray="2 2" /></>,
  wood: <><path d="M8 28l24-14" /><path d="M11 30l24-14" /><path d="M8 28l3 2M32 14l3 2" /><path d="M16 22c-1-4 1-7 4-8" /><path d="M22 12c0-3 2-4 3-6" /></>,
};

const MATCH = [
  [/saffron/i, 'saffron'], [/rose/i, 'rose'], [/jasmine|mogra/i, 'jasmine'], [/oud|agar/i, 'oud'],
  [/amber/i, 'amber'], [/vanilla/i, 'vanilla'], [/sandal/i, 'sandalwood'], [/bergamot|lemon|orange(?! blossom)|citrus|grapefruit/i, 'citrus'],
  [/pepper/i, 'pepper'], [/cardamom/i, 'cardamom'], [/blossom|neroli/i, 'blossom'], [/frankincense|incense|luban|myrrh/i, 'incense'],
  [/musk/i, 'musk'], [/patchouli|vetiver|leaf/i, 'leaf'], [/leather/i, 'leather'], [/wood|cedar|guaiac/i, 'wood'],
];

export const iconFor = (name = '') => MATCH.find(([rx]) => rx.test(name))?.[1] || 'musk';

export default function NoteIcon({ name, size = 28, className = '' }) {
  return (
    <svg className={`note-icon ${className}`} viewBox="0 0 40 40" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[iconFor(name)]}
    </svg>
  );
}
