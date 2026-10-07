import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, downloadFile, toQuery } from '../../lib/api';
import { money, formatDate } from '../../lib/format';
import { useStore } from '../../context/StoreContext';
import { PeriodPicker, periodParams, Pager } from './Fields';
import Icon from '../../components/Icon';

// Order value is kept per currency: ₹ for India, AED for the UAE.
function Value({ value }) {
  const parts = ['INR', 'AED'].filter((c) => value?.[c]).map((c) => money(value[c], c));
  return parts.length ? parts.join(' + ') : <span className="a-muted">—</span>;
}

const SORTS = [
  ['createdAt:desc', 'Newest registered'],
  ['createdAt:asc', 'Oldest registered'],
  ['name:asc', 'Name A–Z'],
  ['orders:desc', 'Most orders (lifetime)'],
  ['periodOrders:desc', 'Most orders (period)'],
  ['lastOrder:desc', 'Most recent order'],
];
const KEYS = ['q', 'role', 'activity', 'sort', 'period', 'from', 'to'];

export function UserList() {
  const { toast } = useStore();
  const [params, setParams] = useSearchParams();
  const f = Object.fromEntries(KEYS.map((k) => [k, params.get(k) || '']));
  const page = Math.max(parseInt(params.get('page'), 10) || 1, 1);
  const [search, setSearch] = useState(f.q);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const query = useMemo(() => {
    const [sort, dir] = (f.sort || 'createdAt:desc').split(':');
    return { q: f.q, role: f.role, activity: f.activity, sort, dir, ...periodParams(f) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  const incomplete = f.period === 'custom' && !f.from && !f.to;
  const periodOn = f.period && f.period !== 'all';

  useEffect(() => {
    if (incomplete) return;
    setError('');
    api(`/users${toQuery({ ...query, page, limit: 25 })}`)
      .then(setData)
      .catch((e) => {
        setError(e.message);
        setData({ items: [], total: 0, page: 1, pages: 1 });
      });
  }, [query, page, incomplete]);
  useEffect(() => {
    const t = setTimeout(() => search !== f.q && update({ q: search }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function update(patch) {
    setParams((prev) => Object.fromEntries(Object.entries({ ...Object.fromEntries(KEYS.map((k) => [k, prev.get(k) || ''])), ...patch }).filter(([, v]) => v)));
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const name = await downloadFile(`/users/export/xlsx${toQuery(query)}`, 'users.xlsx');
      toast(`Downloaded ${name}`);
    } catch (e) {
      toast(e.message, 'warn');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <header className="a-head">
        <h1>Users</h1>
        <div className="a-actions">
          <button className="a-btn a-primary" onClick={exportExcel} disabled={exporting || incomplete}>{exporting ? 'Preparing…' : 'Export Excel'}</button>
        </div>
      </header>
      <section className="a-filters">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or user ID" aria-label="Search users" />
        <select value={f.role} onChange={(e) => update({ role: e.target.value })} aria-label="Role">
          <option value="">All roles</option>
          <option value="customer">Customers</option>
          <option value="admin">Admins</option>
        </select>
        <select value={f.activity} onChange={(e) => update({ activity: e.target.value })} aria-label="Activity">
          <option value="">All users</option>
          <option value="ordered">Ordered in period</option>
          <option value="registered">Registered in period</option>
          <option value="none">Never ordered</option>
        </select>
        <select value={f.sort || 'createdAt:desc'} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort">
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <PeriodPicker value={f} onChange={update} />
        {KEYS.some((k) => f[k]) && <button className="a-link" onClick={() => { setSearch(''); setParams({}); }}>Clear filters</button>}
      </section>
      <p className="a-muted a-hint">
        {periodOn ? <>“Period” figures cover <b>{data?.period?.label || 'the selected period'}</b>; lifetime figures cover every order.</> : 'Choose a period to compare it with lifetime figures. The export uses the same filters.'}
      </p>
      <section className="a-panel">
        {error && <p className="a-error">{error}</p>}
        {!data ? <p>Loading…</p> : data.items.length === 0 ? <p className="a-muted">No users match these filters.</p> : (
          <>
            <div className="a-table-wrap">
              <table className="a-table">
                <thead>
                  <tr><th>User</th><th>Phone</th><th>Role</th><th>Registered</th>{periodOn && <th>Period orders</th>}<th>Lifetime orders</th><th>Lifetime value</th><th>Last order</th><th /></tr>
                </thead>
                <tbody>
                  {data.items.map((u) => (
                    <tr key={u.id}>
                      <td><b>{u.name}</b><br /><small>{u.email}</small></td>
                      <td>{u.phone || <span className="a-muted">—</span>}{u.address?.city && <><br /><small>{u.address.city}, {u.address.country}</small></>}</td>
                      <td><span className={`a-pill ${u.role === 'admin' ? 'warn' : ''}`}>{u.role}</span></td>
                      <td>{formatDate(u.createdAt)}</td>
                      {periodOn && <td><b>{u.period.orders}</b><br /><small><Value value={u.period.value} /></small></td>}
                      <td>{u.lifetime.orders}</td>
                      <td><Value value={u.lifetime.value} /></td>
                      <td>{u.lifetime.last ? formatDate(u.lifetime.last) : <span className="a-muted">—</span>}</td>
                      <td><Link to={`/admin/users/${u.id}`} className="a-link">View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={data.page} pages={data.pages} total={data.total} noun={data.total === 1 ? 'user' : 'users'} onPage={(p) => setParams({ ...Object.fromEntries(params), page: String(p) })} />
          </>
        )}
      </section>
    </div>
  );
}

export function UserDetail() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api(`/users/${id}`).then(setD).catch((e) => setError(e.message));
  }, [id]);
  if (error) return <div><header className="a-head"><h1>User</h1><Link to="/admin/users" className="a-btn"><Icon name="arrow-left" size={16} /> Users</Link></header><p className="a-error">{error}</p></div>;
  if (!d) return <p>Loading…</p>;
  const { user: u, orders } = d;
  const a = u.address;
  return (
    <div>
      <header className="a-head">
        <h1>{u.name}</h1>
        <div className="a-actions">
          <Link to={`/admin/orders?customer=${u.id}`} className="a-btn">Open in Orders</Link>
          <Link to="/admin/users" className="a-btn"><Icon name="arrow-left" size={16} /> Users</Link>
        </div>
      </header>
      <div className="a-tiles">
        <div className="a-tile"><span>Lifetime orders</span><b>{u.lifetime.orders}</b></div>
        <div className="a-tile"><span>Lifetime value</span><b className="a-tile-sm"><Value value={u.lifetime.value} /></b></div>
        <div className="a-tile"><span>First order</span><b className="a-tile-sm">{u.lifetime.first ? formatDate(u.lifetime.first) : '—'}</b></div>
        <div className="a-tile"><span>Last order</span><b className="a-tile-sm">{u.lifetime.last ? formatDate(u.lifetime.last) : '—'}</b></div>
      </div>
      <div className="a-two">
        <section className="a-panel">
          <h2>Orders</h2>
          {orders.length === 0 ? <p className="a-muted">No orders yet.</p> : (
            <div className="a-table-wrap">
              <table className="a-table">
                <thead><tr><th>Order</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o._id}>
                      <td><Link to={`/admin/orders?q=${encodeURIComponent(o.orderNumber)}`} className="a-link">{o.orderNumber}</Link><br /><small>{formatDate(o.createdAt)}</small></td>
                      <td>{o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</td>
                      <td>{money(o.total, o.currency)}</td>
                      <td>{o.paymentStatus}<br /><small>{o.paymentMethod}</small></td>
                      <td><span className="a-pill">{o.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="a-panel">
          <h2>Profile</h2>
          <dl className="a-dl">
            <dt>User ID</dt><dd><code>{u.id}</code></dd>
            <dt>Email</dt><dd>{u.email}</dd>
            <dt>Phone</dt><dd>{u.phone || '—'}</dd>
            <dt>Role</dt><dd>{u.role}</dd>
            <dt>Status</dt><dd>{u.status}</dd>
            <dt>Registered</dt><dd>{formatDate(u.createdAt)}</dd>
            <dt>Address</dt>
            <dd>{a ? <>{a.line1}{a.line2 && `, ${a.line2}`}<br />{a.city} {a.state} {a.postalCode}<br />{a.country}</> : '—'}</dd>
          </dl>
          <p className="a-muted a-hint">Phone is the account's mobile number (or the latest order's, for older accounts); address comes from the most recent order.</p>
        </section>
      </div>
    </div>
  );
}
