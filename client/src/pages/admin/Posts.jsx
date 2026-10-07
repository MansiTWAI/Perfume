import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { renderMarkdown } from '../../lib/markdown';
import { useStore } from '../../context/StoreContext';
import { clearApiCache } from '../../hooks/useApi';
import { ImageField, csv, fromCsv } from './Fields';
import Icon from '../../components/Icon';

const EMPTY = {
  title: '', slug: '', excerpt: '', content: '## First heading\n\nStart writing…', cover: { src: '', alt: '' },
  category: 'Guides', tags: [], author: 'AL BARAKAH LIFESTYLE', featured: false, status: 'draft',
  relatedProducts: [], seo: { title: '', description: '' },
};
const CATEGORIES = ['Brand Stories', 'Guides', 'Heritage', 'Rituals', 'Behind the Bottle'];

export function PostList() {
  const [list, setList] = useState(null);
  useEffect(() => {
    api('/posts?all=1&limit=50').then((d) => setList(d.items)).catch(() => setList([]));
  }, []);
  return (
    <div>
      <header className="a-head"><h1>Journal</h1><Link to="/admin/journal/new" className="a-btn a-primary">+ New article</Link></header>
      <section className="a-panel">
        {!list ? <p>Loading…</p> : (
          <div className="a-table-wrap"><table className="a-table">
            <thead><tr><th /><th>Title</th><th>Category</th><th>Status</th><th>Published</th><th /></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p._id}>
                  <td><img src={p.cover?.src} alt="" className="a-thumb" /></td>
                  <td><b>{p.title}</b>{p.featured && <small className="a-gold"> · Featured</small>}<br /><small>/journal/{p.slug} · {p.readingMinutes} min</small></td>
                  <td>{p.category}</td>
                  <td><span className={`a-pill ${p.status === 'published' ? 'ok' : ''}`}>{p.status}</span></td>
                  <td>{formatDate(p.publishedAt)}</td>
                  <td><Link to={`/admin/journal/${p._id}`} className="a-link">Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}

export function PostEdit() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { toast } = useStore();
  const [p, setP] = useState(isNew ? EMPTY : null);
  const [products, setProducts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('split');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    api('/products?all=1').then(setProducts).catch(() => {});
    if (!isNew) api(`/posts/id/${id}`).then((d) => setP({ ...EMPTY, ...d }));
  }, [id, isNew]);

  const preview = useMemo(() => renderMarkdown(p?.content || '').html, [p?.content]);
  if (!p) return <p>Loading…</p>;
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const setIn = (k, sub, v) => setP((x) => ({ ...x, [k]: { ...x[k], [sub]: v } }));

  async function save(status) {
    setBusy(true);
    try {
      const body = { ...p, status: status || p.status };
      const saved = await api(isNew ? '/posts' : `/posts/${id}`, { method: isNew ? 'POST' : 'PUT', body });
      clearApiCache();
      toast(body.status === 'published' ? 'Article published' : 'Draft saved');
      if (isNew) navigate(`/admin/journal/${saved._id}`, { replace: true });
      else setP({ ...EMPTY, ...saved });
    } catch (err) {
      toast(err.message, 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    await api(`/posts/${id}`, { method: 'DELETE' });
    clearApiCache();
    toast('Article deleted');
    navigate('/admin/journal');
  }

  const toggleProduct = (slug) =>
    set('relatedProducts', p.relatedProducts.includes(slug) ? p.relatedProducts.filter((s) => s !== slug) : [...p.relatedProducts, slug]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }}>
      <header className="a-head">
        <h1>{isNew ? 'New article' : 'Edit article'}</h1>
        <div className="a-actions">
          {!isNew && p.status === 'published' && <a href={`/journal/${p.slug}`} target="_blank" rel="noreferrer" className="a-btn">View <Icon name="external" size={14} /></a>}
          <button type="button" className="a-btn" disabled={busy} onClick={() => save('draft')}>Save draft</button>
          <button type="button" className="a-btn a-primary" disabled={busy} onClick={() => save('published')}>{p.status === 'published' ? 'Update' : 'Publish'}</button>
        </div>
      </header>

      <div className="a-edit">
        <div className="a-col">
          <section className="a-panel a-form">
            <label>Title<input className="a-title-input" required value={p.title} onChange={(e) => set('title', e.target.value)} /></label>
            <label>Excerpt<textarea rows="2" value={p.excerpt} onChange={(e) => set('excerpt', e.target.value)} /></label>
          </section>
          <section className="a-panel">
            <div className="a-editor-bar">
              <span className="a-muted">Markdown: ## heading, **bold**, *italic*, &gt; quote, - list, | tables |</span>
              <div className="a-seg">
                {['write', 'split', 'preview'].map((v) => <button type="button" key={v} aria-pressed={view === v} onClick={() => setView(v)}>{v}</button>)}
              </div>
            </div>
            <div className={`a-editor a-editor-${view}`}>
              {view !== 'preview' && (
                <textarea className="a-md" value={p.content} onChange={(e) => set('content', e.target.value)} spellCheck="true" aria-label="Article content" />
              )}
              {view !== 'write' && <div className="a-preview prose" dangerouslySetInnerHTML={{ __html: preview }} />}
            </div>
          </section>
        </div>

        <div className="a-col a-col-side">
          <section className="a-panel a-form">
            <h2>Details</h2>
            <p className="a-muted">Status: <b>{p.status}</b>{p.publishedAt && ` · ${formatDate(p.publishedAt)}`}</p>
            <label>URL slug<input value={p.slug} onChange={(e) => set('slug', e.target.value)} placeholder="from title" /></label>
            <label>Category
              <input list="cats" value={p.category} onChange={(e) => set('category', e.target.value)} />
              <datalist id="cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label>Tags (comma separated)<input value={csv(p.tags)} onChange={(e) => set('tags', fromCsv(e.target.value))} /></label>
            <label>Author<input value={p.author} onChange={(e) => set('author', e.target.value)} /></label>
            <label className="a-check"><input type="checkbox" checked={p.featured} onChange={(e) => set('featured', e.target.checked)} /> Feature at the top of the Journal</label>
          </section>
          <section className="a-panel a-form">
            <h2>Cover</h2>
            <ImageField value={p.cover?.src} onChange={(src) => setIn('cover', 'src', src)} label="Cover" />
            <label>Alt text<input value={p.cover?.alt || ''} onChange={(e) => setIn('cover', 'alt', e.target.value)} /></label>
          </section>
          <section className="a-panel a-form">
            <h2>Linked fragrances</h2>
            {products.map((pr) => (
              <label key={pr.slug} className="a-check"><input type="checkbox" checked={p.relatedProducts.includes(pr.slug)} onChange={() => toggleProduct(pr.slug)} /> {pr.name}</label>
            ))}
          </section>
          <section className="a-panel a-form">
            <h2>Search</h2>
            <label>SEO title<input value={p.seo?.title || ''} onChange={(e) => setIn('seo', 'title', e.target.value)} /></label>
            <label>Meta description<textarea rows="3" value={p.seo?.description || ''} onChange={(e) => setIn('seo', 'description', e.target.value)} /></label>
          </section>
          {!isNew && (
            <section className="a-panel">
              {!confirmDelete ? (
                <button type="button" className="a-btn a-danger" onClick={() => setConfirmDelete(true)}>Delete article</button>
              ) : (
                <div className="a-confirm">
                  <p>Delete this article permanently?</p>
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
