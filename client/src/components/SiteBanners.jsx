import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useStore } from '../context/StoreContext';
import Icon from './Icon';

// The store banners on the website (home and shop pages), managed in
// Admin → Banners: full width, edge to edge, with the words over the picture.
// Each banner can have its own wide picture (2400 × 480) and phone picture
// (1080 × 720); without them the whole app picture (1080 × 540) is shown on
// the right, never cropped. More than
// one slide by, one at a time. Nothing shows until one is on for the website.
const EVERY_MS = 7000;

function Go({ to, className, children, label, hidden }) {
  if (!to) return <span className={className}>{children}</span>;
  const props = { className, 'aria-label': label, tabIndex: hidden ? -1 : undefined };
  return /^https?:\/\//.test(to)
    ? <a href={to} target="_blank" rel="noreferrer" {...props}>{children}</a>
    : <Link to={to} {...props}>{children}</Link>;
}

export default function SiteBanners({ className = '' }) {
  const { t } = useStore();
  const { data } = useApi('/banners?placement=app&on=web');
  const items = data?.items || [];
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef(null);
  const go = (n) => setI((n + items.length) % items.length);

  useEffect(() => {
    if (items.length < 2 || paused) return undefined;
    const id = setInterval(() => setI((n) => (n + 1) % items.length), EVERY_MS);
    return () => clearInterval(id);
  }, [items.length, paused]);
  useEffect(() => { if (i >= items.length) setI(0); }, [i, items.length]);

  if (!items.length) return null;
  return (
    <section
      className={`site-banners ${className}`}
      aria-roledescription="carousel"
      aria-label={t('Offers and new arrivals')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (touch.current ?? e.changedTouches[0].clientX);
        if (Math.abs(dx) > 40 && items.length > 1) go(i + (dx < 0 ? 1 : -1));
        touch.current = null;
      }}
    >
      <div className="site-banners-track" dir="ltr" style={{ transform: `translateX(${-i * 100}%)` }}>
        {items.map((b, n) => {
          const words = b.eyebrow || b.title || b.subtitle || b.buttonLabel;
          return (
            <article
              key={b.id}
              className={`site-banner${words ? ' has-words' : ''}${b.webImage ? ' has-wide' : ''}${b.webPhoneImage ? ' has-phone' : ''}`}
              aria-roledescription="slide"
              aria-label={`${n + 1} / ${items.length}`}
              aria-hidden={n !== i}
            >
              <Go to={b.link} className="site-banner-img" label={b.title || b.buttonLabel || t('Shop now')} hidden={n !== i || !!words}>
                <picture>
                  {b.webPhoneImage && <source media="(max-width: 760px)" srcSet={b.webPhoneImage} />}
                  <img src={b.webImage || b.image || b.imageUrl} alt={b.title || ''} loading={n ? 'lazy' : 'eager'} decoding="async" />
                </picture>
              </Go>
              {words && (
                <div className="site-banner-copy">
                  <div className="site-banner-words" lang="en" dir="ltr">
                    {b.eyebrow && <p className="site-banner-eyebrow">{b.eyebrow}</p>}
                    {b.title && <h2>{b.title}</h2>}
                    {b.subtitle && <p className="site-banner-sub">{b.subtitle}</p>}
                    {b.link && b.buttonLabel && <Go to={b.link} className="site-banner-btn" hidden={n !== i}>{b.buttonLabel}<Icon name="arrow-right" size={16} /></Go>}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {items.length > 1 && (
        <div className="site-banners-nav">
          <button type="button" className="site-banners-arrow" onClick={() => go(i - 1)} aria-label={t('Previous')}><Icon name="arrow-left" size={18} /></button>
          <div className="site-banners-dots" role="tablist" aria-label={t('Banners')}>
            {items.map((b, n) => <button key={b.id} type="button" role="tab" aria-selected={n === i} aria-label={`${n + 1} / ${items.length}`} className={n === i ? 'is-on' : ''} onClick={() => setI(n)} />)}
          </div>
          <button type="button" className="site-banners-arrow" onClick={() => go(i + 1)} aria-label={t('Next')}><Icon name="arrow-right" size={18} /></button>
        </div>
      )}
    </section>
  );
}
