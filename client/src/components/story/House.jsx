import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { Reveal, ScrollText } from '../Motion';
import { ChapterOpening } from './Chapter';

// Chapter one: who makes these fragrances, and why. The quote lights up word
// by word as it scrolls into view.
export default function House() {
  const { t } = useStore();
  const quote = t('A fragrance is invisible, yet it can become the most recognisable part of a person. We create for that moment: the memory that remains after the room has changed.');
  const facts = [
    ['Since', '2013'],
    ['From', 'Hyderabad'],
    ['Made as', 'Eau de Parfum'],
  ];
  return (
    <section id="house" className="relative bg-onyx px-6 py-28 text-ivory md:px-12" aria-label={t('The house')}>
      <ChapterOpening label={t('Chapter one · The house')} />
      <div className="mx-auto mt-16 grid max-w-[calc(var(--max)_-_2*var(--gutter))] items-center gap-14 md:grid-cols-[1.2fr_1fr]">
        <div>
          <ScrollText key={quote} className="font-display text-[clamp(28px,3vw,44px)] leading-[1.25]" text={quote} />
          <Reveal>
            <dl className="m-0 mt-12 grid grid-cols-3">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] uppercase tracking-[0.28em] text-mute">{t(k)}</dt>
                  <dd className="m-0 mt-2 font-display text-[clamp(20px,2.2vw,30px)] leading-tight">{t(v)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-mute">{t('Founded on a lifelong passion for perfume and a career in the fragrance industry that began in 2013.')}</p>
            <Link to="/our-story" className="mt-6 inline-block py-2 text-[11px] font-medium uppercase tracking-[0.26em] text-gold-soft transition hover:text-ivory">
              {t('Read our story')}
            </Link>
          </Reveal>
        </div>
        <Reveal as="figure" className="relative m-0 mx-auto w-full max-w-sm" y={60}>
          <div className="aspect-[4/5] overflow-hidden rounded-arch">
            <img src="/media/panel-house.webp" alt={t('ELARISSE and ZAFREON side by side beneath a burgundy arch')} loading="lazy" className="h-full w-full object-cover" />
          </div>
          <figcaption className="mt-4 text-center font-display italic text-mute">{t('Indian richness, Arabian artistry.')}</figcaption>
        </Reveal>
      </div>
    </section>
  );
}
