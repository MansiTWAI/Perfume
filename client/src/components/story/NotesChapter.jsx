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

// Where the bottle stands: beside the notes on wide screens (right in
// English, left in Arabic), above them on portrait screens. NotesScene places
// the 3D notes to match.
const SPOT =
  'absolute left-[calc(50%+min(24vw,400px))] top-[52%] h-[min(70vh,820px)] aspect-[427/900] -translate-x-1/2 -translate-y-1/2 ' +
  'rtl:left-[calc(50%-min(24vw,400px))] portrait:left-1/2 portrait:top-[46%] portrait:h-[min(44svh,100vw)] portrait:rtl:left-1/2';

// Chapter three: ZAFREON on stage with its notes drifting around it in 3D,
// and the top, heart and base notes side by side on one screen.
export default function NotesChapter({ product }) {
  const { t } = useStore();
  const ref = useRef(null);
  const progress = useSectionProgress(ref);
  const scale = useTransform(progress, [0, 1], [1, 1.05]);
  const y = useTransform(progress, [0, 1], ['0%', '-2%']);
  const render = renderFor(product);
  if (!product || !render) return null;

  return (
    <div id="notes" className="bg-onyx text-ivory">
      <ChapterOpening label={t('Chapter three · What the bottle holds')} title={<>{t('Notes that')} <em className="text-gold-soft">{t('unfold')}</em></>} className="pb-10 pt-28" />
      <section ref={ref} className="relative overflow-hidden bg-[linear-gradient(180deg,#0d0a09_0%,#1f0f0e_60%,#2b080c_100%)]" aria-label={t('{name}: top, heart and base notes', { name: product.name })}>
        <div className="relative h-[62svh] min-h-[420px] landscape:absolute landscape:inset-0 landscape:h-auto landscape:min-h-0">
          {/* The lit burgundy arch behind the bottle. */}
          <div className={`${SPOT} pointer-events-none`} aria-hidden="true">
            <span className="absolute bottom-[12%] left-1/2 h-[94%] w-[168%] -translate-x-1/2 rounded-[50%_50%_0_0/26%_26%_0_0] bg-[linear-gradient(180deg,#5a1520_0%,#3a0c13_45%,#1c0508_100%)] shadow-[inset_0_0_90px_rgba(0,0,0,0.6)] [mask-image:linear-gradient(to_bottom,#000_78%,transparent)]" />
          </div>
          <NotesStage className="z-[1]" variant={product.slug} stage side="back" progress={progress} />
          <div className={`${SPOT} z-[2]`}>
            <motion.div className="relative z-[1] h-full w-full [&_.fp-reflect]:opacity-[0.12] [&_.fp]:[--floor:18%] [&_.fp]:[--glow:rgba(214,150,70,0.3)] [&_.fp]:[--pad:4%_4%_18%]" style={{ scale, y }}>
              <FloatingProduct render={render} alt={`${product.name} Eau de Parfum`} sizes="(max-width: 860px) 60vw, 34vw" strength={0.7} />
            </motion.div>
          </div>
          <NotesStage className="z-[3]" variant={product.slug} stage side="front" progress={progress} />
        </div>

        {/* All three tiers together: beside the bottle on wide screens, below it on phones. */}
        <div className="relative z-10 px-[max(var(--gutter),calc((100%_-_var(--max))/2_+_var(--gutter)))] pb-16 landscape:flex landscape:min-h-[min(100svh,980px)] landscape:items-center landscape:py-24">
          <motion.div
            className="grid w-full max-w-[min(520px,46%)] gap-8 portrait:max-w-none"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            {TIERS.map(([key, label, hint]) => {
              const notes = product.notes?.[key] || [];
              if (!notes.length) return null;
              return (
                <div key={key} className="grid gap-3 border-t border-[rgba(215,195,160,0.18)] pt-5 first:border-t-0 first:pt-0">
                  <p className="text-[11px] font-medium uppercase tracking-label text-gold-soft">{t(label)} · <span className="normal-case tracking-normal italic text-[#bfb2a6]">{t(hint)}</span></p>
                  <ul className="m-0 grid list-none gap-3 p-0">
                    {notes.map((n) => (
                      <li key={n.name} className="grid grid-cols-[26px_minmax(0,1fr)] items-start gap-4 text-gold-soft">
                        <NoteIcon name={n.name} size={26} />
                        <span>
                          <b className="block font-display text-[20px] font-normal leading-tight text-ivory">{n.label || n.name}</b>
                          {n.description && <small className="mt-1 block text-sm leading-normal text-mute">{n.description}</small>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            <Link to={`/fragrances/${product.slug}`} className="text-link self-start">
              {t('Discover {name}', { name: product.name })}
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
