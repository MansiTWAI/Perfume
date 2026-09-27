import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import Seo, { breadcrumbLd } from '../components/Seo';
import { Reveal, SplitHeading, Parallax } from '../components/Motion';
import { Accordion, Loading } from '../components/Bits';
import FragranceNotes from '../components/FragranceNotes';
import ProductCard from '../components/ProductCard';
import AutoVideo from '../components/AutoVideo';
import BottleStage from '../components/BottleStage';
import Img from '../components/Img';
import { useProduct } from '../hooks/useProducts';
import { useSolidHeader } from '../hooks/useSolidHeader';
import { useStore } from '../context/StoreContext';
import { whatsappLink } from '../lib/format';
import { flyToCart } from '../lib/flyToCart';
import { NotFound } from './InfoPages';

function Gallery({ product, mainRef }) {
  const media = [...(product.images || [])];
  if (product.video?.src) media.splice(1, 0, { video: product.video.src, src: product.video.poster, alt: `${product.name} film` });
  // The two Eaux de Parfum have a real-time 3D view; the gift set does not.
  if (['zafreon', 'elarisse'].includes(product.slug)) media.splice(1, 0, { three: product.slug, src: media[0]?.src, alt: `${product.name} in 360°` });
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(null);
  const { t } = useStore();
  const cur = media[i] || {};
  return (
    <div className="pgallery">
      <div className="pgallery-main">
        <AnimatePresence mode="wait">
          <motion.div key={i} className="pgallery-stage" initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            {cur.three ? (
              <BottleStage variant={cur.three} interactive className={`pgallery-3d pgallery-3d-${product.theme}`} fallback={{ src: cur.src, alt: cur.alt }} />
            ) : cur.video ? (
              <AutoVideo src={cur.video} poster={cur.src} label={cur.alt} />
            ) : (
              <div
                className={`zoom ${zoom ? 'is-zoom' : ''}`}
               
                onMouseMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setZoom(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
                }}
                onMouseLeave={() => setZoom(null)}
              >
                <Img ref={i === 0 ? mainRef : undefined} src={cur.src} alt={cur.alt} eager={i === 0} sizes="(max-width: 960px) 100vw, 50vw" style={zoom ? { transformOrigin: zoom } : undefined} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="pgallery-thumbs" role="tablist" aria-label={t('Product images')}>
        {media.map((m, k) => (
          <button key={k} role="tab" aria-selected={k === i} aria-label={m.alt} onClick={() => setI(k)}>
            <img src={m.src} alt="" loading="lazy" />
            {m.video && <span aria-hidden="true">{t('Film')}</span>}
            {m.three && <span aria-hidden="true">360°</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function WearTimeline({ wear }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 80%', 'end 60%'] });
  const width = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  if (!wear?.length) return null;
  return (
    <div ref={ref} className="wear" style={{ position: 'relative' }}>
      <div className="wear-line"><motion.i style={{ width }} /></div>
      <ol className="wear-steps">
        {wear.map((w, i) => (
          <Reveal as="li" key={w.time} delay={i * 0.15} className="wear-step">
            <p className="eyebrow">{w.time}</p>
            <h3>{w.label}</h3>
            <p>{w.text}</p>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}

export default function Product() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useProduct(slug);
  const { region, addToCart, toast, priceOf, fmt, t } = useStore();
  const [qty, setQty] = useState(1);
  const buyRef = useRef(null);
  const mainImg = useRef(null);
  const [showBar, setShowBar] = useState(false);
  useSolidHeader(data?.product?.theme === 'ivory');

  useEffect(() => setQty(1), [slug]);

  useEffect(() => {
    const el = buyRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShowBar(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [data]);

  if (loading && !data) return <div className="page-pad"><Loading /></div>;
  if (error?.status === 404) return <NotFound />;
  if (!data) return null;
  const { product: p, related } = data;
  const price = priceOf(p);
  const soldOut = p.stock <= 0;
  const rule = region.ships ? region.shipping : null;
  const noteLine = (tier) => (p.notes?.[tier] || []).map((n) => n.label || n.name).join(t(', '));

  const add = (source) => {
    flyToCart(source || mainImg.current);
    addToCart(p, qty);
    toast(t('{name} added to your bag', { name: p.name }));
  };
  const buyNow = () => {
    addToCart(p, qty);
    navigate('/checkout');
  };

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${p.name} ${p.subtitle}`,
    description: p.description,
    image: (p.images || []).map((i) => window.location.origin + i.src),
    brand: { '@type': 'Brand', name: 'AL BARAKAH LIFESTYLE' },
    sku: p.slug,
    category: 'Eau de Parfum',
    offers: (p.price ? Object.entries(p.price) : []).filter(([, v]) => v).map(([cur, v]) => ({
      '@type': 'Offer',
      url: window.location.href,
      priceCurrency: cur,
      price: v,
      availability: soldOut ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
    })),
  };

  return (
    <div className={`product theme-${p.theme}`}>
      <Seo
        title={p.seo?.title || `${p.name} ${p.subtitle}`}
        description={p.seo?.description || p.description}
        image={p.images?.[0]?.src}
        type="product"
        jsonLd={[ld, breadcrumbLd([['Home', '/'], ['Fragrances', '/fragrances'], [p.name, `/fragrances/${p.slug}`]])]}
      />
      <section className="product-top">
        <div className="container">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/">{t('Home')}</Link><span aria-hidden="true">/</span><Link to="/fragrances">{t('Fragrances')}</Link><span aria-hidden="true">/</span><span aria-current="page">{p.name}</span>
          </nav>
          <div className="product-main">
            <Gallery product={p} mainRef={mainImg} />
            <div className="pinfo">
              <p className="eyebrow">{p.family}</p>
              <SplitHeading as="h1" text={p.name} className="pinfo-name" />
              <p className="pinfo-sub">{p.subtitle} · <span dir="ltr">{p.sizeLabel}</span></p>
              <p className="pinfo-tag">{p.tagline}</p>
              <p className="pinfo-desc">{p.description}</p>

              {p.notes?.top?.length > 0 && (
                <dl className="pinfo-notes">
                  <div><dt>{t('Top')}</dt><dd>{noteLine('top')}</dd></div>
                  <div><dt>{t('Heart')}</dt><dd>{noteLine('heart')}</dd></div>
                  <div><dt>{t('Base')}</dt><dd>{noteLine('base')}</dd></div>
                </dl>
              )}

              <div className="pinfo-price">
                <span>{fmt(price)}</span>
                <small>{region.ships ? t(region.taxLabel) : t('Estimated from UAE dirhams')}</small>
              </div>

              <div className="pinfo-buy" ref={buyRef}>
                <div className="qty qty-lg">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label={t('Decrease quantity')}>−</button>
                  <span aria-live="polite">{qty}</span>
                  <button onClick={() => setQty((q) => Math.min(10, q + 1))} aria-label={t('Increase quantity')}>+</button>
                </div>
                <button className="btn btn-primary btn-add" disabled={soldOut} onClick={() => add()}>
                  {t(soldOut ? 'Sold out' : 'Add to bag')}
                </button>
              </div>
              {!soldOut && <button className="btn btn-ghost btn-block" onClick={buyNow}>{t('Buy now')}</button>}

              <ul className="pinfo-facts">
                <li>{soldOut ? t('Currently unavailable') : p.stock <= 5 ? t('Only {n} left', { n: p.stock }) : t('In stock, dispatched from Hyderabad')}</li>
                <li>
                  {region.ships
                    ? rule && t('Delivery to {country}, complimentary over {amount}', { country: t(region.name), amount: fmt(rule.freeOver) })
                    : t('Delivery to {country} is arranged on request', { country: t(region.name) })}
                </li>
                <li>{t('Complimentary Signature Card gift note at checkout')}</li>
                <li><a href={whatsappLink(t('Hello Al Barakah, I have a question about {name}.', { name: `${p.name} ${p.subtitle}` }))} target="_blank" rel="noreferrer" className="text-link">{t('Ask us on WhatsApp')}</a></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {p.notes?.top?.length > 0 && (
        <section className="section product-notes">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow">{t('The composition')}</p>
              <SplitHeading text={t('Inside {name}', { name: p.name })} className="display-l" />
            </div>
            <FragranceNotes notes={p.notes} name={p.name} />
            <p className="notes-disclaimer">{t('Fragrance perception varies with skin, climate and preference.')}</p>
          </div>
        </section>
      )}

      {p.wear?.length > 0 && (
        <section className="section product-wear">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow">{t('How it wears')}</p>
              <SplitHeading text={t('From the first spray to the memory')} className="display-l" />
            </div>
            <WearTimeline wear={p.wear} />
          </div>
        </section>
      )}

      <section className="product-story">
        <Parallax className="product-story-img" strength={70}>
          <Img src={p.images?.[1]?.src || p.images?.[0]?.src} alt="" sizes="100vw" />
        </Parallax>
        <div className="container product-story-text">
          <Reveal><p className="eyebrow">{t('The story')}</p></Reveal>
          <Reveal delay={0.1}><p className="story-p">{p.story}</p></Reveal>
          {p.occasions?.length > 0 && (
            <Reveal delay={0.2}><p className="story-occasions">{t('Wear it for {list}', { list: p.occasions.join(' · ') })}</p></Reveal>
          )}
        </div>
      </section>

      <section className="section product-details">
        <div className="container narrow">
          <Accordion
            items={[
              [t('How to wear'), p.howToWear],
              [t('How to store'), p.howToStore],
              [t('What is included'), p.includes?.length ? <ul className="dash">{p.includes.map((x) => <li key={x}>{x}</li>)}</ul> : null],
              [t('Delivery & returns'), <p key="s">{t('We deliver across India and to the United Arab Emirates. Delivery charges are shown in your bag before checkout. Read our {link}.', { link: <Link to="/shipping-returns" className="text-link">{t('shipping & returns policy')}</Link> })}</p>],
              ...(p.faq || []).map((f) => [f.q, f.a]),
            ]}
          />
        </div>
      </section>

      {related?.length > 0 && (
        <section className="section related">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow">{t('Also from the house')}</p>
              <SplitHeading text={t('Complete your signature')} className="display-l" />
            </div>
            <div className="product-grid">
              {related.map((r, i) => <ProductCard key={r._id || r.slug} product={r} index={i} />)}
            </div>
          </div>
        </section>
      )}

      <AnimatePresence>
        {showBar && (
          <motion.div className="buybar" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}>
            <img src={p.images?.[0]?.src} alt="" width="44" height="44" />
            <div className="buybar-text"><b>{p.name}</b><span>{fmt(price)}</span></div>
            <button className="btn btn-primary" disabled={soldOut} onClick={(e) => add(e.currentTarget.parentElement.querySelector('img'))}>{t(soldOut ? 'Sold out' : 'Add to bag')}</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
