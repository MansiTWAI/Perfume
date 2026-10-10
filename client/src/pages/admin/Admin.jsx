import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useStore } from '../../context/StoreContext';
import { api } from '../../lib/api';
import Dashboard from './Dashboard';
import Orders from './Orders';
import { ImportHistory } from './OrderExcel';
import { UserList, UserDetail } from './Users';
import { ProductList, ProductEdit } from './Products';
import { PostList, PostEdit } from './Posts';
import { Enquiries, Subscribers } from './Inbox';
import Reviews from './Reviews';
import Leads from './Leads';
import Shipping from './Shipping';
import { CouponList, CouponEdit } from './Coupons';
import WhatsApp from './WhatsApp';
import Icon from '../../components/Icon';
import TwoStepCode from '../../components/TwoStepCode';

const CODE_STYLE = { form: 'a-2fa-form', lede: 'a-muted', code: 'a-code-input', error: 'a-error', note: 'a-hint', primary: 'a-btn a-primary', row: 'a-code-row', link: 'a-link-btn' };

// Step 1: email and password. Step 2: the code we email (TwoStepCode).
function AdminLogin({ notice = '' }) {
  const { logout } = useStore();
  const [f, setF] = useState({ email: '', password: '' });
  const [error, setError] = useState(notice);
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState(null);
  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const d = await api('/auth/login', { method: 'POST', body: f });
      if (d.twoFactorRequired) {
        setChallenge(d);
        setF((x) => ({ ...x, password: '' }));
      } else {
        throw new Error('This account does not have admin access.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const brand = <><img src="/media/emblem.webp" alt="" width="110" className="emblem-tile" /><h1>Admin studio</h1></>;
  if (challenge) {
    return (
      <div className="admin-login">
        <div className="admin-card admin-card-2fa">
          {brand}
          <p className="a-step">Step 2 of 2 · Check your email</p>
          <TwoStepCode
            challenge={challenge}
            classes={CODE_STYLE}
            onDone={(u) => { if (u.role !== 'admin') { logout(); setChallenge(null); setError('This account does not have admin access.'); } }}
            onCancel={(msg) => { setChallenge(null); setError(msg || ''); }}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="admin-login">
      <form onSubmit={submit} className="admin-card">
        {brand}
        <p className="a-step">Step 1 of 2 · Password</p>
        <label>Email<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="username" /></label>
        <label>Password<input type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" /></label>
        {error && <p className="a-error" role="alert">{error}</p>}
        <button className="a-btn a-primary" disabled={busy}>{busy ? 'One moment…' : 'Continue'}</button>
        <p className="a-muted a-hint">For your security, we email you a code after your password.</p>
        <Link to="/" className="a-link"><Icon name="arrow-left" size={16} className="flip-rtl" /> Back to the store</Link>
      </form>
    </div>
  );
}

// The menu in three groups, most-used first.
const NAV = [
  ['Sales', [['/admin', 'Dashboard', true], ['/admin/orders', 'Orders'], ['/admin/shipping', 'Shipping'], ['/admin/coupons', 'Coupons']]],
  ['Catalogue', [['/admin/products', 'Products'], ['/admin/reviews', 'Reviews'], ['/admin/journal', 'Journal']]],
  ['Customers', [['/admin/users', 'Users'], ['/admin/leads', 'AI leads'], ['/admin/whatsapp', 'WhatsApp'], ['/admin/enquiries', 'Enquiries'], ['/admin/subscribers', 'Newsletter']]],
];

export default function Admin() {
  const { user, logout } = useStore();
  const nav = useRef(null);
  const { pathname } = useLocation();
  const [notice, setNotice] = useState('');
  // A session from before two-step sign-in: sign out and ask for the code.
  useEffect(() => {
    const onMfa = () => { logout(); setNotice('For your security, please sign in again. We will email you a code.'); };
    addEventListener('ab:mfa-required', onMfa);
    return () => removeEventListener('ab:mfa-required', onMfa);
  }, [logout]);
  // On narrow screens the menu scrolls sideways: keep the current page in view.
  useEffect(() => {
    nav.current?.querySelector('a.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [pathname]);
  if (!user || user.role !== 'admin') return <AdminLogin notice={notice} />;
  return (
    <div className="admin">
      <Helmet><title>Admin studio | AL BARAKAH LIFESTYLE</title><meta name="robots" content="noindex" /></Helmet>
      <aside className="a-side">
        <Link to="/admin" className="a-brand"><img src="/media/calligraphy.webp" alt="" width="56" /> <span>Studio</span></Link>
        <nav ref={nav} aria-label="Studio">
          {NAV.map(([group, links]) => (
            <div key={group} className="a-nav-group" role="group" aria-label={group}>
              <span className="a-nav-label" aria-hidden="true">{group}</span>
              {links.map(([to, label, end]) => <NavLink key={to} to={to} end={end}>{label}</NavLink>)}
            </div>
          ))}
        </nav>
        <div className="a-side-foot">
          <Link to="/" target="_blank">View store <Icon name="external" size={14} /></Link>
          <button onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="a-main">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/imports" element={<ImportHistory />} />
          <Route path="shipping" element={<Shipping />} />
          <Route path="users" element={<UserList />} />
          <Route path="users/:id" element={<UserDetail />} />
          <Route path="products" element={<ProductList />} />
          <Route path="products/:id" element={<ProductEdit />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="journal" element={<PostList />} />
          <Route path="journal/:id" element={<PostEdit />} />
          <Route path="coupons" element={<CouponList />} />
          <Route path="coupons/:id" element={<CouponEdit />} />
          <Route path="leads" element={<Leads />} />
          <Route path="whatsapp/*" element={<WhatsApp />} />
          <Route path="enquiries" element={<Enquiries />} />
          <Route path="subscribers" element={<Subscribers />} />
        </Routes>
      </main>
    </div>
  );
}
