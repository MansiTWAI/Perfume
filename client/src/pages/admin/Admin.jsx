import { useState } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
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

function AdminLogin() {
  const { login } = useStore();
  const [f, setF] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const d = await api('/auth/login', { method: 'POST', body: f });
      if (d.user.role !== 'admin') throw new Error('This account does not have admin access.');
      login(d.token, d.user);
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <div className="admin-login">
      <form onSubmit={submit} className="admin-card">
        <img src="/media/emblem.webp" alt="" width="110" className="emblem-tile" />
        <h1>Admin studio</h1>
        <label>Email<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="username" /></label>
        <label>Password<input type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" /></label>
        {error && <p className="a-error">{error}</p>}
        <button className="a-btn a-primary">Sign in</button>
        <Link to="/" className="a-link">← Back to the store</Link>
      </form>
    </div>
  );
}

const NAV = [
  ['/admin', 'Dashboard', true],
  ['/admin/orders', 'Orders'],
  ['/admin/users', 'Users'],
  ['/admin/products', 'Products'],
  ['/admin/reviews', 'Reviews'],
  ['/admin/journal', 'Journal'],
  ['/admin/leads', 'AI leads'],
  ['/admin/enquiries', 'Enquiries'],
  ['/admin/subscribers', 'Subscribers'],
];

export default function Admin() {
  const { user, logout } = useStore();
  if (!user || user.role !== 'admin') return <AdminLogin />;
  return (
    <div className="admin">
      <Helmet><title>Admin studio | AL BARAKAH LIFESTYLE</title><meta name="robots" content="noindex" /></Helmet>
      <aside className="a-side">
        <Link to="/admin" className="a-brand"><img src="/media/calligraphy.webp" alt="" width="56" /> <span>Studio</span></Link>
        <nav>
          {NAV.map(([to, label, end]) => (
            <NavLink key={to} to={to} end={end}>{label}</NavLink>
          ))}
        </nav>
        <div className="a-side-foot">
          <Link to="/" target="_blank">View store ↗</Link>
          <button onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="a-main">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/imports" element={<ImportHistory />} />
          <Route path="users" element={<UserList />} />
          <Route path="users/:id" element={<UserDetail />} />
          <Route path="products" element={<ProductList />} />
          <Route path="products/:id" element={<ProductEdit />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="journal" element={<PostList />} />
          <Route path="journal/:id" element={<PostEdit />} />
          <Route path="leads" element={<Leads />} />
          <Route path="enquiries" element={<Enquiries />} />
          <Route path="subscribers" element={<Subscribers />} />
        </Routes>
      </main>
    </div>
  );
}
