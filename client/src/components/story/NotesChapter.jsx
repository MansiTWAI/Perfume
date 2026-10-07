import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useTransform } from 'framer-motion';
import { useStore } from '../../context/StoreContext';
import { renderFor } from '../../lib/renders';
import { useSectionProgress } from '../../hooks/useSectionProgress';
import FloatingProduct from '../FloatingProduct';
import NotesStage from '../NotesStage';
import NoteIcon from '../NoteIcon';
import { ChapterOpening } from './Chapter';

const EASE = [0.2, 0.7, 0.2, 1];
const TIERS = [
  ['top', 'Top notes', 'The first impression'],
  ['heart', 'Heart notes', 'The character'],
  ['base', 'Base notes', 'The memory'],
];

// Where the bottle stands: beside the copy on wide screens (right in English,
// left in Arabic), above it on portrait screens. NotesScene places the 3D
// notes to match.
const SPOT =
  'absolute left-[calc(50%+min(24vw,400px))] top-[52%] h-[min(70vh,860px)] aspect-[427/900] -translate-x-1/2 -translate-y-1/2 ' +
  'rtl:left-[calc(50%-min(24vw,400px))] portrait:left-1/2 portrait:top-[32%] portrait:h-[min(40vh,110vw)] portrait:rtl:left-1/2';

// Chapter three opens with ZAFREON on stage: its notes drift around the
// bottle in 3D while the top, heart and base notes scroll past, and the
// light warms from black to burgundy.
export default function NotesChapter({ product }) {
  const { t } = useStore();
  const ref = useRef(null);
  const progress = useSectionProgress(ref);
  const bg = useTransform(progress, [0, 0.4, 0.75, 1], ['#0d0a09', '#150f0d', '#1f0f0e', '#2b080c']);
  const scale = useTransform(progress, [0, 1], [1, 1.07]);
  const y = useTransform(progress, [0, 1], ['0%', '-3%']);
  const render = renderFor(product);
  if (!product || !render) return null;

  return (
    <div id="notes" className="bg-onyx text-ivory">
      <ChapterOpening label={t('Chapter three · What the bottle holds')} title={<>{t('Notes that')} <em className="text-gold-soft">{t('unfold')}</em></>} className="pb-10 pt-28" />
      <section ref={ref} className="relative" aria-label={t('{name}: top, heart and base notes', { name: product.name })}>
        <motion.div className="sticky top-0 h-screen overflow-hidden" style={{ backgroundColor: bg }}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_55%_at_72%_55%,rgba(210,160,90,0.16),transparent_70%)] rtl:bg-[radial-gradient(40%_55%_at_28%_55%,rgba(210,160,90,0.16),transparent_70%)] portrait:bg-[radial-gradient(60%_40%_at_50%_34%,rgba(210,160,90,0.18),transparent_70%)]" />
          {/* The lit burgundy arch behind the bottle. */}
          <div className={`${SPOT} pointer-events-none`} aria-hidden="true">
            <span className="absolute bottom-[12%] left-1/2 h-[94%] w-[168%] -translate-x-1/2 rounded-[50%_50%_0_0/26%_26%_0_0] bg-[radial-gradient(ellipse_70%_45%_at_50%_38%,rgba(214,150,70,0.22),transparent_70%),linear-gradient(180deg,#5a1520_0%,#3a0c13_45%,#1c0508_100%)] shadow-[inset_0_0_90px_rgba(0,0,0,0.6),0_0_160px_rgba(110,20,30,0.35)] [mask-image:linear-gradient(to_bottom,#000_78%,transparent)]" />
          </div>
          <NotesStage className="z-[1]" variant={product.slug} stage side="back" progress={progress} />
          <div className={`${SPOT} z-[2]`}>
            <motion.div className="relative z-[1] h-full w-full [&_.fp-reflect]:opacity-[0.12] [&_.fp]:[--floor:18%] [&_.fp]:[--glow:rgba(214,150,70,0.3)] [&_.fp]:[--pad:4%_4%_18%]" style={{ scale, y }}>
              <FloatingProduct render={render} alt={`${product.name} Eau de Parfum`} sizes="(max-width: 860px) 60vw, 34vw" strength={0.7} />
            </motion.div>
          </div>
          <NotesStage className="z-[3]" variant={product.slug} stage side="front" progress={progress} />
        </motion.div>

        <div className="relative z-10 -mt-[100vh]">
          {TIERS.map(([key, label, hint], i) => {
            const notes = product.notes?.[key] || [];
            const pictured = notes.find((n) => n.image);
            return (
              <div key={key} className="flex min-h-screen items-center px-[max(var(--gutter),calc((100%_-_var(--max))/2_+_var(--gutter)))] pb-16 pt-28 max-[860px]:items-end max-[860px]:pb-10">
                <motion.div
                  className="grid w-full max-w-[520px] gap-5 max-[860px]:max-w-none max-[860px]:bg-gradient-to-t max-[860px]:from-onyx max-[860px]:via-onyx/95 max-[860px]:to-transparent max-[860px]:pt-6"
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ amount: 0.5 }}
                  transition={{ duration: 1, ease: EASE }}
                >
                  <p className="text-[11px] font-medium uppercase tracking-label text-gold-soft">
                    <span dir="ltr">{String(i + 1).padStart(2, '0')} / 03</span> · {t(label)}
                  </p>
                  <h3 className="font-display text-[clamp(34px,3.8vw,56px)]">{t(hint)}</h3>
                  <ul className="m-0 grid list-none p-0">
                    {notes.map((n) => (
                      <li key={n.name} className="grid grid-cols-[30px_minmax(0,1fr)] items-start gap-[18px] py-3 text-gold-soft max-[860px]:py-2">
                        <NoteIcon name={n.name} size={30} />
                        <span>
                          <b className="block font-display text-[22px] font-normal leading-tight text-ivory">{n.label || n.name}</b>
                          <small className="mt-1 block text-sm leading-normal text-mute max-[860px]:hidden">{n.description}</small>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {pictured && (
                    <figure className="m-0 mt-1 flex items-center gap-4 max-[860px]:hidden">
                      <img src={pictured.image} alt={`${pictured.label || pictured.name}, ${product.name}`} loading="lazy" className="h-[90px] w-[72px] object-cover" />
                      <figcaption className="font-display text-base italic text-[#bfb2a6]">{pictured.label || pictured.name}</figcaption>
                    </figure>
                  )}
                  {i === TIERS.length - 1 && (
                    <Link to={`/fragrances/${product.slug}`} className="inline-block py-2 text-[11px] font-medium uppercase tracking-[0.26em] text-gold-soft transition hover:text-ivory">
                      {t('Discover {name}', { name: product.name })}
                    </Link>
                  )}
                </motion.div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
