import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import { currencySymbol } from '../lib/format';

// Compact "IN · ₹" button that opens the list of markets.
export default function RegionSelect({ align = 'right' }) {
  const { regions, region, setRegion, lang, t } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    addEventListener('pointerdown', close);
    addEventListener('keydown', esc);
    return () => {
      removeEventListener('pointerdown', close);
      removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className={`region region-${align}`} ref={ref}>
      <button className="region-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{region.code}</span>
        <i aria-hidden="true">·</i>
        <span>{currencySymbol(region.currency, lang)}</span>
        <span className="sr-only">{t('Change country, currently {name}', { name: t(region.name) })}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            className="region-list"
            role="listbox"
            aria-label={t('Deliver to')}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            {regions.map((r) => (
              <li key={r.code}>
                <button
                  role="option"
                  aria-selected={r.code === region.code}
                  onClick={() => {
                    setRegion(r.code);
                    setOpen(false);
                  }}
                >
                  <span>{t(r.name)}</span>
                  <small>{r.ships ? currencySymbol(r.currency, lang) : `${t('On request')} · ${currencySymbol(r.currency, lang)}`}</small>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
