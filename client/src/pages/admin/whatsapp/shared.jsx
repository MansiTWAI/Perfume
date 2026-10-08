import { useEffect, useRef, useState } from 'react';
import { api, toQuery, uploadFile } from '../../../lib/api';
import { money } from '../../../lib/format';
import Icon from '../../../components/Icon';

// Pieces shared by the WhatsApp admin tabs: the phone preview, the message
// editor (templates and campaigns), the AI draft panel, the people picker and
// small helpers.

export const when = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const STATUS = { queued: ['Waiting', 'warn'], sending: ['Sending', 'warn'], sent: ['Sent', ''], delivered: ['Delivered', 'ok'], read: ['Read', 'ok'], failed: ['Failed', 'bad'], skipped: ['Skipped', 'off'] };
export const LEAD_TONE = (s) => (s >= 60 ? 'ok' : s >= 30 ? 'warn' : '');
export const AUDIENCE = { all: 'All subscribers', leads: 'AI leads', selected: 'Selected customers' };
export const people = (n) => `${n} ${n === 1 ? 'person' : 'people'}`;
// Still changing: messages going out, or receipts still expected.
export const live = (c) => !c.cancelledAt && (!c.finishedAt || ((c.counts.sent || c.counts.delivered) > 0 && Date.now() - new Date(c.createdAt).getTime() < 15 * 60000));
export function campaignState(c) {
  if (c.cancelledAt) return ['Cancelled', 'off'];
  if (c.problem) return ['Stopped', 'bad'];
  if (c.scheduledAt && new Date(c.scheduledAt) > new Date() && !c.finishedAt) return [`Sends ${when(c.scheduledAt)}`, 'warn'];
  if (!c.finishedAt) return ['Sending', 'warn'];
  return ['Sent', 'ok'];
}
export const summary = (c) => [
  c.read && `${c.read} read`, c.delivered && `${c.delivered} delivered`, c.sent && `${c.sent} sent`,
  c.waiting && `${c.waiting} waiting`, c.failed && `${c.failed} failed`, c.skipped && `${c.skipped} skipped`,
].filter(Boolean).join(' · ') || '—';

export function DeliveryBar({ counts, total }) {
  const part = (n) => `${total ? ((n || 0) / total) * 100 : 0}%`;
  return (
    <span className="a-wa-bar" aria-hidden="true">
      <i className="is-read" style={{ width: part(counts.read) }} />
      <i className="is-delivered" style={{ width: part(counts.delivered) }} />
      <i className="is-sent" style={{ width: part(counts.sent) }} />
      <i className="is-failed" style={{ width: part(counts.failed) }} />
    </span>
  );
}

// Products (with WhatsApp-ready pictures) and usable coupons, loaded once.
let optionsCache = null;
export function useOptions() {
  const [o, setO] = useState(optionsCache);
  useEffect(() => {
    api('/admin/whatsapp/options').then((d) => { optionsCache = d; setO(d); }).catch(() => setO({ products: [], coupons: [], variables: [] }));
  }, []);
  return o;
}

export const EMPTY_CONTENT = { title: '', message: '', product: '', image: '', coupon: '', cta: { label: 'Shop Now', path: '' } };
export const contentOf = (t) => ({ title: t.title || '', message: t.message || '', product: t.product || '', image: t.image || '', coupon: t.coupon || '', cta: { label: t.cta?.label || 'Shop Now', path: t.cta?.path || '' } });

// ----- WhatsApp-style phone preview, filled in by the server -----
export function PhonePreview({ content, templateId, contactId, onResult }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const key = JSON.stringify({ content, templateId, contactId });
  useEffect(() => {
    const id = setTimeout(() => {
      api('/admin/whatsapp/preview', { method: 'POST', body: { ...(templateId && { templateId }), ...content, ...(contactId && { contactId }) } })
        .then((d) => { setP(d); setError(''); onResult?.(d); })
        .catch((e) => setError(e.message));
    }, 350);
    return () => clearTimeout(id);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <p className="a-error">{error}</p>;
  if (!p) return <div className="a-phone a-phone-loading" aria-busy="true" />;
  const empty = !p.text && !p.title;
  return (
    <figure className="a-phone" aria-label={`Preview for ${p.to.name}`}>
      <div className="a-phone-top"><span className="a-phone-av" aria-hidden="true">AB</span>Al Barakah Lifestyle</div>
      <div className="a-phone-chat">
        <div className="a-phone-msg">
          {p.image && <img className="a-phone-img" src={content?.image || p.image} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
          <div className="a-phone-body">
            {empty ? <span className="a-muted">Your message appears here.</span> : (
              <>{p.greeting} {p.title && <b>{p.title}</b>} {p.text.split('\n').map((line, i) => <span key={i}>{i > 0 && <br />}{line}</span>)}</>
            )}
          </div>
          <div className="a-phone-foot"><span>{p.footer}</span><span>10:42</span></div>
          {p.cta && <div className="a-phone-btn"><Icon name="external" size={14} />{p.cta.label}</div>}
        </div>
      </div>
      <figcaption>
        {p.problems.map((x) => <p key={x} className="a-note is-bad"><Icon name="error" size={16} /><span>{x}</span></p>)}
        {!empty && p.errors.map((x) => <p key={x.message} className="a-note is-bad"><Icon name="error" size={16} /><span>{x.message}</span></p>)}
        {p.warnings.map((x) => <p key={x} className="a-note"><Icon name="alert" size={16} /><span>{x}</span></p>)}
        {!empty && p.canSend && !p.warnings.length && (
          <p className="a-note is-ok"><Icon name="check" size={16} /><span>{[p.product && `${p.product.name} is in the shop`, p.coupon && `${p.coupon.code} is active`].filter(Boolean).join('. ') || 'Ready to send'}.</span></p>
        )}
      </figcaption>
    </figure>
  );
}

// ----- the message editor -----
export function ContentForm({ value, onChange, errors = {} }) {
  const o = useOptions();
  const msg = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const set = (patch) => onChange({ ...value, ...patch });
  const product = o?.products.find((p) => p.slug === value.product);
  const insert = (v) => {
    const el = msg.current;
    const token = `{${v}}`;
    if (!el) return set({ message: `${value.message}${token}` });
    const s = el.selectionStart ?? value.message.length;
    const e = el.selectionEnd ?? s;
    set({ message: value.message.slice(0, s) + token + value.message.slice(e) });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + token.length, s + token.length); });
  };
  function pickProduct(slug) {
    const p = o.products.find((x) => x.slug === slug);
    // A new product brings its first WhatsApp-ready picture, unless one was uploaded.
    const uploaded = value.image && !o.products.some((x) => x.images.some((i) => i.src === value.image));
    set({ product: slug, image: uploaded ? value.image : p?.images.find((i) => i.ok)?.src || '' });
  }
  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png)$/.test(file.type)) return setUploadError('Choose a JPG or PNG picture; WhatsApp does not show other formats.');
    setUploadError('');
    setUploading(true);
    try {
      const { src } = await uploadFile(file, () => {});
      set({ image: src });
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }
  const vars = (o?.variables || ['name', 'product', 'price', 'coupon', 'discount']).filter((v) => v !== 'link' && v !== 'name');
  const ctaMode = value.cta.path ? 'custom' : 'default';
  const err = (k) => errors[k] && <span className="a-field-error">{errors[k]}</span>;
  return (
    <div className="a-form a-content-form">
      <label><span>Title <small className="a-muted">(bold, optional)</small></span>
        <input value={value.title} onChange={(e) => set({ title: e.target.value })} maxLength={60} placeholder="e.g. New fragrance just arrived ✨" />{err('title')}
      </label>
      <label>Message
        <textarea ref={msg} rows="5" value={value.message} onChange={(e) => set({ message: e.target.value })} maxLength={500} placeholder="e.g. Discover {product}, saffron and oud, now {price}." aria-invalid={!!errors.message} />
        <span className="a-wa-count"><span>“Hello {'{name}'},” is added at the start automatically.</span><span>{value.message.length} / 500</span></span>
        {err('message')}
      </label>
      <div className="a-vars" aria-label="Insert a variable">
        <span className="a-muted">Insert:</span>
        {vars.map((v) => <button type="button" key={v} onClick={() => insert(v)} title={{ product: 'Product name', price: 'Price in the customer’s currency', coupon: 'Coupon code', discount: 'What the coupon takes off, e.g. 10% off' }[v]}>{`{${v}}`}</button>)}
      </div>
      <div className="a-grid2">
        <label><span>Product <small className="a-muted">(optional)</small></span>
          <select value={value.product} onChange={(e) => pickProduct(e.target.value)} aria-invalid={!!errors.product}>
            <option value="">No product</option>
            {o?.products.map((p) => <option key={p.slug} value={p.slug}>{p.name} · {money(p.price?.INR, 'INR')}{p.stock > 0 ? '' : ' · out of stock'}</option>)}
          </select>{err('product')}
        </label>
        <label><span>Coupon <small className="a-muted">(optional)</small></span>
          <select value={value.coupon} onChange={(e) => set({ coupon: e.target.value })} aria-invalid={!!errors.coupon}>
            <option value="">No coupon</option>
            {value.coupon && !o?.coupons.some((c) => c.code === value.coupon) && <option value={value.coupon}>{value.coupon} (not active)</option>}
            {o?.coupons.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.discount}</option>)}
          </select>{err('coupon')}
        </label>
      </div>
      <fieldset className="a-fieldset">
        <legend>Picture <small className="a-muted">(WhatsApp shows JPG or PNG)</small></legend>
        <div className="a-img-pick">
          <button type="button" className={`a-img-none${!value.image ? ' is-on' : ''}`} onClick={() => set({ image: '' })} aria-pressed={!value.image}>No picture</button>
          {(product?.images || []).map((i) => (
            <button type="button" key={i.src} className={`a-img-opt${value.image === i.src ? ' is-on' : ''}${i.ok ? '' : ' is-no'}`} disabled={!i.ok} onClick={() => set({ image: i.src })} aria-pressed={value.image === i.src} title={i.ok ? i.alt : 'WebP: WhatsApp cannot show this one'}>
              <img src={i.src} alt={i.alt} loading="lazy" />{!i.ok && <span>WebP</span>}
            </button>
          ))}
          {value.image && !(product?.images || []).some((i) => i.src === value.image) && (
            <button type="button" className="a-img-opt is-on" aria-pressed="true" title="Uploaded picture"><img src={value.image} alt="Uploaded" /></button>
          )}
          <label className="a-img-up">{uploading ? 'Uploading…' : <>Upload<br />JPG / PNG</>}<input type="file" accept="image/jpeg,image/png" onChange={upload} hidden /></label>
        </div>
        {!product && !value.image && <span className="a-hint">Choose a product to pick one of its pictures, or upload one.</span>}
        {uploadError && <span className="a-field-error">{uploadError}</span>}
        {err('image')}
      </fieldset>
      <div className="a-grid2">
        <label>Button text<input value={value.cta.label} onChange={(e) => set({ cta: { ...value.cta, label: e.target.value } })} maxLength={20} /></label>
        <label>Button opens
          <select value={ctaMode} onChange={(e) => set({ cta: { ...value.cta, path: e.target.value === 'custom' ? '/fragrances' : '' } })}>
            <option value="default">{value.product ? 'The product page' : 'The shop home page'}{value.coupon ? ' (with the coupon)' : ''}</option>
            <option value="custom">Another page on the site…</option>
          </select>
        </label>
      </div>
      {ctaMode === 'custom' && (
        <label>Page address<input value={value.cta.path} onChange={(e) => set({ cta: { ...value.cta, path: e.target.value } })} placeholder="/fragrances/zafreon" dir="ltr" />{err('cta') || <span className="a-hint">A page on albarakah.me, starting with /.</span>}</label>
      )}
      {!value.product && !value.coupon && !value.cta.path && <span className="a-hint">No button: add a product, a coupon or a page to show a Shop Now button.</span>}
    </div>
  );
}

// ----- AI draft panel -----
export function AiPanel({ onDraft, initial = {} }) {
  const o = useOptions();
  const [f, setF] = useState({ brief: '', product: initial.product || '', coupon: initial.coupon || '', tone: 'elegant' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function generate(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onDraft(await api('/admin/whatsapp/templates/generate', { method: 'POST', body: f }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="a-ai" onSubmit={generate}>
      <h3><Icon name="pencil" size={16} /> Write it with AI</h3>
      <div className="a-form">
        <label>What is it about?<textarea rows="2" value={f.brief} onChange={(e) => setF({ ...f, brief: e.target.value })} maxLength={300} placeholder="e.g. Announce that ZAFREON is back in stock, with the welcome offer" required /></label>
        <div className="a-grid3">
          <label>Product<select value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })}><option value="">None</option>{o?.products.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></label>
          <label>Coupon<select value={f.coupon} onChange={(e) => setF({ ...f, coupon: e.target.value })}><option value="">None</option>{o?.coupons.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.discount}</option>)}</select></label>
          <label>Tone<select value={f.tone} onChange={(e) => setF({ ...f, tone: e.target.value })}><option value="elegant">Elegant</option><option value="warm">Warm</option><option value="festive">Festive</option><option value="exclusive">Exclusive</option></select></label>
        </div>
      </div>
      {error && <p className="a-error" role="alert">{error}</p>}
      <div className="a-actions">
        <button className="a-btn a-primary" disabled={busy || !f.brief.trim()}><Icon name="pencil" size={16} /> {busy ? 'Writing…' : 'Generate draft'}</button>
        <span className="a-muted a-hint">The AI only fills in the form below. It never saves or sends, and never sees customer details.</span>
      </div>
    </form>
  );
}

// ----- searchable multi-select of subscribers -----
export function Picker({ selected, setSelected }) {
  const [q, setQ] = useState('');
  const [leadsOnly, setLeadsOnly] = useState(false);
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [q, leadsOnly]);
  useEffect(() => {
    const id = setTimeout(() => {
      api(`/admin/whatsapp/contacts${toQuery({ q, leads: leadsOnly ? '1' : '', page, limit: 20 })}`)
        .then((d) => setData((prev) => (page > 1 && prev ? { ...d, items: [...prev.items, ...d.items] } : d)))
        .catch(() => setData({ items: [], total: 0, pages: 1 }));
    }, 250);
    return () => clearTimeout(id);
  }, [q, leadsOnly, page]);
  const toggle = (c) => setSelected((m) => { const n = new Map(m); n.has(c.id) ? n.delete(c.id) : n.set(c.id, c); return n; });
  const items = data?.items || [];
  return (
    <div className="a-picker">
      <div className="a-picker-top">
        {[...selected.values()].map((c) => (
          <span key={c.id} className="a-chip">{c.name || c.phone}<button type="button" aria-label={`Remove ${c.name || c.phone}`} onClick={() => toggle(c)}><Icon name="close" size={14} /></button></span>
        ))}
        <span className="a-picker-search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or email" aria-label="Search subscribers" /></span>
      </div>
      <div className="a-picker-tools">
        <label className="a-check"><input type="checkbox" checked={leadsOnly} onChange={(e) => setLeadsOnly(e.target.checked)} /> AI leads only</label>
        <span>
          {data ? `${data.total} match${data.total === 1 ? '' : 'es'}` : 'Loading…'}
          {items.length > 0 && <> · <button type="button" className="a-textbtn" onClick={() => setSelected((m) => { const n = new Map(m); items.forEach((c) => n.set(c.id, c)); return n; })}>Select all shown</button></>}
          {selected.size > 0 && <> · <button type="button" className="a-textbtn" onClick={() => setSelected(new Map())}>Clear</button></>}
        </span>
      </div>
      <div className="a-picker-list" role="group" aria-label="Subscribers">
        {data && items.length === 0 && <p className="a-muted a-picker-empty">{q || leadsOnly ? 'No subscribers match.' : 'No subscribers yet. Customers subscribe from their account, the homepage or the AI concierge, after confirming their number.'}</p>}
        {items.map((c) => (
          <label key={c.id} className="a-picker-opt">
            <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c)} aria-label={`Select ${c.name || c.phone}`} />
            <span>{c.name || 'No name'}<small dir="ltr">{c.phone}{c.lead?.interestedProducts?.length ? ` · ${c.lead.interestedProducts.join(', ')}` : ''}</small></span>
            {c.lead ? <span className={`a-pill ${LEAD_TONE(c.lead.score)}`}>Lead {c.lead.score}</span> : <span className="a-pill off">{c.source === 'account' ? 'Account' : 'Website'}</span>}
          </label>
        ))}
        {data && data.page < data.pages && <button type="button" className="a-btn a-picker-more" onClick={() => setPage((p) => p + 1)}>Show more</button>}
      </div>
    </div>
  );
}

// Field errors from a 400 reply, by field.
export const fieldErrors = (err) => Object.fromEntries((err?.data?.errors || []).map((x) => [x.field, x.message]));
