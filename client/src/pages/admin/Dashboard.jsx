import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { money, formatDate } from '../../lib/format';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    api('/orders/stats').then(setStats).catch(() => {});
    api('/orders').then((o) => setRecent(o.slice(0, 6))).catch(() => {});
    api('/products?all=1').then(setProducts).catch(() => {});
  }, []);

  const count = (s) => stats?.byStatus?.find((x) => x._id === s)?.n || 0;
  const open = stats ? stats.count - count('Delivered') - count('Cancelled') : 0;
  const lowStock = products.filter((p) => p.stock <= 5);

  return (
    <div>
      <header className="a-head"><h1>Dashboard</h1></header>
      <div className="a-tiles">
        <div className="a-tile"><span>Orders</span><b>{stats?.count ?? '—'}</b></div>
        <div className="a-tile"><span>Open orders</span><b>{stats ? open : '—'}</b></div>
        {(stats?.revenue || []).map((r) => (
          <div className="a-tile" key={r._id}><span>Order value · {r._id}</span><b>{money(r.total, r._id)}</b></div>
        ))}
        {count('Cancelled') > 0 && <Link to="/admin/orders?status=Cancelled" className="a-tile"><span>Cancelled</span><b>{count('Cancelled')}</b></Link>}
        <div className={`a-tile ${lowStock.length ? 'warn' : ''}`}><span>Low stock</span><b>{lowStock.length}</b></div>
      </div>

      {stats && (
        <section className="a-panel">
          <h2>Pipeline</h2>
          <div className="a-pipeline">
            {stats.stages.map((s) => (
              <Link to={`/admin/orders?status=${encodeURIComponent(s)}`} key={s}><b>{count(s)}</b><span>{s}</span></Link>
            ))}
          </div>
        </section>
      )}

      <div className="a-two">
        <section className="a-panel">
          <h2>Recent orders</h2>
          {recent.length === 0 ? <p className="a-muted">No orders yet.</p> : (
            <table className="a-table">
              <tbody>
                {recent.map((o) => (
                  <tr key={o._id}>
                    <td><b>{o.orderNumber}</b><br /><small>{formatDate(o.createdAt)}</small></td>
                    <td>{o.customer.name}<br /><small>{o.customer.address.city}</small></td>
                    <td>{money(o.total, o.currency)}</td>
                    <td><span className="a-pill">{o.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Link to="/admin/orders" className="a-link">All orders →</Link>
        </section>
        <section className="a-panel">
          <h2>Stock</h2>
          <table className="a-table">
            <tbody>
              {products.map((p) => (
                <tr key={p._id}>
                  <td><b>{p.name}</b></td>
                  <td className={p.stock <= 5 ? 'a-warn' : ''}>{p.stock} in stock</td>
                  <td>{p.published ? 'Live' : 'Hidden'}</td>
                  <td><Link to={`/admin/products/${p._id}`} className="a-link">Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
