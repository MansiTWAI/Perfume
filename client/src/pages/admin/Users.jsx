import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, downloadFile, toQuery } from '../../lib/api';
import { money, formatDate } from '../../lib/format';
import { useStore } from '../../context/StoreContext';
import { PeriodPicker, periodParams, Pager } from './Fields';
import Icon from '../../components/Icon';
import { confirm, ContactIcons, EmptyState, LoadError, formatPhone } from './ui';

// Tags: the team's own (VIP, Test account, Wholesale) plus Repeat buyer and
// VIP worked out from the orders.
const TAGS = [['vip', 'VIP'], ['test', 'Test account'], ['wholesale', 'Wholesale']];
const VIP_VALUE = { INR: 15000, AED: 700 };
function tagsOf(u) {
  const out = [];
  const life = u.lifetime || {};
  const big = Object.entries(VIP_VALUE).some(([c, n]) => (life.value?.[c] || 0) >= n) || life.orders >= 5;
  if ((u.tags || []).includes('vip') || big) out.push(['VIP', 'gold']);
  else if (life.orders >= 2) out.push(['Repeat buyer', 'ok']);
  if ((u.tags || []).includes('wholesale')) out.push(['Wholesale', '']);
  if ((u.tags || []).includes('test')) out.push(['Test account', 'bad']);
  return out;
}
const Tags = ({ u }) => tagsOf(u).map(([l, t]) => <span key={l} className={`a-pill a-tag ${t}`}>{l}</span>);

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
const KEYS = ['q', 'role', 'activity', 'tag', 'sort', 'period', 'from', 'to', 'limit'];

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
    return { q: f.q, role: f.role, activity: f.activity, tag: f.tag, sort, dir, ...periodParams(f) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  const incomplete = f.period === 'custom' && !f.from && !f.to;
  const periodOn = f.period && f.period !== 'all';
  const limit = [25, 50, 100].includes(Number(f.limit)) ? Number(f.limit) : 25;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (incomplete) return;
    setError('');
    api(`/users${toQuery({ ...query, page, limit })}`)
      .then(setData)
      .catch((e) => {
        setError(e.message);
        setData({ items: [], total: 0, page: 1, pages: 1 });
      });
  }, [query, page, limit, incomplete, tick]);
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
        <select value={f.tag} onChange={(e) => update({ tag: e.target.value })} aria-label="Tag">
          <option value="">All accounts</option>
          <option value="real">Hide test accounts</option>
          {TAGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
        {error && <LoadError message={error} onRetry={() => setTick((n) => n + 1)} />}
        {!data ? <p className="a-muted">Loading…</p> : data.items.length === 0 ? (
          !error && <EmptyState icon="user" title="No users match these filters" action="Clear filters" onAction={() => { setSearch(''); setParams({}); }}>Accounts appear here when customers sign up on the website or in the app.</EmptyState>
        ) : (
          <>
            <div className="a-table-wrap a-sticky-head">
              <table className="a-table">
                <thead>
                  <tr><th>User</th><th>Phone</th><th>Role</th><th>Registered</th>{periodOn && <th>Period orders</th>}<th>Lifetime orders</th><th>Lifetime value</th><th>Last order</th><th /></tr>
                </thead>
                <tbody>
                  {data.items.map((u) => (
                    <tr key={u.id}>
                      <td><Link to={`/admin/users/${u.id}`} className="a-row-link">{u.name}</Link><small>{u.email}</small><span className="a-tags"><Tags u={u} /></span></td>
                      <td>{u.phone ? <><span dir="ltr">{formatPhone(u.phone, u.address?.country)}</span> <ContactIcons phone={u.phone} country={u.address?.country} text={`Hello ${u.name.split(' ')[0]}, this is AL BARAKAH LIFESTYLE.`} /></> : <span className="a-muted">—</span>}{u.address?.city && <><br /><small>{u.address.city}, {u.address.country}</small></>}</td>
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
            <Pager page={data.page} pages={data.pages} total={data.total} limit={limit} noun={data.total === 1 ? 'user' : 'users'} onPage={(p) => setParams({ ...Object.fromEntries(params), page: String(p) })} onLimit={(n) => setParams({ ...Object.fromEntries(params), limit: String(n), page: '1' })} />
          </>
        )}
      </section>
    </div>
  );
}

export function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useStore();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function setTags(tags) {
    setBusy(true);
    try {
      const r = await api(`/users/${id}/tags`, { method: 'PATCH', body: { tags } });
      setD((x) => ({ ...x, user: { ...x.user, tags: r.tags } }));
      toast('Tags saved');
    } catch (e) {
      toast(e.message, 'warn');
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    const u = d.user;
    if (!(await confirm({ title: `Delete ${u.name}'s account?`, message: `${u.email} will be removed for good, with its saved addresses. It has no orders. They can sign up again later.`, confirmLabel: 'Delete account', cancelLabel: 'Keep it', danger: true }))) return;
    try {
      await api(`/users/${id}`, { method: 'DELETE' });
      toast(`${u.email} deleted`);
      navigate('/admin/users');
    } catch (e) {
      toast(e.message, 'warn');
    }
  }
  useEffect(() => {
    api(`/users/${id}`).then(setD).catch((e) => setError(e.message));
  }, [id]);
  if (error) return <div><header className="a-head"><h1>User</h1><Link to="/admin/users" className="a-btn"><Icon name="arrow-left" size={16} /> Users</Link></header><LoadError message={error} /></div>;
  if (!d) return <p className="a-muted">Loading…</p>;
  const { user: u, orders } = d;
  const a = u.address;
  return (
    <div>
      <header className="a-head">
        <h1>{u.name} <span className="a-tags"><Tags u={u} /></span></h1>
        <div className="a-actions">
          {u.phone && <ContactIcons phone={u.phone} country={a?.country} text={`Hello ${u.name.split(' ')[0]}, this is AL BARAKAH LIFESTYLE.`} />}
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
          {orders.length === 0 ? <EmptyState icon="bag" title="No orders yet">This account has never ordered. If it was only a test, you can delete it below.</EmptyState> : (
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
            <dt>Phone</dt><dd>{u.phone ? <span dir="ltr">{formatPhone(u.phone, a?.country)}</span> : '—'}</dd>
            <dt>Role</dt><dd>{u.role}</dd>
            <dt>Status</dt><dd>{u.status}</dd>
            <dt>Registered</dt><dd>{formatDate(u.createdAt)}</dd>
            <dt>Address</dt>
            <dd>{a ? <>{a.line1}{a.line2 && `, ${a.line2}`}<br />{a.city} {a.state} {a.postalCode}<br />{a.country}</> : '—'}</dd>
          </dl>
          <p className="a-muted a-hint">Phone is the account's mobile number (or the latest order's, for older accounts); address comes from the most recent order.</p>
          <h2 style={{ marginTop: 18 }}>Tags</h2>
          <div className="a-tag-pick">
            {TAGS.map(([v, l]) => {
              const on = (u.tags || []).includes(v);
              return <label key={v} className={`a-check${on ? ' is-on' : ''}`}><input type="checkbox" checked={on} disabled={busy} onChange={() => setTags(on ? u.tags.filter((t) => t !== v) : [...(u.tags || []), v])} /> {l}</label>;
            })}
          </div>
          <p className="a-muted a-hint">Repeat buyer (2+ orders) and VIP (5+ orders, or ₹15,000 / AED 700 spent) are added automatically. Tag test sign-ups as Test account to hide them with the “Hide test accounts” filter.</p>
          {u.role === 'customer' && !orders.length && (
            <div className="a-actions" style={{ marginTop: 14 }}><button type="button" className="a-btn a-danger" onClick={remove}><Icon name="trash" size={16} /> Delete account</button></div>
          )}
        </section>
      </div>
    </div>
  );
}
