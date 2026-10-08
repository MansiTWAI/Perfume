import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { api, toQuery } from '../../lib/api';
import { useStore } from '../../context/StoreContext';
import { Pager } from './Fields';
import Icon from '../../components/Icon';
import { LEAD_TONE, when, people } from './whatsapp/shared';
import { TemplateList, TemplateEdit } from './whatsapp/Templates';
import Campaign from './whatsapp/Campaign';
import { History, HistoryList, CampaignResults } from './whatsapp/History';

// WhatsApp updates, in six plain sections:
//   Overview     how it is going, and "New campaign"
//   Subscribers  who signed up (number + consent), unsubscribe
//   Templates    saved messages (AI Generate or Create manually)
//   Campaigns    send in five steps: audience, message, preview, send, results
//   History      every campaign and each person's delivery
//   Settings     what the server still needs, as a checklist
const TABS = [['', 'Overview', true], ['subscribers', 'Subscribers'], ['templates', 'Templates'], ['campaigns', 'Campaigns'], ['history', 'History'], ['settings', 'Settings']];

function Overview({ status }) {
  const m = status.month || {};
  const now = new Date();
  return (
    <div>
      {!status.configured && (
        <p className="a-note"><Icon name="alert" size={16} /><span>WhatsApp sending is not set up yet, so campaigns cannot go out. Customers can still subscribe. <Link to="/admin/whatsapp/settings" className="a-textbtn">See what’s missing</Link></span></p>
      )}
      <div className="a-tiles a-wa-tiles">
        <div className="a-tile"><span>Subscribers</span><b>{status.subscribed}</b><small className="a-ok">{m.joined ? `+${m.joined} this month` : 'No new ones this month'}</small></div>
        <div className="a-tile"><span>From AI leads</span><b>{status.leads}</b><small>{status.subscribed ? `${Math.round((status.leads / status.subscribed) * 100)}% of subscribers` : '—'}</small></div>
        <div className="a-tile"><span>Delivered (30 days)</span><b>{m.deliveredRate == null ? '—' : `${m.deliveredRate}%`}</b><small>{m.notifications || 0} campaign{m.notifications === 1 ? '' : 's'}</small></div>
        <div className="a-tile"><span>Read (30 days)</span><b>{m.readRate == null ? '—' : `${m.readRate}%`}</b><small>{m.left ? `${m.left} stopped updates` : 'Nobody stopped updates'}</small></div>
      </div>
      {status.scheduled > 0 && (
        <section className="a-panel">
          <h2>Coming up</h2>
          <HistoryList compact limit={50} filter={(c) => c.scheduledAt && new Date(c.scheduledAt) > now && !c.cancelledAt && !c.finishedAt} />
        </section>
      )}
      <section className="a-panel">
        <div className="a-section-head"><h2>Recent</h2><Link to="/admin/whatsapp/history" className="a-textbtn">All campaigns</Link></div>
        <HistoryList compact limit={5} />
      </section>
      <section className="a-panel a-wa-how">
        <h2>How it works</h2>
        <ol>
          <li><b>Customers subscribe</b> from the homepage, their account or the AI concierge, with one tap and a consent tick. Anyone who replies STOP is removed and cannot be re-added from the website.</li>
          <li><b>You send a campaign</b>: choose who gets it, pick or write a message (or let the AI draft one), check the preview, send now or later.</li>
          <li><b>Follow the results</b>: sent, delivered, read and failed for each person. Anyone who replies STOP is unsubscribed straight away.</li>
        </ol>
      </section>
    </div>
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
    <div>
      <p className="a-muted a-hint">People who ticked the consent box and subscribed. Only the customer can subscribe; you can unsubscribe someone here.</p>
      <section className="a-panel">
        <div className="a-filters">
          <input type="search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Search name, phone or email" aria-label="Search subscribers" />
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Status"><option value="subscribed">Subscribed</option><option value="unsubscribed">Unsubscribed</option><option value="all">All</option></select>
          <label className="a-check"><input type="checkbox" checked={f.leads} onChange={(e) => setF({ ...f, leads: e.target.checked })} /> AI leads only</label>
        </div>
        {!data ? <p>Loading…</p> : data.items.length === 0 ? <p className="a-muted">{f.q || f.leads ? 'Nobody matches.' : 'Nobody here yet.'}</p> : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>Customer</th><th>Came from</th><th>Status</th><th>Last message</th><th><span className="sr-only">Action</span></th></tr></thead>
              <tbody>
                {data.items.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name || '—'}<br /><small dir="ltr">{c.phone}</small>{c.email && <><br /><small>{c.email}</small></>}</td>
                    <td>{c.lead ? <span className={`a-pill ${LEAD_TONE(c.lead.score)}`}>AI lead · score {c.lead.score}</span> : { account: 'Account page', concierge: 'Concierge', website: 'Website' }[c.source] || 'Website'}</td>
                    <td>{c.subscribed ? <><span className="a-pill ok">Subscribed</span><br /><small>{when(c.subscribedAt)}</small></> : <><span className="a-pill off">Unsubscribed</span><br /><small>{REASON[c.unsubscribeReason] || ''} · {when(c.unsubscribedAt)}</small></>}</td>
                    <td>{when(c.lastMessageAt)}</td>
                    <td className="a-cell-action">
                      {c.subscribed && <Link to={`/admin/whatsapp/campaigns?contact=${c.id}`} className="a-btn a-quiet">Message</Link>}
                      {c.subscribed && <button type="button" className="a-btn a-quiet" onClick={() => stop(c)}>Unsubscribe</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={data.page} pages={data.pages} total={data.total} noun="people" onPage={setPage} />}
      </section>
    </div>
  );
}

function Settings({ status }) {
  const site = window.location.origin.includes('localhost') ? 'https://albarakah.me' : window.location.origin;
  const rows = [
    [status.account, 'WhatsApp account connected', 'The access token and phone number ID are on the server (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID).'],
    [!!status.template, <>Message template {status.template && <code>{status.template}</code>}</>, <>An approved “Marketing” template with the body <code>Hello {'{{1}}'}, {'{{2}}'}</code> and the footer “Reply STOP to unsubscribe” (WHATSAPP_NOTIFY_TEMPLATE).</>],
    [!!status.mediaTemplate, <>Picture template <small className="a-muted">(optional)</small> {status.mediaTemplate && <code>{status.mediaTemplate}</code>}</>, <>The same message with an image header and a URL button <code>{site}/{'{{1}}'}</code> (WHATSAPP_NOTIFY_MEDIA_TEMPLATE). Without it, messages go as text with the link at the end.</>, true],
    [status.statusUpdates && status.webhookVerify, 'Delivery receipts and STOP replies', <>Webhook <code>{site}/api/whatsapp/webhook</code>, subscribed to “messages”, with the app secret and verify token (WHATSAPP_APP_SECRET, WHATSAPP_WEBHOOK_VERIFY_TOKEN).</>],
  ];
  return (
    <section className="a-panel">
      <h2>WhatsApp setup</h2>
      <ul className="a-checklist">
        {rows.map(([ok, title, detail, optional], i) => (
          <li key={i}>
            <span className={ok ? 'a-ok' : optional ? 'a-muted' : 'a-warn'}><Icon name={ok ? 'check' : 'alert'} size={16} /></span>
            <span><b>{title}</b><small>{detail}</small></span>
            <span className={`a-pill ${ok ? 'ok' : optional ? 'off' : 'warn'}`}>{ok ? 'Done' : optional ? 'Not set' : 'Needed'}</span>
          </li>
        ))}
      </ul>
      <p className="a-muted a-hint">These are set by whoever manages the server, in its settings file. Nothing here can be changed from the admin panel, so tokens stay private.</p>
    </section>
  );
}

export default function WhatsApp() {
  const [status, setStatus] = useState(null);
  const [reload, setReload] = useState(0);
  const { pathname } = useLocation();
  const bump = useCallback(() => setReload((n) => n + 1), []);
  useEffect(() => {
    api('/admin/whatsapp/status').then(setStatus).catch(() => setStatus({ configured: false, subscribed: 0, unsubscribed: 0, leads: 0, month: {} }));
  }, [reload, pathname]);
  const inFlow = pathname.startsWith('/admin/whatsapp/campaigns');

  return (
    <div className="a-wa">
      <header className="a-head">
        <h1>WhatsApp</h1>
        {!inFlow && <Link to="/admin/whatsapp/campaigns" className="a-btn a-primary"><Icon name="send" size={16} /> New campaign</Link>}
      </header>
      <nav className="a-subnav" aria-label="WhatsApp sections">
        {TABS.map(([to, label, end]) => <NavLink key={label} to={`/admin/whatsapp${to ? `/${to}` : ''}`} end={end} className={({ isActive }) => (isActive || (!to && /^\/admin\/whatsapp\/?$/.test(pathname)) ? 'active' : '')}>{label}</NavLink>)}
      </nav>
      {!status ? <p>Loading…</p> : (
        <Routes>
          <Route index element={<Overview status={status} />} />
          <Route path="subscribers" element={<Subscribers onChanged={bump} />} />
          <Route path="templates" element={<TemplateList />} />
          <Route path="templates/:id" element={<TemplateEdit />} />
          <Route path="campaigns" element={<Campaign status={status} />} />
          <Route path="history" element={<History />} />
          <Route path="history/:id" element={<CampaignResults />} />
          <Route path="settings" element={<Settings status={status} />} />
        </Routes>
      )}
    </div>
  );
}
