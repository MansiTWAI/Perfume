import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useStore } from '../../context/StoreContext';
import Icon from '../../components/Icon';

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
  const [sure, setSure] = useState(false);
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
    if (!sure) return setSure(true);
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
          <button className="a-btn a-danger" disabled={!!busy} onClick={remove} onBlur={() => setSure(false)}>{sure ? 'Click again to delete' : 'Delete'}</button>
        </div>
      </div>
    </article>
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
  const fileRef = useRef(null);

  useEffect(() => {
    api('/admin/banners')
      .then((all) => setList(all.filter((b) => b.placement === 'app').map((b) => ({ ...b, imageUrl: b.image }))))
      .catch((e) => { setLoadError(e.message); setList([]); });
  }, []);

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

  return (
    <div>
      <header className="a-head">
        <h1>App banners</h1>
        <span className="a-muted">Shown at the top of the mobile app store, in order. Images must be exactly {W} × {H} pixels.</span>
      </header>

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

      {loadError && <p className="a-error" role="alert">{loadError}</p>}
      {!list ? <p>Loading…</p> : (
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
