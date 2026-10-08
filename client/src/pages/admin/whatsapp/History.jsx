import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, toQuery } from '../../../lib/api';
import { useStore } from '../../../context/StoreContext';
import { Pager } from '../Fields';
import Icon from '../../../components/Icon';
import { DeliveryBar, STATUS, AUDIENCE, campaignState, live, summary, people, when } from './shared';

// Every campaign: sent, scheduled, cancelled or stopped, with delivery.
export function HistoryList({ limit = 20, compact = false, filter }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    api(`/admin/whatsapp/campaigns?page=${page}&limit=${limit}`).then(setData).catch(() => setData({ items: [], total: 0, page: 1, pages: 1 }));
  }, [page, limit, tick]);
  useEffect(() => {
    if (!data?.items.some(live)) return undefined;
    const t = setTimeout(() => setTick((n) => n + 1), 5000);
    return () => clearTimeout(t);
  }, [data]);
  const items = (data?.items || []).filter(filter || (() => true));
  if (!data) return <p>Loading…</p>;
  if (!items.length) return <p className="a-muted">{compact ? 'Nothing yet.' : 'No campaigns yet. Start one from “New campaign”.'}</p>;
  return (
    <>
      {!compact && <div className="a-wa-legend" aria-hidden="true"><span className="is-read">Read</span><span className="is-delivered">Delivered</span><span className="is-sent">Sent</span><span className="is-failed">Failed</span></div>}
      <div className="a-table-wrap">
        <table className="a-table a-wa-history">
          <thead><tr><th>Campaign</th><th>Audience</th><th>Delivery</th><th><span className="sr-only">Open</span></th></tr></thead>
          <tbody>
            {items.map((c) => {
              const [label, tone] = campaignState(c);
              return (
                <tr key={c.id}>
                  <td className="a-wa-msg-cell">
                    <Link to={`/admin/whatsapp/history/${c.id}`} className="a-row-link">{c.title || (c.message.length > 70 ? `${c.message.slice(0, 70)}…` : c.message)}</Link>
                    <small>{when(c.createdAt)} · {c.templateName ? `template “${c.templateName}”` : 'written for this campaign'}{c.createdBy ? ` · ${c.createdBy}` : ''}</small>
                  </td>
                  <td>{c.audience === 'selected' ? `${c.recipients} selected` : `${AUDIENCE[c.audience]} · ${c.recipients}`}</td>
                  <td>
                    {label === 'Sent' || label === 'Sending' ? <><DeliveryBar counts={c.counts} total={c.recipients} /><small>{summary(c.counts)}</small></> : <span className={`a-pill ${tone}`}>{label}</span>}
                    {c.problem && <small className="a-warn">{c.problem}</small>}
                  </td>
                  <td className="a-cell-action"><Link to={`/admin/whatsapp/history/${c.id}`} className="a-btn a-quiet">Results</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!compact && <Pager page={data.page} pages={data.pages} total={data.total} noun="campaigns" onPage={setPage} />}
    </>
  );
}

export function History() {
  return (
    <div>
      <div className="a-section-head"><p className="a-muted">Every campaign, newest first. Open one to see each person’s delivery and retry failures.</p><Link to="/admin/whatsapp/campaigns" className="a-btn a-primary"><Icon name="send" size={16} /> New campaign</Link></div>
      <section className="a-panel"><HistoryList /></section>
    </div>
  );
}

// One campaign: the message, totals, and every person's status.
export function CampaignResults({ id: idProp, embedded = false }) {
  const params = useParams();
  const id = idProp || params.id;
  const { toast } = useStore();
  const [tab, setTab] = useState('');
  const [page, setPage] = useState(1);
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState('');
  const load = useCallback(() => api(`/admin/whatsapp/campaigns/${id}${toQuery({ status: tab, page, limit: 50 })}`).then(setD).catch(() => setD(false)), [id, tab, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!d || !live(d)) return undefined;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [d, load]);
  async function act(kind, messageId) {
    if (kind === 'cancel' && !window.confirm('Cancel this campaign? Messages not yet sent will not go out.')) return;
    setBusy(messageId || kind);
    try {
      const r = await api(kind === 'cancel' ? `/admin/whatsapp/campaigns/${id}/cancel` : messageId ? `/admin/whatsapp/messages/${messageId}/retry` : `/admin/whatsapp/campaigns/${id}/retry`, { method: 'POST' });
      toast(r.message);
      setTimeout(load, 800);
    } catch (e) {
      toast(e.message, 'warn');
    } finally {
      setBusy('');
    }
  }
  if (d === false) return <section className="a-panel"><p className="a-error">Could not load this campaign.</p></section>;
  if (!d) return <section className="a-panel"><p>Loading…</p></section>;
  const c = d.counts;
  const [label, tone] = campaignState(d);
  const scheduled = label.startsWith('Sends');
  const tabs = [['', 'All', d.recipients], ['read', 'Read', c.read], ['delivered', 'Delivered', c.delivered], ['sent', 'Sent', c.sent], ['waiting', 'Waiting', c.waiting], ['failed', 'Failed', c.failed], ['skipped', 'Skipped', c.skipped]];
  return (
    <div>
      {!embedded && <div className="a-section-head"><Link to="/admin/whatsapp/history" className="a-link"><Icon name="arrow-left" size={16} /> All campaigns</Link></div>}
      <section className="a-panel" aria-labelledby="wa-res-title">
        <div className="a-section-head">
          <h2 id="wa-res-title">{scheduled ? 'Scheduled' : d.finishedAt ? 'Results' : 'Sending · updates live'}</h2>
          <span className="a-actions">
            <span className={`a-pill ${tone}`}>{label}</span>
            {(scheduled || (!d.finishedAt && !d.cancelledAt)) && <button type="button" className="a-btn" disabled={!!busy} onClick={() => act('cancel')}>Cancel</button>}
            {c.failed > 0 && !d.cancelledAt && <button type="button" className="a-btn" disabled={!!busy} onClick={() => act('retry')}><Icon name="refresh" size={16} /> Retry {c.failed} failed</button>}
          </span>
        </div>
        <div className="a-tiles a-res-tiles">
          <div className="a-tile"><span>Sent</span><b>{(c.sent || 0) + (c.delivered || 0) + (c.read || 0)}</b></div>
          <div className="a-tile"><span>Delivered</span><b>{(c.delivered || 0) + (c.read || 0)}</b></div>
          <div className="a-tile"><span>Read</span><b>{c.read || 0}</b></div>
          <div className="a-tile"><span>Failed</span><b className={c.failed ? 'a-warn' : ''}>{c.failed || 0}</b></div>
        </div>
        {d.problem && <p className="a-note is-bad"><Icon name="error" size={16} /><span>Stopped before sending: {d.problem} Fix it, then use Retry.</span></p>}
        {scheduled && <p className="a-note"><Icon name="alert" size={16} /><span>Goes out {when(d.scheduledAt)} to {people(d.recipients)}. The product and coupon are checked again just before.</span></p>}
        <dl className="a-facts">
          <dt>Message</dt><dd>{d.messages.items[0]?.body ? <>{d.messages.items[0].body.replace(/\*/g, '')}<small className="a-muted"> (as {(d.messages.items[0].name || 'the first person').split(' ')[0]} received it)</small></> : <>{d.title && <b>{d.title} </b>}{d.message}</>}</dd>
          <dt>To</dt><dd>{d.audience === 'selected' ? `${d.recipients} selected` : `${AUDIENCE[d.audience]} · ${people(d.recipients)}`}</dd>
          {(d.product || d.coupon) && <><dt>With</dt><dd>{[d.product && d.product.toUpperCase(), d.coupon && `coupon ${d.coupon}`, d.image && 'picture'].filter(Boolean).join(' · ')}</dd></>}
          <dt>Created</dt><dd>{when(d.createdAt)}{d.createdBy ? ` by ${d.createdBy}` : ''}{d.templateName ? ` · template “${d.templateName}”` : ''}</dd>
        </dl>
      </section>
      <section className="a-panel">
        <h2>Each person</h2>
        <div className="a-tabs" role="tablist" aria-label="Delivery status">
          {tabs.map(([k, l, n]) => (
            <button key={k || 'all'} role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => { setTab(k); setPage(1); }}>{l}<span className="a-count">{n || 0}</span></button>
          ))}
        </div>
        {d.messages.items.length === 0 ? <p className="a-muted">Nobody here.</p> : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>Customer</th><th>Status</th><th>Details</th><th>Last change</th><th><span className="sr-only">Action</span></th></tr></thead>
              <tbody>
                {d.messages.items.map((m) => {
                  const retrying = m.status === 'queued' && m.attempts > 0;
                  const [l, t] = retrying ? ['Retrying', 'warn'] : STATUS[m.status] || [m.status, ''];
                  return (
                    <tr key={m.id}>
                      <td>{m.name || '—'}<br /><small dir="ltr">{m.phone}</small></td>
                      <td><span className={`a-pill ${t}`}>{l}</span></td>
                      <td className="a-wa-why">{m.error || (m.readAt ? `Read ${when(m.readAt)}` : m.deliveredAt ? `Delivered ${when(m.deliveredAt)}` : m.sentAt ? `Sent ${when(m.sentAt)}` : scheduled ? `Goes out ${when(d.scheduledAt)}` : '—')}{retrying && m.nextAttemptAt && <small className="a-muted"><br />next try {when(m.nextAttemptAt)} · attempt {m.attempts + 1} of 4</small>}</td>
                      <td>{when(m.failedAt || m.readAt || m.deliveredAt || m.sentAt || m.updatedAt)}</td>
                      <td className="a-cell-action">{m.status === 'failed' && !d.cancelledAt && <button type="button" className="a-btn a-quiet" disabled={!!busy} onClick={() => act('retry', m.id)}>{busy === m.id ? 'Retrying…' : 'Retry'}</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={d.messages.page} pages={d.messages.pages} total={d.messages.total} noun="messages" onPage={setPage} />
      </section>
    </div>
  );
}
