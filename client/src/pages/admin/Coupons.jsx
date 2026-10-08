import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, toQuery } from '../../lib/api';
import { money } from '../../lib/format';
import { useStore } from '../../context/StoreContext';
import { Pager } from './Fields';
import Icon from '../../components/Icon';

// Coupons: what each one gives, its rules, how much it has been used and what
// it brought in. Codes are always judged on the server (checkout, bag and
// order), so nothing here can be bypassed from the shop side.
const STATES = [
  ['active', 'Active'],
  ['scheduled', 'Scheduled'],
  ['expired', 'Expired'],
  ['used_up', 'Used up'],
  ['inactive', 'Off'],
  ['', 'All'],
];
const TONE = { active: 'ok', scheduled: 'warn', expired: 'off', used_up: 'off', inactive: 'off' };
const LABEL = Object.fromEntries(STATES);
const day = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const both = (v, fmt = (n, c) => money(n, c)) => ['INR', 'AED'].filter((c) => v?.[c]).map((c) => fmt(v[c], c)).join(' / ');

function discountText(c) {
  if (c.type === 'percent') return [`${c.percent}%`, both(c.maxDiscount) && `up to ${both(c.maxDiscount)}`];
  return [both(c.amount) || '—', null];
}
function rulesText(c) {
  const now = Date.now();
  const main = both(c.minSubtotal) ? `Min ${both(c.minSubtotal)}` : c.startsAt && new Date(c.startsAt) > now ? `starts ${day(c.startsAt)}` : '—';
  const sub = [c.perUserLimit && `${c.perUserLimit} per customer`, c.expiresAt ? `${new Date(c.expiresAt) < now ? 'ended' : 'ends'} ${day(c.expiresAt)}` : 'no end date'].filter(Boolean).join(' · ');
  return [main, sub];
}

export function CouponList() {
  const { toast } = useStore();
  const [params, setParams] = useSearchParams();
  const state = params.get('state') ?? 'active';
  const page = Math.max(parseInt(params.get('page'), 10) || 1, 1);
  const [q, setQ] = useState(params.get('q') || '');
  const [data, setData] = useState(null);
  const [counts, setCounts] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setError('');
    api(`/admin/coupons${toQuery({ state, q: params.get('q') || '', page, limit: 25 })}`)
      .then(setData)
      .catch((e) => { setError(e.message); setData({ items: [], total: 0, page: 1, pages: 1 }); });
  }, [params, reload]); // eslint-disable-line react-hooks/exhaustive-deps
  // Tab counts.
  useEffect(() => {
    Promise.all(STATES.filter(([k]) => k).map(([k]) => api(`/admin/coupons?state=${k}&limit=1`).then((d) => [k, d.total]).catch(() => [k, 0])))
      .then((rows) => setCounts(Object.fromEntries(rows)));
  }, [reload]);
  useEffect(() => {
    const id = setTimeout(() => q !== (params.get('q') || '') && setParams((p) => { const n = new URLSearchParams(p); q ? n.set('q', q) : n.delete('q'); n.delete('page'); return n; }), 300);
    return () => clearTimeout(id);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (patch) => setParams((p) => {
    const n = new URLSearchParams(p);
    for (const [k, v] of Object.entries(patch)) (v || (k === 'state' && v === '') ? n.set(k, v) : n.delete(k));
    return n;
  });

  async function act(c, kind) {
    if (kind === 'delete' && !window.confirm(c.usage?.orders ? `Delete ${c.code}? ${c.usage.orders} order(s) used it; they keep their discount. To keep the record, end it or switch it off instead.` : `Delete ${c.code}? This cannot be undone.`)) return;
    if (kind === 'expire' && !window.confirm(`End ${c.code} now? Customers will no longer be able to use it.`)) return;
    setBusy(`${c.id}:${kind}`);
    try {
      if (kind === 'toggle') await api(`/admin/coupons/${c.id}`, { method: 'PUT', body: { active: !c.active } });
      if (kind === 'expire') await api(`/admin/coupons/${c.id}/expire`, { method: 'POST' });
      if (kind === 'delete') await api(`/admin/coupons/${c.id}`, { method: 'DELETE' });
      toast(kind === 'toggle' ? `${c.code} ${c.active ? 'switched off' : 'switched on'}` : kind === 'expire' ? `${c.code} ended` : `${c.code} deleted`);
    } catch (e) {
      toast(e.message, 'warn');
    } finally {
      setBusy('');
      setReload((n) => n + 1);
    }
  }

  return (
    <div>
      <header className="a-head">
        <h1>Coupons</h1>
        <Link to="/admin/coupons/new" className="a-btn a-primary"><Icon name="plus" size={16} /> New coupon</Link>
      </header>
      <div className="a-tabs a-coupon-tabs" role="tablist" aria-label="Coupon status">
        {STATES.map(([key, label]) => (
          <button key={key || 'all'} role="tab" aria-selected={state === key} className={state === key ? 'is-on' : ''} onClick={() => go({ state: key, page: '' })}>
            {label}{key && counts[key] ? <span className="a-count">{counts[key]}</span> : null}
          </button>
        ))}
      </div>
      <section className="a-filters">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code" aria-label="Search code" />
      </section>
      <section className="a-panel">
        {error && <p className="a-error" role="alert">{error}</p>}
        {!data ? <p>Loading…</p> : data.items.length === 0 ? (
          <p className="a-muted">{state === 'active' ? 'No coupons are running. Create one to show it in the bag and at checkout.' : 'No coupons here.'}</p>
        ) : (
          <div className="a-table-wrap">
            <table className="a-table a-coupons">
              <thead><tr><th>Code</th><th>Discount</th><th>Rules</th><th>Used</th><th>Results</th><th>Status</th></tr></thead>
              <tbody>
                {data.items.map((c) => {
                  const [d1, d2] = discountText(c);
                  const [r1, r2] = rulesText(c);
                  const left = c.usageLimit ? Math.max(0, c.usageLimit - c.usedCount) : null;
                  const sales = both(c.usage?.sales);
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/admin/coupons/${c.id}`} className="a-code">{c.code}</Link><br /><small>{c.showOnSite ? 'Shown on website' : 'Private code'}</small>
                        <span className="a-row-acts">
                          <Link to={`/admin/coupons/${c.id}`} className="a-textbtn" aria-label={`Edit ${c.code}`}>Edit</Link>
                          {['active', 'scheduled', 'used_up'].includes(c.state) && <button type="button" className="a-textbtn" disabled={!!busy} onClick={() => act(c, 'expire')} aria-label={`End ${c.code} now`}>End now</button>}
                          <button type="button" className="a-textbtn a-textbtn-danger" disabled={!!busy} onClick={() => act(c, 'delete')} aria-label={`Delete ${c.code}`}>Delete</button>
                        </span>
                      </td>
                      <td>{d1}{d2 && <><br /><small>{d2}</small></>}</td>
                      <td>{r1}<br /><small>{r2}</small></td>
                      <td>{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}<br /><small>{left === null ? 'no limit' : `${left} left`}</small></td>
                      <td>{sales ? <>{sales} sales<br /><small>{both(c.usage.discount)} discount · {c.usage.orders} order{c.usage.orders === 1 ? '' : 's'}</small></> : <small>—</small>}</td>
                      <td>
                        <span className="a-coupon-state">
                          <button type="button" role="switch" aria-checked={c.active} aria-label={`${c.code}: ${c.active ? 'on' : 'off'}`} title={c.active ? 'Switch off' : 'Switch on'} className={`a-switch${c.active ? ' is-on' : ''}`} disabled={!!busy} onClick={() => act(c, 'toggle')} />
                          <span className={`a-pill ${TONE[c.state] || ''}`}>{LABEL[c.state] || c.state}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={data.page} pages={data.pages} total={data.total} noun="coupons" onPage={(p) => go({ page: String(p) })} />}
      </section>
      <p className="a-muted a-hint">Deleting a coupon that has been used keeps those orders and their discount as they are. To stop a coupon but keep its record, end it or switch it off.</p>
    </div>
  );
}

// yyyy-mm-dd in the admin's own time zone, and back (start or end of that day).
const toDay = (d) => {
  if (!d) return '';
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const fromDay = (s, end) => (s ? new Date(`${s}T${end ? '23:59:59' : '00:00:00'}`).toISOString() : null);
const num = (v) => (v === '' || v == null ? '' : String(v));
const EMPTY = { code: '', description: '', type: 'percent', percent: '10', amountINR: '', amountAED: '', maxINR: '', maxAED: '', minINR: '', minAED: '', usageLimit: '', perUserLimit: '1', startsAt: '', expiresAt: '', active: true, showOnSite: true };

export function CouponEdit() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { toast } = useStore();
  const [f, setF] = useState(isNew ? EMPTY : null);
  const [usage, setUsage] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    api(`/admin/coupons/${id}`).then((c) => setF({
      code: c.code, description: c.description, type: c.type, percent: num(c.percent),
      amountINR: num(c.amount?.INR), amountAED: num(c.amount?.AED), maxINR: num(c.maxDiscount?.INR), maxAED: num(c.maxDiscount?.AED),
      minINR: num(c.minSubtotal?.INR), minAED: num(c.minSubtotal?.AED), usageLimit: num(c.usageLimit), perUserLimit: num(c.perUserLimit),
      startsAt: toDay(c.startsAt), expiresAt: toDay(c.expiresAt), active: c.active, showOnSite: c.showOnSite, usedCount: c.usedCount,
    })).catch((e) => setError(e.message));
    api(`/admin/coupons/${id}/orders?limit=10`).then(setUsage).catch(() => {});
  }, [id, isNew]);

  if (error && !f) return <div><header className="a-head"><h1>Coupon</h1></header><p className="a-error">{error}</p></div>;
  if (!f) return <p>Loading…</p>;
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }); setErrors((x) => ({ ...x, [k]: undefined })); };
  const pair = (inr, aed) => ({ ...(inr !== '' && { INR: Number(inr) }), ...(aed !== '' && { AED: Number(aed) }) });

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setErrors({});
    const body = {
      code: f.code, description: f.description, type: f.type, active: f.active, showOnSite: f.showOnSite,
      percent: f.type === 'percent' ? Number(f.percent) : undefined,
      amount: f.type === 'fixed' ? pair(f.amountINR, f.amountAED) : {},
      maxDiscount: f.type === 'percent' ? pair(f.maxINR, f.maxAED) : {},
      minSubtotal: pair(f.minINR, f.minAED),
      usageLimit: f.usageLimit === '' ? null : f.usageLimit,
      perUserLimit: f.perUserLimit === '' ? null : f.perUserLimit,
      startsAt: fromDay(f.startsAt, false),
      expiresAt: fromDay(f.expiresAt, true),
    };
    try {
      await api(isNew ? '/admin/coupons' : `/admin/coupons/${id}`, { method: isNew ? 'POST' : 'PUT', body });
      toast(isNew ? `${f.code.toUpperCase()} created` : 'Coupon saved');
      navigate('/admin/coupons');
    } catch (err) {
      setError(err.message);
      const map = { amount: f.type === 'fixed' ? 'amountINR' : 'percent' };
      setErrors(Object.fromEntries((err.data?.errors || []).map((x) => [map[x.field] || x.field, x.message])));
    } finally {
      setBusy(false);
    }
  }

  // The customer-facing card, as the bag will show it (in rupees).
  const sample = 2799;
  const pct = Number(f.percent) || 0;
  const cap = Number(f.maxINR) || 0;
  const saving = f.type === 'percent' ? Math.min(Math.round((sample * pct) / 100), cap || Infinity) : Number(f.amountINR) || 0;
  const what = f.type === 'percent' ? `${pct}% off${cap ? `, up to ${money(cap, 'INR')}` : ''}` : `${money(Number(f.amountINR) || 0, 'INR')} off`;
  const terms = [f.minINR && `on bags over ${money(Number(f.minINR), 'INR')}`, f.expiresAt && `ends ${new Date(`${f.expiresAt}T12:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`].filter(Boolean);
  const err = (k) => errors[k] && <span className="a-field-error">{errors[k]}</span>;

  return (
    <div>
      <header className="a-head">
        <h1>{isNew ? 'New coupon' : f.code}</h1>
        <Link to="/admin/coupons" className="a-link"><Icon name="arrow-left" size={16} /> All coupons</Link>
      </header>
      <div className="a-coupon-edit">
        <section className="a-panel">
          <form className="a-form" onSubmit={save} noValidate>
            <div className="a-grid2">
              <label>Code<input value={f.code} onChange={set('code')} required maxLength={30} autoCapitalize="characters" spellCheck="false" style={{ textTransform: 'uppercase' }} aria-invalid={!!errors.code} />{err('code') || <span className="a-hint">Letters, numbers, - or _. Customers can type it in any case.</span>}</label>
              <label>Short description<input value={f.description} onChange={set('description')} maxLength={200} placeholder="e.g. 10% off your first order" /><span className="a-hint">Shown on the website with the offer.</span></label>
            </div>
            <fieldset className="a-fieldset">
              <legend>Discount</legend>
              <div className="a-seg" role="radiogroup" aria-label="Discount type">
                {[['percent', 'Percentage'], ['fixed', 'Fixed amount']].map(([k, label]) => (
                  <button key={k} type="button" role="radio" aria-checked={f.type === k} className={f.type === k ? 'is-on' : ''} onClick={() => setF({ ...f, type: k })}>{label}</button>
                ))}
              </div>
            </fieldset>
            {f.type === 'percent' ? (
              <div className="a-grid3">
                <label>Percent off<input inputMode="numeric" value={f.percent} onChange={set('percent')} aria-invalid={!!errors.percent} />{err('percent')}</label>
                <label>Maximum discount (₹)<input inputMode="numeric" value={f.maxINR} onChange={set('maxINR')} placeholder="No cap" /></label>
                <label>Maximum discount (AED)<input inputMode="numeric" value={f.maxAED} onChange={set('maxAED')} placeholder="No cap" /></label>
              </div>
            ) : (
              <div className="a-grid2">
                <label>Amount off (₹)<input inputMode="numeric" value={f.amountINR} onChange={set('amountINR')} aria-invalid={!!errors.amountINR} />{err('amountINR') || <span className="a-hint">Leave a currency empty and the coupon does not work in that market.</span>}</label>
                <label>Amount off (AED)<input inputMode="numeric" value={f.amountAED} onChange={set('amountAED')} /></label>
              </div>
            )}
            <div className="a-grid2">
              <label>Minimum order (₹)<input inputMode="numeric" value={f.minINR} onChange={set('minINR')} placeholder="None" /></label>
              <label>Minimum order (AED)<input inputMode="numeric" value={f.minAED} onChange={set('minAED')} placeholder="None" /></label>
            </div>
            <div className="a-grid2">
              <label>Total uses<input inputMode="numeric" value={f.usageLimit} onChange={set('usageLimit')} placeholder="No limit" />{!isNew && <span className="a-hint">Used {f.usedCount} time{f.usedCount === 1 ? '' : 's'} so far.</span>}</label>
              <label>Uses per customer<input inputMode="numeric" value={f.perUserLimit} onChange={set('perUserLimit')} placeholder="No limit" /><span className="a-hint">Counted by account and by email, guests included.</span></label>
            </div>
            <div className="a-grid2">
              <label>Starts<input type="date" value={f.startsAt} onChange={set('startsAt')} /><span className="a-hint">Empty = straight away.</span></label>
              <label>Ends (end of that day)<input type="date" value={f.expiresAt} onChange={set('expiresAt')} aria-invalid={!!errors.expiresAt} />{err('expiresAt') || <span className="a-hint">Empty = no end date.</span>}</label>
            </div>
            <label className="a-check"><input type="checkbox" checked={f.active} onChange={set('active')} /> Active</label>
            <label className="a-check"><input type="checkbox" checked={f.showOnSite} onChange={set('showOnSite')} /> Show on website (bag and checkout)</label>
            {error && <p className="a-error" role="alert">{error}</p>}
            <div className="a-actions">
              <button className="a-btn a-primary" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Create coupon' : 'Save coupon'}</button>
              <Link to="/admin/coupons" className="a-btn">Cancel</Link>
            </div>
          </form>
        </section>
        <aside className="a-coupon-side">
          <div className="a-coupon-preview">
            <span className="a-eyebrow">How customers see it</span>
            {f.showOnSite ? (
              <div className="a-offer">
                <span className="a-offer-what">{what}</span>
                <span className="a-offer-terms"><b>{(f.code || 'CODE').toUpperCase()}</b>{terms.map((x) => ` · ${x}`).join('')}</span>
                {saving > 0 && (!f.minINR || sample >= Number(f.minINR)) && <span className="a-offer-save">Saves {money(saving, 'INR')} on a {money(sample, 'INR')} bag</span>}
                {f.description && <span className="a-offer-terms">{f.description}</span>}
                <span className="a-offer-apply" aria-hidden="true">Apply</span>
              </div>
            ) : <p className="a-muted a-hint">Not listed on the website. It still works for customers who have the code.</p>}
          </div>
          {usage && usage.items.length > 0 && (
            <section className="a-panel">
              <h2>Recent orders with this code</h2>
              <ul className="a-coupon-orders">
                {usage.items.map((o) => (
                  <li key={o.id}><Link to={`/admin/orders?q=${o.orderNumber}`} className="a-link">{o.orderNumber}</Link> <span>{o.customer.name}</span> <small className="a-muted">−{money(o.discount, o.currency)} · {o.status}</small></li>
                ))}
              </ul>
              <p className="a-muted a-hint">{usage.usage.orders} order{usage.usage.orders === 1 ? '' : 's'} in all (cancelled ones not counted).</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
