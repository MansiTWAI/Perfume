import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, toQuery } from '../../lib/api';
import { money, formatDate } from '../../lib/format';
import { PeriodPicker, periodParams } from './Fields';
import { EmptyState, LoadError } from './ui';
import Icon from '../../components/Icon';

// Order value per day for the chart, in one currency, with empty days kept
// so the bars line up with the calendar.
function series(daily, currency) {
  if (!daily) return [];
  const byDay = new Map(daily.days.filter((d) => d.currency === currency).map((d) => [d.day, d]));
  const out = [];
  const from = new Date(daily.from);
  const to = new Date(daily.to);
  // Days in the admin's own calendar (the server sends at most 90).
  for (let d = new Date(from.getFullYear(), from.getMonth(), from.getDate()); d <= to && out.length < 92; d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const x = byDay.get(key);
    out.push({ day: key, total: x?.total || 0, orders: x?.orders || 0 });
  }
  return out;
}

function RevenueChart({ daily, currencies }) {
  const [currency, setCurrency] = useState(currencies[0] || 'INR');
  useEffect(() => { if (currencies.length && !currencies.includes(currency)) setCurrency(currencies[0]); }, [currencies, currency]);
  const data = useMemo(() => series(daily, currency), [daily, currency]);
  const max = Math.max(...data.map((d) => d.total), 0);
  const sum = data.reduce((n, d) => n + d.total, 0);
  const label = (d) => new Date(`${d}T12:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (!data.length) return null;
  return (
    <section className="a-panel">
      <div className="a-section-head">
        <h2>Order value by day</h2>
        <span className="a-actions">
          {currencies.length > 1 && (
            <span className="a-seg" role="group" aria-label="Currency">
              {currencies.map((c) => <button key={c} type="button" aria-pressed={c === currency} onClick={() => setCurrency(c)}>{c}</button>)}
            </span>
          )}
        </span>
      </div>
      {max === 0 ? <p className="a-muted">No orders in {currency} in this period.</p> : (
        <figure className="a-chart" aria-label={`Order value by day in ${currency}, ${money(sum, currency)} in all`}>
          <div className="a-chart-bars" style={{ '--n': data.length }}>
            {data.map((d) => (
              <span key={d.day} className="a-chart-col" title={`${label(d.day)}: ${money(d.total, currency)} · ${d.orders} order${d.orders === 1 ? '' : 's'}`}>
                <i style={{ height: `${Math.max(d.total ? 3 : 0, (d.total / max) * 100)}%` }} />
              </span>
            ))}
          </div>
          <figcaption className="a-chart-axis"><span>{label(data[0].day)}</span><span>Highest day {money(max, currency)}</span><span>{label(data.at(-1).day)}</span></figcaption>
        </figure>
      )}
      <p className="a-muted a-hint">Cancelled orders are not counted. Hover a bar for that day.</p>
    </section>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const range = { period: params.get('period') || '7d', from: params.get('from') || '', to: params.get('to') || '' };
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState(null);
  const [products, setProducts] = useState([]);
  const [tick, setTick] = useState(0);
  const incomplete = range.period === 'custom' && !range.from && !range.to;
  const q = periodParams(range);

  useEffect(() => {
    if (incomplete) return;
    setError('');
    api(`/orders/stats${toQuery(q)}`).then(setStats).catch((e) => setError(e.message));
    api(`/orders${toQuery({ paged: 1, limit: 8, ...q })}`).then((d) => setRecent(d.items)).catch(() => setRecent([]));
  }, [params, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    api('/products?all=1').then(setProducts).catch(() => {});
  }, []);

  const count = (s) => stats?.byStatus?.find((x) => x._id === s)?.n || 0;
  const open = stats ? stats.count - count('Delivered') - count('Cancelled') : 0;
  const out = products.filter((p) => p.stock <= 0);
  const low = products.filter((p) => p.stock > 0 && p.stock <= 5);
  const currencies = (stats?.revenue || []).map((r) => r._id);
  const ordersLink = (extra = {}) => `/admin/orders${toQuery({ ...extra, period: range.period === 'all' ? '' : range.period, from: range.from, to: range.to })}`;
  const cancelledPct = stats?.count ? Math.round((count('Cancelled') / stats.count) * 100) : 0;

  return (
    <div>
      <header className="a-head">
        <h1>Dashboard</h1>
        <div className="a-actions">
          <PeriodPicker value={range} onChange={(v) => setParams(Object.fromEntries(Object.entries(v).filter(([, x]) => x)))} />
          <button type="button" className="a-btn a-quiet" onClick={() => setTick((n) => n + 1)} aria-label="Refresh"><Icon name="refresh" size={16} /></button>
        </div>
      </header>
      {incomplete && <p className="a-muted">Choose a start or end date for the custom range.</p>}
      {error && <LoadError message={error} onRetry={() => setTick((n) => n + 1)} />}

      <div className="a-tiles a-strip">
        <Link to={ordersLink()} className="a-tile"><span>Orders · {stats?.period?.label || '…'}</span><b>{stats?.count ?? '—'}</b></Link>
        <Link to={ordersLink()} className="a-tile"><span>Still open</span><b>{stats ? open : '—'}</b></Link>
        {(stats?.revenue || []).map((r) => (
          <div className="a-tile" key={r._id}><span>Order value · {r._id}</span><b>{money(r.total, r._id)}</b></div>
        ))}
        <Link to={ordersLink({ status: 'Cancelled' })} className={`a-tile ${cancelledPct >= 30 ? 'warn' : ''}`}><span>Cancelled{stats?.count ? ` · ${cancelledPct}%` : ''}</span><b>{stats ? count('Cancelled') : '—'}</b></Link>
        <Link to="/admin/products?stock=out" className={`a-tile ${out.length ? 'warn' : ''}`}><span>Out of stock</span><b>{out.length}</b></Link>
        <Link to="/admin/products?stock=low" className={`a-tile ${low.length ? 'warn' : ''}`}><span>Low stock (1–5)</span><b>{low.length}</b></Link>
      </div>

      {stats && (
        <section className="a-panel">
          <h2>Pipeline</h2>
          <div className="a-pipeline">
            {stats.stages.map((s) => (
              <Link to={ordersLink({ status: s })} key={s}><b>{count(s)}</b><span>{s}</span></Link>
            ))}
          </div>
        </section>
      )}

      {stats && <RevenueChart daily={stats.daily} currencies={currencies.length ? currencies : ['INR']} />}

      <div className="a-two">
        <section className="a-panel">
          <div className="a-section-head"><h2>Recent orders</h2><Link to={ordersLink()} className="a-textbtn">All orders</Link></div>
          {recent == null ? <p className="a-muted">Loading…</p> : recent.length === 0 ? (
            <EmptyState icon="bag" title="No orders in this period">Choose a longer period above, or add a phone or WhatsApp order from Orders.</EmptyState>
          ) : (
            <div className="a-table-wrap"><table className="a-table a-clickable">
              <tbody>
                {recent.map((o) => (
                  <tr key={o._id} tabIndex={0} onClick={() => navigate(`/admin/orders?q=${encodeURIComponent(o.orderNumber)}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/orders?q=${encodeURIComponent(o.orderNumber)}`)} title="Open this order">
                    <td><b>{o.orderNumber}</b><br /><small>{formatDate(o.createdAt)}</small></td>
                    <td>{o.customer.name}<br /><small>{o.customer.address?.city}</small></td>
                    <td>{money(o.total, o.currency)}</td>
                    <td><span className={`a-pill ${o.status === 'Cancelled' ? 'bad' : o.status === 'Delivered' ? 'ok' : ''}`}>{o.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </section>
        <div>
          {stats?.cancelled?.length > 0 && (
            <section className="a-panel">
              <h2>Why orders were cancelled</h2>
              <ul className="a-bars">
                {stats.cancelled.map((c) => (
                  <li key={c.reason || 'none'}>
                    <span>{c.label}</span><b>{c.n}</b>
                    <i style={{ width: `${(c.n / stats.cancelled[0].n) * 100}%` }} aria-hidden="true" />
                  </li>
                ))}
              </ul>
              <p className="a-muted a-hint">From now on a reason is asked for every cancellation, so this list fills in.</p>
            </section>
          )}
          <section className="a-panel">
            <div className="a-section-head"><h2>Stock</h2><Link to="/admin/products" className="a-textbtn">All products</Link></div>
            <div className="a-table-wrap"><table className="a-table">
              <tbody>
                {[...products].sort((a, b) => a.stock - b.stock).map((p) => (
                  <tr key={p._id}>
                    <td><b>{p.name}</b></td>
                    <td>{p.stock <= 0 ? <span className="a-pill bad">Out of stock</span> : <span className={p.stock <= 5 ? 'a-warn' : ''}>{p.stock} in stock</span>}</td>
                    <td>{p.published ? <span className="a-pill ok">Live</span> : <span className="a-pill off">Hidden</span>}</td>
                    <td><Link to={`/admin/products/${p._id}`} className="a-link">Edit</Link></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </section>
        </div>
      </div>
    </div>
  );
}
