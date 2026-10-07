import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { money, formatDate } from '../../lib/format';
import { useStore } from '../../context/StoreContext';

// Leads from the website's AI concierge: ask in plain words, filter, open a
// lead to read the conversation, add notes and move its status on.
const STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];
const QUESTIONS = ["Show today's hot leads", 'Who wants a callback?', 'Which products are getting the most interest?', 'Show leads interested in perfumes under ₹2000', 'Which leads need follow-up?', "Summarize today's AI conversations"];
const scoreTone = (s) => (s >= 60 ? 'ok' : s >= 30 ? 'warn' : '');
const when = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

function LeadDetail({ id, onChanged, onClose }) {
  const { toast } = useStore();
  const [lead, setLead] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setLead(null);
    api(`/admin/leads/${id}`).then(setLead).catch(() => setLead(false));
  }, [id]);
  async function save(body) {
    setBusy(true);
    try {
      const l = await api(`/admin/leads/${id}`, { method: 'PATCH', body });
      setLead((x) => ({ ...x, ...l }));
      onChanged(l);
      if (body.note) setNote('');
      toast('Lead updated');
    } catch (e) {
      toast(e.message, 'warn');
    } finally {
      setBusy(false);
    }
  }
  if (lead === false) return <aside className="a-panel a-lead-detail"><p>Could not load this lead.</p></aside>;
  if (!lead) return <aside className="a-panel a-lead-detail"><p>Loading…</p></aside>;
  return (
    <aside className="a-panel a-lead-detail">
      <header>
        <h2>{lead.name || 'Anonymous shopper'}</h2>
        <button type="button" className="a-btn" onClick={onClose}>Close</button>
      </header>
      <p className="a-hint">
        {lead.email && <a href={`mailto:${lead.email}`} className="a-link">{lead.email}</a>}
        {lead.phone && <> · <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="a-link">{lead.phone} (WhatsApp)</a></>}
        {!lead.email && !lead.phone && <span className="a-muted">No contact details shared.</span>}
      </p>
      <dl className="a-lead-facts">
        <div><dt>Score</dt><dd><span className={`a-pill ${scoreTone(lead.score)}`}>{lead.score}</span> · {lead.intent}</dd></div>
        <div><dt>Interested in</dt><dd>{lead.interestedProducts?.join(', ') || '—'}</dd></div>
        <div><dt>Budget</dt><dd>{lead.budget?.amount ? money(lead.budget.amount, lead.budget.currency) : '—'}</dd></div>
        <div><dt>For</dt><dd>{lead.useCase || '—'}{lead.quantity > 1 && ` · ${lead.quantity} pieces`}</dd></div>
        <div><dt>Callback</dt><dd>{lead.wantsCallback || lead.handoff?.at ? `Yes${lead.handoff?.reason ? ` · ${lead.handoff.reason}` : ''}` : 'No'}</dd></div>
        <div><dt>Last seen</dt><dd>{when(lead.lastInteractionAt)}</dd></div>
      </dl>
      {lead.summary && <p className="a-hint">“{lead.summary}”</p>}
      <label>Status
        <select value={lead.status} disabled={busy} onChange={(e) => save({ status: e.target.value })}>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <form className="a-lead-note" onSubmit={(e) => { e.preventDefault(); if (note.trim()) save({ note }); }}>
        <label>Add a note<textarea rows="2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Called, sending 2 gift boxes" maxLength={1000} /></label>
        <button className="a-btn a-primary" disabled={busy || !note.trim()}>Save note</button>
      </form>
      {lead.notes?.length > 0 && (
        <ol className="a-history">{[...lead.notes].reverse().map((n, i) => <li key={i}>{n.text}<br /><small>{when(n.at)} · {n.by}</small></li>)}</ol>
      )}
      <h3>Conversation</h3>
      <div className="a-convo">
        {lead.conversation?.length ? lead.conversation.map((m, i) => (
          <p key={i} className={`a-convo-${m.role}`}><b>{m.role === 'user' ? 'Shopper' : 'Concierge'}</b> {m.text.replace(/\*\*/g, '')}</p>
        )) : <p className="a-muted">No messages kept.</p>}
      </div>
    </aside>
  );
}

export default function Leads() {
  const [f, setF] = useState({ q: '', status: '', hot: false, callback: false, needsFollowUp: false, sort: 'recent' });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [ask, setAsk] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState(null);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ sort: f.sort, limit: '50', ...(f.q && { q: f.q }), ...(f.status && { status: f.status }), ...(f.hot && { hot: '1' }), ...(f.callback && { callback: '1' }), ...(f.needsFollowUp && { needsFollowUp: '1' }) });
    api(`/admin/leads?${qs}`).then(setData, (e) => setError(e.message));
  }, [f]);
  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  async function askAi(question) {
    const q = String(question || '').trim();
    if (!q) return;
    setAsk(q);
    setAsking(true);
    setAnswer(null);
    try {
      setAnswer(await api('/admin/ai/ask', { method: 'POST', body: { question: q } }));
    } catch (e) {
      setAnswer({ answer: e.message, leads: [], failed: true });
    } finally {
      setAsking(false);
    }
  }

  const replace = (l) => setData((d) => d && { ...d, items: d.items.map((x) => (x._id === l._id ? { ...x, ...l } : x)) });
  const rows = (list) => (
    <div className="a-table-wrap">
      <table className="a-table a-leads">
        <thead><tr><th>Lead</th><th>Interested in</th><th>Budget</th><th>Intent · score</th><th>Status</th><th>Last</th></tr></thead>
        <tbody>
          {list.map((l) => (
            <tr key={l._id} onClick={() => setOpen(l._id)} className={open === l._id ? 'is-open' : ''}>
              <td><b>{l.name || 'Anonymous'}</b>{(l.wantsCallback || l.handoff?.at) && <span className="a-pill warn a-cb">callback</span>}<br /><small>{l.email || l.phone || 'no contact yet'}</small></td>
              <td>{l.interestedProducts?.join(', ') || '—'}<br /><small>{l.useCase}</small></td>
              <td>{l.budget?.amount ? money(l.budget.amount, l.budget.currency) : '—'}</td>
              <td>{l.intent} · <span className={`a-pill ${scoreTone(l.score)}`}>{l.score}</span></td>
              <td><span className="a-pill">{l.status}</span></td>
              <td><small>{when(l.lastInteractionAt)}</small></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <header className="a-head">
        <h1>AI leads</h1>
        <span className="a-muted">{data ? `${data.total} lead${data.total === 1 ? '' : 's'}` : ''}{data?.counts?.NEW ? ` · ${data.counts.NEW} new` : ''}</span>
      </header>

      <section className="a-panel a-ask">
        <form onSubmit={(e) => { e.preventDefault(); askAi(ask); }}>
          <label className="sr-only" htmlFor="a-ask">Ask about your leads</label>
          <input id="a-ask" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ask about your leads, e.g. Who wants a callback?" maxLength={400} />
          <button className="a-btn a-primary" disabled={asking || !ask.trim() || data?.aiEnabled === false}>{asking ? 'Thinking…' : 'Ask'}</button>
        </form>
        <div className="a-quick">{QUESTIONS.map((q) => <button type="button" key={q} disabled={asking || data?.aiEnabled === false} onClick={() => askAi(q)}>{q}</button>)}</div>
        {data?.aiEnabled === false && <p className="a-muted a-hint">Add GEMINI_API_KEY to the server settings to ask questions. The list below works without it.</p>}
        {answer && (
          <div className={`a-answer ${answer.failed ? 'is-failed' : ''}`} aria-live="polite">
            {answer.answer.split('\n').filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}
            {answer.leads?.length > 0 && rows(answer.leads)}
          </div>
        )}
      </section>

      <div className={`a-leads-grid ${open ? 'has-detail' : ''}`}>
        <section className="a-panel">
          <div className="a-filters">
            <input type="search" placeholder="Search name, email, phone, product…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
            <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Status">
              <option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })} aria-label="Sort">
              <option value="recent">Most recent</option><option value="score">Highest score</option><option value="oldest">Oldest</option>
            </select>
            {[['hot', 'Hot (60+)'], ['callback', 'Wants callback'], ['needsFollowUp', 'Needs follow-up']].map(([k, label]) => (
              <label key={k} className="a-check"><input type="checkbox" checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /> {label}</label>
            ))}
          </div>
          {error ? <p className="a-error">{error}</p> : !data ? <p>Loading…</p> : data.items.length === 0 ? (
            <p className="a-muted">No leads match. Leads appear when shoppers show buying interest in the AI concierge.</p>
          ) : rows(data.items)}
          {data && <p className="a-muted a-hint">Updated {formatDate(new Date())}</p>}
        </section>
        {open && <LeadDetail id={open} onChanged={(l) => { replace(l); load(); }} onClose={() => setOpen(null)} />}
      </div>
    </div>
  );
}
