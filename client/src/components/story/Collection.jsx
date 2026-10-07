import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { flyToCart } from '../../lib/flyToCart';
import { renderFor } from '../../lib/renders';
import { ChapterOpening } from './Chapter';

const SLOTS = 4;
const EASE = [0.2, 0.7, 0.2, 1];

// The light inside each arch, after the fragrance's own world.
const STAGE = {
  elarisse: 'bg-[radial-gradient(70%_60%_at_50%_45%,#fffaf0,#e8dcc4)]',
  zafreon: 'bg-[radial-gradient(70%_60%_at_50%_45%,#3a2520,#120c0a)]',
  'signature-duo': 'bg-[radial-gradient(70%_60%_at_50%_45%,#6a1a22,#2b080c)]',
};
const DEFAULT_STAGE = 'bg-[radial-gradient(70%_60%_at_50%_45%,#2a1e19,#0d0a09)]';

// Right after the hero: every fragrance in a row of four. When the house has
// fewer than four, the last card opens the four-question guide.
export default function Collection({ products }) {
  const { priceOf, fmt, addToCart, toast, t, setFinderOpen } = useStore();
  const list = [...products]
    .filter((p) => p.published !== false && (renderFor(p) || p.images?.[0]?.src))
    .sort((a, b) => (b.featured === true) - (a.featured === true) || (a.sortOrder || 0) - (b.sortOrder || 0))
    .slice(0, SLOTS);
  if (!list.length) return null;

  const reveal = (i) => ({
    initial: { opacity: 0, y: 40 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '0px 0px -10% 0px' },
    transition: { duration: 0.9, delay: i * 0.08, ease: EASE },
  });

  return (
    <section id="collection" className="relative bg-onyx px-6 pb-28 pt-10 text-ivory md:px-12" aria-labelledby="collection-title">
      <ChapterOpening id="collection-title" label={t('The collection')} title={<>{t('Find your')} <em className="text-gold-soft">{t('signature')}</em></>}>
        <p className="mt-4 max-w-md text-mute">{t('Every fragrance the house makes, side by side. Choose one, or let us help.')}</p>
      </ChapterOpening>

      <ul className="mx-auto mt-14 grid max-w-[calc(var(--max)_-_2*var(--gutter))] list-none auto-cols-[78%] grid-flow-col snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [scrollbar-width:none] md:auto-cols-auto [&::-webkit-scrollbar]:hidden md:grid-flow-row md:grid-cols-4 md:overflow-visible">
        {list.map((p, i) => {
          const render = renderFor(p);
          const soldOut = p.stock <= 0;
          const wide = render && render.w / render.h > 1;
          return (
            <motion.li key={p._id || p.slug} {...reveal(i)} className="group snap-start">
              <Link to={`/fragrances/${p.slug}`} className={`relative grid h-80 items-end justify-items-center overflow-hidden rounded-arch ${STAGE[p.slug] || DEFAULT_STAGE}`} aria-label={p.name}>
                {(p.badge || soldOut) && (
                  <span className="absolute left-1/2 top-5 -translate-x-1/2 rounded-sm bg-onyx/70 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-gold-soft">{t(soldOut ? 'Sold out' : p.badge)}</span>
                )}
                <img
                  src={render ? render.sm || render.src : p.images[0].src}
                  alt=""
                  loading="lazy"
                  className={`${render ? (wide ? 'mb-8 h-40' : 'mb-4 h-60') : 'h-full w-full object-cover'} transition duration-700 ease-out group-hover:-translate-y-2`}
                />
              </Link>
              <div className="px-2 pt-6 text-center">
                <h3 className="font-display text-2xl tracking-[0.08em]"><Link to={`/fragrances/${p.slug}`}>{p.name}</Link></h3>
                <p className="mt-1 text-sm text-mute">{p.family || p.subtitle}</p>
                <div className="mt-4 flex items-center justify-center gap-4">
                  <span className="font-display text-xl">{fmt(priceOf(p))}</span>
                  <button
                    className="rounded-sm bg-gold-soft px-5 py-2.5 text-[11px] uppercase tracking-[0.2em] text-onyx transition hover:bg-champagne disabled:opacity-50"
                    disabled={soldOut}
                    aria-label={t('Add {name} to your bag', { name: p.name })}
                    onClick={(e) => {
                      flyToCart(e.currentTarget.closest('li')?.querySelector('img'));
                      addToCart(p);
                      toast(t('{name} added to your bag', { name: p.name }));
                    }}
                  >
                    + {t(soldOut ? 'Sold out' : 'Bag')}
                  </button>
                </div>
              </div>
            </motion.li>
          );
        })}

        {list.length < SLOTS && (
          <motion.li {...reveal(list.length)} className="snap-start">
            <button className="flex h-80 w-full flex-col items-center justify-center gap-4 rounded-arch bg-[radial-gradient(80%_70%_at_50%_30%,#5a1520,#2b080c)] p-8 text-center" onClick={() => setFinderOpen(true)}>
              <span className="font-display text-3xl">{t('Not sure which one?')}</span>
              <span className="text-sm text-ivory/80">{t('Answer four questions and we will match your scent.')}</span>
              <span className="text-[11px] uppercase tracking-[0.22em] text-gold-soft">{t('Take the guide')}</span>
            </button>
          </motion.li>
        )}
      </ul>
    </section>
  );
}
