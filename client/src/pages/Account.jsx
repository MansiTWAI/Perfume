import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Seo from '../components/Seo';
import { PageHero } from '../components/Bits';
import { useStore } from '../context/StoreContext';
import { api } from '../lib/api';
import { formatDate, money } from '../lib/format';

function AuthForm() {
  const { login } = useStore();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const d = await api(`/auth/${mode === 'login' ? 'login' : 'register'}`, { method: 'POST', body: f });
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
        <button type="button" role="tab" aria-selected={mode === 'login'} aria-pressed={mode === 'login'} onClick={() => setMode('login')}>Sign in</button>
        <button type="button" role="tab" aria-selected={mode === 'register'} aria-pressed={mode === 'register'} onClick={() => setMode('register')}>Create account</button>
      </div>
      {mode === 'register' && <label>Name<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></label>}
      <label>Email<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></label>
      <label>Password<input type="password" required minLength={mode === 'register' ? 8 : undefined} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
    </form>
  );
}

export default function Account() {
  const { user, logout } = useStore();
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    if (user) api('/orders/mine').then(setOrders).catch(() => setOrders([]));
  }, [user]);

  return (
    <>
      <Seo title="Your account" />
      <PageHero eyebrow="Account" title={user ? `Welcome, ${user.name.split(' ')[0]}` : 'Your account'} layout="split" image="/media/elarisse-logo-dark.webp" alt="The ELARISSE emblem in gold" lede="Your orders, tracking and details, kept in one place." />
      <section className="section">
        <div className="container narrow">
          {!user ? (
            <AuthForm />
          ) : (
            <div className="account">
              <div className="account-bar">
                <p>{user.email}</p>
                <div className="btn-row">
                  {user.role === 'admin' && <Link to="/admin" className="btn btn-primary">Open the admin studio</Link>}
                  <button className="btn btn-ghost" onClick={logout}>Sign out</button>
                </div>
              </div>
              <h2 className="h-section">Your orders</h2>
              {orders == null ? <p>Loading…</p> : orders.length === 0 ? (
                <p className="empty">No orders yet. <Link to="/fragrances" className="text-link">Find your signature →</Link></p>
              ) : (
                <ul className="order-list">
                  {orders.map((o) => (
                    <li key={o._id}>
                      <div><b>{o.orderNumber}</b><small>{formatDate(o.createdAt)}</small></div>
                      <div>{o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</div>
                      <div>{money(o.total, o.currency)}</div>
                      <span className="status-pill">{o.status}</span>
                      <Link to={`/track?id=${o.trackingId}&email=${encodeURIComponent(o.customer.email)}`} className="text-link">Track →</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
