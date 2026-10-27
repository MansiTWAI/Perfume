import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { renderMarkdown } from '../../lib/markdown';
import { useStore } from '../../context/StoreContext';
import { clearApiCache } from '../../hooks/useApi';
import { CsvInput, ImageField } from './Fields';
import Icon from '../../components/Icon';
import { EmptyState, LoadError } from './ui';

const EMPTY = {
  title: '', slug: '', excerpt: '', content: '## First heading\n\nStart writing…', cover: { src: '', alt: '' },
  category: 'Guides', tags: [], author: 'AL BARAKAH LIFESTYLE', featured: false, status: 'draft',
  relatedProducts: [], seo: { title: '', description: '' },
};
const CATEGORIES = ['Brand Stories', 'Guides', 'Heritage', 'Rituals', 'Behind the Bottle'];

const TABS = [['', 'All'], ['published', 'Published'], ['draft', 'Drafts']];

export function PostList() {
  const [tab, setTab] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setError('');
    api(`/posts?all=1&limit=50${tab ? `&status=${tab}` : ''}`).then(setData).catch((e) => { setError(e.message); setData({ items: [] }); });
  }, [tab, tick]);
  const list = data?.items;
  const counts = data?.counts || {};
  return (
    <div>
      <header className="a-head">
        <h1>Journal</h1>
        <div className="a-actions">
          <div className="a-tabs">
            {TABS.map(([v, l]) => <button key={l} className={tab === v ? 'is-on' : ''} onClick={() => setTab(v)}>{l}{v && counts[v] ? <span className="a-count">{counts[v]}</span> : null}</button>)}
          </div>
          <Link to="/admin/journal/new" className="a-btn a-primary"><Icon name="plus" size={16} /> New article</Link>
        </div>
      </header>
      <section className="a-panel">
        {error && <LoadError message={error} onRetry={() => setTick((n) => n + 1)} />}
        {!list ? <p className="a-muted">Loading…</p> : list.length === 0 ? (
          !error && (tab === 'draft'
            ? <EmptyState icon="pencil" title="No drafts" action="Start an article" to="/admin/journal/new">Use “Save draft” while writing; drafts stay here, unseen by readers, until you publish.</EmptyState>
            : <EmptyState icon="pencil" title="No articles yet" action="Write the first article" to="/admin/journal/new">Journal articles appear on the website’s Journal page once published.</EmptyState>)
        ) : (
          <div className="a-table-wrap a-sticky-head"><table className="a-table">
            <thead><tr><th /><th>Title</th><th>Category</th><th>Status</th><th>Published</th><th>Views</th><th /></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p._id}>
                  <td>{p.cover?.src ? <img src={p.cover.src} alt="" className="a-thumb" /> : <span className="a-thumb a-thumb-empty" aria-hidden="true" />}</td>
                  <td><Link to={`/admin/journal/${p._id}`} className="a-row-link">{p.title}</Link>{p.featured && <small className="a-gold">Featured</small>}<small>/journal/{p.slug} · {p.readingMinutes} min read</small></td>
                  <td>{p.category}</td>
                  <td><span className={`a-pill ${p.status === 'published' ? 'ok' : 'warn'}`}>{p.status === 'published' ? 'Published' : 'Draft'}</span></td>
                  <td>{p.publishedAt ? formatDate(p.publishedAt) : <span className="a-muted">—</span>}</td>
                  <td>{p.status === 'published' ? (p.views || 0).toLocaleString() : <span className="a-muted">—</span>}</td>
                  <td><Link to={`/admin/journal/${p._id}`} className="a-link">Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <p className="a-muted a-hint" style={{ marginTop: 12 }}>Views count readers opening an article on the website since this counter was added; the team’s own visits are not counted.</p>
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
            <p className="a-muted">Status: <b>{p.status === 'published' ? 'Published' : 'Draft'}</b>{p.publishedAt && ` · ${formatDate(p.publishedAt)}`}{p.status === 'published' && ` · ${(p.views || 0).toLocaleString()} views`}</p>
            <label>URL slug<input value={p.slug} onChange={(e) => set('slug', e.target.value)} placeholder="from title" /></label>
            <label>Category
              <input list="cats" value={p.category} onChange={(e) => set('category', e.target.value)} />
              <datalist id="cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label>Tags (comma separated)<CsvInput value={p.tags} onChange={(v) => set('tags', v)} /></label>
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
