import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import { cx } from '../lib/format';
import { stopScroll } from './SmoothScroll';
import RegionSelect from './RegionSelect';
import AccountMenu from './AccountMenu';
import Icon from './Icon';

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
  const { count, setCartOpen, user, logout, setSearchOpen, setFinderOpen, t } = useStore();
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
    if (!menu) return;
    // Escape closes the menu, as it does the bag and search.
    const onKey = (e) => e.key === 'Escape' && setMenu(false);
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
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
            <LangToggle />
            <button className="icon-btn" onClick={() => setSearchOpen(true)} aria-label={t('Search')}><Icon name="search" /></button>
            <div className="nav-desktop-only"><RegionSelect /></div>
            <div className="nav-desktop-only"><AccountMenu /></div>
            <button id="bag-button" className="icon-btn" onClick={() => setCartOpen(true)} aria-label={t(count === 1 ? 'Bag, 1 item' : 'Bag, {n} items', { n: count })}>
              <Icon name="bag" />
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
              {user && <Link to="/profile/orders" className="text-btn">{t('My orders')}</Link>}
              {user && <Link to="/profile/edit" className="text-btn">{t('Edit profile')}</Link>}
              <Link to="/track" className="text-btn">{t('Track an order')}</Link>
              {user && <button type="button" className="text-btn" onClick={() => { logout(); setMenu(false); }}>{t('Sign out')}</button>}
              <div className="menu-tools">
                <LangToggle className="lang-btn lang-btn-menu" />
                <RegionSelect align="left" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
