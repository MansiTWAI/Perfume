import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import { cx, whatsappLink } from '../lib/format';
import { stopScroll } from './SmoothScroll';
import RegionSelect from './RegionSelect';
import AccountMenu, { Monogram } from './AccountMenu';
import { openWhatsAppSignup, useSubscribed } from './WhatsAppUpdates';
import Icon from './Icon';

// Every page, in the same groups as the footer. Desktop shows them as four
// menus (Shop, The House, Journal, Help); phones get them in the menu.
const FRAGRANCES = [
  ['/fragrances/elarisse', 'ELARISSE', 'Luminous Floral Amber'],
  ['/fragrances/zafreon', 'ZAFREON', 'Oriental Woody Oud'],
  ['/fragrances/signature-duo', 'Signature Duo', 'Gift set · 2 × 100 ml'],
];
const HOUSE = [
  ['/about-us', 'About Us'],
  ['/our-story', 'Our Story'],
  ['/mission-vision', 'Mission & Vision'],
  ['/fragrance-heritage', 'Heritage'],
  ['/gallery', 'Gallery'],
];
const HELP = [
  ['/track', 'Track an order'],
  ['/contact', 'Contact'],
  ['/faq', 'FAQ'],
  ['/shipping-policy', 'Shipping Policy'],
  ['/refund-policy', 'Refund & Cancellation'],
];
const inGroup = (pathname, group) => group.some(([to]) => pathname === to || pathname.startsWith(`${to}/`));

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

// "Subscribe" in the bar; hidden once this customer is subscribed.
function SubscribeButton() {
  const { t } = useStore();
  const [state] = useSubscribed();
  if (!state || state.subscribed) return null;
  return (
    <button type="button" className="nav-sub" onClick={() => openWhatsAppSignup({ source: 'header' })} aria-label={t('Subscribe to WhatsApp updates')}>
      <Icon name="chat" size={15} /><span>{t('Subscribe')}</span>
    </button>
  );
}

// One desktop menu: opens on hover or click, closes on Esc, outside click or
// leaving it. The panel holds plain links.
function NavMenu({ id, label, active, open, setOpen, children }) {
  const box = useRef(null);
  const timer = useRef(0);
  const isOpen = open === id;
  useEffect(() => {
    if (!isOpen) return undefined;
    const outside = (e) => !box.current?.contains(e.target) && setOpen(null);
    const key = (e) => {
      if (e.key === 'Escape') {
        setOpen(null);
        box.current?.querySelector('.nav-link')?.focus();
      }
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', key); };
  }, [isOpen, setOpen]);
  const enter = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(id), 90); };
  const leave = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen((o) => (o === id ? null : o)), 160); };
  return (
    <div className="nav-menu" ref={box} onMouseEnter={enter} onMouseLeave={leave}>
      <button
        type="button"
        className={cx('nav-link', 'nav-trigger', (active || isOpen) && 'active', isOpen && 'is-open')}
        aria-expanded={isOpen}
        aria-controls={`nav-${id}`}
        onClick={() => setOpen(isOpen ? null : id)}
      >
        {label}<span className="nav-caret" aria-hidden="true" />
        {active && <motion.span layoutId="nav-underline" className="nav-underline" transition={{ type: 'spring', stiffness: 260, damping: 30 }} />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={`nav-${id}`}
            className={`nav-panel nav-panel-${id}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Header() {
  const { count, setCartOpen, user, logout, setSearchOpen, setFinderOpen, t } = useStore();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menu, setMenu] = useState(false);
  const [open, setOpen] = useState(null); // which desktop menu is open
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

  useEffect(() => { setMenu(false); setOpen(null); }, [pathname]);
  useEffect(() => { if (hidden) setOpen(null); }, [hidden]);
  useEffect(() => {
    stopScroll(menu);
    document.body.style.overflow = menu ? 'hidden' : '';
    if (!menu) return undefined;
    // Escape closes the menu, as it does the bag and search.
    const onKey = (e) => e.key === 'Escape' && setMenu(false);
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [menu]);

  const finder = () => { setOpen(null); setMenu(false); setFinderOpen(true); };
  const shopActive = pathname.startsWith('/fragrances');

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
              <NavMenu id="shop" label={t('Shop')} active={shopActive} open={open} setOpen={setOpen}>
                <div className="nav-col">
                  <p className="nav-h">{t('Fragrances')}</p>
                  {FRAGRANCES.map(([to, name, note]) => (
                    <Link key={to} to={to} className="nav-product"><b>{name}</b><small>{t(note)}</small></Link>
                  ))}
                </div>
                <div className="nav-col">
                  <p className="nav-h">{t('Shop')}</p>
                  <Link to="/fragrances">{t('All fragrances')}</Link>
                  <button type="button" onClick={finder}>{t('Find your signature')}</button>
                  <Link to="/track">{t('Track an order')}</Link>
                </div>
                <button type="button" className="nav-feature" onClick={finder}>
                  <b>{t('Not sure which?')}</b>
                  <span>{t('Answer four questions and we will match you.')}</span>
                  <i>{t('Find your signature')} <span className="flip-rtl" aria-hidden="true">→</span></i>
                </button>
              </NavMenu>
              <NavMenu id="house" label={t('The House')} active={inGroup(pathname, HOUSE)} open={open} setOpen={setOpen}>
                <div className="nav-col">
                  {HOUSE.map(([to, label]) => <Link key={to} to={to}>{t(label)}</Link>)}
                </div>
              </NavMenu>
              <NavLink to="/journal" className="nav-link">
                {({ isActive }) => (
                  <>
                    {t('Journal')}
                    {isActive && <motion.span layoutId="nav-underline" className="nav-underline" transition={{ type: 'spring', stiffness: 260, damping: 30 }} />}
                  </>
                )}
              </NavLink>
              <NavMenu id="help" label={t('Help')} active={inGroup(pathname, HELP)} open={open} setOpen={setOpen}>
                <div className="nav-col">
                  {HELP.map(([to, label]) => <Link key={to} to={to}>{t(label)}</Link>)}
                  <a href={whatsappLink(t('Hello Al Barakah'))} target="_blank" rel="noreferrer">{t('Chat on WhatsApp')}</a>
                </div>
              </NavMenu>
            </nav>
          </div>

          <Link to="/" className="logo" aria-label={t('AL BARAKAH LIFESTYLE, home')}>
            <img src="/media/calligraphy.webp" alt="" width="58" height="44" />
            <span className="logo-word">
              <b>Al Barakah</b>
              <small>Lifestyle</small>
            </span>
          </Link>

          {/* Desktop: Subscribe and the market / language in one quiet style,
              a hairline, then three equal icons. Tablet and phone keep the
              profile and the bag; the rest is in the menu. */}
          <div className="header-right">
            <div className="nav-desktop-only hdr-utils">
              <SubscribeButton />
              <div className="hdr-locale">
                <RegionSelect />
                <LangToggle className="lang-btn lang-inline" />
              </div>
              <span className="hdr-sep" aria-hidden="true" />
            </div>
            <button className="icon-btn hdr-search" onClick={() => setSearchOpen(true)} aria-label={t('Search')}><Icon name="search" /></button>
            <AccountMenu />
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
            data-lenis-prevent
            initial={{ clipPath: 'inset(0 0 100% 0)' }}
            animate={{ clipPath: 'inset(0 0 0% 0)', transition: { duration: 0.7, ease: [0.76, 0, 0.24, 1] } }}
            exit={{ clipPath: 'inset(0 0 100% 0)', transition: { duration: 0.5, ease: [0.76, 0, 0.24, 1] } }}
          >
            <nav aria-label={t('Menu')}>
              <motion.div className="mm-account" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}>
                {user ? (
                  <>
                    <div className="mm-acct">
                      <Monogram user={user} className="avatar-lg" />
                      <span><b>{t('Hello, {name}', { name: user.name?.split(' ')[0] || '' })}</b><small dir="ltr">{user.email}</small></span>
                    </div>
                    <div className="mm-quick">
                      <NavLink to="/profile/orders"><Icon name="package" />{t('My orders')}</NavLink>
                      <NavLink to="/profile/edit"><Icon name="user" />{t('Edit profile')}</NavLink>
                      <NavLink to="/track"><Icon name="truck" />{t('Track an order')}</NavLink>
                    </div>
                  </>
                ) : (
                  <div className="mm-acct">
                    <span><b>{t('Your account')}</b><small>{t('See your orders and check out faster.')}</small></span>
                    <NavLink to="/account" className="mm-signin">{t('Sign in')}</NavLink>
                  </div>
                )}
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.25 } }}>
                <p className="mm-h">{t('Shop')}</p>
                <div className="mm-big">
                  <NavLink to="/fragrances" end>{t('All fragrances')}</NavLink>
                  {FRAGRANCES.map(([to, name]) => <NavLink key={to} to={to}>{name}</NavLink>)}
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.32 } }}>
                <p className="mm-h">{t('The House')}</p>
                <div className="mm-two">
                  {HOUSE.map(([to, label]) => <NavLink key={to} to={to}>{t(label)}</NavLink>)}
                  <NavLink to="/journal">{t('Journal')}</NavLink>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.39 } }}>
                <p className="mm-h">{t('Help')}</p>
                <div className="mm-two">
                  {HELP.slice(0, 3).map(([to, label]) => <NavLink key={to} to={to}>{t(label)}</NavLink>)}
                  <button type="button" onClick={finder}>{t('Find your signature')}</button>
                  <button type="button" onClick={() => { setMenu(false); setSearchOpen(true); }}>{t('Search')}</button>
                  {user && <NavLink to="/profile" end>{t('Account overview')}</NavLink>}
                  {user?.role === 'admin' && <NavLink to="/admin">{t('Admin studio')}</NavLink>}
                  {user && <button type="button" className="mm-out" onClick={() => { logout(); setMenu(false); }}>{t('Sign out')}</button>}
                </div>
              </motion.div>
            </nav>
            <div className="mobile-menu-foot">
              <MenuSubscribe onOpen={() => setMenu(false)} />
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

function MenuSubscribe({ onOpen }) {
  const { t } = useStore();
  const [state] = useSubscribed();
  if (!state || state.subscribed) return null;
  return (
    <button type="button" className="btn wa-gold btn-block mm-sub" onClick={() => { onOpen(); openWhatsAppSignup({ source: 'menu' }); }}>
      <Icon name="chat" size={16} />{t('Subscribe on WhatsApp')}
    </button>
  );
}
