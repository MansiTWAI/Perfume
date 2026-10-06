import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { flyToCart } from '../lib/flyToCart';
import { renderFor, renderSrcSet } from '../lib/renders';

const MIN = 8;
const MAX = 92;
const clamp = (v) => Math.min(MAX, Math.max(MIN, v));

// The first note of each tier: "Saffron · Frankincense · Oud".
const notesLine = (p) =>
  ['top', 'heart', 'base']
    .map((k) => p.notes?.[k]?.[0])
    .filter(Boolean)
    .map((n) => n.label || n.name)
    .join(' · ');

function Side({ product, when, className, children }) {
  const { priceOf, fmt, addToCart, toast, t } = useStore();
  const render = renderFor(product);
  const soldOut = product.stock <= 0;
  return (
    <div className={`dn-side ${className}`}>
      {children}
      {render && (
        <Link to={`/fragrances/${product.slug}`} className="dn-bottle" tabIndex={-1} aria-hidden="true">
          <img src={render.src} srcSet={renderSrcSet(render)} sizes="(max-width: 760px) 40vw, 22vw" width={render.w} height={render.h} alt="" fetchpriority="high" />
        </Link>
      )}
      <div className="dn-copy">
        <p className="dn-when">{t(when)}</p>
        <h2 className="dn-name"><Link to={`/fragrances/${product.slug}`}>{product.name}</Link></h2>
        {product.tagline && <p className="dn-mood">{product.tagline}</p>}
        <p className="dn-notes">{notesLine(product) || product.family}</p>
        <div className="dn-buy">
          <span className="dn-price">{fmt(priceOf(product))}</span>
          <button
            className="dn-add"
            disabled={soldOut}
            onClick={(e) => {
              flyToCart(e.currentTarget.closest('.dn-side')?.querySelector('.dn-bottle img'));
              addToCart(product);
              toast(t('{name} added to your bag', { name: product.name }));
            }}
          >
            {t(soldOut ? 'Sold out' : 'Add to bag')}
          </button>
        </div>
      </div>
    </div>
  );
}

// The two signatures split the screen, ELARISSE by day and
// ZAFREON after dark. The side under the pointer leans open; the line can be
// dragged (or moved with the arrow keys) to reveal either one.
export default function DayNight({ day, night, duo, head = true }) {
  const { priceOf, fmt, t } = useStore();
  const ref = useRef(null);
  const [x, setX] = useState(50);
  const [dragging, setDragging] = useState(false);

  // A small sway when the section comes into view shows that the line moves.
  useEffect(() => {
    const el = ref.current;
    let timers = [];
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        timers = [setTimeout(() => setX(57), 500), setTimeout(() => setX(50), 1400)];
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  const toPercent = (clientX) => {
    const r = ref.current.getBoundingClientRect();
    return clamp(((clientX - r.left) / r.width) * 100);
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e) => setX(toPercent(e.clientX));
    const up = () => setDragging(false);
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    return () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
    };
  }, [dragging]);

  // With a mouse, the hovered side leans open a little.
  const lean = (e) => {
    if (dragging || e.pointerType !== 'mouse') return;
    const r = ref.current.getBoundingClientRect();
    setX(e.clientX - r.left < r.width / 2 ? 60 : 40);
  };

  const onKey = (e) => {
    const step = { ArrowLeft: -5, ArrowRight: 5, Home: MIN - x, End: MAX - x }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    setX((v) => clamp(v + step));
  };

  return (
    <section
      ref={ref}
      className={`dn ${dragging ? 'is-dragging' : ''}`}
      style={{ '--x': `${x}%` }}
      onPointerMove={lean}
      onPointerLeave={(e) => e.pointerType === 'mouse' && !dragging && setX(50)}
      aria-labelledby={head ? 'dn-title' : undefined}
    >
      {/* Night lies underneath; day is clipped to the left of the line. The
          headline is drawn in both, so it changes colour exactly at the line. */}
      <Side product={night} when="After dark" className="dn-night">
        {head && <div className="dn-head">
          <p className="dn-kicker">{t('Leave your signature')}</p>
          <p id="dn-title" className="dn-title">{t('Which one is yours?')}</p>
        </div>}
      </Side>
      <Side product={day} when="By day" className="dn-day">
        {head && <div className="dn-head" aria-hidden="true">
          <p className="dn-kicker">{t('Leave your signature')}</p>
          <p className="dn-title">{t('Which one is yours?')}</p>
        </div>}
      </Side>

      <div className="dn-line" aria-hidden="true" />
      <div
        className="dn-handle"
        role="slider"
        tabIndex={0}
        aria-label={t('Day or night')}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={Math.round(x)}
        aria-valuetext={x >= 50 ? day.name : night.name}
        onPointerDown={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onKeyDown={onKey}
      >
        <span aria-hidden="true">‹</span>
        <span className="dn-handle-label">{t('Drag')}</span>
        <span aria-hidden="true">›</span>
      </div>

      {duo && (
        <Link to={`/fragrances/${duo.slug}`} className="dn-duo">
          {renderFor(duo) && <img src={renderFor(duo).sm || renderFor(duo).src} alt="" />}
          <span>{t("Can't choose?")}</span>
          <b>{duo.name} · {fmt(priceOf(duo))}</b>
        </Link>
      )}
    </section>
  );
}
