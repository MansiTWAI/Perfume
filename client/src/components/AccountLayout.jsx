import { NavLink, Link, useNavigate } from 'react-router-dom';
import Seo from './Seo';
import { useStore } from '../context/StoreContext';
import { useSolidHeader } from '../hooks/useSolidHeader';

const NAV = [
  ['/profile', 'Overview', true],
  ['/profile/orders', 'My orders'],
  ['/profile/edit', 'Edit profile'],
];

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '·';

// Every signed-in account page shares this frame: a compact header and the
// account navigation (a side column on desktop, a scrollable tab row on phones).
// Signed-out visitors see `signedOut` instead (usually the sign-in form).
export default function AccountLayout({ title, seoTitle, lede, actions, signedOut, children }) {
  const { user, logout, t } = useStore();
  const navigate = useNavigate();
  useSolidHeader();

  if (!user) {
    return (
      <section className="section page-pad acct acct-out">
        <Seo title={seoTitle || title} />
        <div className="acct-signin">
          <img src="/media/emblem.webp" alt="" width="88" height="88" className="emblem-tile" />
          <p className="eyebrow">{t('Your account')}</p>
          <h1 className="acct-title">{t('Welcome to the house')}</h1>
          <p className="acct-lede">{t('Sign in to see your orders, change them before they ship, and keep your details for a faster checkout.')}</p>
          {signedOut}
        </div>
      </section>
    );
  }

  return (
    <section className="section page-pad acct">
      <Seo title={seoTitle || title} />
      <div className="container acct-wrap">
        <header className="acct-head">
          <span className="acct-avatar" aria-hidden="true">{initials(user.name)}</span>
          <div className="acct-head-text">
            <p className="eyebrow">{t('Your account')}</p>
            <h1 className="acct-title">{title}</h1>
            {lede && <p className="acct-lede">{lede}</p>}
          </div>
          {actions && <div className="acct-head-actions">{actions}</div>}
        </header>
        <div className="acct-grid">
          <nav className="acct-nav" aria-label={t('Account')}>
            {NAV.map(([to, label, end]) => (
              <NavLink key={to} to={to} end={end}>{t(label)}</NavLink>
            ))}
            <Link to="/track">{t('Track an order')}</Link>
            {user.role === 'admin' && <Link to="/admin">{t('Admin studio')}</Link>}
            <button type="button" onClick={() => { logout(); navigate('/account'); }}>{t('Sign out')}</button>
          </nav>
          <div className="acct-main">{children}</div>
        </div>
      </div>
    </section>
  );
}
