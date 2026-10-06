import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMotionValueEvent } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import { flyToCart } from '../lib/flyToCart';
import { renderFor, renderSrcSet } from '../lib/renders';
import { useSolidHeader } from '../hooks/useSolidHeader';
import { useSectionProgress } from '../hooks/useSectionProgress';
import { scrollToY } from './SmoothScroll';

// Extra scroll, in viewport heights, that each further bottle takes.
const STEP_VH = 80;

// Each fragrance brings its own light. ELARISSE is the one daylight theme, so
// the header turns solid while it is in front.
const THEMES = { zafreon: 'night', elarisse: 'day', 'signature-duo': 'amber' };
const themeOf = (p) => THEMES[p.slug] || 'night';

// The first note of each tier.
const noteChips = (p) =>
  ['top', 'heart', 'base']
    .map((k) => p.notes?.[k]?.[0])
    .filter(Boolean)
    .map((n) => n.label || n.name);

// The homepage hero: the bottles stand on a lit turntable that turns as the
// page scrolls. The stage stays pinned while each bottle takes its turn in
// front: it sets the colour of the page, its name rises behind it in outline,
// and its notes, price and bag button sit beside it. The arrows, the side
// bottles and a swipe scroll the page to the matching bottle.
export default function Turntable({ products }) {
  const { priceOf, fmt, addToCart, toast, t, lang } = useStore();
  const items = products.filter((p) => renderFor(p));
  const zafreonAt = items.findIndex((p) => p.slug === 'zafreon');
  // ZAFREON opens the show.
  if (zafreonAt > 0) items.unshift(...items.splice(zafreonAt, 1));
  const n = items.length;

  const ref = useRef(null);
  const swipe = useRef(null);
  const [i, setI] = useState(0);
  const progress = useSectionProgress(ref);
  useMotionValueEvent(progress, 'change', (v) => {
    setI(Math.min(n - 1, Math.floor(v * n)));
  });

  const active = items[Math.min(i, n - 1)];
  useSolidHeader(!!active && themeOf(active) === 'day');
  if (!active) return null;

  // Scrolls to the start of bottle k's turn.
  const go = (k) => {
    const el = ref.current;
    if (!el) return;
    const target = ((k % n) + n) % n;
    const span = el.offsetHeight - innerHeight;
    const top = el.getBoundingClientRect().top + scrollY;
    scrollToY(top + (target === 0 ? 0 : (target / n) * span + 2));
  };

  const soldOut = active.stock <= 0;
  const step = lang === 'ar' ? -1 : 1;

  return (
    <section ref={ref} className="tt-track" style={{ height: `calc(100svh + ${(n - 1) * STEP_VH}vh)` }} aria-roledescription={t('carousel')} aria-label={t('The collection')}>
      <div
        className={`tt tt-${themeOf(active)}`}
        onPointerDown={(e) => (swipe.current = e.clientX)}
        onPointerUp={(e) => {
          if (swipe.current === null) return;
          const dx = e.clientX - swipe.current;
          swipe.current = null;
          if (Math.abs(dx) > 50) go(i + (dx < 0 ? step : -step));
        }}
      >
        <div className="tt-ghost" aria-hidden="true" key={active.slug}>
          {active.slug === 'signature-duo' ? 'DUO' : active.name}
        </div>
        <div className="tt-ring" aria-hidden="true" />

        {items.map((p, k) => {
          const pos = (k - i + n) % n;
          const place = pos === 0 ? 'front' : pos === 1 ? 'next' : pos === n - 1 ? 'prev' : 'back';
          const r = renderFor(p);
          return (
            <button
              key={p._id || p.slug}
              className={`tt-bottle is-${place} ${r.w / r.h > 1 ? 'is-wide' : ''}`}
              onClick={() => pos !== 0 && go(k)}
              tabIndex={pos === 0 ? -1 : 0}
              aria-hidden={pos === 0 ? 'true' : undefined}
              aria-label={pos === 0 ? undefined : t('Show {name}', { name: p.name })}
            >
              <img src={r.src} srcSet={renderSrcSet(r)} sizes="(max-width: 760px) 50vw, 30vw" width={r.w} height={r.h} alt="" draggable="false" fetchpriority={pos === 0 ? 'high' : undefined} />
            </button>
          );
        })}

        <div className="tt-intro">
          <h1 className="tt-kicker">{t('Luxury perfume house · Hyderabad')}</h1>
          <p className="tt-tagline">{t('Leave your signature.')}</p>
        </div>

        <div className="tt-panel" aria-live="polite">
          <h2 className="tt-name"><Link to={`/fragrances/${active.slug}`}>{active.name}</Link></h2>
          {active.tagline && <p className="tt-mood">{active.tagline}</p>}
          <ul className="tt-notes">
            {noteChips(active).map((name) => <li key={name}>{name}</li>)}
          </ul>
          <div className="tt-buy">
            <span className="tt-price">{fmt(priceOf(active))}</span>
            <button
              className="tt-add"
              disabled={soldOut}
              onClick={(e) => {
                flyToCart(e.currentTarget.closest('.tt')?.querySelector('.tt-bottle.is-front img'));
                addToCart(active);
                toast(t('{name} added to your bag', { name: active.name }));
              }}
            >
              {t(soldOut ? 'Sold out' : 'Add to bag')}
            </button>
          </div>
        </div>

        {n > 1 && (
          <>
            <div className="tt-ctrl">
              <span className="tt-count" dir="ltr">{String(i + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</span>
              <button className="tt-arrow" onClick={() => go(i - step)} aria-label={t('Previous')}>←</button>
              <button className="tt-arrow" onClick={() => go(i + step)} aria-label={t('Next')}>→</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
