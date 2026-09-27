import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import { seasonFor } from '../lib/seasons';

const EASE = [0.2, 0.7, 0.2, 1];

// A crescent and an eight-pointed star, drawn in gold.
function Crescent() {
  return (
    <motion.svg
      className="season-moon"
      viewBox="0 0 120 120"
      aria-hidden="true"
      initial={{ opacity: 0, rotate: -24, scale: 0.9 }}
      whileInView={{ opacity: 1, rotate: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1.6, ease: EASE }}
    >
      <defs>
        <mask id="season-moon-cut">
          <rect width="120" height="120" fill="#fff" />
          <circle cx="70" cy="48" r="38" fill="#000" />
        </mask>
      </defs>
      <circle cx="54" cy="62" r="44" fill="currentColor" mask="url(#season-moon-cut)" />
      <g transform="translate(92 34)">
        <rect x="-7" y="-7" width="14" height="14" fill="currentColor" />
        <rect x="-7" y="-7" width="14" height="14" fill="currentColor" transform="rotate(45)" />
      </g>
    </motion.svg>
  );
}

// Ramadan, Eid and national-day gifting, shown only while the season is on.
export default function SeasonBand() {
  const { region, t } = useStore();
  const s = seasonFor(region.code);
  if (!s) return null;
  return (
    <section className="season" aria-label={t(s.eyebrow)}>
      <div className="container season-inner">
        {s.moon && <Crescent />}
        <motion.div
          className="season-copy"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: EASE }}
        >
          <p className="eyebrow">{t(s.eyebrow)}</p>
          <h2 className="display-l">{t(s.title)}</h2>
          <p className="season-text">{t(s.text)}</p>
        </motion.div>
        <Link to={s.cta[1]} className="btn btn-primary season-cta">{t(s.cta[0])}</Link>
      </div>
    </section>
  );
}
