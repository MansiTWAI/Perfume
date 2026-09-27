import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useTransform } from 'framer-motion';
import Seo, { orgLd } from '../components/Seo';
import { Reveal, SplitHeading, ScrollText, Magnetic, Parallax } from '../components/Motion';
import TwoWorlds from '../components/TwoWorlds';
import AutoVideo from '../components/AutoVideo';
import ProductCard from '../components/ProductCard';
import Img from '../components/Img';
import FloatingProduct from '../components/FloatingProduct';
import NotesStage from '../components/NotesStage';
import { renderFor } from '../lib/renders';
import NoteIcon from '../components/NoteIcon';
import SeasonBand from '../components/SeasonBand';
import ServicePromise from '../components/ServicePromise';
import LatestShelf from '../components/LatestShelf';
import { useApi } from '../hooks/useApi';
import { useProducts } from '../hooks/useProducts';
import { useStore } from '../context/StoreContext';
import { currencySymbol, formatDate, whatsappLink } from '../lib/format';
import { flyToCart } from '../lib/flyToCart';
import { useSectionProgress } from '../hooks/useSectionProgress';
import { INGREDIENTS, productsWith } from '../lib/ingredients';
import { INGREDIENT_AR } from '../lib/i18n';

const EASE = [0.2, 0.7, 0.2, 1];

const CHAPTERS = [
  ['top', 'Top notes', 'The first impression'],
  ['heart', 'Heart notes', 'The character'],
  ['base', 'Base notes', 'The memory'],
];

// The bottle stays on stage while the story scrolls past it: the opening,
// then its top, heart and base notes, as the light warms.
function Opening({ product }) {
  const ref = useRef(null);
  const [lit, setLit] = useState(false);
  const { lang, t } = useStore();
  const scrollYProgress = useSectionProgress(ref);
  const bg = useTransform(scrollYProgress, [0, 0.4, 0.75, 1], ['#0d0a09', '#150f0d', '#1f0f0e', '#2b080c']);
  // The bottle draws a little closer as the story unfolds.
  const productScale = useTransform(scrollYProgress, [0, 1], [1, 1.07]);
  const productY = useTransform(scrollYProgress, [0, 1], ['0%', '-3%']);
  const render = renderFor(product || 'zafreon');

  useEffect(() => {
    let seen = true;
    try {
      seen = !!sessionStorage.getItem('ab_seen');
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => setLit(true), seen ? 150 : 1700);
    return () => clearTimeout(t);
  }, []);

  return (
    <section ref={ref} className={`opening ${lit ? 'is-lit' : ''}`} style={{ position: 'relative' }}>
      <motion.div className="opening-stage" style={{ backgroundColor: bg }}>
        <div className="opening-glow" aria-hidden="true" />
        {/* Layered back to front: the lit burgundy arch, the notes behind the
            bottle, the bottle, the notes passing in front of it. */}
        <div className="opening-arch" aria-hidden="true"><span className="hero-arch" /></div>
        <NotesStage className="opening-notes" variant="zafreon" stage side="back" progress={scrollYProgress} />
        <div className="opening-product">
          <motion.div className="opening-product-inner" style={{ scale: productScale, y: productY }}>
            <FloatingProduct render={render} alt="ZAFREON Eau de Parfum, black and gold bottle with a crystal cap" eager sizes="(max-width: 860px) 60vw, 34vw" strength={0.7} />
          </motion.div>
        </div>
        <NotesStage className="opening-notes opening-notes-front" variant="zafreon" stage side="front" progress={scrollYProgress} />
      </motion.div>

      <div className="opening-scroll">
        <div className="opening-panel opening-hero">
          <div className="container">
            <div className="hero-copy">
              <h1 className="hero-kicker">{t('Luxury perfume house · Hyderabad')}</h1>
              {lang === 'ar' ? (
                // The tagline is kept in English beneath its Arabic rendering.
                <p className="hero-title hero-title-ar" aria-label="اترك بصمتك. leave your signature">
                  <span className="line"><span>اترك</span></span>
                  <span className="line"><em>بصمتك.</em></span>
                  <span className="hero-tagline-en" lang="en">leave your signature</span>
                </p>
              ) : (
                <p className="hero-title" aria-label="Leave your signature.">
                  <span className="line"><span>Leave your</span></span>
                  <span className="line"><em>signature.</em></span>
                </p>
              )}
              <p className="hero-lede">{t('Eaux de Parfum shaped by Indian richness and Middle Eastern artistry, for people who want to be remembered.')}</p>
              <div className="hero-cta">
                <Magnetic><Link to="/fragrances" className="btn btn-primary">{t('Discover the collection')}</Link></Magnetic>
                <span className="hero-hint">{t('Scroll to open {name}', { name: 'ZAFREON' })}</span>
              </div>
            </div>
          </div>
        </div>

        {product &&
          CHAPTERS.map(([key, label, hint], i) => {
            const notes = product.notes?.[key] || [];
            const pictured = notes.find((n) => n.image);
            return (
              <div key={key} className="opening-panel">
                <div className="container">
                  <motion.div
                    className="chapter-copy"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ amount: 0.5 }}
                    transition={{ duration: 1, ease: EASE }}
                  >
                    <p className="eyebrow"><span dir="ltr">{String(i + 1).padStart(2, '0')} / 03</span> · {t(label)}</p>
                    <h2 className="display-l">{t(hint)}</h2>
                    <ul className="chapter-notes">
                      {notes.map((n) => (
                        <li key={n.name}>
                          <NoteIcon name={n.name} size={30} />
                          <span><b>{n.label || n.name}</b><small>{n.description}</small></span>
                        </li>
                      ))}
                    </ul>
                    {pictured && (
                      <figure className="chapter-photo">
                        <img src={pictured.image} alt={`${pictured.label || pictured.name}, ${product.name}`} loading="lazy" />
                        <figcaption>{pictured.label || pictured.name}</figcaption>
                      </figure>
                    )}
                    {i === CHAPTERS.length - 1 && (
                      <Link to={`/fragrances/${product.slug}`} className="text-link chapter-cta">{t('Discover {name}', { name: product.name })}</Link>
                    )}
                  </motion.div>
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}

function Statement() {
  const { t } = useStore();
  const text = t('A fragrance is invisible, yet it can become the most recognisable part of a person. We create for that moment: the memory that remains after the room has changed.');
  return (
    <section className="section statement">
      <div className="container statement-grid">
        <Reveal className="statement-side">
          <p className="eyebrow">{t('The house')}</p>
          <p className="statement-note">{t('Founded on a lifelong passion for perfume and a career in the fragrance industry that began in 2013.')}</p>
          <Link to="/our-story" className="text-link">{t('Read our story')}</Link>
        </Reveal>
        <ScrollText key={text} className="statement-text" text={text} />
      </div>
    </section>
  );
}

function Collection({ products }) {
  const { t } = useStore();
  const [e, z, ...rest] = products;
  return (
    <section className="section collection">
      <div className="container">
        <div className="collection-head">
          <SplitHeading text={t('The Collection')} className="display-xl" />
          <Reveal delay={0.2}><p className="collection-intro">{t('Two Eaux de Parfum with two personalities. ELARISSE is ivory, luminous and made for daylight. ZAFREON is dark, smoky and made for evenings.')}</p></Reveal>
        </div>
        <div className="collection-grid">
          {e && <ProductCard product={e} className="pcard-a" />}
          {z && <ProductCard product={z} index={1} className="pcard-b" />}
        </div>
        {rest.map((p) => (
          <Reveal key={p._id || p.slug} className="duo-band">
            <Link to={`/fragrances/${p.slug}`} className="duo-link">
              {renderFor(p) ? (
                <div className={`duo-img product-stage stage-${p.theme || 'duo'}`}>
                  <FloatingProduct render={renderFor(p)} alt={`${p.name}: ELARISSE and ZAFREON on black marble`} className="fp-plinth" reflect={false} sizes="(max-width: 800px) 90vw, 50vw" strength={0.5} />
                </div>
              ) : (
                <div className="duo-img"><Img src={p.images?.[1]?.src || p.images?.[0]?.src} alt={p.images?.[1]?.alt || p.name} sizes="(max-width: 800px) 100vw, 60vw" /></div>
              )}
              <div className="duo-text">
                <p className="eyebrow">{p.family}</p>
                <h3>{p.name}</h3>
                <p>{p.description}</p>
                <span className="text-link">{t('Discover the gift set')}</span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// A sticky photograph changes as each material scrolls past.
function Ingredients({ products }) {
  const [active, setActive] = useState(0);
  const refs = useRef([]);
  const { lang, t } = useStore();
  const list = INGREDIENTS.filter((i) => productsWith(products, i.key).length).map((i) => (lang === 'ar' ? { ...i, ...INGREDIENT_AR[i.key] } : i));

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => en.isIntersecting && setActive(Number(en.target.dataset.i))),
      { rootMargin: '-45% 0px -45% 0px' }
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [list.length]);

  if (!list.length) return null;
  return (
    <section className="section ingredients">
      <div className="container">
        <div className="ing-head">
          <p className="eyebrow">{t('The materials')}</p>
          <SplitHeading text={t('What the bottle holds')} className="display-l" />
        </div>
        <div className="ing-grid">
          <div className="ing-visual" aria-hidden="true">
            <AnimatePresence mode="popLayout">
              <motion.img
                key={list[active]?.key}
                src={list[active]?.image}
                alt=""
                initial={{ opacity: 0, scale: 1.08 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.1, ease: EASE }}
              />
            </AnimatePresence>
            <span className="ing-count" dir="ltr">{String(active + 1).padStart(2, '0')} / {String(list.length).padStart(2, '0')}</span>
          </div>
          <ol className="ing-list">
            {list.map((ing, i) => (
              <li key={ing.key} ref={(el) => (refs.current[i] = el)} data-i={i} className={i === active ? 'is-active' : ''}>
                <img className="ing-inline" src={ing.image} alt={`${ing.label || ing.key} from the AL BARAKAH campaign`} loading="lazy" />
                <p className="ing-names">{ing.names}</p>
                <h3>{ing.label || ing.key}</h3>
                <p className="ing-story">{ing.story}</p>
                <p className="ing-in">
                  {t('In {list}', {
                    list: productsWith(products, ing.key).map((p, k, arr) => (
                      <span key={p.slug}>
                        <Link to={`/fragrances/${p.slug}`}>{p.name}</Link>
                        {k < arr.length - 1 ? t(' and ') : ''}
                      </span>
                    )),
                  })}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

// The campaign film opens up from a small arch to full height as the
// visitor scrolls, over a blurred, darkened copy of itself.
function Film({ product }) {
  const ref = useRef(null);
  const frame = useRef(null);
  const { priceOf, fmt, addToCart, toast, t, dir } = useStore();
  const scrollYProgress = useSectionProgress(ref);
  const scale = useTransform(scrollYProgress, [0, 0.45], [0.5, 1]);
  const radius = useTransform(scrollYProgress, [0, 0.45], ['50% 50% 0 0 / 30% 30% 0 0', '0% 0% 0 0 / 0% 0% 0 0']);
  const lineA = useTransform(scrollYProgress, [0.25, 0.5], [0, 1]);
  const lineB = useTransform(scrollYProgress, [0.4, 0.65], [0, 1]);
  const side = dir === 'rtl' ? -1 : 1;
  const lineAx = useTransform(scrollYProgress, [0.25, 0.5], [-40 * side, 0]);
  const lineBx = useTransform(scrollYProgress, [0.4, 0.65], [40 * side, 0]);
  const buy = useTransform(scrollYProgress, [0.66, 0.85], [0, 1]);
  if (!product) return null;
  return (
    <section ref={ref} className="film" style={{ position: 'relative' }} aria-label={`${product.name} film`}>
      <div className="film-stage">
        <div className="film-backdrop" aria-hidden="true">
          <AutoVideo src={product.video?.src} poster={product.video?.poster} label="" />
        </div>
        <motion.div ref={frame} className="film-frame" style={{ scale, borderRadius: radius }}>
          <AutoVideo src={product.video?.src} poster={product.video?.poster} label={`${product.name} campaign film`} />
        </motion.div>
        <motion.p className="film-line film-line-a" style={{ opacity: lineA, x: lineAx }}>{t('More than a scent.')}</motion.p>
        <motion.p className="film-line film-line-b" style={{ opacity: lineB, x: lineBx }}><em>{t('A signature.')}</em></motion.p>
        <motion.div className="film-buy" style={{ opacity: buy }}>
          <p className="eyebrow">{product.name} · {product.subtitle}</p>
          <p className="film-price">{fmt(priceOf(product))} <small dir="ltr">{product.sizeLabel}</small></p>
          <div className="film-actions">
            <button
              className="btn btn-primary"
              disabled={product.stock <= 0}
              onClick={() => {
                flyToCart(frame.current?.querySelector('video'));
                addToCart(product);
                toast(t('{name} added to your bag', { name: product.name }));
              }}
            >
              {t('Add to bag')}
            </button>
            <Link to={`/fragrances/${product.slug}`} className="text-link">{t('Discover the scent')}</Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Craft() {
  const { t } = useStore();
  return (
    <section className="craft">
      <Parallax className="craft-img" strength={60}>
        <Img src="/media/elarisse-still.webp" alt="The ELARISSE bottle and its ivory and gold presentation box on black marble" sizes="(max-width: 860px) 100vw, 60vw" />
      </Parallax>
      <div className="container craft-inner">
        <Reveal className="craft-card" y={80}>
          <p className="eyebrow">{t('Craftsmanship')}</p>
          <h2>{t('The bottle is only the beginning')}</h2>
          <p>{t('Luxury is a detail done thoughtfully: the weight of the bottle in the hand, the way the faceted cap catches light, the texture of the box, the first seconds after the fragrance touches skin.')}</p>
          <ul>
            {[['100 ml', 'Eau de Parfum'], ['Faceted', 'crystal-cut cap'], ['Engraved', 'gold collar'], ['Ivory & gold', 'presentation box']].map(([b, rest]) => (
              <li key={b}><b>{t(b)}</b> {t(rest)}</li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

function Markets() {
  const { regions, region, setRegion, lang, t } = useStore();
  return (
    <section className="section markets">
      <div className="container markets-grid">
        <div>
          <p className="eyebrow">{t('India & the Gulf')}</p>
          <SplitHeading text={t('From Hyderabad, for India and the Gulf')} className="display-l" />
          <Reveal delay={0.2}>
            <p className="markets-copy">
              {t('Our home is Hyderabad, a city with centuries of ties to Arabia. We deliver across India and to the United Arab Emirates, with prices shown in your currency including tax.')}
            </p>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <ul className="markets-list">
            {regions.map((r) => (
              <li key={r.code} className={r.code === region.code ? 'is-current' : ''}>
                <span className="m-name">{t(r.name)}</span>
                {r.ships ? (
                  <span className="m-status">{t('Delivery · prices in {currency}', { currency: currencySymbol(r.currency, lang) })}</span>
                ) : (
                  <a className="m-status" href={whatsappLink(t('Hello Al Barakah, I would like to order from {country}.', { country: t(r.name) }))} target="_blank" rel="noreferrer">
                    {t('Order by enquiry · estimate in {currency}', { currency: currencySymbol(r.currency, lang) })}
                  </a>
                )}
                <button className="m-select" aria-pressed={r.code === region.code} onClick={() => setRegion(r.code)}>
                  {t(r.code === region.code ? 'Selected' : 'Select')}
                </button>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

function Journal({ posts }) {
  const { t } = useStore();
  if (!posts?.length) return null;
  const [lead, ...more] = posts;
  return (
    <section className="section journal-home">
      <div className="container">
        <div className="journal-head">
          <SplitHeading text={t('The Journal')} className="display-l" />
          <Link to="/journal" className="text-link">{t('All stories')}</Link>
        </div>
        <div className="journal-grid">
          <Reveal className="jlead" lang="en" dir="ltr">
            <Link to={`/journal/${lead.slug}`}>
              <div className="jlead-img"><Img src={lead.cover?.src} alt={lead.cover?.alt || ''} sizes="(max-width: 800px) 100vw, 55vw" /></div>
              <p className="eyebrow">{lead.category} · {lead.readingMinutes} min</p>
              <h3>{lead.title}</h3>
              <p className="jlead-ex">{lead.excerpt}</p>
            </Link>
          </Reveal>
          <ul className="jlist">
            {more.map((p, i) => (
              <Reveal as="li" key={p._id} delay={0.1 + i * 0.1} lang="en" dir="ltr">
                <Link to={`/journal/${p.slug}`}>
                  <span className="eyebrow">{p.category}</span>
                  <h3>{p.title}</h3>
                  <span className="jdate">{formatDate(p.publishedAt)}</span>
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Closing() {
  const { setFinderOpen, t } = useStore();
  return (
    <section className="closing closing-scene">
      <div className="container closing-inner">
        {/* The two signatures, one set a step behind the other. */}
        <Reveal className="closing-products" y={60}>
          <Link to="/fragrances/elarisse" className="closing-bottle closing-bottle-back" aria-label="ELARISSE">
            <FloatingProduct render={renderFor('elarisse')} alt="" sizes="(max-width: 860px) 36vw, 16vw" strength={0.6} />
          </Link>
          <Link to="/fragrances/zafreon" className="closing-bottle closing-bottle-front" aria-label="ZAFREON">
            <FloatingProduct render={renderFor('zafreon')} alt="" sizes="(max-width: 860px) 40vw, 18vw" strength={0.6} />
          </Link>
        </Reveal>
        <SplitHeading text={t('Find the one that becomes yours.')} className="display-l" />
        <Reveal delay={0.3} className="closing-cta">
          <Link to="/fragrances" className="btn btn-primary">{t('Explore the collection')}</Link>
          <button className="text-link" onClick={() => setFinderOpen(true)}>{t('Take the four-question guide')}</button>
        </Reveal>
      </div>
    </section>
  );
}

export default function Home() {
  const { products } = useProducts();
  const { data: posts } = useApi('/posts?limit=3');
  const zafreon = products.find((p) => p.video?.src);
  const { t } = useStore();

  return (
    <>
      <Seo
        title="Luxury Perfume & Fragrance House in India | AL BARAKAH LIFESTYLE"
        description="AL BARAKAH LIFESTYLE is a contemporary luxury fragrance house from Hyderabad. Discover ELARISSE and ZAFREON Eau de Parfum, delivered across India and to the UAE."
        jsonLd={[orgLd(), { '@context': 'https://schema.org', '@type': 'WebSite', name: 'AL BARAKAH LIFESTYLE', url: window.location.origin }]}
      />
      <Opening product={zafreon} />
      {products.length > 0 && <LatestShelf products={products} />}
      <SeasonBand />
      <Statement />
      {products.length > 0 && <Collection products={products} />}
      <ServicePromise />
      {products.length > 0 && <Ingredients products={products} />}
      <Film product={zafreon} />
      <section className="section worlds-section">
        <div className="container">
          <div className="worlds-head">
            <p className="eyebrow">{t('Day & night')}</p>
            <SplitHeading text={t('Two worlds, one house')} className="display-l" />
          </div>
          <TwoWorlds />
        </div>
      </section>
      <Craft />
      <Markets />
      <Journal posts={posts?.items} />
      <Closing />
    </>
  );
}
