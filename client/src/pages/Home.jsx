import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useTransform } from 'framer-motion';
import Seo, { orgLd } from '../components/Seo';
import { Reveal, SplitHeading } from '../components/Motion';
import AutoVideo from '../components/AutoVideo';
import Img from '../components/Img';
import SeasonBand from '../components/SeasonBand';
import ServicePromise from '../components/ServicePromise';
import DayNight from '../components/DayNight';
import Turntable from '../components/Turntable';
import Collection from '../components/story/Collection';
import House from '../components/story/House';
import NotesChapter from '../components/story/NotesChapter';
import Epilogue from '../components/story/Epilogue';
import { WhatsAppBand } from '../components/WhatsAppUpdates';
import { ChapterOpening } from '../components/story/Chapter';
import { useApi } from '../hooks/useApi';
import { useProducts } from '../hooks/useProducts';
import { useStore } from '../context/StoreContext';
import { formatDate } from '../lib/format';
import { flyToCart } from '../lib/flyToCart';
import { useSectionProgress } from '../hooks/useSectionProgress';
import { INGREDIENTS, productsWith } from '../lib/ingredients';
import { INGREDIENT_AR } from '../lib/i18n';

const EASE = [0.2, 0.7, 0.2, 1];


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
    <section className="section ingredients" aria-label={t('The materials')}>
      <div className="container">
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

export default function Home() {
  const { products } = useProducts();
  const { data: posts } = useApi('/posts?limit=3');
  const zafreon = products.find((p) => p.video?.src);
  const bySlug = (slug) => products.find((p) => p.slug === slug);
  const elarisse = bySlug('elarisse');
  const zafreonP = bySlug('zafreon');
  const duo = bySlug('signature-duo');
  const { t } = useStore();

  return (
    <>
      <Seo
        title="Luxury Perfume & Fragrance House in India | AL BARAKAH LIFESTYLE"
        description="AL BARAKAH LIFESTYLE is a contemporary luxury fragrance house from Hyderabad. Discover ELARISSE and ZAFREON Eau de Parfum, delivered across India and to the UAE."
        jsonLd={[orgLd(), { '@context': 'https://schema.org', '@type': 'WebSite', name: 'AL BARAKAH LIFESTYLE', url: window.location.origin }]}
      />
      {/* The homepage reads as one story: the turntable, the collection, five
          chapters and an epilogue, on one continuous dark ground. */}
      <Turntable products={products} />
      <Collection products={products} />
      <SeasonBand />
      <House />
      {elarisse && zafreonP && (
        <section id="two" className="bg-onyx pt-4 text-ivory" aria-labelledby="two-title">
          <ChapterOpening id="two-title" label={t('Chapter two · Two signatures')} title={<>{t('Which one is')} <em className="text-gold-soft">{t('yours?')}</em></>} className="pb-12" />
          <DayNight day={elarisse} night={zafreonP} duo={duo} head={false} />
        </section>
      )}
      <NotesChapter product={zafreonP || zafreon} />
      {products.length > 0 && <Ingredients products={products} />}
      {zafreon && (
        <div id="ritual" className="bg-onyx text-ivory">
          <ChapterOpening label={t('Chapter four · The ritual')} title={<>{t('Worn, not')} <em className="text-gold-soft">{t('just owned')}</em></>} className="pb-6 pt-28" />
          <Film product={zafreon} />
        </div>
      )}
      <section id="promise" className="bg-onyx px-6 py-28 text-ivory md:px-12" aria-labelledby="promise-title">
        <ChapterOpening id="promise-title" label={t('Chapter five · Our promise')} title={<>{t('From our hands')} <em className="text-gold-soft">{t('to yours')}</em></>} className="pb-14" />
        <ServicePromise />
      </section>
      <Journal posts={posts?.items} />
      <WhatsAppBand />
      <Epilogue />
    </>
  );
}
