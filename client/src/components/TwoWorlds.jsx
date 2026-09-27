import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useSpring, useTransform } from 'framer-motion';
import { useStore } from '../context/StoreContext';

// Drag between ELARISSE (ivory, day) and ZAFREON (onyx, night). The slider
// is physical (ELARISSE on the left) in both languages; only the text flows.
export default function TwoWorlds() {
  const { t, dir } = useStore();
  const ref = useRef(null);
  // On phones the two worlds stack, so start fully on ELARISSE rather than
  // halfway, where the two blocks of text would overlap.
  const start = typeof window !== 'undefined' && window.matchMedia('(max-width: 800px)').matches ? 100 : 50;
  const [val, setVal] = useState(start);
  const spring = useSpring(start, { stiffness: 120, damping: 22 });
  const clip = useTransform(spring, (v) => `inset(0 ${100 - v}% 0 0)`);
  const left = useTransform(spring, (v) => `${v}%`);
  const dragging = useRef(false);

  const set = (v) => {
    const c = Math.max(0, Math.min(100, v));
    setVal(c);
    spring.set(c);
  };
  const fromEvent = (e) => {
    const r = ref.current.getBoundingClientRect();
    set(((e.clientX - r.left) / r.width) * 100);
  };

  return (
    <div className="worlds-wrap">
      <div
        ref={ref}
        className="worlds"
        dir="ltr"
       
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          fromEvent(e);
        }}
        onPointerMove={(e) => dragging.current && fromEvent(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <div className="world world-z">
          <img src="/media/zafreon-campaign.webp" alt="ZAFREON black bottle with saffron, oud and velvet" draggable="false" />
          <div className="world-text" dir={dir}>
            <p className="eyebrow">{t('Eau de Parfum · by Al Barakah')}</p>
            <h3>ZAFREON</h3>
            <p className="world-tag">{t('A Bold Fragrance · A Higher Story')}</p>
            <p className="world-copy">{t('Saffron, incense and oud. Dark, polished and unmistakable, a signature for evenings.')}</p>
            <Link to="/fragrances/zafreon" className="btn btn-ghost" onPointerDown={(e) => e.stopPropagation()}>{t('Enter {name}', { name: 'ZAFREON' })}</Link>
          </div>
        </div>
        <motion.div className="world world-e" style={{ clipPath: clip }}>
          <img src="/media/elarisse-campaign.webp" alt="ELARISSE bottle and box beneath palace arches" draggable="false" />
          <div className="world-text" dir={dir}>
            <p className="eyebrow">{t('Eau de Parfum · by Al Barakah')}</p>
            <h3>ELARISSE</h3>
            <p className="world-tag">{t('A Fragrance Beyond Time')}</p>
            <p className="world-copy">{t('Saffron, jasmine and amber. Luminous, graceful and more personal as the day unfolds.')}</p>
            <Link to="/fragrances/elarisse" className="btn btn-primary" onPointerDown={(e) => e.stopPropagation()}>{t('Enter {name}', { name: 'ELARISSE' })}</Link>
          </div>
        </motion.div>
        <motion.div className="worlds-handle" style={{ left }} aria-hidden="true">
          <span><i>‹ ›</i></span>
        </motion.div>
        <input
          className="sr-only"
          type="range"
          min="0"
          max="100"
          value={Math.round(val)}
          onChange={(e) => set(+e.target.value)}
          aria-label={t('Move between ELARISSE and ZAFREON')}
        />
      </div>
      <div className="worlds-labels" dir="ltr">
        <button onClick={() => set(100)}>← ELARISSE · {t('Day')}</button>
        <span dir={dir}>{t('Drag to cross between worlds')}</span>
        <button onClick={() => set(0)}>ZAFREON · {t('Night')} →</button>
      </div>
    </div>
  );
}
