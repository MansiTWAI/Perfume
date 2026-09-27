import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../context/StoreContext';

const EASE = [0.65, 0, 0.35, 1];

// Once per browser session: the approved calligraphy is revealed from right
// to left, the way the pen writes it, then the curtain lifts. For visitors in
// the Gulf a mashrabiya rosette turns slowly behind it. The artwork itself is
// never redrawn. Skipped entirely for reduced motion.
export default function Preloader() {
  const { gulf, lang } = useStore();
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
    }, 1900);
    return () => clearTimeout(t);
  }, [show]);

  useEffect(() => {
    if (!show) document.documentElement.classList.remove('is-loading');
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div className="preloader" exit={{ opacity: 0, transition: { duration: 0.9, ease: [0.76, 0, 0.24, 1] } }} aria-hidden="true">
          <div className="preloader-mark">
            {gulf && (
              <motion.span
                className="preloader-rosette"
                initial={{ opacity: 0, rotate: -30, scale: 0.85 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                transition={{ duration: 1.9, ease: [0.2, 0.7, 0.2, 1] }}
              />
            )}
            <motion.img
              src="/media/calligraphy.webp"
              alt=""
              initial={{ opacity: 0.4, clipPath: 'inset(0 0 0 100%)', filter: 'brightness(0.5)' }}
              animate={{ opacity: 1, clipPath: 'inset(0 0 0 0%)', filter: 'brightness(1)' }}
              transition={{ duration: 1.25, ease: EASE }}
            />
          </div>
          <motion.span className="preloader-line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.1, delay: 0.3, ease: EASE }} />
          <motion.span
            className="preloader-tag"
            lang={lang}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            {lang === 'ar' ? 'اترك بصمتك' : 'leave your signature'}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
