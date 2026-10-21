import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, downloadFile, toQuery } from '../../lib/api';
import { money } from '../../lib/format';
import { useStore } from '../../context/StoreContext';
import { PeriodPicker, periodParams, Pager, Modal } from './Fields';
import { ImportModal } from './OrderExcel';
import { OrderRow, STAGES, CANCEL_REASONS } from './OrderDetail';
import { confirm, EmptyState, LoadError } from './ui';
import Icon from '../../components/Icon';
import { INDIAN_STATES, foreignPlace } from '../../../../shared/india.js';

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
    const abroad = region === 'IN' && foreignPlace(c.city, c.state);
    if (abroad) return setError(`This address is in ${abroad}. India orders ship with Delhivery within India only: choose another market, or correct the address.`);
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
              <div className="a-row-ctl"><button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} disabled={items.length === 1} aria-label="Remove"><Icon name="close" size={16} /></button></div>
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
          {region === 'IN' ? (
            <label>State
              <select required value={c.state} onChange={set('state')}>
                <option value="">Choose…</option>
                {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          ) : <label>Emirate<input value={c.state} onChange={set('state')} /></label>}
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
  const limit = [25, 50, 100].includes(Number(params.get('limit'))) ? Number(params.get('limit')) : 25;
  const [data, setData] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState('');
  const [products, setProducts] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [search, setSearch] = useState(filters.q);
  const [modal, setModal] = useState(null); // 'add' | 'import'
  const [exporting, setExporting] = useState(false);
  const [reload, setReload] = useState(0);
  const extraSet = ['paymentStatus', 'currency', 'product'].filter((k) => filters[k]).length;
  const [moreOpen, setMoreOpen] = useState(extraSet > 0);
  const excelMenu = useRef(null);
  const closeExcel = () => excelMenu.current?.removeAttribute('open');
  useEffect(() => {
    const away = (e) => !excelMenu.current?.contains(e.target) && closeExcel();
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, []);

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
    api(`/orders${toQuery({ ...query, paged: 1, page, limit })}`)
      .then((d) => { setData(d); setPicked(new Set()); })
      .catch((e) => {
        setError(e.message);
        setData({ items: [], total: 0, page: 1, pages: 1 });
      });
  }, [query, page, limit, reload, customRangeIncomplete]);
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
      const next = { ...Object.fromEntries(FILTER_KEYS.map((k) => [k, prev.get(k) || ''])), limit: prev.get('limit') || '', ...patch };
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

  // Bulk: the same status for every selected order (each still follows the
  // usual rules: stock, emails, Delhivery).
  async function bulk(status) {
    const ids = [...picked];
    const n = `${ids.length} order${ids.length === 1 ? '' : 's'}`;
    let extra = {};
    if (status === 'Cancelled') {
      const a = await confirm({
        title: `Cancel ${n}?`,
        message: 'Items go back to stock, coupons are given back and each customer is emailed. Booked Delhivery shipments are cancelled too.',
        choices: CANCEL_REASONS.filter(([k]) => k !== 'payment_not_completed'),
        choiceLabel: 'Why are they cancelled?',
        withNote: true,
        noteLabel: 'Message for the customers (optional)',
        confirmLabel: 'Cancel orders',
        cancelLabel: 'Keep them',
        danger: true,
      });
      if (!a) return;
      extra = { cancelReason: a.choice, note: a.note };
    } else if (!(await confirm({ title: `Mark ${n} as ${status}?`, message: 'Each customer is emailed about the change.', confirmLabel: `Mark ${status}` }))) {
      return;
    }
    setBulkBusy(true);
    try {
      const r = await api('/orders/bulk', { method: 'POST', body: { ids, status, ...extra }, timeout: 120000 });
      const why = r.results.find((x) => !x.ok)?.message;
      toast(r.failed ? `${r.updated} updated, ${r.failed} not changed. ${why || ''}` : `${r.updated} order${r.updated === 1 ? '' : 's'} updated`, r.failed ? 'warn' : undefined);
      setReload((x) => x + 1);
    } catch (e) {
      toast(e.message, 'warn');
    } finally {
      setBulkBusy(false);
    }
  }
  const togglePick = (id, on) => setPicked((prev) => {
    const next = new Set(prev);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  });

  const orders = data?.items;
  const allPicked = orders?.length > 0 && orders.every((o) => picked.has(o._id));
  return (
    <div>
      <header className="a-head">
        <h1>Orders</h1>
        <div className="a-actions">
          {/* Every Excel action in one place: export, template, upload, history. */}
          <details className="a-menu" ref={excelMenu}>
            <summary className="a-btn">{exporting ? 'Preparing…' : 'Excel'} <Icon name="chevron-down" size={16} /></summary>
            <div className="a-menu-list" role="menu">
          <button role="menuitem" className="a-menu-item" onClick={() => { closeExcel(); exportExcel(); }} disabled={exporting || customRangeIncomplete}>Export orders</button>
          <button
            role="menuitem"
            className="a-menu-item"
            disabled={customRangeIncomplete}
            title={data?.total ? `Pre-filled with the ${data.total.toLocaleString()} order${data.total === 1 ? '' : 's'} shown; fill in only what changes` : 'Blank template'}
            onClick={() =>
              closeExcel() ||
              downloadFile(`/orders/template${toQuery({ ...query, prefill: data?.total ? 1 : '' })}`, 'orders_update_template.xlsx')
                .then((name) => toast(`Downloaded ${name}${data?.total ? ` with ${data.total.toLocaleString()} order${data.total === 1 ? '' : 's'}` : ''}`))
                .catch((e) => toast(e.message, 'warn'))
            }
          >
            Download update template
          </button>
          <button role="menuitem" className="a-menu-item" onClick={() => { closeExcel(); setModal('import'); }}>Upload changes</button>
          <Link role="menuitem" to="/admin/orders/imports" className="a-menu-item">Import history</Link>
            </div>
          </details>
          <button className="a-btn a-primary" onClick={() => setModal('add')}><Icon name="plus" size={16} /> Add order</button>
        </div>
      </header>

      <section className="a-filters">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order ID, tracking ID, name, email, phone, city" aria-label="Search orders" />
        <select value={filters.status} onChange={(e) => update({ status: e.target.value })} aria-label="Filter by status">
          <option value="">All statuses</option>
          {STAGES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <PeriodPicker value={filters} onChange={(v) => update(v)} />
        <button type="button" className="a-btn" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
          More filters{extraSet ? ` · ${extraSet}` : ''} <Icon name="chevron-down" size={16} className={moreOpen ? 'a-rot' : ''} />
        </button>
        {moreOpen && <>
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
        </>}
        {filters.customer && <span className="a-chip">Customer: {customerName || '…'} <button onClick={() => update({ customer: '' })} aria-label="Remove customer filter"><Icon name="close" size={14} /></button></span>}
        {active && <button className="a-link" onClick={() => { setSearch(''); setParams({}); }}>Clear filters</button>}
      </section>
      {customRangeIncomplete && <p className="a-muted">Choose a start or end date for the custom range.</p>}

      <section className="a-panel">
        {error && <LoadError message={error} onRetry={() => setReload((n) => n + 1)} />}
        {orders == null ? <p className="a-muted">Loading…</p> : orders.length === 0 ? (
          !error && (active
            ? <EmptyState icon="search" title="No orders match these filters" action="Clear filters" onAction={() => { setSearch(''); setParams({}); }}>Try another period or status.</EmptyState>
            : <EmptyState icon="bag" title="No orders yet" action="Add an order" onAction={() => setModal('add')}>Orders from the website appear here as they come in. Phone and WhatsApp orders can be added by hand.</EmptyState>)
        ) : (
          <>
            {picked.size > 0 && (
              <div className="a-bulk" role="region" aria-label="Selected orders">
                <b>{picked.size} selected</b>
                <span className="a-actions">
                  {['Confirmed', 'Packed', 'Delivered'].map((st) => <button key={st} type="button" className="a-btn" disabled={bulkBusy} onClick={() => bulk(st)}>Mark {st}</button>)}
                  <button type="button" className="a-btn a-danger" disabled={bulkBusy} onClick={() => bulk('Cancelled')}>Cancel…</button>
                  <button type="button" className="a-btn a-quiet" onClick={() => setPicked(new Set())}>Clear</button>
                </span>
              </div>
            )}
            <div className="a-table-wrap a-sticky-head">
              <table className="a-table a-orders">
                <thead><tr>
                  <th className="a-sel"><input type="checkbox" checked={allPicked} onChange={(e) => setPicked(e.target.checked ? new Set(orders.map((o) => o._id)) : new Set())} aria-label="Select all orders on this page" /></th>
                  <th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th>
                </tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <OrderRow
                      key={o._id}
                      order={o}
                      selected={picked.has(o._id)}
                      onSelect={(on) => togglePick(o._id, on)}
                      defaultOpen={orders.length === 1 && !!filters.q && filters.q.toUpperCase() === o.orderNumber}
                      onSaved={(n) => setData((d) => ({ ...d, items: d.items.map((x) => (x._id === n._id ? n : x)) }))}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              page={data.page} pages={data.pages} total={data.total} limit={limit} noun={data.total === 1 ? 'order' : 'orders'}
              onPage={(p) => setParams({ ...Object.fromEntries(params), page: String(p) })}
              onLimit={(n) => setParams({ ...Object.fromEntries(params), limit: String(n), page: '1' })}
            />
          </>
        )}
      </section>

      {modal === 'add' && <AddOrderModal products={products} onClose={() => setModal(null)} onCreated={() => { setModal(null); setReload((n) => n + 1); api('/products?all=1').then(setProducts).catch(() => {}); }} />}
      {modal === 'import' && <ImportModal onClose={() => setModal(null)} onDone={() => setReload((n) => n + 1)} />}
    </div>
  );
}
