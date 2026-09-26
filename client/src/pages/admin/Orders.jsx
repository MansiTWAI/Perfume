import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { money, formatDate } from '../../lib/format';
import { useStore } from '../../context/StoreContext';

const STAGES = ['Order Placed', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'];

function OrderRow({ order, onSaved }) {
  const { toast } = useStore();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ status: order.status, carrier: order.carrier || '', carrierUrl: order.carrierUrl || '', eta: order.eta || '', paymentStatus: order.paymentStatus, note: '' });
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const o = await api(`/orders/${order._id}`, { method: 'PATCH', body: f });
      onSaved(o);
      toast(`${order.orderNumber} updated`);
      setF((x) => ({ ...x, note: '' }));
    } catch (e) {
      toast(e.message, 'warn');
    } finally {
      setBusy(false);
    }
  }
  const c = order.customer;
  return (
    <>
      <tr className={open ? 'is-open' : ''} onClick={() => setOpen(!open)}>
        <td><b>{order.orderNumber}</b><br /><small>{formatDate(order.createdAt)}</small></td>
        <td>{c.name}<br /><small>{c.address.city}, {c.address.country}</small></td>
        <td>{order.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}{order.giftNote?.enabled && <><br /><small className="a-gold">✦ Signature Card</small></>}</td>
        <td>{money(order.total, order.currency)}<br /><small>{order.paymentMethod} · {order.paymentStatus}</small></td>
        <td><span className="a-pill">{order.status}</span></td>
      </tr>
      {open && (
        <tr className="a-detail">
          <td colSpan={5}>
            <div className="a-detail-grid">
              <div>
                <h3>Customer</h3>
                <p>{c.name}<br />{c.email}<br />{c.phone}</p>
                <p>{c.address.line1}{c.address.line2 && <>, {c.address.line2}</>}<br />{c.address.city} {c.address.state} {c.address.postalCode}<br />{c.address.country}</p>
                <p className="a-muted">Tracking ID: <b>{order.trackingId}</b></p>
                {order.giftNote?.enabled && (
                  <div className="a-gift">
                    <h3>Signature Card</h3>
                    <p><b>{order.giftNote.name}</b> · {order.giftNote.occasion}<br />“{order.giftNote.message}”</p>
                  </div>
                )}
              </div>
              <div className="a-form">
                <label>Status
                  <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                    {STAGES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <label>Note for this update<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Optional" /></label>
                <label>Courier<input value={f.carrier} onChange={(e) => setF({ ...f, carrier: e.target.value })} /></label>
                <label>Courier tracking URL<input value={f.carrierUrl} onChange={(e) => setF({ ...f, carrierUrl: e.target.value })} /></label>
                <label>Expected delivery<input value={f.eta} onChange={(e) => setF({ ...f, eta: e.target.value })} placeholder="e.g. 3 October" /></label>
                <label>Payment
                  <select value={f.paymentStatus} onChange={(e) => setF({ ...f, paymentStatus: e.target.value })}>
                    <option value="pending">Pending</option><option value="paid">Paid</option><option value="refunded">Refunded</option>
                  </select>
                </label>
                <button className="a-btn a-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save update'}</button>
              </div>
              <div>
                <h3>History</h3>
                <ol className="a-history">
                  {order.history.map((h, i) => <li key={i}><b>{h.status}</b> · {new Date(h.at).toLocaleString('en-GB')}{h.note && <><br /><small>{h.note}</small></>}</li>)}
                </ol>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [orders, setOrders] = useState(null);
  useEffect(() => {
    api(`/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`).then(setOrders).catch(() => setOrders([]));
  }, [status]);
  return (
    <div>
      <header className="a-head">
        <h1>Orders</h1>
        <select value={status} onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})} aria-label="Filter by status">
          <option value="">All statuses</option>
          {STAGES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </header>
      <section className="a-panel">
        {orders == null ? <p>Loading…</p> : orders.length === 0 ? <p className="a-muted">No orders here yet.</p> : (
          <div className="a-table-wrap">
            <table className="a-table a-orders">
              <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {orders.map((o) => <OrderRow key={o._id} order={o} onSaved={(n) => setOrders((os) => os.map((x) => (x._id === n._id ? n : x)))} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
