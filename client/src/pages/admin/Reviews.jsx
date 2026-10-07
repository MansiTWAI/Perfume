import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import Icon from '../../components/Icon';

const FILTERS = [['pending', 'Waiting'], ['approved', 'Published'], ['rejected', 'Hidden'], ['', 'All']];

// Every review comes from a delivered order. Nothing is published until it
// is approved here; the house can also reply publicly.
export default function Reviews() {
  const [filter, setFilter] = useState('pending');
  const [list, setList] = useState(null);
  const [replies, setReplies] = useState({});

  useEffect(() => {
    setList(null);
    api(`/reviews${filter ? `?status=${filter}` : ''}`).then(setList).catch(() => setList([]));
  }, [filter]);

  const update = async (id, body) => {
    const r = await api(`/reviews/${id}`, { method: 'PATCH', body });
    setList((l) => (filter && r.status !== filter ? l.filter((x) => x._id !== id) : l.map((x) => (x._id === id ? r : x))));
  };

  return (
    <div>
      <header className="a-head">
        <h1>Reviews</h1>
        <div className="a-tabs">
          {FILTERS.map(([v, label]) => (
            <button key={label} className={filter === v ? 'is-on' : ''} onClick={() => setFilter(v)}>{label}</button>
          ))}
        </div>
      </header>
      <section className="a-panel">
        {!list ? <p>Loading…</p> : list.length === 0 ? <p className="a-muted">Nothing here yet.</p> : (
          <div className="a-inbox">
            {list.map((r) => (
              <article key={r._id} className={`a-msg a-msg-${r.status === 'pending' ? 'new' : 'closed'}`}>
                <header>
                  <b className="a-stars" aria-label={`${r.rating} of 5`}>{[1, 2, 3, 4, 5].map((n) => <Icon key={n} name="star" size={14} filled={n <= r.rating} />)}</b> · {r.slug.toUpperCase()} · {r.name}{r.city && `, ${r.city}`}{r.phone && <> · <span dir="ltr">{r.phone}</span></>}
                  <small>{formatDate(r.createdAt)} · order {r.orderNumber}</small>
                </header>
                {r.title && <p><b>{r.title}</b></p>}
                <p>{r.body}</p>
                <label className="a-reply">
                  Public reply from the house (optional)
                  <textarea rows="2" value={replies[r._id] ?? r.reply ?? ''} onChange={(e) => setReplies({ ...replies, [r._id]: e.target.value })} />
                </label>
                <footer>
                  <span>Status: {r.status}</span>
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
    </div>
  );
}
