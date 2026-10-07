import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import { useProducts } from '../hooks/useProducts';
import { cx, whatsappLink } from '../lib/format';
import { api } from '../lib/api';
import ChatConcierge from './ChatConcierge';

// Asked once per page load: is the AI concierge switched on on the server?
let aiStatus = null;
const aiEnabled = () => (aiStatus ||= api('/ai/status').then((d) => !!d.enabled).catch(() => false));

const HIDDEN = /^\/(checkout|order)/;
const TEASER_AFTER = 20000;

const readSeen = () => {
  try {
    return !!sessionStorage.getItem('ab_concierge');
  } catch {
    return true;
  }
};

// The WhatsApp concierge: always one tap away, and it already knows which
// fragrance the visitor is looking at. Once per session it offers help.
export default function Concierge() {
  const { pathname } = useLocation();
  const { products } = useProducts();
  const { t, cartOpen } = useStore();
  const [teaser, setTeaser] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const [ai, setAi] = useState(false);
  useEffect(() => {
    aiEnabled().then(setAi);
  }, []);

  const slug = pathname.match(/^\/fragrances\/([^/]+)/)?.[1];
  const product = slug && products.find((p) => p.slug === slug);
  // The homepage opening stays clean: the button arrives once the story scrolls on.
  const hidden = HIDDEN.test(pathname) || cartOpen || (pathname === '/' && !pastHero);

  useEffect(() => {
    // On the homepage the hero is the pinned turntable: wait until it has turned.
    const on = () => {
      const hero = document.querySelector('.tt-track');
      setPastHero(scrollY > (hero ? hero.offsetHeight - innerHeight * 0.2 : innerHeight * 0.8));
    };
    on();
    addEventListener('scroll', on, { passive: true });
    return () => removeEventListener('scroll', on);
  }, []);

  useEffect(() => {
    if (readSeen()) return;
    const id = setTimeout(() => setTeaser(true), TEASER_AFTER);
    return () => clearTimeout(id);
  }, []);

  const closeTeaser = () => {
    setTeaser(false);
    try {
      sessionStorage.setItem('ab_concierge', '1');
    } catch {
      /* ignore */
    }
  };

  const message = product
    ? t('Hello Al Barakah, I have a question about {name}.', { name: `${product.name} ${product.subtitle}` })
    : t('Hello Al Barakah, I would like help choosing a fragrance.');

  // With the AI concierge on, it takes this place (WhatsApp stays one tap
  // away inside the chat).
  if (ai) return <ChatConcierge hidden={hidden} lift={!!product} />;

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          className={cx('concierge', product && 'concierge-lift')}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 1.2 } }}
          exit={{ opacity: 0, y: 20 }}
        >
          <AnimatePresence>
            {teaser && (
              <motion.div className="concierge-teaser" role="status" initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }}>
                <button className="concierge-x" onClick={closeTeaser} aria-label={t('Dismiss')}>✕</button>
                <p><b>{t('Need help choosing?')}</b>{t('Our concierge replies on WhatsApp.')}</p>
                <a href={whatsappLink(message)} target="_blank" rel="noreferrer" className="text-link" onClick={closeTeaser}>{t('Chat with us')}</a>
              </motion.div>
            )}
          </AnimatePresence>
          <a
            className="concierge-btn"
            href={whatsappLink(message)}
            target="_blank"
            rel="noreferrer"
            aria-label={t('Ask our fragrance concierge on WhatsApp')}
            onClick={closeTeaser}
          >
            <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
              <path d="M16 4.5c-6.4 0-11.5 4.9-11.5 11 0 2.2.7 4.3 1.9 6L5 27l5.7-1.6c1.6.8 3.4 1.2 5.3 1.2 6.4 0 11.5-4.9 11.5-11S22.4 4.5 16 4.5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M12 11.5c.4-.6 1.2-.6 1.5 0l.9 2c.2.4 0 .8-.3 1.1l-.6.6c.6 1.4 1.8 2.6 3.2 3.2l.6-.6c.3-.3.7-.5 1.1-.3l2 .9c.6.3.6 1.1 0 1.5-.9.7-2 1-3 .6-2.9-1.1-5.1-3.3-6.2-6.2-.4-1-.1-2.1.8-2.8z" fill="currentColor" />
            </svg>
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
