import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useStore } from '../../context/StoreContext';
import { Modal } from './Fields';
import { EmptyState, LoadError, formatPhone } from './ui';
import Icon from '../../components/Icon';

const FILTERS = [['pending', 'Waiting'], ['approved', 'Published'], ['rejected', 'Hidden'], ['', 'All']];
const EMPTY_TEXT = {
  pending: ['Nothing waiting', 'New reviews from delivered orders arrive here to be read before they appear on the website.'],
  approved: ['No published reviews yet', 'Publish a waiting review, or add one a customer sent you on WhatsApp.'],
  rejected: ['No hidden reviews', 'Reviews you hide stay here, out of sight of shoppers.'],
  '': ['No reviews yet', 'Customers can review a fragrance once their order is delivered. You can also add a review a customer sent you another way.'],
};

// A review the team received another way (WhatsApp, in the shop). It is
// published with the team's name for it and never shown as a verified purchase.
function AddReview({ onClose, onAdded }) {
  const { toast } = useStore();
  const [products, setProducts] = useState([]);
  const [f, setF] = useState({ slug: '', rating: 5, name: '', city: '', title: '', body: '', status: 'approved' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api('/products?all=1').then((list) => { setProducts(list); setF((x) => ({ ...x, slug: x.slug || list[0]?.slug || '' })); }).catch(() => {});
  }, []);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErrors((x) => ({ ...x, [k]: undefined })); };
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const r = await api('/reviews/admin', { method: 'POST', body: f });
      toast(r.status === 'approved' ? 'Review published' : 'Review saved to Waiting');
      onAdded(r);
    } catch (err) {
      setErrors(Object.fromEntries((err.data?.errors || [{ field: 'form', message: err.message }]).map((x) => [x.field, x.message])));
    } finally {
      setBusy(false);
    }
  }
  const err = (k) => errors[k] && <span className="a-field-error">{errors[k]}</span>;
  return (
    <Modal title="Add a review" onClose={busy ? undefined : onClose}>
      <form className="a-form" onSubmit={submit}>
        <p className="a-muted a-hint">For a review a customer sent you another way, e.g. on WhatsApp. On the website it shows as “Shared with the house”, not as a verified purchase.</p>
        <div className="a-grid2">
          <label>Fragrance
            <select value={f.slug} onChange={set('slug')} required>{products.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select>{err('slug')}
          </label>
          <label>Rating
            <span className="a-stars-pick" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={Number(f.rating) === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} onClick={() => setF({ ...f, rating: n })}><Icon name="star" size={20} filled={n <= f.rating} /></button>
              ))}
            </span>{err('rating')}
          </label>
          <label>Customer’s name<input value={f.name} onChange={set('name')} required maxLength={80} placeholder="e.g. Aisha Khan (shown as Aisha K.)" />{err('name')}</label>
          <label>City <small className="a-muted">(optional)</small><input value={f.city} onChange={set('city')} maxLength={60} /></label>
        </div>
        <label>Title <small className="a-muted">(optional)</small><input value={f.title} onChange={set('title')} maxLength={80} /></label>
        <label>Review<textarea rows="4" value={f.body} onChange={set('body')} required maxLength={1200} />{err('body')}</label>
        <label className="a-check"><input type="checkbox" checked={f.status === 'approved'} onChange={(e) => setF({ ...f, status: e.target.checked ? 'approved' : 'pending' })} /> Publish now</label>
        {errors.form && <p className="a-error" role="alert">{errors.form}</p>}
        <footer className="a-modal-foot">
          <button type="button" className="a-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="a-btn a-primary" disabled={busy || !products.length}>{busy ? 'Saving…' : 'Add review'}</button>
        </footer>
      </form>
    </Modal>
  );
}

// Every customer review comes from a delivered order. Nothing is published
// until it is approved here; the house can also reply publicly.
export default function Reviews() {
  const { toast } = useStore();
  const [filter, setFilter] = useState('pending');
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [replies, setReplies] = useState({});
  const [adding, setAdding] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setList(null);
    setError('');
    api(`/reviews${filter ? `?status=${filter}` : ''}`).then(setList).catch((e) => { setError(e.message); setList([]); });
  }, [filter, tick]);

  const update = async (id, body) => {
    try {
      const r = await api(`/reviews/${id}`, { method: 'PATCH', body });
      setList((l) => (filter && r.status !== filter ? l.filter((x) => x._id !== id) : l.map((x) => (x._id === id ? { ...x, ...r } : x))));
      toast(body.status === 'approved' ? 'Published' : body.status === 'rejected' ? 'Hidden' : 'Reply saved');
    } catch (e) {
      toast(e.message, 'warn');
    }
  };
  const [title, text] = EMPTY_TEXT[filter];

  return (
    <div>
      <header className="a-head">
        <h1>Reviews</h1>
        <div className="a-actions">
          <div className="a-tabs">
            {FILTERS.map(([v, label]) => (
              <button key={label} className={filter === v ? 'is-on' : ''} onClick={() => setFilter(v)}>{label}</button>
            ))}
          </div>
          <button type="button" className="a-btn a-primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Add review</button>
        </div>
      </header>
      <section className="a-panel">
        {error && <LoadError message={error} onRetry={() => setTick((n) => n + 1)} />}
        {!list ? <p className="a-muted">Loading…</p> : list.length === 0 ? (
          !error && <EmptyState icon="star" title={title} action="Add a review" onAction={() => setAdding(true)}>{text}</EmptyState>
        ) : (
          <div className="a-inbox">
            {list.map((r) => (
              <article key={r._id} className={`a-msg a-msg-${r.status === 'pending' ? 'new' : 'closed'}`}>
                <header>
                  <b className="a-stars" aria-label={`${r.rating} of 5`}>{[1, 2, 3, 4, 5].map((n) => <Icon key={n} name="star" size={14} filled={n <= r.rating} />)}</b> · {r.slug.toUpperCase()} · {r.name}{r.city && `, ${r.city}`}{r.phone && <> · <span dir="ltr">{formatPhone(r.phone)}</span></>}
                  {r.source === 'house' && <span className="a-pill off">Added by the team</span>}
                  <small>{formatDate(r.createdAt)}{r.orderNumber ? ` · order ${r.orderNumber}` : r.addedBy ? ` · ${r.addedBy}` : ''}</small>
                </header>
                {r.title && <p><b>{r.title}</b></p>}
                <p>{r.body}</p>
                <label className="a-reply">
                  Public reply from the house (optional)
                  <textarea rows="2" value={replies[r._id] ?? r.reply ?? ''} onChange={(e) => setReplies({ ...replies, [r._id]: e.target.value })} />
                </label>
                <footer>
                  <span>Status: {{ pending: 'waiting', approved: 'published', rejected: 'hidden' }[r.status] || r.status}</span>
                  <span className="a-actions">
                    {replies[r._id] !== undefined && replies[r._id] !== (r.reply || '') && (
                      <button className="a-btn" onClick={() => update(r._id, { reply: replies[r._id] })}>Save reply</button>
                    )}
                    {r.status !== 'approved' && <button className="a-btn a-primary" onClick={() => update(r._id, { status: 'approved', reply: replies[r._id] ?? r.reply })}>Publish</button>}
                    {r.status !== 'rejected' && <button className="a-btn" onClick={() => update(r._id, { status: 'rejected' })}>Hide</button>}
                  </span>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>
      {adding && <AddReview onClose={() => setAdding(false)} onAdded={(r) => { setAdding(false); setFilter(r.status === 'approved' ? 'approved' : 'pending'); setTick((n) => n + 1); }} />}
    </div>
  );
}
