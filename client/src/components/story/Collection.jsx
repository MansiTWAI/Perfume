import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { flyToCart } from '../../lib/flyToCart';
import { renderFor } from '../../lib/renders';
import { sizesOf, fromPrice } from '../../lib/sizes';
import { ChapterOpening } from './Chapter';

const EASE = [0.2, 0.7, 0.2, 1];
const isNew = (p) => /^new$/i.test(p.badge || '');

// The light inside each arch, after the fragrance's own world.
const STAGE = {
  elarisse: 'bg-[radial-gradient(70%_60%_at_50%_45%,#fffaf0,#e8dcc4)]',
  zafreon: 'bg-[radial-gradient(70%_60%_at_50%_45%,#3a2520,#120c0a)]',
  'signature-duo': 'bg-[radial-gradient(70%_60%_at_50%_45%,#6a1a22,#2b080c)]',
  'after-dark': 'bg-[radial-gradient(70%_60%_at_50%_45%,#4a2a6e,#140b22)]',
  'sovereign-musk': 'bg-[radial-gradient(70%_60%_at_50%_45%,#7a4a1c,#1e1007)]',
  'mukhallat-al-zayer': 'bg-[radial-gradient(70%_60%_at_50%_45%,#17493a,#07160f)]',
  'blue-dive': 'bg-[radial-gradient(70%_60%_at_50%_45%,#1d4f9a,#08142b)]',
};
const DEFAULT_STAGE = 'bg-[radial-gradient(70%_60%_at_50%_45%,#2a1e19,#0d0a09)]';

// Right after the hero: every fragrance in one grid, four to a row on every
// screen (phones get compact cards), a shorter row centred.
// Perfumes marked "New" start their own row; the four-question guide is the
// last card, after every fragrance.
export default function Collection({ products }) {
  const { priceOf, fmt, addToCart, toast, t, setFinderOpen } = useStore();
  const all = [...products]
    .filter((p) => p.published !== false && (renderFor(p) || p.images?.[0]?.src))
    .sort((a, b) => (b.featured === true) - (a.featured === true) || (a.sortOrder || 0) - (b.sortOrder || 0));
  const first = all.filter((p) => !isNew(p));
  const fresh = all.filter(isNew);
  if (!all.length) return null;
  const items = [...first.map((p) => ({ p })), ...(first.length && fresh.length ? [{ rowBreak: true }] : []), ...fresh.map((p) => ({ p })), { guide: true }];
  // A card's width: a quarter of the row, less its share of the gaps
  // (gap-x-2 / sm:gap-x-4 / lg:gap-x-6 below).
  const cell = 'shrink-0 grow-0 basis-[calc((100%-1.5rem)/4)] sm:basis-[calc((100%-3rem)/4)] lg:basis-[calc((100%-4.5rem)/4)]';

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

      <ul className="mx-auto mt-10 flex max-w-[calc(var(--max)_-_2*var(--gutter))] list-none flex-wrap justify-center gap-x-2 gap-y-8 sm:mt-14 sm:gap-x-4 md:gap-y-14 lg:gap-x-6">
        {items.map(({ p, guide, rowBreak }, i) => {
          if (rowBreak) return <li key="row-break" className="-mt-8 h-0 basis-full md:-mt-14" aria-hidden="true" />;
          if (guide) {
            // The guide, shaped like a fragrance card: the house's calligraphy
            // in the arch, the question beneath and one clear action.
            return (
              <motion.li key="guide" {...reveal(i)} className={`group flex min-w-0 flex-col ${cell}`}>
                <button type="button" onClick={() => setFinderOpen(true)} className="relative block aspect-[3/4] w-full overflow-hidden rounded-arch bg-[radial-gradient(80%_70%_at_50%_30%,#5a1520,#2b080c)]" aria-label={t('Take the guide')}>
                  <img src="/media/calligraphy.webp" alt="" loading="lazy" className="absolute inset-x-[10%] top-[28%] w-[80%] opacity-90 mix-blend-screen transition duration-700 ease-out [mask-image:radial-gradient(closest-side,#000_70%,transparent)] group-hover:-translate-y-2" />
                  <span className="absolute left-1/2 top-[12%] -translate-x-1/2 text-xs text-gold-soft sm:text-lg" aria-hidden="true">✦</span>
                  <span className="absolute bottom-[10%] left-1/2 -translate-x-1/2 hidden whitespace-nowrap text-[9px] uppercase tracking-[0.24em] text-gold-soft/90 sm:block sm:text-[10px]">{t('Four questions')}</span>
                </button>
                <div className="flex flex-1 flex-col pt-2 text-center sm:px-2 sm:pt-6">
                  <h3 className="font-display text-[11px] leading-tight sm:text-base md:text-xl lg:text-2xl">{t('Not sure which one?')}</h3>
                  <p className="mt-1 hidden text-xs text-mute sm:block md:text-sm">{t('Answer four questions and we will match your scent.')}</p>
                  <div className="mt-auto flex justify-center pt-3 sm:pt-4">
                    <button type="button" onClick={() => setFinderOpen(true)} className="rounded-full border border-gold-soft/70 px-2.5 py-2 text-[8px] uppercase tracking-[0.12em] text-gold-soft transition hover:bg-gold-soft hover:text-onyx sm:px-4 sm:text-[10px] sm:tracking-[0.2em] lg:px-5 lg:py-2.5 lg:text-[11px]">
                      {t('Take the guide')}
                    </button>
                  </div>
                </div>
              </motion.li>
            );
          }
          const render = renderFor(p);
          const sizes = sizesOf(p);
          const soldOut = sizes ? sizes.every((s) => s.stock <= 0) : p.stock <= 0;
          const wide = render && render.w / render.h > 1;
          return (
            <motion.li key={p._id || p.slug} {...reveal(i)} className={`group flex min-w-0 flex-col ${cell}`}>
              <Link to={`/fragrances/${p.slug}`} className={`relative grid aspect-[3/4] items-end justify-items-center overflow-hidden rounded-arch ${STAGE[p.slug] || DEFAULT_STAGE}`} aria-label={p.name}>
                {(p.badge || soldOut) && (
                  <span className="absolute left-1/2 top-[6%] z-[1] -translate-x-1/2 whitespace-nowrap rounded-full bg-onyx/70 px-1.5 py-0.5 text-[7px] uppercase tracking-[0.12em] text-gold-soft sm:px-3 sm:py-1 sm:text-[10px] sm:tracking-[0.2em]">{t(soldOut ? 'Sold out' : p.badge)}</span>
                )}
                <img
                  src={render ? render.sm || render.src : p.images[0].src}
                  alt=""
                  loading="lazy"
                  className={`${render ? `absolute left-1/2 -translate-x-1/2 ${wide ? 'bottom-[12%] w-[86%]' : 'bottom-[6%] h-[74%] w-auto max-w-[86%] object-contain'}` : 'h-full w-full object-cover object-[64%_50%]'} transition duration-700 ease-out group-hover:-translate-y-2`}
                />
              </Link>
              {/* Price and Bag sit at the bottom, so they line up across a row
                  even when a long name takes two lines. */}
              <div className="flex flex-1 flex-col pt-2 text-center sm:px-2 sm:pt-6">
                <h3 className="font-display text-[10px] leading-tight tracking-[0.04em] sm:text-base md:text-xl md:tracking-[0.08em] lg:text-2xl"><Link to={`/fragrances/${p.slug}`}>{p.name}</Link></h3>
                <p className="mt-1 hidden text-xs text-mute sm:block md:text-sm">{p.family || p.subtitle}</p>
                <div className="mt-auto flex flex-col items-center justify-center gap-1.5 pt-1.5 sm:gap-2 sm:pt-4 lg:flex-row lg:gap-4">
                  <span className="font-display text-[11px] sm:text-base md:text-lg lg:text-xl">{sizes && <small className="font-body text-[0.7em] text-mute">{t('From')} </small>}{fmt(sizes ? fromPrice(p, priceOf) : priceOf(p))}</span>
                  {sizes && !soldOut ? (
                    <Link
                      to={`/fragrances/${p.slug}`}
                      className="rounded-full bg-gold-soft px-2.5 py-2 text-[8px] uppercase tracking-[0.12em] text-onyx transition hover:bg-champagne sm:px-4 sm:text-[10px] sm:tracking-[0.2em] lg:px-5 lg:py-2.5 lg:text-[11px]"
                      aria-label={t('Choose a size of {name}', { name: p.name })}
                    >
                      {t('Sizes')}
                    </Link>
                  ) : (
                  <button
                    className="rounded-full bg-gold-soft px-2.5 py-2 text-[8px] uppercase tracking-[0.12em] text-onyx transition hover:bg-champagne sm:px-4 sm:text-[10px] sm:tracking-[0.2em] disabled:opacity-50 lg:px-5 lg:py-2.5 lg:text-[11px]"
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
                  )}
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}
