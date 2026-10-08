import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AccountLayout from '../components/AccountLayout';
import OrderTimeline from '../components/OrderTimeline';
import ShipmentTracking from '../components/ShipmentTracking';
import SignatureCard, { OCCASIONS } from '../components/SignatureCard';
import { useStore } from '../context/StoreContext';
import { useLive } from '../hooks/useLive';
import { api } from '../lib/api';
import { formatDate, money, whatsappLink } from '../lib/format';
import { payOnline } from '../lib/payments';
import { AuthForm } from './Account';
import { PAYMENT_METHOD, PAYMENT_STATUS, statusTone } from './MyOrders';
import Icon from '../components/Icon';

function Row({ label, children, strong }) {
  return (
    <div className={`od-row ${strong ? 'is-strong' : ''}`}>
      <span>{label}</span>
      <span>{children}</span>
    </div>
  );
}

const occasionLabel = (id) => OCCASIONS.find((o) => o.id === id)?.label || id;

// Cancel confirmation, with an optional reason for the house.
function CancelDialog({ order, onClose, onDone }) {
  const { t } = useStore();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const first = useRef(null);
  useEffect(() => {
    first.current?.focus();
    const key = (e) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [busy, onClose]);
  async function confirm() {
    setBusy(true);
    setError('');
    try {
      onDone(await api(`/orders/mine/${order.orderNumber}/cancel`, { method: 'POST', body: { reason } }));
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  const reasons = ['I ordered by mistake', 'I want a different fragrance', 'The delivery date does not suit me', 'I found a better price'];
  return (
    <div className="sheet-back" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
        <h2 id="cancel-title">{t('Cancel order {n}?', { n: order.orderNumber })}</h2>
        <p>{t('Your items go back on sale straight away.')}{order.paymentStatus === 'paid' && ` ${t('As you have already paid, we will arrange your refund.')}`}</p>
        <div className="form">
          <span className="label">{t('Reason (optional)')}</span>
          <div className="chips">
            {reasons.map((r) => (
              <button key={r} type="button" className="chip" aria-pressed={reason === t(r)} onClick={() => setReason(reason === t(r) ? '' : t(r))}>{t(r)}</button>
            ))}
          </div>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="sheet-actions">
          <button ref={first} className="btn btn-ghost" onClick={onClose} disabled={busy}>{t('Keep my order')}</button>
          <button className="btn btn-danger" onClick={confirm} disabled={busy}>{t(busy ? 'Cancelling…' : 'Cancel order')}</button>
        </div>
      </div>
    </div>
  );
}

// Change delivery details, the Signature Card and (early on) quantities.
function EditOrder({ order, onCancel, onSaved }) {
  const { t, lang } = useStore();
  const c = order.customer;
  const a = c.address || {};
  const [f, setF] = useState({ name: c.name || '', phone: c.phone || '', line1: a.line1 || '', line2: a.line2 || '', city: a.city || '', state: a.state || '', postalCode: a.postalCode || '' });
  const [qty, setQty] = useState(() => Object.fromEntries(order.items.map((i) => [i.slug, i.qty])));
  const [gift, setGift] = useState(order.giftNote?.enabled ? { ...order.giftNote } : { enabled: false, name: '', occasion: 'eid', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const india = a.country === 'India';

  const subtotal = order.items.reduce((n, i) => n + i.unitPrice * (qty[i.slug] ?? i.qty), 0);
  const count = Object.values(qty).reduce((n, q) => n + q, 0);
  const changedItems = order.items.some((i) => qty[i.slug] !== i.qty);
  const step = (slug, d) => setQty((q) => ({ ...q, [slug]: Math.min(10, Math.max(0, (q[slug] ?? 0) + d)) }));

  async function save(e) {
    e.preventDefault();
    if (count < 1) return setError(t('An order needs at least one fragrance. To stop the order, cancel it instead.'));
    setBusy(true);
    setError('');
    try {
      const body = {
        customer: { name: f.name, phone: f.phone, address: { line1: f.line1, line2: f.line2, city: f.city, state: f.state, postalCode: f.postalCode } },
        giftNote: gift.enabled ? { enabled: true, name: gift.name, occasion: gift.occasion, message: gift.message } : { enabled: false },
      };
      if (order.editable.items && changedItems) body.items = order.items.map((i) => ({ slug: i.slug, qty: qty[i.slug] }));
      onSaved(await api(`/orders/mine/${order.orderNumber}`, { method: 'PATCH', body }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="form od-edit" onSubmit={save}>
      <section className="od-card">
        <h2 className="od-title">{t('Items')}</h2>
        {order.editable.items ? (
          <ul className="od-items">
            {order.items.map((i) => (
              <li key={i.slug} className={qty[i.slug] === 0 ? 'is-removed' : ''}>
                {i.image ? <img src={i.image} alt="" width="64" height="80" /> : <span className="my-order-noimg" />}
                <span className="od-item-name"><b>{i.name}</b><small>{money(i.unitPrice, order.currency, lang)}</small></span>
                <span className="qty-stepper" role="group" aria-label={t('Quantity of {name}', { name: i.name })}>
                  <button type="button" onClick={() => step(i.slug, -1)} aria-label={t('One less')} disabled={qty[i.slug] === 0}><Icon name="minus" size={16} /></button>
                  <output aria-live="polite">{qty[i.slug]}</output>
                  <button type="button" onClick={() => step(i.slug, 1)} aria-label={t('One more')} disabled={qty[i.slug] >= 10}><Icon name="plus" size={16} /></button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="od-locked">{order.paymentStatus === 'paid' ? t('This order is paid, so its items are fixed. Message us to change them.') : t('Your order is being packed, so its items are fixed. You can still change the delivery details.')}</p>
        )}
        {changedItems && (
          <p className="od-newtotal">{t('New subtotal {amount}', { amount: money(subtotal, order.currency, lang) })} <small>{t('Delivery is recalculated when you save.')}</small></p>
        )}
      </section>

      <section className="od-card">
        <h2 className="od-title">{t('Delivery details')}</h2>
        <div className="form-row">
          <label>{t('Full name')}<input required value={f.name} onChange={set('name')} autoComplete="name" /></label>
          <label>{t('Mobile (WhatsApp)')}<input required type="tel" dir="ltr" value={f.phone} onChange={set('phone')} autoComplete="tel" /></label>
        </div>
        <label>{t('Address line 1')}<input required value={f.line1} onChange={set('line1')} autoComplete="address-line1" /></label>
        <label>{t('Address line 2 (optional)')}<input value={f.line2} onChange={set('line2')} autoComplete="address-line2" /></label>
        <div className="form-row three">
          <label>{t('City')}<input required value={f.city} onChange={set('city')} autoComplete="address-level2" /></label>
          <label>{t(india ? 'State' : 'Emirate')}<input value={f.state} onChange={set('state')} autoComplete="address-level1" /></label>
          <label>{t(india ? 'PIN code' : 'Postal code')}<input required value={f.postalCode} onChange={set('postalCode')} autoComplete="postal-code" dir="ltr" /></label>
        </div>
        <p className="fine">{t('Delivering to {country}. To send it to another country, cancel and order again.', { country: t(a.country) })}</p>
      </section>

      <section className="od-card">
        <h2 className="od-title">{t('Signature Card')}</h2>
        <label className="toggle">
          <input type="checkbox" checked={gift.enabled} onChange={(e) => setGift((g) => ({ ...g, enabled: e.target.checked }))} />
          <span>{t('Add a complimentary gift note, printed and placed in the box')}</span>
        </label>
        {gift.enabled && (
          <div className="od-gift-edit">
            <div className="form">
              <label>{t('Recipient’s name')}<input maxLength={40} value={gift.name} onChange={(e) => setGift((g) => ({ ...g, name: e.target.value }))} /></label>
              <span className="label">{t('Occasion')}</span>
              <div className="chips">
                {OCCASIONS.map((o) => <button type="button" key={o.id} className="chip" aria-pressed={gift.occasion === o.id} onClick={() => setGift((g) => ({ ...g, occasion: o.id }))}>{t(o.label)}</button>)}
              </div>
              <label>{t('Your message')}<textarea rows="3" maxLength={160} value={gift.message} onChange={(e) => setGift((g) => ({ ...g, message: e.target.value }))} /></label>
            </div>
            <SignatureCard name={gift.name || 'Ayesha'} occasion={gift.occasion} message={gift.message} theme="ivory" fragrance={order.items[0]?.name} />
          </div>
        )}
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="od-edit-bar">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>{t('Discard changes')}</button>
        <button className="btn btn-primary" disabled={busy}>{t(busy ? 'Saving…' : 'Save changes')}</button>
      </div>
    </form>
  );
}

export default function OrderDetails() {
  const { orderId } = useParams();
  const { user, t, lang, toast } = useStore();
  const { data: live, error, reload } = useLive(`/orders/${encodeURIComponent(orderId)}`, { skip: !user });
  const [saved, setSaved] = useState(null); // the order as returned by a save, until the next refresh
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [paying, setPaying] = useState(false);
  async function pay() {
    setPaying(true);
    try {
      await payOnline({ orderNumber: o.orderNumber, email: o.customer.email });
      toast(t('Payment received. Thank you.'));
      setSaved(null);
      reload();
    } catch (e) {
      if (e.kind === 'confirming') toast(t('We are confirming your payment. Please do not pay again.'), 'warn');
      else if (!e.dismissed) toast(e.message, 'warn');
      reload();
    } finally {
      setPaying(false);
    }
  }
  const o = saved && live && new Date(saved.updatedAt) > new Date(live.updatedAt) ? saved : live || saved;
  useEffect(() => setSaved(null), [orderId]);
  const fmt = (n) => money(n, o?.currency, lang);

  let body;
  if (!o && !error) {
    body = <div className="od-skeleton" aria-busy="true"><span /><span /><span /></div>;
  } else if (error?.status === 404) {
    body = (
      <div className="state-box" role="alert">
        <h2 className="state-title">{t('Order not found')}</h2>
        <p>{t('We could not find order {n} in your account. Check the Order ID, or sign in with the email you used at checkout.', { n: orderId })}</p>
        <Link to="/profile/orders" className="btn btn-primary">{t('See my orders')}</Link>
      </div>
    );
  } else if (!o) {
    body = (
      <div className="state-box" role="alert">
        <p>{t('We could not load this order just now.')}</p>
        <button className="btn btn-ghost" onClick={reload}>{t('Try again')}</button>
      </div>
    );
  } else if (editing) {
    body = (
      <EditOrder
        order={o}
        onCancel={() => setEditing(false)}
        onSaved={(n) => { setSaved(n); setEditing(false); toast(t('Your order has been updated')); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
      />
    );
  } else {
    const a = o.customer.address || {};
    const latestNote = [...o.history].reverse().find((h) => h.note)?.note;
    const lastEdit = o.edits?.at(-1);
    body = (
      <>
        {o.canPayOnline && (
          <div className="od-editable od-paynow">
            <div>
              <b>{t('Payment pending: {amount}', { amount: fmt(o.total) })}</b>
              <small>{t('Pay securely by UPI, card, netbanking or wallet.')}</small>
            </div>
            <button className="btn btn-primary" onClick={pay} disabled={paying}>{t(paying ? 'Opening…' : 'Pay now')}</button>
          </div>
        )}
        {o.editable?.details && (
          <div className="od-editable">
            <div>
              <b>{t('You can still change this order')}</b>
              <small>{o.editable.items ? t('Change quantities, the delivery address or the gift card until it is packed.') : t('Change the delivery address or the gift card until it ships.')}</small>
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={() => setEditing(true)}>{t('Edit order')}</button>
              <button className="btn btn-ghost" onClick={() => setCancelling(true)}>{t('Cancel order')}</button>
            </div>
          </div>
        )}

        {o.shipment && o.status !== 'Cancelled' ? (
          <ShipmentTracking order={o} onRefreshed={() => { setSaved(null); reload(); }} />
        ) : (
        <section className="od-card" aria-labelledby="od-status">
          <div className="od-card-head">
            <h2 id="od-status" className="od-title">{t('Order status')}</h2>
            <span className={`status-pill ${statusTone(o.status)}`}>{t(o.status)}</span>
          </div>
          <OrderTimeline status={o.status} stages={o.stages} history={o.history} />
          {latestNote && <p className="od-note">“{latestNote}”</p>}
          {(o.carrier || o.eta) && o.status !== 'Cancelled' && (
            <div className="od-ship">
              {o.eta && o.status !== 'Delivered' && <p>{t('Expected:')} <b>{o.eta}</b></p>}
              {o.carrier && <p>{t('Courier:')} <b>{o.carrier}</b></p>}
              {o.trackingNumber && <p>{t('Tracking number:')} <b dir="ltr">{o.trackingNumber}</b></p>}
            </div>
          )}
          {lastEdit && <p className="fine">{t('Last changed by you on {date}', { date: formatDate(lastEdit.at) })}</p>}
        </section>
        )}

        <div className="od-grid">
          <section className="od-card" aria-labelledby="od-items">
            <h2 id="od-items" className="od-title">{t('Items')}</h2>
            <ul className="od-items">
              {o.items.map((i) => (
                <li key={i.slug}>
                  {i.image ? <img src={i.image} alt="" width="64" height="80" loading="lazy" /> : <span className="my-order-noimg" />}
                  <span className="od-item-name">
                    <Link to={`/fragrances/${i.slug}`}><b>{i.name}</b></Link>
                    <small>{t('{qty} × {price}', { qty: i.qty, price: fmt(i.unitPrice) })}</small>
                  </span>
                  <b>{fmt(i.lineTotal)}</b>
                </li>
              ))}
            </ul>
            <div className="od-totals">
              <Row label={t('Subtotal')}>{fmt(o.subtotal)}</Row>
              {o.discount > 0 && <Row label={o.couponCode ? t('Coupon {code}', { code: o.couponCode }) : t('Discount')}>−{fmt(o.discount)}</Row>}
              <Row label={t('Delivery')}>{o.shipping ? fmt(o.shipping) : t('Complimentary')}</Row>
              <Row label={t('Total')} strong>{fmt(o.total)}</Row>
              {o.taxLabel && <p className="fine">{t('Prices {label}.', { label: t(o.taxLabel) })}</p>}
            </div>
          </section>

          <div className="od-side">
            <section className="od-card" aria-labelledby="od-pay">
              <h2 id="od-pay" className="od-title">{t('Payment')}</h2>
              <Row label={t('Method')}>{t(PAYMENT_METHOD[o.paymentMethod] || o.paymentMethod)}</Row>
              <Row label={t('Status')}>{t(PAYMENT_STATUS[o.paymentStatus] || o.paymentStatus)}</Row>
              <Row label={t('Amount')}>{fmt(o.total)}</Row>
            </section>
            <section className="od-card" aria-labelledby="od-addr">
              <h2 id="od-addr" className="od-title">{t('Delivery address')}</h2>
              <address>
                <b>{o.customer.name}</b><br />
                {a.line1}{a.line2 && <>, {a.line2}</>}<br />
                {[a.city, a.state, a.postalCode].filter(Boolean).join(' ')}<br />
                {t(a.country)}<br />
                <span dir="ltr">{o.customer.phone}</span>
              </address>
            </section>
            {o.giftNote?.enabled && (
              <section className="od-card" aria-labelledby="od-gift">
                <h2 id="od-gift" className="od-title">{t('Signature Card')}</h2>
                <p><b>{o.giftNote.name}</b>{o.giftNote.occasion && <> · {t(occasionLabel(o.giftNote.occasion))}</>}</p>
                {o.giftNote.message && <p className="od-note-sm">“{o.giftNote.message}”</p>}
              </section>
            )}
          </div>
        </div>

        <div className="od-actions">
          {o.status === 'Delivered' && (
            <Link to={`/track?id=${o.trackingId}&email=${encodeURIComponent(o.customer.email)}`} className="btn btn-primary">{t('Review your fragrance')}</Link>
          )}
          <a href={whatsappLink(t('Hello Al Barakah, I have a question about order {n}.', { n: o.orderNumber }))} className="btn btn-ghost" target="_blank" rel="noreferrer">{t('Ask about this order')}</a>
        </div>
      </>
    );
  }

  return (
    <AccountLayout
      title={o ? <span dir="ltr">{o.orderNumber}</span> : t('Order details')}
      seoTitle={o ? `${t('Order {n}', { n: o.orderNumber })}` : 'Order details'}
      lede={o ? t('Placed on {date}', { date: formatDate(o.createdAt) }) : null}
      actions={<Link to="/profile/orders" className="text-link"><Icon name="arrow-left" size={16} className="flip-rtl" /> {t('My orders')}</Link>}
      signedOut={<AuthForm />}
    >
      {body}
      {cancelling && o && (
        <CancelDialog
          order={o}
          onClose={() => setCancelling(false)}
          onDone={(n) => { setSaved(n); setCancelling(false); toast(t('Your order has been cancelled')); }}
        />
      )}
    </AccountLayout>
  );
}
