import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import Icon from './Icon';

// The signed-in customer's monogram (first letter of the name, else the email).
export function Monogram({ user, className = '' }) {
  const letter = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();
  return <span className={`avatar ${className}`} aria-hidden="true">{letter}</span>;
}

// The profile button in the header, on every screen size: a monogram when
// signed in, the outline otherwise. Opens a small menu with the account
// shortcuts (or sign in / create account).
export default function AccountMenu() {
  const { user, logout, t } = useStore();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const button = useRef(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => !box.current?.contains(e.target) && setOpen(false);
    const key = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
      // Arrow keys move between the menu items.
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = [...box.current.querySelectorAll('[role="menuitem"]')];
        const i = items.indexOf(document.activeElement);
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
        e.preventDefault();
      }
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', key);
    setTimeout(() => box.current?.querySelector('[role="menuitem"]')?.focus(), 30);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  const first = user?.name?.split(' ')[0] || '';
  const item = (to, icon, label) => (
    <Link role="menuitem" to={to}><Icon name={icon} size={18} />{t(label)}</Link>
  );
  return (
    <div className="acct-menu" ref={box}>
      <button
        ref={button}
        className={`icon-btn acct-btn${open ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t(user ? 'Your account' : 'Sign in')}
        onClick={() => setOpen((o) => !o)}
      >
        {user ? <Monogram user={user} /> : <Icon name="user" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="acct-menu-panel"
            role="menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {user ? (
              <>
                <div className="acct-menu-head">
                  <Monogram user={user} className="avatar-lg" />
                  <span>
                    <b>{first ? t('Hello, {name}', { name: first }) : t('Your account')}</b>
                    <small dir="ltr">{user.email}</small>
                  </span>
                </div>
                <div className="acct-menu-list">
                  {item('/profile/orders', 'package', 'My orders')}
                  {item('/profile/edit', 'user', 'Edit profile')}
                  {item('/profile', 'star', 'Account overview')}
                  {item('/track', 'truck', 'Track an order')}
                  {user.role === 'admin' && item('/admin', 'grid', 'Admin studio')}
                </div>
                <div className="acct-menu-list acct-menu-foot">
                  <button role="menuitem" type="button" className="acct-menu-out" onClick={() => { logout(); setOpen(false); navigate('/account'); }}>
                    <Icon name="sign-out" size={18} />{t('Sign out')}
                  </button>
                </div>
              </>
            ) : (
              <div className="acct-menu-guest">
                <b>{t('Your account')}</b>
                <small>{t('See your orders and check out faster.')}</small>
                <Link role="menuitem" to="/account" className="acct-menu-cta">{t('Sign in')}</Link>
                <Link role="menuitem" to="/account?new=1" className="acct-menu-line">{t('Create account')}</Link>
                <Link role="menuitem" to="/track" className="acct-menu-track">{t('Track an order')}</Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
