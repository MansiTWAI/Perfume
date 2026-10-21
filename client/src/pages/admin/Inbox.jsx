import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useStore } from '../../context/StoreContext';
import { EmptyState, LoadError, ContactIcons, formatPhone, downloadCsv } from './ui';
import Icon from '../../components/Icon';

const STAMP = () => new Date().toISOString().slice(0, 10);
const STATUS = [['', 'All'], ['new', 'New'], ['replied', 'Replied'], ['closed', 'Closed']];

// Messages from the contact form. New ones are counted in the menu, and the
// team is emailed about each one as it arrives.
export function Enquiries() {
  const { toast } = useStore();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setError('');
    api('/enquiries').then(setList).catch((e) => { setError(e.message); setList([]); });
  }, [tick]);
  const setStatus = async (id, status) => {
    try {
      const e = await api(`/enquiries/${id}`, { method: 'PATCH', body: { status } });
      setList((l) => l.map((x) => (x._id === id ? e : x)));
    } catch (err) {
      toast(err.message, 'warn');
    }
  };
  const shown = (list || []).filter((e) => !filter || e.status === filter);
  const fresh = (list || []).filter((e) => e.status === 'new').length;
  const exportCsv = () => downloadCsv(`enquiries_${STAMP()}.csv`, [
    [(e) => formatDate(e.createdAt), 'Date'], ['name', 'Name'], ['email', 'Email'], [(e) => formatPhone(e.phone) || e.phone || '', 'Phone'], ['topic', 'Topic'], ['message', 'Message'], ['status', 'Status'],
  ], shown);
  return (
    <div>
      <header className="a-head">
        <h1>Enquiries</h1>
        <div className="a-actions">
          <div className="a-tabs">
            {STATUS.map(([v, l]) => <button key={l} className={filter === v ? 'is-on' : ''} onClick={() => setFilter(v)}>{l}{v === 'new' && fresh > 0 && <span className="a-count">{fresh}</span>}</button>)}
          </div>
          <button type="button" className="a-btn" onClick={exportCsv} disabled={!shown.length}><Icon name="arrow-down" size={16} /> Export CSV</button>
        </div>
      </header>
      <p className="a-muted a-hint">The team is emailed about every new enquiry. New ones are counted beside Enquiries in the menu until you mark them replied or closed.</p>
      <section className="a-panel">
        {error && <LoadError message={error} onRetry={() => setTick((n) => n + 1)} />}
        {!list ? <p className="a-muted">Loading…</p> : shown.length === 0 ? (
          !error && (list.length
            ? <EmptyState icon="check" title="Nothing here">No enquiries with this status.</EmptyState>
            : <EmptyState icon="mail" title="No enquiries yet">Messages sent from the website’s Contact page arrive here, with the customer’s email and mobile number.</EmptyState>)
        ) : (
          <div className="a-inbox">
            {shown.map((e) => (
              <article key={e._id} className={`a-msg a-msg-${e.status}`}>
                <header>
                  <b>{e.name}</b> · {e.topic}
                  <small>{formatDate(e.createdAt)}</small>
                </header>
                <p>{e.message}</p>
                <footer>
                  <span className="a-ico-line">
                    <a href={`mailto:${e.email}?subject=${encodeURIComponent(`Re: ${e.topic || 'your message'}`)}`} className="a-link">{e.email}</a>
                    {e.phone && <> · <span dir="ltr">{formatPhone(e.phone) || e.phone}</span> <ContactIcons phone={e.phone} text={`Hello ${e.name.split(' ')[0]}, thank you for your message to AL BARAKAH LIFESTYLE.`} /></>}
                  </span>
                  <select value={e.status} onChange={(ev) => setStatus(e._id, ev.target.value)} aria-label="Status">
                    <option value="new">New</option><option value="replied">Replied</option><option value="closed">Closed</option>
                  </select>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function Subscribers() {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setError('');
    api('/subscribers').then(setList).catch((e) => { setError(e.message); setList([]); });
  }, [tick]);
  const shown = (list || []).filter((s) => !q || s.email.toLowerCase().includes(q.trim().toLowerCase()));
  const exportCsv = () => downloadCsv(`newsletter_${STAMP()}.csv`, [['email', 'Email'], ['source', 'Source'], [(s) => formatDate(s.createdAt), 'Joined']], shown);
  return (
    <div>
      <header className="a-head">
        <h1>Newsletter</h1>
        <div className="a-actions">
          <span className="a-muted">{list?.length ?? 0} {list?.length === 1 ? 'person' : 'people'}</span>
          <button type="button" className="a-btn" onClick={exportCsv} disabled={!shown.length}><Icon name="arrow-down" size={16} /> Export CSV</button>
        </div>
      </header>
      {list?.length > 0 && <section className="a-filters"><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email" aria-label="Search subscribers" /></section>}
      <section className="a-panel">
        {error && <LoadError message={error} onRetry={() => setTick((n) => n + 1)} />}
        {!list ? <p className="a-muted">Loading…</p> : shown.length === 0 ? (
          !error && (list.length
            ? <EmptyState icon="search" title="Nobody matches">Try another email.</EmptyState>
            : <EmptyState icon="mail" title="No subscribers yet">People who sign up for the newsletter on the website appear here. Export them as CSV for your email tool.</EmptyState>)
        ) : (
          <div className="a-table-wrap a-sticky-head"><table className="a-table">
            <thead><tr><th>Email</th><th>Source</th><th>Joined</th></tr></thead>
            <tbody>{shown.map((s) => <tr key={s._id}><td><a href={`mailto:${s.email}`} className="a-link">{s.email}</a></td><td>{s.source || '—'}</td><td>{formatDate(s.createdAt)}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
