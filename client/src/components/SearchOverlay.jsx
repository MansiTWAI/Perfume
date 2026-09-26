import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import { useProducts } from '../hooks/useProducts';
import { api } from '../lib/api';
import { money } from '../lib/format';
import { stopScroll } from './SmoothScroll';

const SUGGESTIONS = ['Oud', 'Saffron', 'Jasmine', 'Gift', 'Evening'];

// Searches fragrances by name, family, notes, mood and occasion, and the
// Journal by title and tags.
export default function SearchOverlay() {
  const { searchOpen, setSearchOpen, currency } = useStore();
  const { products } = useProducts();
  const [q, setQ] = useState('');
  const [posts, setPosts] = useState([]);
  const input = useRef(null);

  useEffect(() => {
    stopScroll(searchOpen);
    if (searchOpen) setTimeout(() => input.current?.focus(), 60);
    else setQ('');
    const esc = (e) => e.key === 'Escape' && setSearchOpen(false);
    if (searchOpen) addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [searchOpen, setSearchOpen]);

  const term = q.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!term) return [];
    return products
      .map((p) => {
        const notes = ['top', 'heart', 'base'].flatMap((t) => p.notes?.[t] || []).map((n) => n.name);
        const hay = [p.name, p.family, p.tagline, p.category, ...(p.mood || []), ...(p.occasions || [])].join(' ').toLowerCase();
        const note = notes.find((n) => n.toLowerCase().includes(term));
        if (!note && !hay.includes(term)) return null;
        return { p, why: note ? `Contains ${note}` : p.family };
      })
      .filter(Boolean);
  }, [products, term]);

  useEffect(() => {
    if (term.length < 2) return setPosts([]);
    const t = setTimeout(() => {
      api(`/posts?q=${encodeURIComponent(term)}&limit=4`).then((d) => setPosts(d.items)).catch(() => setPosts([]));
    }, 250);
    return () => clearTimeout(t);
  }, [term]);

  const close = () => setSearchOpen(false);

  return (
    <AnimatePresence>
      {searchOpen && (
        <motion.div
          className="search-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-lenis-prevent
        >
          <div className="container search-inner">
            <div className="search-bar">
              <label htmlFor="site-search" className="sr-only">Search fragrances, notes and stories</label>
              <input
                id="site-search"
                ref={input}
                type="search"
                autoComplete="off"
                placeholder="Search a fragrance, a note, a story"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button className="text-btn" onClick={close}>Close</button>
            </div>

            {!term && (
              <div className="search-suggest">
                <p className="eyebrow">Try</p>
                <div className="chips">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className="chip" onClick={() => setQ(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            {term && (
              <div className="search-results">
                <section>
                  <p className="eyebrow">Fragrances</p>
                  {matches.length === 0 ? (
                    <p className="muted">No fragrance matches “{q}”.</p>
                  ) : (
                    <ul>
                      {matches.map(({ p, why }) => (
                        <li key={p.slug}>
                          <Link to={`/fragrances/${p.slug}`} onClick={close} className="search-product">
                            <img src={p.images?.[0]?.src} alt="" width="64" height="84" />
                            <span><b>{p.name}</b><small>{why}</small></span>
                            <span className="search-price">{money(p.price?.[currency], currency)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section>
                  <p className="eyebrow">From the Journal</p>
                  {posts.length === 0 ? (
                    <p className="muted">{term.length < 2 ? 'Keep typing…' : 'No stories match yet.'}</p>
                  ) : (
                    <ul>
                      {posts.map((p) => (
                        <li key={p.slug}>
                          <Link to={`/journal/${p.slug}`} onClick={close} className="search-post">
                            <span>{p.title}</span>
                            <small>{p.category}</small>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
