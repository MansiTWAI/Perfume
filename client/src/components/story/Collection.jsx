import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { flyToCart } from '../../lib/flyToCart';
import { renderFor } from '../../lib/renders';
import { ChapterOpening } from './Chapter';

const PER_ROW = 4;
const EASE = [0.2, 0.7, 0.2, 1];
const isNew = (p) => /^new$/i.test(p.badge || '');

// The light inside each arch, after the fragrance's own world.
const STAGE = {
  elarisse: 'bg-[radial-gradient(70%_60%_at_50%_45%,#fffaf0,#e8dcc4)]',
  zafreon: 'bg-[radial-gradient(70%_60%_at_50%_45%,#3a2520,#120c0a)]',
  'signature-duo': 'bg-[radial-gradient(70%_60%_at_50%_45%,#6a1a22,#2b080c)]',
};
const DEFAULT_STAGE = 'bg-[radial-gradient(70%_60%_at_50%_45%,#2a1e19,#0d0a09)]';

// Right after the hero: every fragrance, four to a row on every screen.
// Perfumes marked "New" start their own row; the four-question guide card
// fills the gap at the end of the row before them.
export default function Collection({ products }) {
  const { priceOf, fmt, addToCart, toast, t, setFinderOpen } = useStore();
  const all = [...products]
    .filter((p) => p.published !== false && (renderFor(p) || p.images?.[0]?.src))
    .sort((a, b) => (b.featured === true) - (a.featured === true) || (a.sortOrder || 0) - (b.sortOrder || 0));
  const first = all.filter((p) => !isNew(p));
  const fresh = all.filter(isNew);
  if (!all.length) return null;
  const showGuide = first.length % PER_ROW !== 0 || !first.length;
  const items = [...first.map((p) => ({ p })), ...(showGuide ? [{ guide: true }] : []), ...fresh.map((p) => ({ p }))];

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

      {/* Four columns on every screen; text and buttons shrink with the card. */}
      <ul className="mx-auto mt-10 grid max-w-[calc(var(--max)_-_2*var(--gutter))] list-none grid-cols-4 gap-x-2 gap-y-8 sm:mt-14 sm:gap-x-4 sm:gap-y-12 md:gap-x-5">
        {items.map(({ p, guide }, i) => {
          if (guide) {
            return (
              <motion.li key="guide" {...reveal(i)}>
                <button className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 rounded-arch bg-[radial-gradient(80%_70%_at_50%_30%,#5a1520,#2b080c)] p-2 text-center sm:gap-3 sm:p-6 lg:gap-4 lg:p-8" onClick={() => setFinderOpen(true)}>
                  <span className="text-sm text-gold-soft sm:text-xl lg:text-2xl" aria-hidden="true">✦</span>
                  <span className="font-display text-[11px] leading-tight sm:text-xl lg:text-3xl">{t('Not sure which one?')}</span>
                  <span className="hidden text-sm text-ivory/80 md:block">{t('Answer four questions and we will match your scent.')}</span>
                  <span className="text-[8px] uppercase tracking-[0.18em] text-gold-soft sm:text-[10px] lg:text-[11px] lg:tracking-[0.22em]">{t('Take the guide')}</span>
                </button>
              </motion.li>
            );
          }
          const render = renderFor(p);
          const soldOut = p.stock <= 0;
          const wide = render && render.w / render.h > 1;
          return (
            <motion.li key={p._id || p.slug} {...reveal(i)} className="group flex min-w-0 flex-col">
              <Link to={`/fragrances/${p.slug}`} className={`relative grid aspect-[3/4] items-end justify-items-center overflow-hidden rounded-arch ${STAGE[p.slug] || DEFAULT_STAGE}`} aria-label={p.name}>
                {(p.badge || soldOut) && (
                  <span className="absolute left-1/2 top-[6%] z-[1] -translate-x-1/2 whitespace-nowrap rounded-full bg-onyx/70 px-1.5 py-0.5 text-[7px] uppercase tracking-[0.12em] text-gold-soft sm:px-3 sm:py-1 sm:text-[10px] sm:tracking-[0.2em]">{t(soldOut ? 'Sold out' : p.badge)}</span>
                )}
                <img
                  src={render ? render.sm || render.src : p.images[0].src}
                  alt=""
                  loading="lazy"
                  className={`${render ? (wide ? 'mb-[12%] w-[86%]' : 'mb-[6%] h-[74%] w-auto') : 'h-full w-full object-cover object-[64%_50%]'} transition duration-700 ease-out group-hover:-translate-y-2`}
                />
              </Link>
              {/* Price and Bag sit at the bottom, so they line up across a row
                  even when a long name takes two lines. */}
              <div className="flex flex-1 flex-col pt-3 text-center sm:px-2 sm:pt-6">
                <h3 className="font-display text-[10px] leading-tight tracking-[0.04em] sm:text-base md:text-xl md:tracking-[0.08em] lg:text-2xl"><Link to={`/fragrances/${p.slug}`}>{p.name}</Link></h3>
                <p className="mt-1 hidden text-xs text-mute sm:block md:text-sm">{p.family || p.subtitle}</p>
                <div className="mt-auto flex flex-col items-center justify-center gap-1.5 pt-1.5 sm:gap-2 sm:pt-4 lg:flex-row lg:gap-4">
                  <span className="font-display text-[11px] sm:text-base md:text-lg lg:text-xl">{fmt(priceOf(p))}</span>
                  <button
                    className="rounded-full bg-gold-soft px-2 py-1 text-[8px] uppercase tracking-[0.12em] text-onyx transition hover:bg-champagne disabled:opacity-50 sm:px-4 sm:py-2 sm:text-[10px] sm:tracking-[0.2em] lg:px-5 lg:py-2.5 lg:text-[11px]"
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
      </ul>
    </section>
  );
}
