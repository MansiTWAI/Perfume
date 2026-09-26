import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// Once per browser session: the emblem surfaces from darkness, then the
// curtain lifts. Skipped entirely for reduced motion.
export default function Preloader() {
  const [show, setShow] = useState(() => {
    try {
      return !sessionStorage.getItem('ab_seen') && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!show) return;
    document.documentElement.classList.add('is-loading');
    const t = setTimeout(() => {
      setShow(false);
      try {
        sessionStorage.setItem('ab_seen', '1');
      } catch {
        /* ignore */
      }
    }, 1700);
    return () => clearTimeout(t);
  }, [show]);

  useEffect(() => {
    if (!show) document.documentElement.classList.remove('is-loading');
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div className="preloader" exit={{ opacity: 0, transition: { duration: 0.9, ease: [0.76, 0, 0.24, 1] } }} aria-hidden="true">
          <motion.img
            src="/media/calligraphy.webp"
            alt=""
            initial={{ opacity: 0, filter: 'brightness(0.2) blur(6px)' }}
            animate={{ opacity: 1, filter: 'brightness(1) blur(0px)' }}
            transition={{ duration: 1.2, ease: [0.2, 0.7, 0.2, 1] }}
          />
          <motion.span className="preloader-line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.1, delay: 0.3, ease: [0.65, 0, 0.35, 1] }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
