import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import Icon from './Icon';

// The profile icon in the header: a small menu with the account shortcuts.
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

  const first = user?.name?.split(' ')[0];
  return (
    <div className="acct-menu" ref={box}>
      <button
        ref={button}
        className={`icon-btn ${user ? 'is-signed-in' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t(user ? 'Your account' : 'Sign in')}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="user" />
        {user && <span className="acct-dot" aria-hidden="true" />}
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
                  <b>{t('Hello, {name}', { name: first })}</b>
                  <small dir="ltr">{user.email}</small>
                </div>
                <Link role="menuitem" to="/profile/orders">{t('My orders')}</Link>
                <Link role="menuitem" to="/profile/edit">{t('Edit profile')}</Link>
                <Link role="menuitem" to="/profile">{t('Account overview')}</Link>
                <Link role="menuitem" to="/track">{t('Track an order')}</Link>
                {user.role === 'admin' && <Link role="menuitem" to="/admin">{t('Admin studio')}</Link>}
                <button role="menuitem" type="button" className="acct-menu-out" onClick={() => { logout(); setOpen(false); navigate('/account'); }}>{t('Sign out')}</button>
              </>
            ) : (
              <>
                <div className="acct-menu-head">
                  <b>{t('Your account')}</b>
                  <small>{t('See your orders and check out faster.')}</small>
                </div>
                <Link role="menuitem" to="/account" className="acct-menu-cta">{t('Sign in')}</Link>
                <Link role="menuitem" to="/account?new=1">{t('Create account')}</Link>
                <Link role="menuitem" to="/track">{t('Track an order')}</Link>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
