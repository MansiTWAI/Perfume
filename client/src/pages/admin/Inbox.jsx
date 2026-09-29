import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';

export function Enquiries() {
  const [list, setList] = useState(null);
  useEffect(() => {
    api('/enquiries').then(setList).catch(() => setList([]));
  }, []);
  const setStatus = async (id, status) => {
    const e = await api(`/enquiries/${id}`, { method: 'PATCH', body: { status } });
    setList((l) => l.map((x) => (x._id === id ? e : x)));
  };
  return (
    <div>
      <header className="a-head"><h1>Enquiries</h1></header>
      <section className="a-panel">
        {!list ? <p>Loading…</p> : list.length === 0 ? <p className="a-muted">No enquiries yet.</p> : (
          <div className="a-inbox">
            {list.map((e) => (
              <article key={e._id} className={`a-msg a-msg-${e.status}`}>
                <header>
                  <b>{e.name}</b> · {e.topic}
                  <small>{formatDate(e.createdAt)}</small>
                </header>
                <p>{e.message}</p>
                <footer>
                  <span>{e.email}{e.phone && ` · ${e.phone}`}</span>
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
  useEffect(() => {
    api('/subscribers').then(setList).catch(() => setList([]));
  }, []);
  return (
    <div>
      <header className="a-head"><h1>Subscribers</h1><span className="a-muted">{list?.length ?? 0} {list?.length === 1 ? 'person' : 'people'}</span></header>
      <section className="a-panel">
        {!list ? <p>Loading…</p> : list.length === 0 ? <p className="a-muted">No subscribers yet.</p> : (
          <table className="a-table">
            <thead><tr><th>Email</th><th>Source</th><th>Joined</th></tr></thead>
            <tbody>{list.map((s) => <tr key={s._id}><td>{s.email}</td><td>{s.source}</td><td>{formatDate(s.createdAt)}</td></tr>)}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}
