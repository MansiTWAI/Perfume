import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, downloadFile, toQuery } from '../../lib/api';
import { money, formatDate } from '../../lib/format';
import { useStore } from '../../context/StoreContext';
import { PeriodPicker, periodParams, Pager, Modal } from './Fields';
import { ImportModal } from './OrderExcel';
import { OrderRow, STAGES } from './OrderDetail';

const PAYMENT_LABEL = { cod: 'Cash on delivery', 'pay-on-confirmation': 'Pay on confirmation' };

// The house places an order for a customer (phone / WhatsApp orders). The
// server applies the same prices, delivery charges and stock rules as checkout.
function AddOrderModal({ products, onClose, onCreated }) {
  const { regions, toast } = useStore();
  const markets = regions.filter((r) => r.ships);
  const [region, setRegion] = useState(markets[0]?.code || 'IN');
  const market = markets.find((r) => r.code === region) || markets[0];
  const [c, setC] = useState({ name: '', email: '', phone: '', line1: '', line2: '', city: '', state: '', postalCode: '' });
  const live = products.filter((p) => p.published);
  const [items, setItems] = useState([{ slug: live[0]?.slug || '', qty: 1 }]);
  const [paymentMethod, setPaymentMethod] = useState(market?.payments?.[0]);
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setPaymentMethod(market?.payments?.[0]), [market]);

  const set = (k) => (e) => setC({ ...c, [k]: e.target.value });
  const subtotal = items.reduce((s, it) => s + (live.find((p) => p.slug === it.slug)?.price?.[market?.currency] || 0) * (Number(it.qty) || 0), 0);
  const shipping = market?.shipping ? (subtotal >= market.shipping.freeOver ? 0 : market.shipping.flat) : 0;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const o = await api('/orders/admin', {
        method: 'POST',
        body: {
          region, paymentMethod, paymentStatus, notes,
          items: items.filter((i) => i.slug),
          customer: { name: c.name, email: c.email, phone: c.phone, address: { line1: c.line1, line2: c.line2, city: c.city, state: c.state, postalCode: c.postalCode } },
        },
      });
      toast(`${o.orderNumber} created`);
      onCreated(o);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add order" onClose={busy ? undefined : onClose} wide>
      <form className="a-form" onSubmit={submit}>
        <div className="a-grid2">
          <label>Market
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              {markets.map((r) => <option key={r.code} value={r.code}>{r.name} ({r.currency})</option>)}
            </select>
          </label>
          <label>Payment method
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {(market?.payments || []).map((p) => <option key={p} value={p}>{PAYMENT_LABEL[p] || p}</option>)}
            </select>
          </label>
        </div>
        <h3>Items</h3>
        <div className="a-rows">
          {items.map((it, i) => (
            <div className="a-row" key={i}>
              <label className="grow">Fragrance
                <select value={it.slug} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, slug: e.target.value } : x)))}>
                  {live.map((p) => <option key={p.slug} value={p.slug} disabled={p.stock < 1}>{p.name} · {money(p.price?.[market?.currency], market?.currency)} · {p.stock} in stock</option>)}
                </select>
              </label>
              <label>Qty<input type="number" min="1" max="10" value={it.qty} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} /></label>
              <div className="a-row-ctl"><button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} disabled={items.length === 1} aria-label="Remove">✕</button></div>
            </div>
          ))}
          <button type="button" className="a-btn" onClick={() => setItems([...items, { slug: live[0]?.slug || '', qty: 1 }])}>+ Add item</button>
        </div>
        <h3>Customer</h3>
        <div className="a-grid2">
          <label>Name<input required value={c.name} onChange={set('name')} /></label>
          <label>Email<input required type="email" value={c.email} onChange={set('email')} /></label>
          <label>Phone (WhatsApp)<input required type="tel" value={c.phone} onChange={set('phone')} /></label>
          <label>Postal code<input required value={c.postalCode} onChange={set('postalCode')} /></label>
        </div>
        <label>Address line 1<input required value={c.line1} onChange={set('line1')} /></label>
        <label>Address line 2<input value={c.line2} onChange={set('line2')} /></label>
        <div className="a-grid2">
          <label>City<input required value={c.city} onChange={set('city')} /></label>
          <label>{region === 'IN' ? 'State' : 'Emirate'}<input value={c.state} onChange={set('state')} /></label>
        </div>
        <div className="a-grid2">
          <label>Payment status
            <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
              <option value="pending">Pending</option><option value="paid">Paid</option>
            </select>
          </label>
          <label>Internal notes<input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></label>
        </div>
        <p className="a-muted">Estimated total {money(subtotal + shipping, market?.currency)} (delivery {money(shipping, market?.currency)}). Prices and stock are confirmed by the server. If the email belongs to an account, the order appears under that customer's orders.</p>
        {error && <p className="a-error" role="alert">{error}</p>}
        <footer className="a-modal-foot">
          <button type="button" className="a-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="a-btn a-primary" disabled={busy || !live.length}>{busy ? 'Creating…' : 'Create order'}</button>
        </footer>
      </form>
    </Modal>
  );
}

const FILTER_KEYS = ['q', 'status', 'paymentStatus', 'currency', 'product', 'customer', 'period', 'from', 'to'];

export default function Orders() {
  const { toast } = useStore();
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']));
  const page = Math.max(parseInt(params.get('page'), 10) || 1, 1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [products, setProducts] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [search, setSearch] = useState(filters.q);
  const [modal, setModal] = useState(null); // 'add' | 'import'
  const [exporting, setExporting] = useState(false);
  const [reload, setReload] = useState(0);

  // Everything the list shows is also what Export Excel downloads.
  const query = useMemo(() => {
    const { period, from, to, ...rest } = filters;
    return { ...rest, ...periodParams({ period, from, to }) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  const customRangeIncomplete = filters.period === 'custom' && !filters.from && !filters.to;

  useEffect(() => {
    api('/products?all=1').then(setProducts).catch(() => {});
  }, []);
  useEffect(() => {
    if (!filters.customer) return setCustomerName('');
    api(`/users/${filters.customer}`).then((d) => setCustomerName(d.user.name)).catch(() => setCustomerName('this customer'));
  }, [filters.customer]);
  useEffect(() => {
    if (customRangeIncomplete) return;
    setError('');
    api(`/orders${toQuery({ ...query, paged: 1, page, limit: 50 })}`)
      .then(setData)
      .catch((e) => {
        setError(e.message);
        setData({ items: [], total: 0, page: 1, pages: 1 });
      });
  }, [query, page, reload, customRangeIncomplete]);
  // Search as you type, without a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => search !== filters.q && update({ q: search }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function update(patch) {
    // Build on the latest URL, not this render's copy, so quick successive
    // changes all stick. Any filter change goes back to page 1.
    setParams((prev) => {
      const next = { ...Object.fromEntries(FILTER_KEYS.map((k) => [k, prev.get(k) || ''])), ...patch };
      return Object.fromEntries(Object.entries(next).filter(([, v]) => v));
    });
  }
  const active = FILTER_KEYS.some((k) => filters[k]);

  async function exportExcel() {
    setExporting(true);
    try {
      const name = await downloadFile(`/orders/export${toQuery(query)}`, 'orders.xlsx');
      toast(`Downloaded ${name}`);
    } catch (e) {
      toast(e.message, 'warn');
    } finally {
      setExporting(false);
    }
  }

  const orders = data?.items;
  return (
    <div>
      <header className="a-head">
        <h1>Orders</h1>
        <div className="a-actions">
          <button className="a-btn a-primary" onClick={() => setModal('add')}>+ Add Order</button>
          <button className="a-btn" onClick={exportExcel} disabled={exporting || customRangeIncomplete}>{exporting ? 'Preparing…' : 'Export Excel'}</button>
          <button
            className="a-btn"
            disabled={customRangeIncomplete}
            title={data?.total ? `Pre-filled with the ${data.total.toLocaleString()} order${data.total === 1 ? '' : 's'} shown; fill in only what changes` : 'Blank template'}
            onClick={() =>
              downloadFile(`/orders/template${toQuery({ ...query, prefill: data?.total ? 1 : '' })}`, 'orders_update_template.xlsx')
                .then((name) => toast(`Downloaded ${name}${data?.total ? ` with ${data.total.toLocaleString()} order${data.total === 1 ? '' : 's'}` : ''}`))
                .catch((e) => toast(e.message, 'warn'))
            }
          >
            Download Template
          </button>
          <button className="a-btn" onClick={() => setModal('import')}>Upload Excel</button>
          <Link to="/admin/orders/imports" className="a-btn">Import History</Link>
        </div>
      </header>

      <section className="a-filters">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order ID, tracking ID, name, email, phone, city" aria-label="Search orders" />
        <select value={filters.status} onChange={(e) => update({ status: e.target.value })} aria-label="Filter by status">
          <option value="">All statuses</option>
          {STAGES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={filters.paymentStatus} onChange={(e) => update({ paymentStatus: e.target.value })} aria-label="Filter by payment">
          <option value="">All payments</option>
          <option value="pending">Payment pending</option>
          <option value="paid">Paid</option>
          <option value="partially_refunded">Partly refunded</option>
          <option value="refunded">Refunded</option>
        </select>
        <select value={filters.currency} onChange={(e) => update({ currency: e.target.value })} aria-label="Filter by market">
          <option value="">All markets</option>
          <option value="INR">India (INR)</option>
          <option value="AED">UAE (AED)</option>
        </select>
        <select value={filters.product} onChange={(e) => update({ product: e.target.value })} aria-label="Filter by product">
          <option value="">All products</option>
          {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
        <PeriodPicker value={filters} onChange={(v) => update(v)} />
        {filters.customer && <span className="a-chip">Customer: {customerName || '…'} <button onClick={() => update({ customer: '' })} aria-label="Remove customer filter">✕</button></span>}
        {active && <button className="a-link" onClick={() => { setSearch(''); setParams({}); }}>Clear filters</button>}
      </section>
      {customRangeIncomplete && <p className="a-muted">Choose a start or end date for the custom range.</p>}

      <section className="a-panel">
        {error && <p className="a-error">{error}</p>}
        {orders == null ? <p>Loading…</p> : orders.length === 0 ? <p className="a-muted">{active ? 'No orders match these filters.' : 'No orders here yet.'}</p> : (
          <>
            <div className="a-table-wrap">
              <table className="a-table a-orders">
                <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>
                  {orders.map((o) => <OrderRow key={o._id} order={o} onSaved={(n) => setData((d) => ({ ...d, items: d.items.map((x) => (x._id === n._id ? n : x)) }))} />)}
                </tbody>
              </table>
            </div>
            <Pager page={data.page} pages={data.pages} total={data.total} noun={data.total === 1 ? 'order' : 'orders'} onPage={(p) => setParams({ ...Object.fromEntries(params), page: String(p) })} />
          </>
        )}
      </section>

      {modal === 'add' && <AddOrderModal products={products} onClose={() => setModal(null)} onCreated={() => { setModal(null); setReload((n) => n + 1); api('/products?all=1').then(setProducts).catch(() => {}); }} />}
      {modal === 'import' && <ImportModal onClose={() => setModal(null)} onDone={() => setReload((n) => n + 1)} />}
    </div>
  );
}
