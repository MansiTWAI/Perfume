import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Seo, { breadcrumbLd } from '../components/Seo';
import { PageHero, PostCard, Loading } from '../components/Bits';
import { Reveal } from '../components/Motion';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import { useStore } from '../context/StoreContext';

export default function Journal() {
  const { t } = useStore();
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const { data: cats = [] } = useApi('/posts/categories');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => setPage(1), [cat, debounced]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 9 });
    if (cat !== 'All') params.set('category', cat);
    if (debounced) params.set('q', debounced);
    api(`/posts?${params}`)
      .then((d) => {
        if (!live) return;
        setItems((prev) => (page === 1 ? d.items : [...prev, ...d.items]));
        setMeta({ pages: d.pages, total: d.total });
      })
      .catch(() => live && setItems([]))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [cat, debounced, page]);

  const showFeature = cat === 'All' && !debounced && items[0]?.featured;
  const feature = showFeature ? items[0] : null;
  const rest = showFeature ? items.slice(1) : items;

  return (
    <>
      <Seo
        title="Luxury Fragrance Journal | Perfume Guides & Stories"
        description="The AL BARAKAH LIFESTYLE Journal: fragrance guides, perfume rituals, the heritage of oud and attar, and the story behind the house."
        jsonLd={breadcrumbLd([['Home', '/'], ['Journal', '/journal']])}
      />
      <PageHero eyebrow={t('The Journal')} title={t('Stories, rituals and guides')} layout="split" image="/media/panel-zafreon.webp" alt="ZAFREON with oud wood and incense smoke" lede={t('A fragrance publication from the house: how to choose, wear and keep a fragrance, the heritage behind the materials, and the story of AL BARAKAH LIFESTYLE.')} />
      <section className="section journal-page">
        <div className="container">
          <div className="filter-row">
            <div className="chips" role="group" aria-label={t('Filter by category')}>
              {['All', ...cats].map((c) => (
                <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{t(c)}</button>
              ))}
            </div>
            <label className="search">
              <span className="sr-only">{t('Search the Journal')}</span>
              <input type="search" placeholder={t('Search the Journal')} value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>

          {feature && (
            <Reveal className="feature-post" lang="en" dir="ltr">
              <Link to={`/journal/${feature.slug}`}>
                <div className="feature-img"><img src={feature.cover?.src} alt={feature.cover?.alt || ''} /></div>
                <div className="feature-body">
                  <p className="eyebrow">Featured · {feature.category}</p>
                  <h2>{feature.title}</h2>
                  <p>{feature.excerpt}</p>
                  <p className="postcard-date">{formatDate(feature.publishedAt)} · {feature.readingMinutes} min read</p>
                  <span className="text-link">Read the story →</span>
                </div>
              </Link>
            </Reveal>
          )}

          {loading && page === 1 ? (
            <Loading />
          ) : items.length === 0 ? (
            <p className="empty">{t('No articles match “{q}”. Try another word, such as oud or storage.', { q: debounced })}</p>
          ) : (
            <motion.div layout className="post-grid">
              {rest.map((p, i) => <PostCard key={p._id} post={p} index={i % 3} />)}
            </motion.div>
          )}

          {page < meta.pages && (
            <div className="center" style={{ marginTop: 56 }}>
              <button className="btn btn-ghost" disabled={loading} onClick={() => setPage((p) => p + 1)}>
                {t(loading ? 'Loading…' : 'Load more stories')}
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
