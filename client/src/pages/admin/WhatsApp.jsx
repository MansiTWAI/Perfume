import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, toQuery } from '../../lib/api';
import { useStore } from '../../context/StoreContext';
import { Pager } from './Fields';
import Icon from '../../components/Icon';

// WhatsApp updates to subscribers: write a message, send it to everyone who
// subscribed or to chosen customers (AI leads among them), and follow each
// message to delivered / read / failed. Only people who verified their number
// and agreed are listed; unsubscribed people never appear and are checked
// again just before each message goes out.
const MAX = 600;
const when = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const STATUS = { queued: ['Waiting', 'warn'], sending: ['Sending', 'warn'], sent: ['Sent', ''], delivered: ['Delivered', 'ok'], read: ['Read', 'ok'], failed: ['Failed', 'bad'], skipped: ['Skipped', 'off'] };
const LEAD_TONE = (s) => (s >= 60 ? 'ok' : s >= 30 ? 'warn' : '');
// Still changing: messages going out, or receipts (delivered / read) still
// expected for a recent notification.
const live = (c) => !c.finishedAt || ((c.counts.sent || c.counts.delivered) > 0 && Date.now() - new Date(c.createdAt).getTime() < 15 * 60000);

function DeliveryBar({ counts, total }) {
  const part = (n) => `${total ? (n / total) * 100 : 0}%`;
  return (
    <span className="a-wa-bar" aria-hidden="true">
      <i className="is-read" style={{ width: part(counts.read) }} />
      <i className="is-delivered" style={{ width: part(counts.delivered) }} />
      <i className="is-sent" style={{ width: part(counts.sent) }} />
      <i className="is-failed" style={{ width: part(counts.failed) }} />
    </span>
  );
}
const summary = (c) => [
  c.read && `${c.read} read`, c.delivered && `${c.delivered} delivered`, c.sent && `${c.sent} sent`,
  c.waiting && `${c.waiting} waiting`, c.failed && `${c.failed} failed`, c.skipped && `${c.skipped} skipped`,
].filter(Boolean).join(' · ') || '—';

// Searchable multi-select of subscribers.
function Picker({ selected, setSelected }) {
  const [q, setQ] = useState('');
  const [leadsOnly, setLeadsOnly] = useState(false);
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [q, leadsOnly]);
  useEffect(() => {
    const id = setTimeout(() => {
      api(`/admin/whatsapp/contacts${toQuery({ q, leads: leadsOnly ? '1' : '', page, limit: 20 })}`)
        .then((d) => setData((prev) => (page > 1 && prev ? { ...d, items: [...prev.items, ...d.items] } : d)))
        .catch(() => setData({ items: [], total: 0, pages: 1 }));
    }, 250);
    return () => clearTimeout(id);
  }, [q, leadsOnly, page]);
  const toggle = (c) => setSelected((m) => { const n = new Map(m); n.has(c.id) ? n.delete(c.id) : n.set(c.id, c); return n; });
  const items = data?.items || [];
  return (
    <div className="a-picker">
      <div className="a-picker-top">
        {[...selected.values()].map((c) => (
          <span key={c.id} className="a-chip">{c.name || c.phone}<button type="button" aria-label={`Remove ${c.name || c.phone}`} onClick={() => toggle(c)}><Icon name="close" size={14} /></button></span>
        ))}
        <span className="a-picker-search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or email" aria-label="Search subscribers" /></span>
      </div>
      <div className="a-picker-tools">
        <label className="a-check"><input type="checkbox" checked={leadsOnly} onChange={(e) => setLeadsOnly(e.target.checked)} /> AI leads only</label>
        <span>
          {data ? `${data.total} match${data.total === 1 ? '' : 'es'}` : 'Loading…'}
          {items.length > 0 && <> · <button type="button" className="a-textbtn" onClick={() => setSelected((m) => { const n = new Map(m); items.forEach((c) => n.set(c.id, c)); return n; })}>Select all shown</button></>}
          {selected.size > 0 && <> · <button type="button" className="a-textbtn" onClick={() => setSelected(new Map())}>Clear</button></>}
        </span>
      </div>
      <div className="a-picker-list" role="group" aria-label="Subscribers">
        {data && items.length === 0 && <p className="a-muted a-picker-empty">{q || leadsOnly ? 'No subscribers match.' : 'No subscribers yet. Customers subscribe from their account or the AI concierge, after confirming their number.'}</p>}
        {items.map((c) => (
          <label key={c.id} className="a-picker-opt">
            <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c)} aria-label={`Select ${c.name || c.phone}`} />
            <span>{c.name || 'No name'}<small dir="ltr">{c.phone}{c.lead?.interestedProducts?.length ? ` · ${c.lead.interestedProducts.join(', ')}` : ''}</small></span>
            {c.lead ? <span className={`a-pill ${LEAD_TONE(c.lead.score)}`}>Lead {c.lead.score}</span> : <span className="a-pill off">{c.source === 'account' ? 'Account' : 'Website'}</span>}
          </label>
        ))}
        {data && data.page < data.pages && <button type="button" className="a-btn a-picker-more" onClick={() => setPage((p) => p + 1)}>Show more</button>}
      </div>
    </div>
  );
}

function Composer({ status, onSent }) {
  const { toast } = useStore();
  const [params] = useSearchParams();
  const [audience, setAudience] = useState(params.get('contact') ? 'selected' : 'all');
  const [selected, setSelected] = useState(new Map());
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // "Notify" from an AI lead opens here with that person chosen.
  useEffect(() => {
    const id = params.get('contact');
    if (!id) return;
    api(`/admin/whatsapp/contacts?ids=${id}`).then((d) => d.items[0] && setSelected(new Map([[d.items[0].id, d.items[0]]]))).catch(() => {});
  }, [params]);

  const text = message.replace(/\s+/g, ' ').trim();
  const count = audience === 'all' ? status.subscribed : selected.size;
  const first = audience === 'selected' && selected.size ? [...selected.values()][0] : null;
  const firstName = (first?.name || 'Aisha').split(' ')[0];
  const greeting = status.greeting ? status.greeting.replace('Aisha', firstName) : '';
  const canSend = status.configured && text && text.length <= MAX && count > 0 && !busy;

  async function send(e) {
    e.preventDefault();
    if (!canSend) return;
    if (!window.confirm(`Send this WhatsApp message to ${count} ${count === 1 ? 'person' : 'people'}?`)) return;
    setBusy(true);
    setError('');
    try {
      const r = await api('/admin/whatsapp/campaigns', { method: 'POST', body: { audience, message, ...(audience === 'selected' && { contactIds: [...selected.keys()] }) } });
      toast(`Sending to ${r.recipients} ${r.recipients === 1 ? 'person' : 'people'}`);
      setMessage('');
      setSelected(new Map());
      onSent(r.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="a-panel" onSubmit={send}>
      <h2>New notification</h2>
      <div className="a-aud" role="radiogroup" aria-label="Who receives it">
        <label className={audience === 'all' ? 'is-on' : ''}>
          <input type="radio" name="aud" checked={audience === 'all'} onChange={() => setAudience('all')} aria-label={`All subscribers, ${status.subscribed}`} />
          <span><b>All subscribers</b><small>{status.subscribed} {status.subscribed === 1 ? 'person' : 'people'}</small></span>
        </label>
        <label className={audience === 'selected' ? 'is-on' : ''}>
          <input type="radio" name="aud" checked={audience === 'selected'} onChange={() => setAudience('selected')} aria-label={`Selected customers, ${selected.size} selected`} />
          <span><b>Selected customers</b><small>{selected.size} selected</small></span>
        </label>
      </div>
      {audience === 'selected' && <Picker selected={selected} setSelected={setSelected} />}
      <div className="a-wa-compose">
        <div className="a-form">
          <label>Message<textarea rows="6" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} placeholder="e.g. ZAFREON is back in stock. Use WELCOME10 for 10% off at albarakah.me" aria-describedby="wa-count" /></label>
          <div className="a-wa-count" id="wa-count">
            <span>Line breaks are sent as one paragraph (a WhatsApp rule for template messages).</span>
            <span className={text.length > MAX ? 'a-warn' : ''}>{text.length} / {MAX}</span>
          </div>
        </div>
        <div className="a-wa-frame" aria-label="Preview">
          <span className="a-eyebrow">What {audience === 'selected' && first ? firstName : 'a subscriber'} receives</span>
          <div className="a-wa-bubble">
            {greeting && <>{greeting}, </>}{text || <span className="a-muted">Your message appears here.</span>}
            <small className="a-wa-foot">Reply STOP to unsubscribe</small>
          </div>
        </div>
      </div>
      {error && <p className="a-error" role="alert">{error}</p>}
      <div className="a-wa-send">
        <span className="a-muted a-hint">{status.configured ? <>Sent with your approved template <b>{status.template}</b>.</> : 'WhatsApp is not set up on the server yet, so sending is off.'}</span>
        <button className="a-btn a-primary" disabled={!canSend}><Icon name="send" size={16} /> {busy ? 'Sending…' : count ? `Send to ${count} ${count === 1 ? 'person' : 'people'}` : 'Send'}</button>
      </div>
    </form>
  );
}

function CampaignDetail({ id, onClose, onChanged }) {
  const { toast } = useStore();
  const [tab, setTab] = useState('');
  const [page, setPage] = useState(1);
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState('');
  const load = useCallback(() => api(`/admin/whatsapp/campaigns/${id}${toQuery({ status: tab, page, limit: 50 })}`).then(setD).catch(() => setD(false)), [id, tab, page]);
  useEffect(() => { load(); }, [load]);
  // Keep the numbers fresh while messages are going out and receipts come in.
  useEffect(() => {
    if (!d || !live(d)) return undefined;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [d, load]);
  async function retry(messageId) {
    setBusy(messageId || 'all');
    try {
      const r = await api(messageId ? `/admin/whatsapp/messages/${messageId}/retry` : `/admin/whatsapp/campaigns/${id}/retry`, { method: 'POST' });
      toast(r.message);
      setTimeout(() => { load(); onChanged(); }, 800);
    } catch (e) {
      toast(e.message, 'warn');
    } finally {
      setBusy('');
    }
  }
  if (d === false) return <section className="a-panel"><p className="a-error">Could not load this notification.</p></section>;
  if (!d) return <section className="a-panel"><p>Loading…</p></section>;
  const c = d.counts;
  const tabs = [['', 'All', d.recipients], ['read', 'Read', c.read], ['delivered', 'Delivered', c.delivered], ['sent', 'Sent', c.sent], ['waiting', 'Waiting', c.waiting], ['failed', 'Failed', c.failed], ['skipped', 'Skipped', c.skipped]];
  return (
    <section className="a-panel a-wa-detail" aria-labelledby="wa-detail-title">
      <div className="a-head a-wa-detail-head">
        <h2 id="wa-detail-title">{when(d.createdAt)} · {d.audience === 'all' ? 'All subscribers' : `${d.recipients} selected`}</h2>
        <span className="a-actions">
          {c.failed > 0 && <button type="button" className="a-btn" disabled={!!busy} onClick={() => retry()}><Icon name="refresh" size={16} /> Retry {c.failed} failed</button>}
          <button type="button" className="a-btn" onClick={onClose}>Close</button>
        </span>
      </div>
      <p className="a-wa-msg">“{d.message}”<small className="a-muted"> · by {d.createdBy || 'the team'}</small></p>
      <div className="a-tabs" role="tablist" aria-label="Delivery status">
        {tabs.map(([k, label, n]) => (
          <button key={k || 'all'} role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => { setTab(k); setPage(1); }}>{label}<span className="a-count">{n || 0}</span></button>
        ))}
      </div>
      {d.messages.items.length === 0 ? <p className="a-muted">Nobody here.</p> : (
        <div className="a-table-wrap">
          <table className="a-table">
            <thead><tr><th>Customer</th><th>Status</th><th>Details</th><th>Last change</th><th><span className="sr-only">Action</span></th></tr></thead>
            <tbody>
              {d.messages.items.map((m) => {
                const retrying = m.status === 'queued' && m.attempts > 0;
                const [label, tone] = retrying ? ['Retrying', 'warn'] : STATUS[m.status] || [m.status, ''];
                return (
                  <tr key={m.id}>
                    <td>{m.name || '—'}<br /><small dir="ltr">{m.phone}</small></td>
                    <td><span className={`a-pill ${tone}`}>{label}</span></td>
                    <td className="a-wa-why">{m.error || (m.readAt ? `Read ${when(m.readAt)}` : m.deliveredAt ? `Delivered ${when(m.deliveredAt)}` : m.sentAt ? `Sent ${when(m.sentAt)}` : '—')}{retrying && m.nextAttemptAt && <small className="a-muted"><br />next try {when(m.nextAttemptAt)} · attempt {m.attempts + 1} of 4</small>}</td>
                    <td>{when(m.failedAt || m.readAt || m.deliveredAt || m.sentAt || m.updatedAt)}</td>
                    <td className="a-cell-action">{m.status === 'failed' && <button type="button" className="a-btn a-quiet" disabled={!!busy} onClick={() => retry(m.id)}>{busy === m.id ? 'Retrying…' : 'Retry'}</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={d.messages.page} pages={d.messages.pages} total={d.messages.total} noun="messages" onPage={setPage} />
    </section>
  );
}

function History({ open, setOpen, reload, bump }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  useEffect(() => {
    api(`/admin/whatsapp/campaigns?page=${page}&limit=10`).then(setData).catch(() => setData({ items: [], total: 0, page: 1, pages: 1 }));
  }, [page, reload]);
  // Refresh while something is still sending or receipts are coming in.
  useEffect(() => {
    if (!data?.items.some(live)) return undefined;
    const t = setTimeout(bump, 5000);
    return () => clearTimeout(t);
  }, [data, bump]);
  return (
    <section className="a-panel">
      <h2>History</h2>
      <div className="a-wa-legend" aria-hidden="true"><span className="is-read">Read</span><span className="is-delivered">Delivered</span><span className="is-sent">Sent</span><span className="is-failed">Failed</span></div>
      {!data ? <p>Loading…</p> : data.items.length === 0 ? <p className="a-muted">Nothing sent yet.</p> : (
        <div className="a-table-wrap">
          <table className="a-table a-wa-history">
            <thead><tr><th>Sent</th><th>Message</th><th>To</th><th>Delivery</th><th><span className="sr-only">Details</span></th></tr></thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id} className={open === c.id ? 'is-open' : ''}>
                  <td>{when(c.createdAt)}<br /><small>{c.createdBy}</small></td>
                  <td className="a-wa-msg-cell">{c.message.length > 90 ? `${c.message.slice(0, 90)}…` : c.message}</td>
                  <td>{c.audience === 'all' ? `All · ${c.recipients}` : `${c.recipients} selected`}</td>
                  <td><DeliveryBar counts={c.counts} total={c.recipients} /><small>{summary(c.counts)}{!c.finishedAt && ' · sending'}</small></td>
                  <td className="a-cell-action"><button type="button" className="a-btn a-quiet" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? 'Hide' : 'Details'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={data.page} pages={data.pages} total={data.total} noun="notifications" onPage={setPage} />}
    </section>
  );
}

function Subscribers({ onChanged }) {
  const { toast } = useStore();
  const [f, setF] = useState({ q: '', status: 'subscribed', leads: false });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => setPage(1), [f]);
  useEffect(() => {
    const id = setTimeout(() => api(`/admin/whatsapp/contacts${toQuery({ q: f.q, status: f.status, leads: f.leads ? '1' : '', page, limit: 25 })}`).then(setData).catch(() => setData({ items: [], total: 0, page: 1, pages: 1 })), 250);
    return () => clearTimeout(id);
  }, [f, page, reload]);
  async function stop(c) {
    if (!window.confirm(`Unsubscribe ${c.name || c.phone}? They will get no more WhatsApp updates unless they subscribe again themselves.`)) return;
    try {
      await api(`/admin/whatsapp/contacts/${c.id}`, { method: 'PATCH', body: { subscribed: false } });
      toast('Unsubscribed');
      setReload((n) => n + 1);
      onChanged();
    } catch (e) {
      toast(e.message, 'warn');
    }
  }
  const REASON = { customer: 'by the customer', reply: 'replied STOP', admin: 'by the team', blocked: 'turned off in WhatsApp' };
  return (
    <section className="a-panel">
      <div className="a-filters">
        <input type="search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Search name, phone or email" aria-label="Search subscribers" />
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Status"><option value="subscribed">Subscribed</option><option value="unsubscribed">Unsubscribed</option><option value="all">All</option></select>
        <label className="a-check"><input type="checkbox" checked={f.leads} onChange={(e) => setF({ ...f, leads: e.target.checked })} /> AI leads only</label>
      </div>
      {!data ? <p>Loading…</p> : data.items.length === 0 ? <p className="a-muted">Nobody here yet.</p> : (
        <div className="a-table-wrap">
          <table className="a-table">
            <thead><tr><th>Customer</th><th>From</th><th>Status</th><th>Last message</th><th><span className="sr-only">Action</span></th></tr></thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id}>
                  <td>{c.name || '—'}<br /><small dir="ltr">{c.phone}</small>{c.email && <><br /><small>{c.email}</small></>}</td>
                  <td>{c.lead ? <span className={`a-pill ${LEAD_TONE(c.lead.score)}`}>AI lead {c.lead.score}</span> : c.source === 'account' ? 'Account' : c.source === 'concierge' ? 'Concierge' : 'Website'}</td>
                  <td>{c.subscribed ? <><span className="a-pill ok">Subscribed</span><br /><small>{when(c.subscribedAt)}</small></> : <><span className="a-pill off">Unsubscribed</span><br /><small>{REASON[c.unsubscribeReason] || ''} · {when(c.unsubscribedAt)}</small></>}</td>
                  <td>{when(c.lastMessageAt)}</td>
                  <td className="a-cell-action">{c.subscribed && <button type="button" className="a-btn a-quiet" onClick={() => stop(c)}>Unsubscribe</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={data.page} pages={data.pages} total={data.total} noun="people" onPage={setPage} />}
    </section>
  );
}

export default function WhatsApp() {
  const [status, setStatus] = useState(null);
  const [view, setView] = useState('send');
  const [open, setOpen] = useState(null);
  const [reload, setReload] = useState(0);
  const bump = useCallback(() => setReload((n) => n + 1), []);
  useEffect(() => {
    api('/admin/whatsapp/status').then(setStatus).catch(() => setStatus({ configured: false, subscribed: 0, unsubscribed: 0, leads: 0 }));
  }, [reload]);

  return (
    <div>
      <header className="a-head">
        <h1>WhatsApp</h1>
        {status && <span className="a-muted">{status.subscribed} subscriber{status.subscribed === 1 ? '' : 's'} · {status.leads} from AI leads · {status.unsubscribed} unsubscribed</span>}
      </header>
      {status && !status.configured && (
        <p className="a-note"><Icon name="alert" size={16} /> <span>WhatsApp updates are not set up on the server yet: the approved message template still needs adding (WHATSAPP_NOTIFY_TEMPLATE, with the access token and phone number ID). Customers can still subscribe meanwhile.</span></p>
      )}
      {status?.configured && !status.statusUpdates && (
        <p className="a-note"><Icon name="alert" size={16} /> <span>Delivery and read receipts need the WhatsApp webhook (WHATSAPP_APP_SECRET). Until then messages show as “Sent”.</span></p>
      )}
      <div className="a-tabs" role="tablist" aria-label="WhatsApp">
        <button role="tab" aria-selected={view === 'send'} className={view === 'send' ? 'is-on' : ''} onClick={() => setView('send')}>Notify</button>
        <button role="tab" aria-selected={view === 'people'} className={view === 'people' ? 'is-on' : ''} onClick={() => setView('people')}>Subscribers</button>
      </div>
      {!status ? <p>Loading…</p> : view === 'send' ? (
        <>
          <Composer status={status} onSent={(id) => { setOpen(id); bump(); }} />
          <History open={open} setOpen={setOpen} reload={reload} bump={bump} />
          {open && <CampaignDetail key={open} id={open} onClose={() => setOpen(null)} onChanged={bump} />}
        </>
      ) : <Subscribers onChanged={bump} />}
    </div>
  );
}
