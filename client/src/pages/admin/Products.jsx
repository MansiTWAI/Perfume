import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import { useStore } from '../../context/StoreContext';
import { clearApiCache } from '../../hooks/useApi';
import { CsvInput, ImageField, PhotoGallery, RowList } from './Fields';
import Icon from '../../components/Icon';
import { confirm, EmptyState, LoadError } from './ui';
import { sizesOf } from '../../lib/sizes';

// Rupees per dirham. The shop prices the UAE a little above the exchange rate
// on purpose (₹1,250 / AED 100), so only clear outliers are flagged; the
// server applies the same range.
const AED_RATE = 23;
export function aedHint(inr, aed) {
  if (!inr || !aed) return '';
  const rate = inr / aed;
  if (rate >= 9 && rate <= 40) return '';
  if (rate < 5 || rate > 80) return `This will not save: AED ${aed} cannot be right for ₹${inr} (about AED ${Math.round(inr / AED_RATE)}). Check each price is in its own box.`;
  return `AED ${aed} is unusually ${rate < 9 ? 'high' : 'low'} for ₹${inr}. Check both prices.`;
}

// Editable rows for a fragrance's other sizes (its own size is the product itself).
const sizeRows = (p) => (sizesOf(p) || []).filter((s) => s.slug !== p.slug).map((s) => ({
  _id: s._id, sizeMl: s.sizeMl ?? '', sizeLabel: s.sizeLabel || '', inr: s.price?.INR ?? '', aed: s.price?.AED ?? '', stock: s.stock ?? '',
}));

const stockState = (p) => (p.stock <= 0 ? ['Out of stock', 'bad'] : p.stock <= 5 ? [`Low · ${p.stock} left`, 'warn'] : [`${p.stock} in stock`, '']);

const EMPTY = {
  name: '', slug: '', subtitle: 'Eau de Parfum', tagline: '', family: '', description: '', story: '',
  sizeMl: 100, sizeLabel: '100 ML / 3.4 FL.OZ.', price: { INR: 0, AED: 0 }, stock: 0, category: 'Fragrances',
  badge: '', theme: 'ivory', images: [], video: { src: '', poster: '' },
  render: { src: '', width: 0, height: 0 },
  ar: { tagline: '', family: '', description: '', story: '', howToWear: '', howToStore: '', occasions: [], includes: [] },
  notes: { top: [], heart: [], base: [], approved: false }, wear: [], mood: [], occasions: [],
  howToWear: '', howToStore: '', faq: [], includes: [], featured: false, published: false, sortOrder: 10,
  seo: { title: '', description: '' },
};

export function ProductList() {
  const { toast } = useStore();
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState(params.get('q') || '');
  const [tick, setTick] = useState(0);
  const stock = params.get('stock') || '';
  const status = params.get('status') || '';
  useEffect(() => {
    setError('');
    api('/products?all=1').then(setList).catch((e) => { setError(e.message); setList([]); });
  }, [tick]);
  const go = (k, v) => setParams((prev) => { const n = new URLSearchParams(prev); if (v) n.set(k, v); else n.delete(k); return n; });
  const shown = useMemo(() => {
    const text = q.trim().toLowerCase();
    return (list || []).filter((p) => (!text || [p.name, p.slug, p.family, p.category].some((x) => String(x || '').toLowerCase().includes(text)))
      && (!stock || (stock === 'out' ? p.stock <= 0 : stock === 'low' ? p.stock > 0 && p.stock <= 5 : p.stock > 5))
      && (!status || (status === 'live') === !!p.published));
  }, [list, q, stock, status]);
  const outLive = (list || []).filter((p) => p.published && p.stock <= 0).length;

  async function remove(p) {
    if (!(await confirm({ title: `Delete ${p.name}?`, message: 'The product and its page are removed for good. Orders that included it keep their copy of the item.', confirmLabel: 'Delete product', cancelLabel: 'Keep it', danger: true }))) return;
    try {
      await api(`/products/${p._id}`, { method: 'DELETE' });
      clearApiCache();
      setList((l) => l.filter((x) => x._id !== p._id));
      toast(`${p.name} deleted`);
    } catch (e) {
      toast(e.message, 'warn');
    }
  }

  return (
    <div>
      <header className="a-head"><h1>Products</h1><Link to="/admin/products/new" className="a-btn a-primary"><Icon name="plus" size={16} /> New product</Link></header>
      {outLive > 0 && !stock && (
        <p className="a-note"><Icon name="alert" size={16} /><span>{outLive} live product{outLive === 1 ? ' is' : 's are'} out of stock: shoppers see it but cannot buy. <button type="button" className="a-textbtn" onClick={() => go('stock', 'out')}>Show {outLive === 1 ? 'it' : 'them'}</button></span></p>
      )}
      <section className="a-filters">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, family or category" aria-label="Search products" />
        <select value={stock} onChange={(e) => go('stock', e.target.value)} aria-label="Stock">
          <option value="">All stock</option><option value="out">Out of stock</option><option value="low">Low stock (1–5)</option><option value="in">In stock</option>
        </select>
        <select value={status} onChange={(e) => go('status', e.target.value)} aria-label="Visibility">
          <option value="">Live and hidden</option><option value="live">Live only</option><option value="hidden">Hidden only</option>
        </select>
        {(q || stock || status) && <button type="button" className="a-link" onClick={() => { setQ(''); setParams({}); }}>Clear filters</button>}
      </section>
      <section className="a-panel">
        {error && <LoadError message={error} onRetry={() => setTick((n) => n + 1)} />}
        {!list ? <p className="a-muted">Loading…</p> : shown.length === 0 ? (
          !error && (list.length
            ? <EmptyState icon="search" title="No products match">Try another search or filter.</EmptyState>
            : <EmptyState icon="package" title="No products yet" action="Add the first product" to="/admin/products/new">Add photos, a name, the price and the notes; everything else is optional.</EmptyState>)
        ) : (
          <div className="a-table-wrap a-sticky-head"><table className="a-table">
            <thead><tr><th /><th>Name</th><th>Price</th><th>Stock</th><th>Notes</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {shown.map((p) => {
                const sizes = sizesOf(p);
                const [stockLabel, tone] = stockState(sizes ? { stock: sizes.reduce((n, s) => n + (s.stock || 0), 0) } : p);
                const hint = aedHint(p.price?.INR, p.price?.AED);
                const lowest = sizes && Math.min(...sizes.map((s) => s.price?.INR || Infinity));
                return (
                  <tr key={p._id}>
                    <td>{p.images?.[0]?.src ? <img src={p.images[0].src} alt="" className="a-thumb" /> : <span className="a-thumb a-thumb-empty" aria-hidden="true" />}</td>
                    <td><Link to={`/admin/products/${p._id}`} className="a-row-link">{p.name}</Link><small>/fragrances/{p.slug}</small></td>
                    <td>{sizes ? <>From {money(lowest, 'INR')}<br /><small>{sizes.length} sizes: {sizes.map((s) => `${s.sizeMl} ml`).join(', ')}</small></> : <>{money(p.price?.INR, 'INR')}<br /><small>{p.price?.AED ? money(p.price.AED, 'AED') : 'No AED price'}</small></>}{hint && <><br /><small className="a-warn" title={hint}>Check AED price</small></>}</td>
                    <td><span className={`a-pill ${tone}`}>{stockLabel}</span></td>
                    <td>{p.notes?.top?.length ? (p.notes.approved ? <span className="a-pill ok">Approved</span> : <span className="a-pill warn">Awaiting approval</span>) : '—'}</td>
                    <td>{!p.published ? <span className="a-pill off">Hidden</span> : p.stock <= 0 ? <span className="a-pill warn" title="Shown in the store as Sold out; it cannot be ordered until restocked">Live · Sold out</span> : <span className="a-pill ok">Live</span>}</td>
                    <td className="a-cell-action">
                      <Link to={`/admin/products/${p._id}`} className="a-btn a-quiet">Edit</Link>
                      <button type="button" className="a-btn a-quiet a-danger-text" onClick={() => remove(p)} aria-label={`Delete ${p.name}`}><Icon name="trash" size={16} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}

// Notes as one comma-separated line per tier. Existing descriptions and
// pictures are kept for any note whose name stays the same.
const noteNames = (list) => (list || []).map((n) => n.name);
// Notes keep their description and image when only the list around them changes.
const toNotes = (names, old = []) =>
  names.map((name) => old.find((n) => n.name.toLowerCase() === name.toLowerCase()) || { name, description: '', image: '' });

// A new product needs photos, a name, a price and its notes; everything else
// is folded under "More details".
export function ProductEdit() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { toast } = useStore();
  const [p, setP] = useState(isNew ? EMPTY : null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Other sizes of this fragrance: { _id?, sizeMl, sizeLabel, inr, aed, stock }.
  const [extra, setExtra] = useState([]);
  const [removed, setRemoved] = useState([]);

  // Reset whenever the address changes, so "New product" never inherits the
  // product that was open before.
  useEffect(() => {
    setConfirmDelete(false);
    setRemoved([]);
    if (isNew) {
      setExtra([]);
      return setP(EMPTY);
    }
    setP(null);
    api('/products?all=1').then((all) => {
      const found = all.find((x) => x._id === id);
      setExtra(sizeRows(found));
      setP({ ...EMPTY, ...found });
    });
  }, [id, isNew]);

  if (!p) return <p>Loading…</p>;
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const setIn = (k, sub, v) => setP((x) => ({ ...x, [k]: { ...x[k], [sub]: v } }));
  // The floating bottle's proportions come from the image itself.
  const setRender = (src) => {
    if (!src) return set('render', { src: '', width: 0, height: 0 });
    const img = new Image();
    img.onload = () => set('render', { src, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => set('render', { src, width: 0, height: 0 });
    img.src = src;
  };

  async function save(e) {
    e.preventDefault();
    if (!p.name.trim()) return toast('Give the product a name.', 'warn');
    if (!(p.price?.INR > 0)) return toast('Enter the price in ₹.', 'warn');
    if (p.published && !p.images?.length) return toast('Add at least one photo before making the product visible.', 'warn');
    setBusy(true);
    // Photos describe themselves from the product name unless alt text was written.
    const body = { ...p, images: (p.images || []).map((img, i) => ({ ...img, alt: img.alt || `${p.name}${i ? `, photo ${i + 1}` : ''}` })) };
    try {
      const saved = await api(isNew ? '/products' : `/products/${id}`, { method: isNew ? 'POST' : 'PUT', body });
      const sizeProblem = await saveSizes(saved, body);
      clearApiCache();
      const warning = sizeProblem || saved.warnings?.[0];
      toast(warning ? `Saved. ${warning}` : 'Product saved', warning ? 'warn' : undefined);
      if (isNew) navigate(`/admin/products/${saved._id}`, { replace: true });
      else {
        const fresh = (await api('/products?all=1')).find((x) => x._id === saved._id);
        setExtra(sizeRows(fresh));
        setRemoved([]);
        setP({ ...EMPTY, ...(fresh || saved), warnings: undefined });
      }
    } catch (err) {
      toast(/duplicate|E11000|slug/i.test(err.message) ? 'A product with this name already exists. Change the name, or the web address under More details.' : err.message, 'warn');
    } finally {
      setBusy(false);
    }
  }

  // Each other size is a product of its own that shares this fragrance's
  // name, photos and story; only its size, price and stock differ.
  async function saveSizes(saved, body) {
    const shared = {
      name: saved.name, subtitle: saved.subtitle, tagline: saved.tagline, family: saved.family, description: saved.description,
      story: saved.story, images: body.images, notes: saved.notes, theme: saved.theme, category: saved.category,
      gender: saved.gender, published: saved.published, ar: saved.ar, sizeOf: saved.slug,
    };
    const problems = [];
    for (const r of extra) {
      const ml = Number(r.sizeMl);
      if (!(ml > 0) || !(Number(r.inr) > 0)) {
        problems.push(`a size without ${ml > 0 ? 'a ₹ price' : 'its ml'} was not saved`);
        continue;
      }
      const one = {
        ...shared, sizeMl: ml, sizeLabel: r.sizeLabel?.trim() || `${ml} ML`,
        price: { INR: Number(r.inr), AED: Number(r.aed) || 0 }, stock: Math.max(0, Number(r.stock) || 0),
      };
      try {
        if (r._id) await api(`/products/${r._id}`, { method: 'PUT', body: one });
        else await api('/products', { method: 'POST', body: { ...one, slug: `${saved.slug}-${ml}ml` } });
      } catch (err) {
        problems.push(`${ml} ml: ${/duplicate|E11000/i.test(err.message) ? 'that size already exists' : err.message}`);
      }
    }
    for (const rid of removed) await api(`/products/${rid}`, { method: 'DELETE' }).catch(() => problems.push('a removed size could not be deleted'));
    return problems.length ? `Sizes: ${problems.join('; ')}.` : '';
  }

  async function remove() {
    await api(`/products/${id}`, { method: 'DELETE' });
    clearApiCache();
    toast('Product deleted');
    navigate('/admin/products');
  }

  const setNoteDescription = (tier, i, description) =>
    setIn('notes', tier, p.notes[tier].map((x, j) => (j === i ? { ...x, description } : x)));

  return (
    <form onSubmit={save} className="a-product">
      <header className="a-head">
        <h1>{isNew ? 'New product' : p.name}</h1>
        <div className="a-actions">
          {!isNew && <a href={`/fragrances/${p.slug}`} target="_blank" rel="noreferrer" className="a-btn">View <Icon name="external" size={14} /></a>}
          <button className="a-btn a-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </header>

      <div className="a-edit">
        <div className="a-col">
          <section className="a-panel a-form">
            <h2>Photos</h2>
            <PhotoGallery images={p.images} onChange={(images) => set('images', images)} />
          </section>

          <section className="a-panel a-form">
            <h2>Details</h2>
            <label>Name *<input required value={p.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. ZAFREON" /></label>
            <div className="a-grid3">
              <label>Price ₹ (incl. GST) *<input type="number" min="0" required value={p.price?.INR || ''} onChange={(e) => setIn('price', 'INR', +e.target.value)} /></label>
              <label>Price AED (incl. VAT)<input type="number" min="0" value={p.price?.AED || ''} onChange={(e) => setIn('price', 'AED', +e.target.value)} aria-invalid={!!aedHint(p.price?.INR, p.price?.AED)} />{aedHint(p.price?.INR, p.price?.AED) && <span className="a-field-error">{aedHint(p.price?.INR, p.price?.AED)}</span>}</label>
              <label>Stock<input type="number" min="0" value={p.stock || ''} placeholder="0" onChange={(e) => set('stock', +e.target.value)} /></label>
            </div>
            <div className="a-grid2">
              <label>Fragrance family<input value={p.family} onChange={(e) => set('family', e.target.value)} placeholder="e.g. Oriental Woody Oud" /></label>
              <div className="a-grid2">
                <label>Size (ml)<input type="number" min="1" value={p.sizeMl || ''} onChange={(e) => set('sizeMl', +e.target.value)} /></label>
                <label>Size label<input value={p.sizeLabel} onChange={(e) => set('sizeLabel', e.target.value)} /></label>
              </div>
            </div>
            <label>Short description<textarea rows="3" value={p.description} onChange={(e) => set('description', e.target.value)} placeholder="Two or three sentences shown on the product page." /></label>
          </section>

          <section className="a-panel a-form">
            <h2>Other sizes</h2>
            <p className="a-muted a-hint">The price and stock above are for the {p.sizeMl || '…'} ml bottle. Add each other size customers can choose on the product page; each has its own price and stock.</p>
            {extra.length > 0 && (
              <div className="a-table-wrap"><table className="a-table a-sizes">
                <thead><tr><th>Size (ml)</th><th>Label</th><th>Price ₹</th><th>Price AED</th><th>Stock</th><th><span className="sr-only">Remove</span></th></tr></thead>
                <tbody>
                  {extra.map((r, i) => {
                    const edit = (k) => (e) => setExtra((rows) => rows.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)));
                    const hint = aedHint(Number(r.inr), Number(r.aed));
                    return (
                      <tr key={r._id || `new-${i}`}>
                        <td><input type="number" min="1" value={r.sizeMl} onChange={edit('sizeMl')} aria-label="Size in ml" /></td>
                        <td><input value={r.sizeLabel} onChange={edit('sizeLabel')} placeholder={r.sizeMl ? `${r.sizeMl} ML` : 'e.g. 10 ML'} aria-label="Size label" /></td>
                        <td><input type="number" min="0" value={r.inr} onChange={edit('inr')} aria-label="Price in rupees" /></td>
                        <td><input type="number" min="0" value={r.aed} onChange={edit('aed')} aria-label="Price in dirhams" aria-invalid={!!hint} title={hint || undefined} />{hint && <small className="a-field-error">{hint}</small>}</td>
                        <td><input type="number" min="0" value={r.stock} onChange={edit('stock')} aria-label="Stock" /></td>
                        <td><button type="button" className="a-btn a-quiet a-danger-text" onClick={() => { if (r._id) setRemoved((x) => [...x, r._id]); setExtra((rows) => rows.filter((_, j) => j !== i)); }} aria-label={`Remove ${r.sizeMl || 'this'} ml`}><Icon name="trash" size={16} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )}
            <div><button type="button" className="a-btn" onClick={() => setExtra((rows) => [...rows, { sizeMl: '', sizeLabel: '', inr: '', aed: '', stock: '' }])}><Icon name="plus" size={16} /> Add a size</button></div>
            {removed.length > 0 && <p className="a-muted a-hint">Removed sizes are deleted when you save.</p>}
          </section>

          <section className="a-panel a-form">
            <h2>Notes</h2>
            <p className="a-muted">Separate notes with commas.</p>
            <label>Top notes<CsvInput value={noteNames(p.notes?.top)} onChange={(names) => setIn('notes', 'top', toNotes(names, p.notes?.top))} placeholder="Saffron, Cardamom, Black Pepper" /></label>
            <label>Heart notes<CsvInput value={noteNames(p.notes?.heart)} onChange={(names) => setIn('notes', 'heart', toNotes(names, p.notes?.heart))} placeholder="Frankincense, Damask Rose" /></label>
            <label>Base notes<CsvInput value={noteNames(p.notes?.base)} onChange={(names) => setIn('notes', 'base', toNotes(names, p.notes?.base))} placeholder="Oud, Amber, Smoked Woods" /></label>
          </section>

          <details className="a-panel a-more">
            <summary>More details <span className="a-muted">optional: bottle image, story, Arabic, SEO and more</span></summary>
            <div className="a-form">
              <h3>Floating bottle</h3>
              <ImageField value={p.render?.src} onChange={setRender} label="Bottle on a transparent background" hint="PNG or WebP without a background, used on the home page. Without one, the main photo is used." />
              {p.render?.src && !p.render.width && <p className="a-error">This image could not be read. Upload it again.</p>}

              <h3>Text</h3>
              <div className="a-grid2">
                <label>Tagline<input value={p.tagline} onChange={(e) => set('tagline', e.target.value)} /></label>
                <label>Subtitle<input value={p.subtitle} onChange={(e) => set('subtitle', e.target.value)} /></label>
                <label>Badge<input value={p.badge} onChange={(e) => set('badge', e.target.value)} placeholder="e.g. New" /></label>
                <label>Web address<input value={p.slug} onChange={(e) => set('slug', e.target.value)} placeholder="made from the name" /></label>
              </div>
              <label>Story<textarea rows="5" value={p.story} onChange={(e) => set('story', e.target.value)} /></label>

              <h3>Note descriptions</h3>
              <label className="a-check"><input type="checkbox" checked={!!p.notes?.approved} onChange={(e) => setIn('notes', 'approved', e.target.checked)} /> Notes approved against the perfumer’s final specification</label>
              {['top', 'heart', 'base'].map((t) => (p.notes?.[t]?.length ? (
                <div key={t} className="a-sub">
                  <h4>{t[0].toUpperCase() + t.slice(1)}</h4>
                  {p.notes[t].map((n, i) => (
                    <label key={n.name}>{n.name}<input value={n.description || ''} placeholder="What it brings (optional)" onChange={(e) => setNoteDescription(t, i, e.target.value)} /></label>
                  ))}
                </div>
              ) : null))}

              <h3>Page</h3>
              <div className="a-grid3">
                <label>Category<input value={p.category} onChange={(e) => set('category', e.target.value)} /></label>
                <label>Page colours
                  <select value={p.theme} onChange={(e) => set('theme', e.target.value)}>
                    <option value="ivory">Ivory (like ELARISSE)</option><option value="onyx">Black (like ZAFREON)</option><option value="duo">Burgundy (like the Duo)</option>
                  </select>
                </label>
                <label>Sort order<input type="number" value={p.sortOrder} onChange={(e) => set('sortOrder', +e.target.value)} /></label>
              </div>

              <h3>How it wears</h3>
              <RowList rows={p.wear} onChange={(rows) => set('wear', rows)} fields={[['time', 'Stage'], ['label', 'Word'], ['text', 'Description', 'textarea']]} addLabel="Add stage" />

              <h3>Care &amp; questions</h3>
              <label>How to wear<textarea rows="3" value={p.howToWear} onChange={(e) => set('howToWear', e.target.value)} /></label>
              <label>How to store<textarea rows="3" value={p.howToStore} onChange={(e) => set('howToStore', e.target.value)} /></label>
              <RowList rows={p.faq} onChange={(rows) => set('faq', rows)} fields={[['q', 'Question'], ['a', 'Answer', 'textarea']]} addLabel="Add question" />

              <h3>Film</h3>
              <ImageField value={p.video?.src} onChange={(src) => setIn('video', 'src', src)} label="Video" kind="video" />
              <ImageField value={p.video?.poster} onChange={(src) => setIn('video', 'poster', src)} label="Video cover image" />

              <h3>Tags</h3>
              <label>Mood words (comma separated)<CsvInput value={p.mood} onChange={(v) => set('mood', v)} /></label>
              <label>Occasions<CsvInput value={p.occasions} onChange={(v) => set('occasions', v)} /></label>
              <label>What is included<CsvInput value={p.includes} onChange={(v) => set('includes', v)} /></label>

              <h3>Arabic</h3>
              <p className="a-muted">Shown to visitors browsing in Arabic. Leave a field empty to use the English text.</p>
              <div dir="rtl" lang="ar" className="a-rtl">
                <div className="a-grid2">
                  <label>الشعار (Tagline)<input value={p.ar?.tagline || ''} onChange={(e) => setIn('ar', 'tagline', e.target.value)} /></label>
                  <label>العائلة العطرية (Family)<input value={p.ar?.family || ''} onChange={(e) => setIn('ar', 'family', e.target.value)} /></label>
                </div>
                <label>وصف قصير (Short description)<textarea rows="3" value={p.ar?.description || ''} onChange={(e) => setIn('ar', 'description', e.target.value)} /></label>
                <label>الحكاية (Story)<textarea rows="5" value={p.ar?.story || ''} onChange={(e) => setIn('ar', 'story', e.target.value)} /></label>
                <label>طريقة الاستخدام (How to wear)<textarea rows="3" value={p.ar?.howToWear || ''} onChange={(e) => setIn('ar', 'howToWear', e.target.value)} /></label>
                <label>طريقة الحفظ (How to store)<textarea rows="3" value={p.ar?.howToStore || ''} onChange={(e) => setIn('ar', 'howToStore', e.target.value)} /></label>
                <label>المناسبات، مفصولة بفواصل (Occasions)<CsvInput value={p.ar?.occasions} onChange={(v) => setIn('ar', 'occasions', v)} /></label>
                <label>محتويات العلبة (What is included)<CsvInput value={p.ar?.includes} onChange={(v) => setIn('ar', 'includes', v)} /></label>
              </div>

              <h3>Search engines</h3>
              <label>SEO title<input value={p.seo?.title || ''} onChange={(e) => setIn('seo', 'title', e.target.value)} /></label>
              <label>Meta description<textarea rows="3" value={p.seo?.description || ''} onChange={(e) => setIn('seo', 'description', e.target.value)} /></label>
            </div>
          </details>
        </div>

        <div className="a-col a-col-side">
          <section className="a-panel a-form a-sticky">
            <h2>Publish</h2>
            <label className="a-check"><input type="checkbox" checked={p.published} onChange={(e) => set('published', e.target.checked)} /> Visible in the store</label>
            <label className="a-check"><input type="checkbox" checked={p.featured} onChange={(e) => set('featured', e.target.checked)} /> Featured</label>
            <button className="a-btn a-primary a-block" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Save product' : 'Save changes'}</button>
            <ul className="a-checklist" aria-label="Ready to publish">
              <li className={p.images?.length ? 'ok' : ''}>Photos</li>
              <li className={p.name.trim() ? 'ok' : ''}>Name</li>
              <li className={p.price?.INR > 0 ? 'ok' : ''}>Price</li>
              <li className={p.notes?.top?.length ? 'ok' : ''}>Notes</li>
            </ul>
          </section>

          {!isNew && (
            <section className="a-panel">
              {!confirmDelete ? (
                <button type="button" className="a-btn a-danger" onClick={() => setConfirmDelete(true)}>Delete product</button>
              ) : (
                <div className="a-confirm">
                  <p>Delete {p.name} permanently? Existing orders keep their copy of the item.</p>
                  <button type="button" className="a-btn a-danger" onClick={remove}>Yes, delete</button>
                  <button type="button" className="a-btn" onClick={() => setConfirmDelete(false)}>Keep it</button>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </form>
  );
}
