import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import { useStore } from '../../context/StoreContext';
import { clearApiCache } from '../../hooks/useApi';
import { ImageField, RowList, csv, fromCsv } from './Fields';

const EMPTY = {
  name: '', slug: '', subtitle: 'Eau de Parfum', tagline: '', family: '', description: '', story: '',
  sizeMl: 100, sizeLabel: '100 ML / 3.4 FL.OZ.', price: { INR: 0, AED: 0 }, stock: 0, category: 'Fragrances',
  badge: '', theme: 'ivory', images: [], video: { src: '', poster: '' },
  notes: { top: [], heart: [], base: [], approved: false }, wear: [], mood: [], occasions: [],
  howToWear: '', howToStore: '', faq: [], includes: [], featured: false, published: false, sortOrder: 10,
  seo: { title: '', description: '' },
};

export function ProductList() {
  const [list, setList] = useState(null);
  useEffect(() => {
    api('/products?all=1').then(setList).catch(() => setList([]));
  }, []);
  return (
    <div>
      <header className="a-head"><h1>Products</h1><Link to="/admin/products/new" className="a-btn a-primary">+ New product</Link></header>
      <section className="a-panel">
        {!list ? <p>Loading…</p> : (
          <table className="a-table">
            <thead><tr><th /><th>Name</th><th>Price</th><th>Stock</th><th>Notes</th><th>Status</th><th /></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p._id}>
                  <td><img src={p.images?.[0]?.src} alt="" className="a-thumb" /></td>
                  <td><b>{p.name}</b><br /><small>/fragrances/{p.slug}</small></td>
                  <td>{money(p.price?.INR, 'INR')}<br /><small>{money(p.price?.AED, 'AED')}</small></td>
                  <td className={p.stock <= 5 ? 'a-warn' : ''}>{p.stock}</td>
                  <td>{p.notes?.top?.length ? (p.notes.approved ? <span className="a-pill ok">Approved</span> : <span className="a-pill warn">Awaiting approval</span>) : '—'}</td>
                  <td>{p.published ? 'Live' : 'Hidden'}</td>
                  <td><Link to={`/admin/products/${p._id}`} className="a-link">Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export function ProductEdit() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { toast } = useStore();
  const [p, setP] = useState(isNew ? EMPTY : null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isNew) return;
    api('/products?all=1').then((all) => setP({ ...EMPTY, ...all.find((x) => x._id === id) }));
  }, [id, isNew]);

  if (!p) return <p>Loading…</p>;
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const setIn = (k, sub, v) => setP((x) => ({ ...x, [k]: { ...x[k], [sub]: v } }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await api(isNew ? '/products' : `/products/${id}`, { method: isNew ? 'POST' : 'PUT', body: p });
      clearApiCache();
      toast('Product saved');
      if (isNew) navigate(`/admin/products/${saved._id}`, { replace: true });
      else setP({ ...EMPTY, ...saved });
    } catch (err) {
      toast(err.message, 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    await api(`/products/${id}`, { method: 'DELETE' });
    clearApiCache();
    toast('Product deleted');
    navigate('/admin/products');
  }

  const noteFields = [['name', 'Note'], ['image', 'Image path (optional)'], ['description', 'What it brings', 'textarea']];

  return (
    <form onSubmit={save}>
      <header className="a-head">
        <h1>{isNew ? 'New product' : p.name}</h1>
        <div className="a-actions">
          {!isNew && <a href={`/fragrances/${p.slug}`} target="_blank" rel="noreferrer" className="a-btn">View ↗</a>}
          <button className="a-btn a-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </header>

      <div className="a-edit">
        <div className="a-col">
          <section className="a-panel a-form">
            <h2>Basics</h2>
            <div className="a-grid2">
              <label>Name<input required value={p.name} onChange={(e) => set('name', e.target.value)} /></label>
              <label>URL slug<input value={p.slug} onChange={(e) => set('slug', e.target.value)} placeholder="from name" /></label>
              <label>Subtitle<input value={p.subtitle} onChange={(e) => set('subtitle', e.target.value)} /></label>
              <label>Tagline<input value={p.tagline} onChange={(e) => set('tagline', e.target.value)} /></label>
              <label>Olfactive family<input value={p.family} onChange={(e) => set('family', e.target.value)} /></label>
              <label>Badge<input value={p.badge} onChange={(e) => set('badge', e.target.value)} /></label>
            </div>
            <label>Short description<textarea rows="3" value={p.description} onChange={(e) => set('description', e.target.value)} /></label>
            <label>Story<textarea rows="5" value={p.story} onChange={(e) => set('story', e.target.value)} /></label>
          </section>

          <section className="a-panel a-form">
            <h2>Fragrance notes</h2>
            <label className="a-check"><input type="checkbox" checked={!!p.notes?.approved} onChange={(e) => setIn('notes', 'approved', e.target.checked)} /> Notes approved against the perfumer’s final specification</label>
            {['top', 'heart', 'base'].map((t) => (
              <div key={t} className="a-sub">
                <h3>{t[0].toUpperCase() + t.slice(1)} notes</h3>
                <RowList rows={p.notes?.[t]} onChange={(rows) => setIn('notes', t, rows)} fields={noteFields} addLabel={`Add ${t} note`} />
              </div>
            ))}
          </section>

          <section className="a-panel a-form">
            <h2>How it wears</h2>
            <RowList rows={p.wear} onChange={(rows) => set('wear', rows)} fields={[['time', 'Stage'], ['label', 'Word'], ['text', 'Description', 'textarea']]} addLabel="Add stage" />
          </section>

          <section className="a-panel a-form">
            <h2>Care &amp; questions</h2>
            <label>How to wear<textarea rows="3" value={p.howToWear} onChange={(e) => set('howToWear', e.target.value)} /></label>
            <label>How to store<textarea rows="3" value={p.howToStore} onChange={(e) => set('howToStore', e.target.value)} /></label>
            <h3>FAQ</h3>
            <RowList rows={p.faq} onChange={(rows) => set('faq', rows)} fields={[['q', 'Question'], ['a', 'Answer', 'textarea']]} addLabel="Add question" />
          </section>
        </div>

        <div className="a-col a-col-side">
          <section className="a-panel a-form">
            <h2>Publishing</h2>
            <label className="a-check"><input type="checkbox" checked={p.published} onChange={(e) => set('published', e.target.checked)} /> Visible in the store</label>
            <label className="a-check"><input type="checkbox" checked={p.featured} onChange={(e) => set('featured', e.target.checked)} /> Featured</label>
            <div className="a-grid2">
              <label>Category<input value={p.category} onChange={(e) => set('category', e.target.value)} /></label>
              <label>Page theme
                <select value={p.theme} onChange={(e) => set('theme', e.target.value)}>
                  <option value="ivory">Ivory (ELARISSE)</option><option value="onyx">Onyx (ZAFREON)</option><option value="duo">Burgundy (Duo)</option>
                </select>
              </label>
              <label>Sort order<input type="number" value={p.sortOrder} onChange={(e) => set('sortOrder', +e.target.value)} /></label>
            </div>
          </section>

          <section className="a-panel a-form">
            <h2>Price &amp; stock</h2>
            <div className="a-grid2">
              <label>Price ₹ (incl. GST)<input type="number" min="0" value={p.price?.INR} onChange={(e) => setIn('price', 'INR', +e.target.value)} /></label>
              <label>Price AED (incl. VAT)<input type="number" min="0" value={p.price?.AED} onChange={(e) => setIn('price', 'AED', +e.target.value)} /></label>
              <label>Stock<input type="number" min="0" value={p.stock} onChange={(e) => set('stock', +e.target.value)} /></label>
              <label>Size label<input value={p.sizeLabel} onChange={(e) => set('sizeLabel', e.target.value)} /></label>
            </div>
          </section>

          <section className="a-panel a-form">
            <h2>Images</h2>
            {(p.images || []).map((img, i) => (
              <div key={i} className="a-sub">
                <ImageField value={img.src} onChange={(src) => set('images', p.images.map((x, j) => (j === i ? { ...x, src } : x)))} label={i === 0 ? 'Main image' : `Image ${i + 1}`} />
                <label>Alt text<input value={img.alt || ''} onChange={(e) => set('images', p.images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} /></label>
                <button type="button" className="a-link" onClick={() => set('images', p.images.filter((_, j) => j !== i))}>Remove image</button>
              </div>
            ))}
            <button type="button" className="a-btn" onClick={() => set('images', [...(p.images || []), { src: '', alt: '' }])}>+ Add image</button>
            <h3>Film (optional)</h3>
            <ImageField value={p.video?.src} onChange={(src) => setIn('video', 'src', src)} label="Video" />
            <ImageField value={p.video?.poster} onChange={(src) => setIn('video', 'poster', src)} label="Poster" />
          </section>

          <section className="a-panel a-form">
            <h2>Tags</h2>
            <label>Mood words (comma separated)<input value={csv(p.mood)} onChange={(e) => set('mood', fromCsv(e.target.value))} /></label>
            <label>Occasions<input value={csv(p.occasions)} onChange={(e) => set('occasions', fromCsv(e.target.value))} /></label>
            <label>What is included<input value={csv(p.includes)} onChange={(e) => set('includes', fromCsv(e.target.value))} /></label>
          </section>

          <section className="a-panel a-form">
            <h2>Search</h2>
            <label>SEO title<input value={p.seo?.title || ''} onChange={(e) => setIn('seo', 'title', e.target.value)} /></label>
            <label>Meta description<textarea rows="3" value={p.seo?.description || ''} onChange={(e) => setIn('seo', 'description', e.target.value)} /></label>
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
