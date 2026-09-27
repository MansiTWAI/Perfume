import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Seo, { breadcrumbLd } from '../components/Seo';
import { PageHero, Lightbox } from '../components/Bits';
import { useStore } from '../context/StoreContext';

const ITEMS = [
  { src: '/media/elarisse-campaign.webp', alt: 'ELARISSE bottle and box beneath palace arches at sunset', tags: ['ELARISSE', 'Campaigns'], size: 'xl' },
  { src: '/media/zafreon-logo.webp', alt: 'ZAFREON Arabic and Latin logotype in gold', tags: ['Brand', 'ZAFREON'], size: 'sq' },
  { src: '/media/zafreon-film-portrait.jpg', alt: 'ZAFREON campaign film still', tags: ['ZAFREON', 'Lifestyle'], size: 'tall' },
  { src: '/media/elarisse-bottle.webp', alt: 'ELARISSE crystal bottle with its ivory box', tags: ['ELARISSE', 'Packaging'], size: 'md' },
  { src: '/media/duo-triptych.webp', alt: 'Two signatures, one philosophy', tags: ['Campaigns', 'Brand'], size: 'wide' },
  { src: '/media/elarisse-logo-dark.webp', alt: 'ELARISSE crowned E emblem in gold on black', tags: ['Brand', 'ELARISSE'], size: 'sq' },
  { src: '/media/zafreon-campaign.webp', alt: 'ZAFREON with saffron, oud wood and burgundy velvet', tags: ['ZAFREON', 'Campaigns'], size: 'xl' },
  { src: '/media/zafreon-film-spray.jpg', alt: 'Spraying ZAFREON', tags: ['ZAFREON', 'Lifestyle', 'Details'], size: 'tall' },
  { src: '/media/panel-house.webp', alt: 'Two signatures, one philosophy', tags: ['Brand', 'Campaigns'], size: 'tall' },
  { src: '/media/panel-elarisse.webp', alt: 'ELARISSE beneath ivory arches', tags: ['ELARISSE', 'Campaigns'], size: 'tall' },
  { src: '/media/panel-zafreon.webp', alt: 'ZAFREON with oud wood and incense', tags: ['ZAFREON', 'Campaigns'], size: 'tall' },
  { src: '/media/business-card.webp', alt: 'AL BARAKAH LIFESTYLE stationery', tags: ['Brand', 'Details'], size: 'wide' },
  { src: '/media/elarisse-logo-ivory.webp', alt: 'ELARISSE emblem on ivory', tags: ['ELARISSE', 'Brand'], size: 'sq' },
  { src: '/media/zafreon-bottle-marble.jpg', alt: 'ZAFREON bottle on black marble', tags: ['ZAFREON', 'Packaging'], size: 'tall' },
];
const FILTERS = ['All', 'Brand', 'ELARISSE', 'ZAFREON', 'Packaging', 'Campaigns', 'Details', 'Lifestyle'];

export default function Gallery() {
  const { t } = useStore();
  const [f, setF] = useState('All');
  const [idx, setIdx] = useState(null);
  const list = ITEMS.filter((i) => f === 'All' || i.tags.includes(f));
  return (
    <>
      <Seo title="Luxury Perfume Gallery | AL BARAKAH LIFESTYLE" description="The AL BARAKAH LIFESTYLE gallery: ELARISSE and ZAFREON campaigns, packaging, brand identity and details." jsonLd={breadcrumbLd([['Home', '/'], ['Gallery', '/gallery']])} />
      <PageHero eyebrow={t('Gallery')} title={t('The house, in pictures')} layout="split" video="/media/zafreon-film.mp4" poster="/media/zafreon-film-poster.jpg" alt="ZAFREON campaign film" lede={t('Campaigns, packaging and details from the world of ELARISSE and ZAFREON.')} />
      <section className="section">
        <div className="container">
          <div className="chips center-chips" role="group" aria-label={t('Filter gallery')}>
            {FILTERS.map((x) => (
              <button key={x} className="chip" aria-pressed={f === x} onClick={() => setF(x)}>{t(x)}</button>
            ))}
          </div>
          <motion.div layout className="masonry">
            <AnimatePresence>
              {list.map((it, i) => (
                <motion.button
                  layout
                  key={it.src}
                  className={`m-item m-${it.size}`}
                  onClick={() => setIdx(i)}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
                 
                >
                  <img src={it.src} alt={it.alt} loading="lazy" />
                  <span className="m-cap">{t(it.tags[0])}</span>
                </motion.button>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>
      <Lightbox items={list} index={idx} onClose={() => setIdx(null)} onIndex={setIdx} />
    </>
  );
}
