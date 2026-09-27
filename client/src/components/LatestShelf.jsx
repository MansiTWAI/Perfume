import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { flyToCart } from '../lib/flyToCart';
import { renderFor } from '../lib/renders';
import FloatingProduct from './FloatingProduct';

const MAX = 10;

// A product without a cut-out render still appears, from its first image.
const imageFor = (p) =>
  renderFor(p) || (p.images?.[0]?.src && { src: p.images[0].src, w: 600, h: 800 });

// The newest products as bottles standing on the page: no cards, no boxes,
// just the render, its shadow and its reflection on a lit floor.
export default function LatestShelf({ products }) {
  const { priceOf, fmt, addToCart, toast, t, dir } = useStore();
  const track = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const latest = [...products]
    .filter((p) => imageFor(p))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, MAX);

  // Arrows only when the shelf is wider than the screen.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => {
      const max = el.scrollWidth - el.clientWidth;
      const pos = Math.abs(el.scrollLeft);
      setEdges({ start: pos < 4, end: pos > max - 4 });
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    addEventListener('resize', measure);
    return () => {
      el.removeEventListener('scroll', measure);
      removeEventListener('resize', measure);
    };
  }, [latest.length]);

  const page = (step) => {
    const el = track.current;
    const sign = dir === 'rtl' ? -1 : 1;
    el?.scrollBy({ left: step * sign * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  if (!latest.length) return null;
  const scrollable = !(edges.start && edges.end);

  return (
    <section className="shelf" aria-labelledby="shelf-title">
      <div className="container shelf-head">
        <div>
          <p className="eyebrow">{t('New arrivals')}</p>
          <h2 id="shelf-title" className="shelf-title">{t('Latest from the house')}</h2>
        </div>
        <div className="shelf-nav">
          {scrollable && (
            <>
              <button className="shelf-arrow" onClick={() => page(-1)} disabled={edges.start} aria-label={t('Previous')}>←</button>
              <button className="shelf-arrow" onClick={() => page(1)} disabled={edges.end} aria-label={t('Next')}>→</button>
            </>
          )}
          <Link to="/fragrances" className="text-link">{t('Shop all')}</Link>
        </div>
      </div>

      <ul ref={track} className={`shelf-track ${scrollable ? 'is-scrollable' : ''}`}>
        {latest.map((p) => {
          const img = imageFor(p);
          const soldOut = p.stock <= 0;
          const wide = img.w / img.h > 1;
          return (
            <li key={p._id || p.slug} className={`shelf-item ${wide ? 'is-wide' : ''}`}>
              <Link to={`/fragrances/${p.slug}`} className="shelf-bottle" aria-label={`${p.name}, ${p.subtitle}`}>
                <FloatingProduct
                  render={img}
                  alt=""
                  className={p.slug === 'signature-duo' ? 'fp-plinth' : undefined}
                  reflect={p.slug !== 'signature-duo'}
                  sizes={wide ? '(max-width: 760px) 80vw, 34vw' : '(max-width: 760px) 46vw, 18vw'}
                />
              </Link>
              <div className="shelf-info">
                <h3><Link to={`/fragrances/${p.slug}`}>{p.name}</Link></h3>
                <p className="shelf-price">{fmt(priceOf(p))}</p>
                <button
                  className="shelf-add"
                  disabled={soldOut}
                  onClick={(e) => {
                    flyToCart(e.currentTarget.closest('.shelf-item')?.querySelector('.fp-img'));
                    addToCart(p);
                    toast(t('{name} added to your bag', { name: p.name }));
                  }}
                >
                  {t(soldOut ? 'Sold out' : 'Add to bag')}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
