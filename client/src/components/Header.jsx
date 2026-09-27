import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import { cx } from '../lib/format';
import { stopScroll } from './SmoothScroll';
import RegionSelect from './RegionSelect';

const PRIMARY = [
  ['/fragrances', 'Fragrances'],
  ['/our-story', 'Our Story'],
  ['/journal', 'Journal'],
];
const MENU = [
  ['/fragrances', 'Fragrances'],
  ['/our-story', 'Our Story'],
  ['/fragrance-heritage', 'Heritage'],
  ['/journal', 'Journal'],
  ['/gallery', 'Gallery'],
  ['/contact', 'Contact'],
];

const Icon = {
  search: <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M15 15l5 5" stroke="currentColor" strokeWidth="1.3" /></svg>,
  user: <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>,
  bag: <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M5 8h14l-1 13H6L5 8z" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>,
};

// English ⇄ Arabic. Each option is labelled in its own language.
function LangToggle({ className = 'lang-btn' }) {
  const { lang, setLang } = useStore();
  const next = lang === 'ar' ? 'en' : 'ar';
  return (
    <button
      className={className}
      onClick={() => setLang(next)}
      lang={next}
      aria-label={next === 'ar' ? 'تصفّح بالعربية' : 'Read in English'}
    >
      {next === 'ar' ? 'عربي' : 'EN'}
    </button>
  );
}

export default function Header() {
  const { count, setCartOpen, user, setSearchOpen, setFinderOpen, t } = useStore();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menu, setMenu] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    let last = scrollY;
    const on = () => {
      const y = scrollY;
      setScrolled(y > 40);
      if (y > 480 && y > last + 6) setHidden(true);
      else if (y < last - 6 || y < 480) setHidden(false);
      last = y;
    };
    on();
    addEventListener('scroll', on, { passive: true });
    return () => removeEventListener('scroll', on);
  }, []);

  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    stopScroll(menu);
    document.body.style.overflow = menu ? 'hidden' : '';
  }, [menu]);

  return (
    <>
      <motion.header
        className={cx('site-header', scrolled && 'is-scrolled', hidden && !menu && 'is-hidden', menu && 'menu-open')}
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
      >
        <div className="container header-row">
          <div className="header-left">
            <button className="menu-btn" aria-label={t(menu ? 'Close menu' : 'Open menu')} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              <span /><span />
            </button>
            <nav className="nav-desktop" aria-label={t('Primary')}>
              {PRIMARY.map(([to, label]) => (
                <NavLink key={to} to={to} className="nav-link">
                  {({ isActive }) => (
                    <>
                      {t(label)}
                      {isActive && <motion.span layoutId="nav-underline" className="nav-underline" transition={{ type: 'spring', stiffness: 260, damping: 30 }} />}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          <Link to="/" className="logo" aria-label={t('AL BARAKAH LIFESTYLE, home')}>
            <img src="/media/calligraphy.webp" alt="" width="58" height="44" />
            <span className="logo-word">
              <b>Al Barakah</b>
              <small>Lifestyle</small>
            </span>
          </Link>

          <div className="header-right">
            <NavLink to="/contact" className="nav-link nav-desktop-only">{t('Contact')}</NavLink>
            <LangToggle />
            <button className="icon-btn" onClick={() => setSearchOpen(true)} aria-label={t('Search')}>{Icon.search}</button>
            <div className="nav-desktop-only"><RegionSelect /></div>
            <Link to="/account" className="icon-btn nav-desktop-only" aria-label={t(user ? 'Your account' : 'Sign in')}>{Icon.user}</Link>
            <button id="bag-button" className="icon-btn" onClick={() => setCartOpen(true)} aria-label={t('Bag, {n} items', { n: count })}>
              {Icon.bag}
              <AnimatePresence>
                {count > 0 && (
                  <motion.span className="bag-count" key={count} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} aria-hidden="true">
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {menu && (
          <motion.div
            className="mobile-menu"
            initial={{ clipPath: 'inset(0 0 100% 0)' }}
            animate={{ clipPath: 'inset(0 0 0% 0)', transition: { duration: 0.7, ease: [0.76, 0, 0.24, 1] } }}
            exit={{ clipPath: 'inset(0 0 100% 0)', transition: { duration: 0.5, ease: [0.76, 0, 0.24, 1] } }}
          >
            <nav aria-label={t('Menu')}>
              {MENU.map(([to, label], i) => (
                <motion.div key={to} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.25 + i * 0.05 } }}>
                  <NavLink to={to}>{t(label)}</NavLink>
                </motion.div>
              ))}
            </nav>
            <div className="mobile-menu-foot">
              <button className="text-btn" onClick={() => { setMenu(false); setFinderOpen(true); }}>{t('Find your signature')}</button>
              <Link to="/account" className="text-btn">{t(user ? 'Your account' : 'Sign in')}</Link>
              <Link to="/track" className="text-btn">{t('Track an order')}</Link>
              <LangToggle className="lang-btn lang-btn-menu" />
              <RegionSelect align="left" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
