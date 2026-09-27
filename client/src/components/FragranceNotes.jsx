import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import NoteIcon from './NoteIcon';
import { useStore } from '../context/StoreContext';

const TIERS = [
  ['top', 'Top', 'The first impression'],
  ['heart', 'Heart', 'The character'],
  ['base', 'Base', 'The memory'],
];

// Top, heart and base notes as an editorial list. Hovering or tapping a note
// shows what it brings, with its ingredient photograph when one exists.
export default function FragranceNotes({ notes, name }) {
  const { t } = useStore();
  const all = TIERS.flatMap(([tier]) => (notes?.[tier] || []).map((n) => ({ ...n, tier })));
  // Kept as tier + name so the detail follows a language change.
  const [pick, setPick] = useState(() => all.find((n) => n.image) || all[0]);
  const active = all.find((n) => n.tier === pick?.tier && n.name === pick?.name) || all[0];
  const setActive = (n) => setPick({ tier: n.tier, name: n.name });
  if (!all.length) return null;
  const tierLabel = t(TIERS.find((x) => x[0] === active?.tier)?.[1]);

  return (
    <div className="fnotes">
      <div className="fn-tiers">
        {TIERS.map(([key, label, hint], ti) =>
          notes?.[key]?.length ? (
            <motion.div
              key={key}
              className="fn-tier"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px 0px -10% 0px' }}
              transition={{ delay: ti * 0.12, duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
            >
              <div className="fn-label">
                <span>{t(label)}</span>
                <small>{t(hint)}</small>
              </div>
              <ul className="fn-list">
                {notes[key].map((n) => {
                  const on = active?.name === n.name && active?.tier === key;
                  return (
                    <li key={n.name}>
                      <button
                        type="button"
                        className={on ? 'is-active' : ''}
                        aria-pressed={on}
                        onMouseEnter={() => setActive({ ...n, tier: key })}
                        onFocus={() => setActive({ ...n, tier: key })}
                        onClick={() => setActive({ ...n, tier: key })}
                      >
                        <NoteIcon name={n.name} size={22} />
                        {n.label || n.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          ) : null
        )}
      </div>

      <div className="fn-detail" aria-live="polite">
        <AnimatePresence mode="wait">
          {active && (
            <motion.div
              key={active.tier + active.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {active.image ? (
                <motion.div className="fn-image" initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 1.2, ease: [0.2, 0.7, 0.2, 1] }}>
                  <img src={active.image} alt={`${active.label || active.name}, ${name}`} />
                </motion.div>
              ) : (
                <motion.div className="fn-image fn-emblem" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9 }}>
                  <NoteIcon name={active.name} size={96} />
                </motion.div>
              )}
              <p className="eyebrow">{t('{tier} note · {name}', { tier: tierLabel, name })}</p>
              <h4>{active.label || active.name}</h4>
              <p>{active.description}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
