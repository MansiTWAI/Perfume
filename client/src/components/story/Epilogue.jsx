import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { Reveal, SplitHeading } from '../Motion';

// The close of the story: both signatures behind a last invitation.
export default function Epilogue() {
  const { setFinderOpen, t } = useStore();
  return (
    <section id="epilogue" className="relative grid min-h-[80vh] place-items-center overflow-hidden bg-onyx px-6 py-28 text-center text-ivory" aria-label={t('Epilogue')}>
      <img src="/media/duo-triptych.webp" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-25" />
      <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-onyx to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-onyx to-transparent" />
      <div className="relative flex flex-col items-center">
        <p className="text-[11px] font-medium uppercase tracking-label text-gold-soft">{t('Epilogue')}</p>
        <SplitHeading text={t('Find the one that becomes yours.')} className="mt-5 max-w-3xl font-display text-[clamp(40px,6vw,88px)] leading-[1.02]" />
        <Reveal delay={0.3} className="mt-10 flex flex-wrap items-center justify-center gap-6">
          <Link to="/fragrances" className="bg-gold-soft px-7 py-4 text-[11px] font-medium uppercase tracking-[0.24em] text-onyx transition hover:bg-champagne">{t('Explore the collection')}</Link>
          <button className="py-2 text-[11px] uppercase tracking-[0.24em] transition hover:text-gold-soft" onClick={() => setFinderOpen(true)}>{t('Take the four-question guide')}</button>
        </Reveal>
      </div>
    </section>
  );
}
