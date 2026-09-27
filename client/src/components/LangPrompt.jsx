import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../context/StoreContext';

// Visitors in the Gulf who have never picked a language are asked once, in
// Arabic, whether they would like it. Many Gulf residents prefer English, so
// the site never switches on its own.
export default function LangPrompt() {
  const { gulf, lang, langChosen, setLang } = useStore();
  const [ready, setReady] = useState(false);
  const show = ready && gulf && !langChosen && lang === 'en';

  useEffect(() => {
    const id = setTimeout(() => setReady(true), 2600);
    return () => clearTimeout(id);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="lang-prompt"
          role="dialog"
          aria-label="العربية"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <p lang="ar" dir="rtl">أهلاً بكم. هل تفضّلون تصفّح الموقع بالعربية؟</p>
          <div className="lang-prompt-actions">
            <button className="btn btn-primary" lang="ar" onClick={() => setLang('ar')}>العربية</button>
            <button className="text-btn" onClick={() => setLang('en')}>Continue in English</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
