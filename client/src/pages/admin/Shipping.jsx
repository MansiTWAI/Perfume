import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, toQuery } from '../../lib/api';
import { money, formatDate } from '../../lib/format';
import { useStore } from '../../context/StoreContext';
import { ADMIN_STATUS, shipTone } from '../../lib/shipment';
import { Pager } from './Fields';
import { EmptyState, LoadError, formatPhone } from './ui';
import Icon from '../../components/Icon';

// The shipment tabs: what needs doing first, then the journey in order.
const TABS = [
  ['awaiting', 'Awaiting shipment'],
  ['errors', 'Problems'],
  ['awb_assigned', 'AWB assigned'],
  ['picked_up', 'Picked up'],
  ['in_transit', 'In transit'],
  ['out_for_delivery', 'Out for delivery'],
  ['delivered', 'Delivered'],
  ['exception', 'Delayed'],
  ['rto', 'Returning'],
  ['returned', 'Returned'],
  ['', 'All'],
];
const PAY = { pending: 'Pending', paid: 'Paid', partially_refunded: 'Partly refunded', refunded: 'Refunded' };
const when = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

// Delhivery shipments: orders ready to ship, every shipment's status and
// AWB, problems to fix, and create / retry / refresh in one place.
export default function Shipping() {
  const { toast } = useStore();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'awaiting';
  const page = Math.max(parseInt(params.get('page'), 10) || 1, 1);
  const [q, setQ] = useState(params.get('q') || '');
  const [from, setFrom] = useState(params.get('from') || '');
  const [to, setTo] = useState(params.get('to') || '');
  const [setup, setSetup] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api('/admin/shipments/status').then(setSetup).catch(() => setSetup({ configured: false }));
  }, []);
  useEffect(() => {
    setError('');
    api(`/admin/shipments${toQuery({ status, q: params.get('q') || '', from: params.get('from') || '', to: params.get('to') || '', page, limit: 25 })}`)
      .then(setData)
      .catch((e) => { setError(e.message); setData({ items: [], total: 0, page: 1, pages: 1, counts: {} }); });
  }, [params, reload]); // eslint-disable-line react-hooks/exhaustive-deps
  // Search as you type.
  useEffect(() => {
    const id = setTimeout(() => (q !== (params.get('q') || '')) && update({ q }), 350);
    return () => clearTimeout(id);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  function update(patch) {
    setParams((prev) => {
      const next = { status: prev.get('status') ?? 'awaiting', q: prev.get('q') || '', from: prev.get('from') || '', to: prev.get('to') || '', ...patch };
      return Object.fromEntries(Object.entries(next).filter(([k, v]) => v || k === 'status'));
    });
  }

  async function act(order, kind) {
    setBusy(`${order.id}:${kind}`);
    try {
      await api(`/admin/orders/${order.id}/shipment${kind === 'refresh' ? '/refresh' : ''}`, { method: 'POST' });
      toast(kind === 'refresh' ? `${order.orderNumber}: tracking refreshed` : `${order.orderNumber}: shipment created`);
    } catch (e) {
      toast(e.message, 'warn');
    } finally {
      setBusy('');
      setReload((n) => n + 1);
    }
  }

  const counts = data?.counts || {};
  const countOf = (key) => (key === 'awaiting' ? counts.awaiting : key === 'errors' ? (counts.failed || 0) + (counts.exception || 0) : key ? counts[key] : null);

  return (
    <div>
      <header className="a-head">
        <h1>Shipping</h1>
        {setup?.configured && (
          <p className="a-muted a-hint a-ship-setup">
            Delhivery <b className={setup.mode === 'production' ? 'a-ok' : 'a-warn'}>{setup.mode === 'production' ? 'live' : 'test mode'}</b> · automatic shipments {setup.autoCreate ? 'on' : 'off'} · scan push {setup.webhook ? 'on' : 'off'} · <Link to="/admin/connections" className="a-textbtn">Connection</Link>
          </p>
        )}
      </header>
      {setup && !setup.configured && (
        <p className="a-note is-bad"><Icon name="error" size={16} /><span>Delhivery is not connected, so shipments cannot be booked. <Link to="/admin/connections" className="a-textbtn">See what’s missing</Link>.</span></p>
      )}
      {setup?.configured && setup.mode !== 'production' && (
        <p className="a-note"><Icon name="alert" size={16} /><span><b>Test mode.</b> Shipments go to Delhivery's test system: no courier will collect them and their AWBs are not real. When your live Delhivery account is ready, switch the server settings to live (<Link to="/admin/connections" className="a-textbtn">Connections</Link>).</span></p>
      )}

      <div className="a-tabs a-ship-tabs" role="tablist" aria-label="Shipment status">
        {TABS.map(([key, label]) => {
          const n = countOf(key);
          return (
            <button key={key || 'all'} role="tab" aria-selected={status === key} className={`${status === key ? 'is-on' : ''} ${key === 'errors' && n ? 'is-alert' : ''}`} onClick={() => update({ status: key, page: '' })}>
              {label}{n ? <span className="a-count">{n}</span> : null}
            </button>
          );
        })}
      </div>

      <section className="a-filters">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order ID, AWB, customer name, email or phone" aria-label="Search shipments" />
        <label className="a-inline">From<input type="date" value={from} onChange={(e) => { setFrom(e.target.value); update({ from: e.target.value }); }} /></label>
        <label className="a-inline">To<input type="date" value={to} onChange={(e) => { setTo(e.target.value); update({ to: e.target.value }); }} /></label>
      </section>

      <section className="a-panel">
        {error && <LoadError message={error} onRetry={() => setReload((n) => n + 1)} />}
        {!data ? <p className="a-muted">Loading…</p> : data.items.length === 0 ? (
          !error && <EmptyState icon={status === 'errors' ? 'check' : 'truck'} title={status === 'awaiting' ? 'Nothing is waiting to ship' : status === 'errors' ? 'No shipment problems' : 'No shipments here'}>
            {status === 'awaiting' ? 'Paid orders and confirmed cash-on-delivery orders appear here until their Delhivery shipment is booked.' : 'Try another tab or date range.'}
          </EmptyState>
        ) : (
          <div className="a-table-wrap a-sticky-head">
            <table className="a-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Payment</th><th>Shipment</th><th>AWB</th><th>Last update</th><th><span className="sr-only">Action</span></th></tr></thead>
              <tbody>
                {data.items.map((o) => {
                  const s = o.shipment;
                  const st = s?.status || 'pending';
                  const awaiting = !s || ['failed', 'cancelled'].includes(st) || !s.awb;
                  return (
                    <tr key={o.id}>
                      <td><Link to={`/admin/orders?q=${o.orderNumber}`} className="a-link"><b>{o.orderNumber}</b></Link><br /><small>{formatDate(o.createdAt)}</small></td>
                      <td>{o.customer.name}<br /><small dir="ltr">{formatPhone(o.customer.phone) || o.customer.phone}</small><br /><small>{o.customer.city} {o.customer.postalCode}</small></td>
                      <td>{PAY[o.paymentStatus] || o.paymentStatus} · {o.paymentMethod === 'cod' ? 'COD' : o.paymentMethod}<br /><small>{money(o.total, o.currency)}</small></td>
                      <td>
                        <span className={`a-pill a-ship-${shipTone(st)}`}>{ADMIN_STATUS[st] || st}</span>
                        {s?.courierStatus && st !== 'pending' && <small className="a-muted"><br />{s.courierStatus}{s.location ? ` · ${s.location}` : ''}</small>}
                        {s?.error && <small className="a-warn a-ico-line a-ship-err"><Icon name="alert" size={14} /> {s.error}{s.nextAttemptAt ? ` · retrying ${when(s.nextAttemptAt)}` : ''}</small>}
                      </td>
                      <td dir="ltr">{s?.awb || '—'}</td>
                      <td>{when(s?.lastEventAt || s?.lastTrackingUpdate)}{s?.lastCheckedAt && <><br /><small className="a-muted">checked {when(s.lastCheckedAt)}</small></>}</td>
                      <td className="a-cell-action">
                        {awaiting ? (
                          <button className="a-btn a-primary" disabled={!!busy || !!o.blocker} title={o.blocker || undefined} onClick={() => act(o, 'create')}>
                            {busy === `${o.id}:create` ? 'Creating…' : st === 'failed' ? 'Retry' : 'Create shipment'}
                          </button>
                        ) : !['delivered', 'returned', 'cancelled'].includes(st) ? (
                          <button className="a-btn" disabled={!!busy} onClick={() => act(o, 'refresh')}><Icon name="refresh" size={16} /> {busy === `${o.id}:refresh` ? 'Checking…' : 'Refresh'}</button>
                        ) : null}
                        {awaiting && o.blocker && <small className="a-muted a-ship-why">{o.blocker} <Link to={`/admin/orders?q=${o.orderNumber}`} className="a-textbtn">Open order</Link></small>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={data.page} pages={data.pages} total={data.total} noun="orders" onPage={(p) => update({ page: String(p) })} />}
      </section>
    </div>
  );
}
