import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useStore } from '../../context/StoreContext';
import Icon from '../../components/Icon';
import { confirm, EmptyState, LoadError } from './ui';

// Store banners for the mobile app (GET /api/banners). Images must be exactly
// 1080 × 540; the server checks it again. Until one is uploaded, the app shows
// the default house banner.
const W = 1080;
const H = 540;
const DEFAULT_IMAGE = '/media/banners/app-banner-1.jpg';

const toDay = (d) => {
  if (!d) return '';
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const fromDay = (s, end) => (s ? new Date(`${s}T${end ? '23:59:59' : '00:00:00'}`).toISOString() : '');

// Live, hidden, scheduled or ended, as the app sees it now.
function stateOf(b, now = new Date()) {
  if (!b.active) return ['Hidden', ''];
  if (b.startsAt && new Date(b.startsAt) > now) return ['Scheduled', 'warn'];
  if (b.endsAt && new Date(b.endsAt) < now) return ['Ended', ''];
  return ['Live in the app', 'ok'];
}

// Reads the picture's real size in the browser before uploading.
function readSize(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight, url }); };
    img.onerror = () => resolve({ width: 0, height: 0, url });
    img.src = url;
  });
}
async function pick(file) {
  if (!file) return { error: '' };
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return { error: 'Choose a JPG, PNG or WebP image.' };
  if (file.size > 4 * 1024 * 1024) return { error: 'That image is larger than 4 MB. Please export a smaller one.' };
  const size = await readSize(file);
  if (size.width !== W || size.height !== H) return { error: `The banner must be exactly ${W} × ${H} pixels; this image is ${size.width} × ${size.height}.`, preview: size.url };
  return { file, preview: size.url };
}

const EMPTY = { title: '', subtitle: '', link: '/fragrances', buttonLabel: 'Shop now', sortOrder: '0', active: true, startsAt: '', endsAt: '' };
const fieldsOf = (b) => ({ title: b.title || '', subtitle: b.subtitle || '', link: b.link || '', buttonLabel: b.buttonLabel || '', sortOrder: String(b.sortOrder ?? 0), active: b.active !== false, startsAt: toDay(b.startsAt), endsAt: toDay(b.endsAt) });

function Fields({ f, set }) {
  const on = (k) => (e) => set({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  return (
    <>
      <div className="a-grid2">
        <label>Title<input value={f.title} onChange={on('title')} maxLength={120} placeholder="Two signatures. One house." /></label>
        <label>Subtitle<input value={f.subtitle} onChange={on('subtitle')} maxLength={240} placeholder="Optional" /></label>
      </div>
      <div className="a-grid2">
        <label>Opens in the app<input value={f.link} onChange={on('link')} maxLength={500} placeholder="/fragrances/zafreon" dir="ltr" /><span className="a-hint">A page of the store, e.g. /fragrances or /fragrances/zafreon.</span></label>
        <label>Button text<input value={f.buttonLabel} onChange={on('buttonLabel')} maxLength={40} placeholder="Shop now" /></label>
      </div>
      <div className="a-grid3">
        <label>Order<input type="number" value={f.sortOrder} onChange={on('sortOrder')} /><span className="a-hint">Lower shows first.</span></label>
        <label>Starts<input type="date" value={f.startsAt} onChange={on('startsAt')} /><span className="a-hint">Empty = now.</span></label>
        <label>Ends<input type="date" value={f.endsAt} onChange={on('endsAt')} /><span className="a-hint">Empty = no end.</span></label>
      </div>
      <label className="a-check"><input type="checkbox" checked={f.active} onChange={on('active')} /> Show in the app</label>
    </>
  );
}
const payload = (f) => ({ ...f, sortOrder: parseInt(f.sortOrder, 10) || 0, startsAt: fromDay(f.startsAt, false) || null, endsAt: fromDay(f.endsAt, true) || null });

function BannerCard({ b, onSaved, onDeleted }) {
  const { toast } = useStore();
  const [f, setF] = useState(() => fieldsOf(b));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const [label, tone] = stateOf(b);
  const changed = JSON.stringify(f) !== JSON.stringify(fieldsOf(b));

  async function save() {
    setBusy('save');
    setError('');
    try {
      onSaved(await api(`/admin/banners/${b._id}`, { method: 'PUT', body: payload(f) }));
      toast('Banner saved');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }
  async function replace(file) {
    const p = await pick(file);
    if (fileRef.current) fileRef.current.value = '';
    if (p.error || !p.file) return setError(p.error || '');
    setBusy('image');
    setError('');
    try {
      const form = new FormData();
      form.append('file', p.file);
      onSaved(await api(`/admin/banners/${b._id}/image`, { method: 'POST', form }));
      toast('Image replaced');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }
  async function remove() {
    if (!(await confirm({ title: `Delete ${b.title ? `“${b.title}”` : 'this banner'}?`, message: 'It disappears from the app straight away. This cannot be undone.', confirmLabel: 'Delete banner', cancelLabel: 'Keep it', danger: true }))) return;
    setBusy('delete');
    try {
      await api(`/admin/banners/${b._id}`, { method: 'DELETE' });
      onDeleted(b._id);
      toast('Banner deleted');
    } catch (e) {
      setError(e.message);
      setBusy('');
    }
  }

  return (
    <article className="a-panel a-banner">
      <div className="a-banner-media">
        <img src={b.imageUrl || b.image} alt={b.title || 'Banner'} width={W} height={H} loading="lazy" />
        <span className={`a-pill ${tone}`}>{label}</span>
      </div>
      <div className="a-form">
        <Fields f={f} set={setF} />
        {error && <p className="a-error" role="alert">{error}</p>}
        <div className="a-actions">
          <button className="a-btn a-primary" disabled={!changed || !!busy} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
          <label className="a-btn a-file">
            {busy === 'image' ? 'Uploading…' : 'Replace image'}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" disabled={!!busy} onChange={(e) => replace(e.target.files?.[0])} />
          </label>
          <button className="a-btn a-danger" disabled={!!busy} onClick={remove}>Delete</button>
        </div>
      </div>
    </article>
  );
}

// How the app's store screen shows the banners: one at a time, swiping, in
// order. `draft` is the banner being uploaded, shown first so it can be judged.
function PhoneMock({ banners, draft }) {
  const slides = [...(draft ? [draft] : []), ...banners];
  const [i, setI] = useState(0);
  useEffect(() => { if (i >= slides.length) setI(0); }, [slides.length, i]);
  const b = slides[i] || { image: DEFAULT_IMAGE, title: '', subtitle: '', buttonLabel: '' };
  return (
    <figure className="a-app-phone" aria-label="Preview in the mobile app">
      <div className="a-app-screen">
        <div className="a-app-bar"><span>9:41</span><b>AL BARAKAH</b><span aria-hidden="true">● ● ●</span></div>
        <div className="a-app-banner">
          <img src={b.imageUrl || b.image || DEFAULT_IMAGE} alt="" />
          {(b.title || b.subtitle || b.buttonLabel) && (
            <div className="a-app-copy">
              {b.title && <b>{b.title}</b>}
              {b.subtitle && <span>{b.subtitle}</span>}
              {b.buttonLabel && <em>{b.buttonLabel}</em>}
            </div>
          )}
        </div>
        {slides.length > 1 && (
          <div className="a-app-dots" role="tablist" aria-label="Banners">
            {slides.map((x, n) => <button key={x._id || 'draft'} type="button" role="tab" aria-selected={n === i} aria-label={`Banner ${n + 1}${x === draft ? ' (new)' : ''}`} className={n === i ? 'is-on' : ''} onClick={() => setI(n)} />)}
          </div>
        )}
        <div className="a-app-shelf" aria-hidden="true"><i /><i /><i /><i /></div>
      </div>
      <figcaption className="a-muted">{draft && i === 0 ? 'Your new banner (not saved yet)' : slides.length ? `Banner ${i + 1} of ${slides.length} as the app shows it` : 'The default banner'}</figcaption>
    </figure>
  );
}

// Drag a card (or use the arrows) to change the order the app shows them in.
function OrderList({ list, onMove, busy }) {
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  return (
    <ol className="a-order-list">
      {list.map((b, n) => {
        const [label, tone] = stateOf(b);
        return (
          <li
            key={b._id}
            draggable={!busy}
            onDragStart={(e) => { setDrag(n); e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(e) => { e.preventDefault(); setOver(n); }}
            onDragLeave={() => setOver((x) => (x === n ? null : x))}
            onDrop={(e) => { e.preventDefault(); if (drag !== null && drag !== n) onMove(drag, n); setDrag(null); setOver(null); }}
            onDragEnd={() => { setDrag(null); setOver(null); }}
            className={`${drag === n ? 'is-drag' : ''}${over === n && drag !== n ? ' is-over' : ''}`}
          >
            <span className="a-grip" aria-hidden="true"><Icon name="grip" size={18} /></span>
            <span className="a-order-n">{n + 1}</span>
            <img src={b.imageUrl || b.image} alt="" />
            <span className="a-order-t"><b>{b.title || 'Untitled banner'}</b><small className={`a-pill ${tone}`}>{label}</small></span>
            <span className="a-order-btns">
              <button type="button" disabled={busy || n === 0} onClick={() => onMove(n, n - 1)} aria-label={`Move ${b.title || 'banner'} up`}><Icon name="arrow-up" size={16} /></button>
              <button type="button" disabled={busy || n === list.length - 1} onClick={() => onMove(n, n + 1)} aria-label={`Move ${b.title || 'banner'} down`}><Icon name="arrow-down" size={16} /></button>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function Banners() {
  const { toast } = useStore();
  const [list, setList] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [f, setF] = useState(EMPTY);
  const [chosen, setChosen] = useState({ file: null, preview: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [tick, setTick] = useState(0);
  const fileRef = useRef(null);

  useEffect(() => {
    setLoadError('');
    api('/admin/banners')
      .then((all) => setList(all.filter((b) => b.placement === 'app').map((b) => ({ ...b, imageUrl: b.image }))))
      .catch((e) => { setLoadError(e.message); setList([]); });
  }, [tick]);

  // New order: 10, 20, 30… saved for each banner whose place changed.
  async function move(from, to) {
    const next = [...list];
    const [b] = next.splice(from, 1);
    next.splice(to, 0, b);
    const numbered = next.map((x, n) => ({ ...x, sortOrder: (n + 1) * 10 }));
    const changed = numbered.filter((x) => list.find((y) => y._id === x._id)?.sortOrder !== x.sortOrder);
    setList(numbered);
    setOrdering(true);
    try {
      await Promise.all(changed.map((x) => api(`/admin/banners/${x._id}`, { method: 'PUT', body: { sortOrder: x.sortOrder } })));
      toast('Order saved');
      setTick((n) => n + 1); // the cards below show the new order numbers
    } catch (e) {
      toast(`The new order was not saved: ${e.message}`, 'warn');
      setTick((n) => n + 1);
    } finally {
      setOrdering(false);
    }
  }

  async function choose(file) {
    setError('');
    const p = await pick(file);
    setChosen({ file: p.file || null, preview: p.preview || '' });
    if (p.error) setError(p.error);
  }

  async function upload(e) {
    e.preventDefault();
    if (!chosen.file) return setError(`Choose a ${W} × ${H} image first.`);
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      const body = payload(f);
      for (const [k, v] of Object.entries(body)) if (v !== null && v !== '') form.append(k, String(v));
      form.append('placement', 'app');
      form.append('file', chosen.file);
      const b = await api('/admin/banners/upload', { method: 'POST', form });
      setList((l) => [...(l || []), b].sort((x, y) => (x.sortOrder || 0) - (y.sortOrder || 0)));
      setF(EMPTY);
      setChosen({ file: null, preview: '' });
      if (fileRef.current) fileRef.current.value = '';
      toast(b.warning || 'Banner uploaded');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const live = (list || []).filter((b) => stateOf(b)[1] === 'ok');
  const draft = chosen.preview && !error ? { image: chosen.preview, title: f.title, subtitle: f.subtitle, buttonLabel: f.buttonLabel } : null;

  return (
    <div>
      <header className="a-head">
        <h1>App banners</h1>
        <span className="a-muted">Shown at the top of the mobile app store, in order. Images must be exactly {W} × {H} pixels.</span>
      </header>

      <div className="a-banner-top">
        <section className="a-panel">
          <div className="a-section-head"><h2>Order in the app</h2>{ordering && <small className="a-muted">Saving…</small>}</div>
          {loadError && <LoadError message={loadError} onRetry={() => setTick((n) => n + 1)} />}
          {!list ? <p className="a-muted">Loading…</p> : list.length ? (
            <>
              <OrderList list={list} onMove={move} busy={ordering} />
              <p className="a-muted a-hint" style={{ marginTop: 10 }}>Drag a banner, or use the arrows, to change the order. Hidden, scheduled and ended banners keep their place but are not shown.</p>
            </>
          ) : <EmptyState icon="grid" title="No banners yet">The app shows the default house banner until you upload one below.</EmptyState>}
        </section>
        <section className="a-panel a-phone-panel">
          <h2>Phone preview</h2>
          <PhoneMock banners={live} draft={draft} />
        </section>
      </div>

      <form className="a-panel a-banner a-banner-new" onSubmit={upload}>
        <div className="a-banner-media">
          {chosen.preview ? <img src={chosen.preview} alt="Chosen banner" width={W} height={H} /> : (
            <div className="a-banner-drop"><Icon name="plus" size={22} /><span>{W} × {H} JPG, PNG or WebP, up to 4 MB</span></div>
          )}
          <label className="a-btn a-file a-banner-choose">
            {chosen.file ? 'Choose another' : 'Choose image'}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => choose(e.target.files?.[0])} />
          </label>
        </div>
        <div className="a-form">
          <h3>New banner</h3>
          <Fields f={f} set={setF} />
          {error && <p className="a-error" role="alert">{error}</p>}
          <div className="a-actions">
            <button className="a-btn a-primary" disabled={busy || !chosen.file}>{busy ? 'Uploading…' : 'Upload banner'}</button>
          </div>
        </div>
      </form>

      {!list ? null : (
        <>
          {!live.length && (
            <section className="a-panel a-banner">
              <div className="a-banner-media">
                <img src={DEFAULT_IMAGE} alt="Default house banner" width={W} height={H} />
                <span className="a-pill">Default</span>
              </div>
              <div className="a-form">
                <h3>The app is showing the default banner</h3>
                <p className="a-muted">It appears until one of your banners is live. Upload one above to replace it.</p>
              </div>
            </section>
          )}
          {list.map((b) => (
            <BannerCard
              key={`${b._id}-${b.updatedAt}`}
              b={b}
              onSaved={(nb) => setList((l) => l.map((x) => (x._id === nb._id ? { ...nb, imageUrl: nb.imageUrl || nb.image } : x)).sort((x, y) => (x.sortOrder || 0) - (y.sortOrder || 0)))}
              onDeleted={(id) => setList((l) => l.filter((x) => x._id !== id))}
            />
          ))}
        </>
      )}
    </div>
  );
}
