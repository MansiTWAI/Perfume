import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AccountLayout from '../components/AccountLayout';
import { useStore } from '../context/StoreContext';
import { useLive } from '../hooks/useLive';
import { api } from '../lib/api';
import { formatDate, money, whatsappLink } from '../lib/format';

export function AuthForm() {
  const { login, t } = useStore();
  const { search } = useLocation();
  const [mode, setMode] = useState(() => (new URLSearchParams(search).get('new') ? 'register' : 'login'));
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const signIn = { email: f.email, password: f.password };
      const d = await api(`/auth/${mode === 'login' ? 'login' : 'register'}`, { method: 'POST', body: mode === 'login' ? signIn : f });
      login(d.token, d.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form auth-form" onSubmit={submit}>
      <div className="seg" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'login'} aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(''); }}>{t('Sign in')}</button>
        <button type="button" role="tab" aria-selected={mode === 'register'} aria-pressed={mode === 'register'} onClick={() => { setMode('register'); setError(''); }}>{t('Create account')}</button>
      </div>
      {mode === 'register' && <label>{t('Name')}<input required value={f.name} onChange={set('name')} autoComplete="name" /></label>}
      <label>{t('Email')}<input type="email" dir="ltr" required value={f.email} onChange={set('email')} autoComplete="email" /></label>
      {mode === 'register' && (
        <label>{t('Mobile (WhatsApp)')}
          <input type="tel" dir="ltr" required inputMode="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" placeholder="+91 98765 43210" pattern="[+0-9 ()-]{10,20}" />
          <small className="field-hint">{t('For order updates on WhatsApp. One account per number.')}</small>
        </label>
      )}
      <label>{t('Password')}
        <span className="pw-field">
          <input type={show ? 'text' : 'password'} required minLength={mode === 'register' ? 8 : undefined} value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-pressed={show}>{t(show ? 'Hide' : 'Show')}</button>
        </span>
        {mode === 'register' && <small className="field-hint">{t('At least 8 characters.')}</small>}
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-block" disabled={busy}>{t(busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account')}</button>
      {mode === 'login' && <Link to="/forgot-password" className="text-link auth-forgot">{t('Forgot your password?')}</Link>}
    </form>
  );
}

export const ACTIVE = ['Order Placed', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery'];

function Overview() {
  const { user, lang, t } = useStore();
  const { data: orders, error } = useLive('/orders/mine');
  const a = user.address || {};
  const hasAddress = a.line1 && a.city;
  const active = (orders || []).filter((o) => ACTIVE.includes(o.status));
  const recent = (orders || []).slice(0, 3);

  return (
    <div className="acct-stack">
      <div className="acct-stats">
        <Link to="/profile/orders" className="acct-stat"><b>{orders ? orders.length : '–'}</b><span>{t('Orders')}</span></Link>
        <Link to="/profile/orders?show=active" className="acct-stat"><b>{orders ? active.length : '–'}</b><span>{t('On their way')}</span></Link>
        <span className="acct-stat"><b>{user.createdAt ? new Date(user.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { month: 'short', year: 'numeric' }) : '—'}</b><span>{t('Member since')}</span></span>
      </div>

      {active[0] && (
        <Link to={`/profile/orders/${active[0].orderNumber}`} className="acct-card acct-live">
          <span className="eyebrow">{t('Latest order')}</span>
          <b>{active[0].orderNumber} · {t(active[0].status)}</b>
          <small>{active[0].items.map((i) => `${i.name} × ${i.qty}`).join(', ')} · {money(active[0].total, active[0].currency, lang)}</small>
          <span className="text-link">{t('View order')}</span>
        </Link>
      )}

      <section className="acct-card">
        <div className="acct-card-head">
          <h2>{t('Recent orders')}</h2>
          {orders?.length > 0 && <Link to="/profile/orders" className="text-link">{t('See all orders')}</Link>}
        </div>
        {error ? (
          <p className="muted">{t('We could not load your orders just now.')}</p>
        ) : !orders ? (
          <div className="skeleton-lines" aria-busy="true"><span /><span /></div>
        ) : recent.length === 0 ? (
          <div className="acct-empty">
            <p>{t('No orders yet.')}</p>
            <Link to="/fragrances" className="btn btn-primary">{t('Find your signature')}</Link>
          </div>
        ) : (
          <ul className="acct-rows">
            {recent.map((o) => (
              <li key={o._id}>
                <Link to={`/profile/orders/${o.orderNumber}`}>
                  <span className="acct-row-thumbs">{o.items.slice(0, 2).map((i) => i.image && <img key={i.slug} src={i.image} alt="" width="36" height="46" loading="lazy" />)}</span>
                  <span className="acct-row-main"><b dir="ltr">{o.orderNumber}</b><small>{formatDate(o.createdAt)}</small></span>
                  <span className="acct-row-total">{money(o.total, o.currency, lang)}</span>
                  <span className={`status-pill ${o.status === 'Delivered' ? 'is-done' : o.status === 'Cancelled' ? 'is-cancelled' : 'is-active'}`}>{t(o.status)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!user.phone && (
        <p className="pay-note acct-phone-note" role="status">
          {t('Add your mobile number so we can send order updates on WhatsApp.')} <Link to="/profile/edit" className="text-link">{t('Add mobile number')}</Link>
        </p>
      )}
      <div className="acct-two">
        <section className="acct-card">
          <div className="acct-card-head">
            <h2>{t('Your details')}</h2>
            <Link to="/profile/edit" className="text-link">{t('Edit')}</Link>
          </div>
          <dl className="acct-dl">
            <dt>{t('Name')}</dt><dd>{user.name}</dd>
            <dt>{t('Email')}</dt><dd dir="ltr">{user.email}</dd>
            <dt>{t('Phone')}</dt><dd dir="ltr">{user.phone || <Link to="/profile/edit" className="text-link">{t('Add phone')}</Link>}</dd>
          </dl>
        </section>
        <section className="acct-card">
          <div className="acct-card-head">
            <h2>{t('Delivery address')}</h2>
            <Link to="/profile/edit#address" className="text-link">{t(hasAddress ? 'Edit' : 'Add')}</Link>
          </div>
          {hasAddress ? (
            <address className="acct-address">{a.line1}{a.line2 && <>, {a.line2}</>}<br />{[a.city, a.state, a.postalCode].filter(Boolean).join(' ')}<br />{t(a.region === 'AE' ? 'United Arab Emirates' : 'India')}</address>
          ) : (
            <p className="muted">{t('Save an address and checkout fills it in for you.')}</p>
          )}
        </section>
      </div>

      <section className="acct-help">
        <p>{t('Need help with an order?')}</p>
        <a href={whatsappLink(t('Hello Al Barakah, I need help with my order.'))} target="_blank" rel="noreferrer" className="btn btn-ghost">{t('Message us on WhatsApp')}</a>
      </section>
    </div>
  );
}

export default function Account() {
  const { user, t } = useStore();
  return (
    <AccountLayout
      title={user ? t('Hello, {name}', { name: user.name.split(' ')[0] }) : t('Your account')}
      seoTitle="Your account"
      lede={user?.email}
      signedOut={<AuthForm />}
    >
      {user && <Overview />}
    </AccountLayout>
  );
}
