import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { money, formatDate } from '../../lib/format';
import { useStore } from '../../context/StoreContext';
import { COURIERS, courierByName, trackingUrl, isUrl, STATUS_NOTES } from '../../../../shared/couriers.js';

// The six steps of the customer's timeline, plus Cancelled (from any step;
// the server returns the items to stock).
export const STAGES = ['Order Placed', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];
const OTHER = '__other';
const CUSTOM = '__custom';

// "3 October 2026" <-> the yyyy-mm-dd a date input needs.
const longDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
function isoFromEta(eta) {
  if (!eta) return '';
  const year = new Date().getFullYear();
  for (const s of [eta, `${eta} ${year}`]) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime()) && d.getFullYear() >= year - 1) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  return '';
}
const plusDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function formFrom(order) {
  const c = order.customer || {};
  const a = c.address || {};
  // Older orders may have a tracking number saved in the link field.
  const legacyNumber = order.carrierUrl && !isUrl(order.carrierUrl) ? order.carrierUrl : '';
  const known = courierByName(order.carrier);
  return {
    name: c.name || '', email: c.email || '', phone: c.phone || '',
    line1: a.line1 || '', line2: a.line2 || '', city: a.city || '', state: a.state || '', postalCode: a.postalCode || '',
    status: order.status,
    noteChoice: '', note: '',
    courier: known ? known.name : order.carrier ? OTHER : '',
    otherCourier: known ? '' : order.carrier || '',
    trackingNumber: order.trackingNumber || legacyNumber,
    otherUrl: !known && isUrl(order.carrierUrl) ? order.carrierUrl : '',
    etaIso: isoFromEta(order.eta),
    etaText: order.eta || '',
    paymentStatus: order.paymentStatus,
    notes: order.notes || '',
  };
}

const PAY_LABEL = { pending: 'Pending', paid: 'Paid', partially_refunded: 'Partly refunded', refunded: 'Refunded' };
const ISSUE_LABEL = { amount_mismatch: 'Wrong amount paid', duplicate_payment: 'Paid twice', paid_after_cancel: 'Paid after cancelling' };
const rupees = (paise, currency) => money((paise || 0) / 100, currency);

// Online payment: what Razorpay reported, money to give back, refunds sent.
// Refunds are admin-only and need a second click to confirm.
function PaymentPanel({ order, onSaved }) {
  const { user, toast } = useStore();
  const p = order.payment || {};
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [target, setTarget] = useState(null); // payment id being refunded, after the first click
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const isAdmin = user?.role === 'admin';
  const openIssues = (p.issues || []).filter((i) => !i.resolved);
  const left = Math.max(0, (p.amount || 0) - (p.refundedAmount || 0));
  const canRefundMain = p.providerPaymentId && ['paid', 'partially_refunded'].includes(order.paymentStatus) && left > 0;
  const stuck = order.paymentStatus === 'pending' && (p.attempts?.length || p.providerOrderId);
  if (!p.providerPaymentId && !stuck && !openIssues.length) return null;

  async function run(kind, body) {
    setBusy(kind);
    setError('');
    try {
      const o = await api(`/admin/orders/${order._id}/${kind === 'check' ? 'payment-check' : 'refund'}`, { method: 'POST', body });
      onSaved(o);
      toast(kind === 'check' ? (o.paymentStatus === 'pending' ? 'Razorpay has no completed payment for this order yet' : 'Payment found and recorded') : 'Refund sent to Razorpay');
      setTarget(null);
      setAmount('');
      setReason('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }
  const refund = (paymentId) => {
    if (target !== paymentId) return setTarget(paymentId);
    return run('refund', paymentId === p.providerPaymentId ? { amount: amount.trim(), reason } : { paymentId, reason: reason || 'Extra payment returned' });
  };

  return (
    <div className="a-pay">
      <h3>Online payment</h3>
      {p.providerPaymentId ? (
        <p className="a-hint">
          <b>{PAY_LABEL[order.paymentStatus] || order.paymentStatus}</b> · {rupees(p.amount, order.currency)}{p.method && ` by ${p.method}`}
          {p.paidAt && <><br /><small className="a-muted">{new Date(p.paidAt).toLocaleString('en-GB')} · confirmed by {p.verifiedBy || 'checkout'}</small></>}
          <br /><small className="a-muted">Payment {p.providerPaymentId} · {p.providerOrderId}</small>
        </p>
      ) : (
        <p className="a-hint">Waiting for payment of {money(order.total, order.currency)}.{p.attempts?.at(-1)?.lastError && <><br /><small className="a-muted">Last try: {p.attempts.at(-1).lastError}</small></>}</p>
      )}
      {stuck && (
        <button type="button" className="a-btn" disabled={!!busy} onClick={() => run('check')} title="Asks Razorpay whether the customer paid; use it if a payment seems missing">
          {busy === 'check' ? 'Checking…' : 'Check with Razorpay'}
        </button>
      )}

      {openIssues.map((i) => (
        <div key={i.providerPaymentId} className="a-pay-issue" role="alert">
          <b>⚠ {ISSUE_LABEL[i.kind] || i.kind}: {rupees(i.amount, order.currency)} to refund</b>
          <small>{i.note}<br />{i.providerPaymentId}</small>
          {isAdmin && (
            <button type="button" className={`a-btn ${target === i.providerPaymentId ? 'a-danger' : ''}`} disabled={!!busy} onClick={() => refund(i.providerPaymentId)}>
              {busy === 'refund' && target === i.providerPaymentId ? 'Refunding…' : target === i.providerPaymentId ? `Confirm refund of ${rupees(i.amount, order.currency)}` : 'Refund this payment'}
            </button>
          )}
        </div>
      ))}

      {p.refunds?.length > 0 && (
        <ol className="a-history">
          {p.refunds.map((r) => (
            <li key={r.providerRefundId}>
              <b>Refund {rupees(r.amount, order.currency)}</b> · {r.status === 'processed' ? 'sent' : r.status === 'failed' ? 'failed' : 'processing'}
              <br /><small>{new Date(r.createdAt).toLocaleString('en-GB')}{r.by && ` · ${r.by}`}{r.reason && ` · ${r.reason}`}</small>
            </li>
          ))}
        </ol>
      )}

      {canRefundMain && isAdmin && (
        <div className="a-form a-refund">
          <div className="a-grid2">
            <label>Refund amount
              <input inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setTarget(null); }} placeholder={`All ${rupees(left, order.currency)}`} />
            </label>
            <label>Reason<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged in transit" maxLength={200} /></label>
          </div>
          <div className="a-actions">
            <button type="button" className={`a-btn ${target === p.providerPaymentId ? 'a-danger' : ''}`} disabled={!!busy} onClick={() => refund(p.providerPaymentId)}>
              {busy === 'refund' ? 'Refunding…' : target === p.providerPaymentId ? `Confirm: refund ${amount.trim() ? money(Number(amount), order.currency) : rupees(left, order.currency)}` : 'Refund…'}
            </button>
            {target === p.providerPaymentId && <button type="button" className="a-btn" onClick={() => setTarget(null)}>Cancel</button>}
          </div>
          <small className="a-muted">Money goes back to the customer's original payment method in 5–7 working days.</small>
        </div>
      )}
      {canRefundMain && !isAdmin && <p className="a-muted a-hint">Refunds can be sent by an admin.</p>}
      {error && <p className="a-error" role="alert">{error}</p>}
    </div>
  );
}

// WhatsApp needs the number in international form without "+" or spaces.
function waNumber(phone, country) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10 && country === 'India') d = `91${d}`;
  if (d.length === 9 && /Emirates/.test(country || '')) d = `971${d}`;
  return d;
}

export function OrderRow({ order, onSaved }) {
  const { toast } = useStore();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(() => formFrom(order));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Keep the form in step when the order changes elsewhere (e.g. an Excel import).
  useEffect(() => setF(formFrom(order)), [order]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const c = order.customer;
  const country = c.address?.country || '';

  const courierName = f.courier === OTHER ? f.otherCourier.trim() : f.courier;
  const link = f.courier === OTHER ? f.otherUrl.trim() : trackingUrl(f.courier, f.trackingNumber);
  const courierInfo = courierByName(f.courier);
  const needsNumberInPage = courierInfo?.url && !courierInfo.url.includes('{n}');
  const statusChanged = f.status !== order.status;
  const presets = STATUS_NOTES[f.status] || [];
  const note = f.noteChoice === CUSTOM ? f.note : f.noteChoice;
  const eta = f.etaIso ? longDate(f.etaIso) : f.etaText;

  const suggestedCouriers = useMemo(() => {
    const home = /Emirates/.test(country) ? 'AE' : 'IN';
    return [
      [home === 'IN' ? 'India' : 'UAE & international', COURIERS.filter((x) => x.region === home)],
      [home === 'IN' ? 'UAE & international' : 'India', COURIERS.filter((x) => x.region && x.region !== home)],
      ['Other', COURIERS.filter((x) => !x.region)],
    ];
  }, [country]);

  async function save() {
    setError('');
    if (f.courier === OTHER && f.otherUrl.trim() && !isUrl(f.otherUrl)) return setError('The tracking link must start with https://');
    setBusy(true);
    try {
      const o = await api(`/orders/${order._id}`, {
        method: 'PATCH',
        body: {
          customer: { name: f.name, email: f.email, phone: f.phone, address: { line1: f.line1, line2: f.line2, city: f.city, state: f.state, postalCode: f.postalCode } },
          status: f.status,
          note: statusChanged ? note : '',
          carrier: courierName,
          trackingNumber: f.trackingNumber,
          carrierUrl: link,
          eta,
          ...(f.paymentStatus !== order.paymentStatus && { paymentStatus: f.paymentStatus }),
          notes: f.notes,
        },
      });
      onSaved(o);
      toast(`${order.orderNumber} updated`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const trackPage = `${window.location.origin}/track?id=${order.trackingId}&email=${encodeURIComponent(order.customer.email)}`;
  const waText = [
    `Hello ${f.name.split(' ')[0] || ''}, an update on your AL BARAKAH LIFESTYLE order ${order.orderNumber}: ${f.status}.`,
    note,
    courierName && `Courier: ${courierName}${f.trackingNumber ? `, tracking number ${f.trackingNumber}` : ''}.`,
    link && `Courier tracking: ${link}`,
    eta && f.status !== 'Delivered' && `Expected delivery: ${eta}.`,
    `Track your order: ${trackPage}`,
  ].filter(Boolean).join('\n');
  const wa = waNumber(f.phone, country);

  return (
    <>
      <tr className={open ? 'is-open' : ''} onClick={() => setOpen(!open)}>
        <td><b>{order.orderNumber}</b><br /><small>{formatDate(order.createdAt)}</small></td>
        <td>{c.name}<br /><small dir="ltr">{c.phone}</small><br /><small>{c.address.city}, {c.address.country}</small></td>
        <td>{order.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}{order.giftNote?.enabled && <><br /><small className="a-gold">✦ Signature Card</small></>}</td>
        <td>
          {money(order.total, order.currency)}<br /><small>{order.paymentMethod} · {PAY_LABEL[order.paymentStatus] || order.paymentStatus}</small>
          {order.payment?.issues?.some((i) => !i.resolved) && <><br /><small className="a-warn">⚠ refund due</small></>}
        </td>
        <td><span className="a-pill">{order.status}</span></td>
      </tr>
      {open && (
        <tr className="a-detail">
          <td colSpan={5}>
            <div className="a-detail-grid">
              <div className="a-form">
                <h3>Customer</h3>
                <label>Full name<input value={f.name} onChange={set('name')} /></label>
                <label>Email <small className="a-muted">(used on the tracking page)</small><input type="email" value={f.email} onChange={set('email')} /></label>
                <label>Phone (WhatsApp)<input type="tel" value={f.phone} onChange={set('phone')} /></label>
                <label>Address line 1<input value={f.line1} onChange={set('line1')} /></label>
                <label>Address line 2<input value={f.line2} onChange={set('line2')} placeholder="Optional" /></label>
                <div className="a-grid2">
                  <label>City<input value={f.city} onChange={set('city')} /></label>
                  <label>{country === 'India' ? 'State' : 'Emirate / State'}<input value={f.state} onChange={set('state')} /></label>
                </div>
                <div className="a-grid2">
                  <label>{country === 'India' ? 'PIN code' : 'Postal code'}<input value={f.postalCode} onChange={set('postalCode')} /></label>
                  <label>Country<input value={country} disabled title="Set by the market the order was priced in" /></label>
                </div>
                <p className="a-muted">Order {order.orderNumber} · Tracking ID <b>{order.trackingId}</b></p>
                {order.giftNote?.enabled && (
                  <div className="a-gift">
                    <h3>Signature Card</h3>
                    <p><b>{order.giftNote.name}</b> · {order.giftNote.occasion}<br />“{order.giftNote.message}”</p>
                  </div>
                )}
              </div>

              <div className="a-form">
                <h3>Delivery & payment</h3>
                <label>Status
                  <select value={f.status} onChange={(e) => setF((x) => ({ ...x, status: e.target.value, noteChoice: STATUS_NOTES[e.target.value]?.[0] && e.target.value !== order.status ? STATUS_NOTES[e.target.value][0] : '' }))}>
                    {STAGES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
                {statusChanged && (
                  <label>Message for the customer's tracking page
                    <select value={f.noteChoice} onChange={set('noteChoice')}>
                      <option value="">No message</option>
                      {presets.map((p) => <option key={p} value={p}>{p}</option>)}
                      <option value={CUSTOM}>Write my own…</option>
                    </select>
                    {f.noteChoice === CUSTOM && <input value={f.note} onChange={set('note')} placeholder="Your message" autoFocus />}
                  </label>
                )}
                <label>Courier
                  <select value={f.courier} onChange={set('courier')}>
                    <option value="">Not shipped yet</option>
                    {suggestedCouriers.map(([group, list]) => (
                      <optgroup key={group} label={group}>{list.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}</optgroup>
                    ))}
                    <option value={OTHER}>Other courier…</option>
                  </select>
                  {f.courier === OTHER && <input value={f.otherCourier} onChange={set('otherCourier')} placeholder="Courier name" />}
                </label>
                {f.courier && f.courier !== 'Hand delivery' && (
                  <label>Tracking number (AWB)<input value={f.trackingNumber} onChange={set('trackingNumber')} placeholder="e.g. 26554968" /></label>
                )}
                {f.courier === OTHER ? (
                  <label>Tracking link<input value={f.otherUrl} onChange={set('otherUrl')} placeholder="https://…" /></label>
                ) : link ? (
                  <p className="a-link-preview">
                    Customer tracking link: <a href={link} target="_blank" rel="noreferrer" className="a-link">open ↗</a>
                    {needsNumberInPage && <><br /><small className="a-muted">{f.courier} opens its tracking page; the customer enters the number there.</small></>}
                  </p>
                ) : f.courier && f.courier !== 'Hand delivery' ? (
                  <p className="a-muted a-hint">Add the tracking number and the customer's tracking link is created automatically.</p>
                ) : null}
                <label>Expected delivery
                  <input type="date" value={f.etaIso} min={plusDays(-30)} onChange={(e) => setF((x) => ({ ...x, etaIso: e.target.value, etaText: '' }))} />
                </label>
                <div className="a-quick">
                  {[2, 3, 5, 7].map((n) => (
                    <button type="button" key={n} className={f.etaIso === plusDays(n) ? 'is-on' : ''} onClick={() => setF((x) => ({ ...x, etaIso: plusDays(n), etaText: '' }))}>+{n} days</button>
                  ))}
                  {(f.etaIso || f.etaText) && <button type="button" onClick={() => setF((x) => ({ ...x, etaIso: '', etaText: '' }))}>Clear</button>}
                </div>
                {!f.etaIso && f.etaText && <p className="a-muted a-hint">Currently: “{f.etaText}”. Pick a date to replace it.</p>}
                {order.payment?.providerPaymentId ? (
                  <p className="a-hint">Payment: <b>{PAY_LABEL[order.paymentStatus]}</b> online. <small className="a-muted">Set by Razorpay; refunds are in the payment panel.</small></p>
                ) : (
                  <label>Payment
                    <select value={f.paymentStatus} onChange={set('paymentStatus')}>
                      <option value="pending">Pending</option><option value="paid">Paid</option><option value="refunded">Refunded</option>
                    </select>
                  </label>
                )}
                <label>Internal notes<textarea rows="2" value={f.notes} onChange={set('notes')} placeholder="Only the team sees these" /></label>
                {error && <p className="a-error" role="alert">{error}</p>}
                <div className="a-actions">
                  <button className="a-btn a-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save update'}</button>
                  {wa.length >= 8 && (
                    <a className="a-btn" href={`https://wa.me/${wa}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer" title="Opens WhatsApp with this update written for the customer">
                      Send on WhatsApp
                    </a>
                  )}
                </div>
              </div>

              <div>
                <h3>History</h3>
                <ol className="a-history">
                  {order.history.map((h, i) => <li key={i}><b>{h.status}</b> · {new Date(h.at).toLocaleString('en-GB')}{h.note && <><br /><small>{h.note}</small></>}</li>)}
                </ol>
                <PaymentPanel order={order} onSaved={onSaved} />
                {order.edits?.length > 0 && (
                  <>
                    <h3 style={{ marginTop: 16 }}>Changed by the customer</h3>
                    <ol className="a-history">
                      {order.edits.map((e, i) => <li key={i}><small>{new Date(e.at).toLocaleString('en-GB')}</small><br />{e.summary}</li>)}
                    </ol>
                  </>
                )}
                {order.carrier && (
                  <p className="a-muted a-hint" style={{ marginTop: 14 }}>
                    Saved courier: <b>{order.carrier}</b>{order.trackingNumber && <> · {order.trackingNumber}</>}
                    {order.eta && <><br />Expected: <b>{order.eta}</b></>}
                  </p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
