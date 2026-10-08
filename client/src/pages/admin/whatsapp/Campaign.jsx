import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useStore } from '../../../context/StoreContext';
import Icon from '../../../components/Icon';
import { ContentForm, AiPanel, PhonePreview, Picker, EMPTY_CONTENT, contentOf, fieldErrors, people, AUDIENCE, when } from './shared';
import { CampaignResults } from './History';

// A new campaign in five steps: 1 Audience → 2 Message → 3 Preview →
// 4 Send (now or later) → 5 Results. Only the current step's choices show;
// Back keeps everything. Nothing is sent before step 4's confirmed button.
const STEPS = [['Audience', 'Who receives it'], ['Message', 'Template or new'], ['Preview', 'Check it'], ['Send', 'Now or later'], ['Results', 'Delivery']];
const localInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function Campaign({ status }) {
  const { toast } = useStore();
  const [params, setParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [audience, setAudience] = useState(params.get('contact') ? 'selected' : 'all');
  const [selected, setSelected] = useState(new Map());
  const [mode, setMode] = useState(params.get('template') ? 'saved' : '');
  const [templates, setTemplates] = useState(null);
  const [templateId, setTemplateId] = useState(params.get('template') || '');
  const [content, setContent] = useState(EMPTY_CONTENT);
  const [editing, setEditing] = useState(false); // changing a saved template's text for this campaign only
  const [drafted, setDrafted] = useState(false);
  const [previewAs, setPreviewAs] = useState('');
  const [preview, setPreview] = useState(null);
  const [whenMode, setWhenMode] = useState('now');
  const [at, setAt] = useState(() => localInput(new Date(Date.now() + 3600e3)));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);

  useEffect(() => {
    api('/admin/whatsapp/templates?active=true').then((d) => setTemplates(d.items)).catch(() => setTemplates([]));
  }, []);
  // "Notify" from an AI lead: that person, already chosen.
  useEffect(() => {
    const id = params.get('contact');
    if (id) api(`/admin/whatsapp/contacts?ids=${id}`).then((d) => d.items[0] && setSelected(new Map([[d.items[0].id, d.items[0]]]))).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const tpl = templates?.find((t) => t.id === templateId);
  useEffect(() => {
    if (mode === 'saved' && tpl && !editing) setContent(contentOf(tpl));
  }, [mode, tpl, editing]);

  const counts = { all: status.subscribed, leads: status.leads, selected: selected.size };
  const recipients = counts[audience] || 0;
  const usingTemplate = mode === 'saved' && templateId && !editing;
  const messageReady = mode === 'saved' ? !!tpl : content.message.trim().length > 0;
  const firstSelected = audience === 'selected' ? [...selected.values()][0] : null;
  const contactId = previewAs || firstSelected?.id || '';

  function go(n) {
    setError('');
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function send() {
    const scheduled = whenMode === 'later' ? new Date(at) : null;
    if (scheduled && (Number.isNaN(scheduled.getTime()) || scheduled < new Date())) return setError('Choose a time in the future, or send now.');
    const q = scheduled
      ? `Schedule this WhatsApp message to ${people(recipients)} for ${when(scheduled)}? You can cancel it until then.`
      : `Send this WhatsApp message to ${people(recipients)} now? This cannot be undone.`;
    if (!window.confirm(q)) return;
    setBusy(true);
    setError('');
    try {
      const body = {
        audience, confirm: true,
        ...(audience === 'selected' && { contactIds: [...selected.keys()] }),
        ...(mode === 'saved' && templateId && { templateId }),
        ...(!usingTemplate && content),
        ...(scheduled && { scheduledAt: scheduled.toISOString() }),
      };
      const c = await api('/admin/whatsapp/campaigns', { method: 'POST', body });
      toast(scheduled ? `Scheduled for ${when(scheduled)}` : `Sending to ${people(c.recipients)}`);
      setSent(c);
      setParams({}, { replace: true });
      go(5);
    } catch (e) {
      setError(e.message);
      setErrors(fieldErrors(e));
      if (e.data?.errors?.length || e.code === 'CONTENT_PROBLEM') setStep(e.code === 'CONTENT_PROBLEM' ? 3 : 2);
    } finally {
      setBusy(false);
    }
  }
  function startOver() {
    setSent(null);
    setStep(1);
    setMode('');
    setTemplateId('');
    setContent(EMPTY_CONTENT);
    setSelected(new Map());
    setEditing(false);
    setDrafted(false);
    setWhenMode('now');
  }

  return (
    <div className="a-flow">
      <ol className="a-stepper" aria-label="Steps">
        {STEPS.map(([label, sub], i) => {
          const n = i + 1;
          const done = n < step || (n === 5 && sent);
          const can = !sent && n < step;
          return (
            <li key={label} className={n === step ? 'is-on' : done ? 'is-done' : ''} aria-current={n === step ? 'step' : undefined}>
              {can ? <button type="button" onClick={() => go(n)}><b>{n} {label}</b><span>{stepNote(n) || sub}</span></button> : <span><b>{n} {label}</b><span>{(n < step && stepNote(n)) || sub}</span></span>}
            </li>
          );
        })}
      </ol>

      {!status.configured && step < 5 && (
        <p className="a-note"><Icon name="alert" size={16} /><span>WhatsApp is not set up on the server yet, so the last step cannot send. You can still prepare and preview. <Link to="/admin/whatsapp/settings" className="a-textbtn">What’s missing</Link></span></p>
      )}

      {step === 1 && (
        <section className="a-panel">
          <h2>Who should receive it?</h2>
          <div className="a-choice" role="radiogroup" aria-label="Audience">
            {[['all', 'Everyone who verified their number and agreed.'], ['leads', 'Subscribers who came from the AI concierge.'], ['selected', 'Search and tick people, e.g. those who asked about one fragrance.']].map(([k, d]) => (
              <label key={k} className={audience === k ? 'is-on' : ''}>
                <span className="a-choice-head"><input type="radio" name="aud" checked={audience === k} onChange={() => setAudience(k)} /> {AUDIENCE[k]}{k === 'leads' ? ' only' : ''}</span>
                <span className="a-choice-n">{k === 'selected' ? (selected.size ? `${selected.size} chosen` : 'Choose…') : people(counts[k] || 0)}</span>
                <small>{d}</small>
              </label>
            ))}
          </div>
          {audience === 'selected' && <Picker selected={selected} setSelected={setSelected} />}
          <p className="a-muted a-hint">Unsubscribed people are never included, and everyone is checked again just before their message goes.</p>
          <div className="a-flow-foot">
            <span className="a-muted">Step 1 of 5 · {people(recipients)}</span>
            <button type="button" className="a-btn a-primary" disabled={!recipients} onClick={() => go(2)}>Next: message</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="a-panel">
          <h2>What should it say?</h2>
          <div className="a-choice" role="radiogroup" aria-label="How to write it">
            {[['ai', 'AI Generate', 'pencil', 'Describe it in a sentence; the AI writes a draft you can edit. Nothing is sent or saved.'], ['saved', 'Saved template', 'copy', templates ? `Pick one you made before. ${templates.length} active.` : 'Pick one you made before.'], ['manual', 'Create manually', 'plus', 'Write the title, message, product, picture, coupon and button yourself.']].map(([k, label, icon, d]) => (
              <label key={k} className={mode === k ? 'is-on' : ''}>
                <span className="a-choice-head"><input type="radio" name="mode" checked={mode === k} onChange={() => { if (k !== 'saved' && mode === 'saved') setContent(EMPTY_CONTENT); setMode(k); setEditing(false); }} /> <Icon name={icon} size={16} /> {label}</span>
                <small>{d}</small>
              </label>
            ))}
          </div>

          {mode === 'saved' && (templates?.length ? (
            <div className="a-table-wrap a-tpl-pick">
              <table className="a-table">
                <thead><tr><th><span className="sr-only">Choose</span></th><th>Template</th><th>Product · coupon</th><th>Last used</th></tr></thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.id} className={templateId === t.id ? 'is-open' : ''} onClick={() => { setTemplateId(t.id); setEditing(false); }}>
                      <td><input type="radio" name="tpl" checked={templateId === t.id} onChange={() => { setTemplateId(t.id); setEditing(false); }} aria-label={t.name} /></td>
                      <td><b>{t.name}</b> <span className={`a-pill ${t.source === 'ai' ? 'ai' : ''}`}>{t.source === 'ai' ? 'AI draft, edited' : 'Manual'}</span><br /><small>“{t.message.length > 80 ? `${t.message.slice(0, 80)}…` : t.message}”</small></td>
                      <td>{[t.product?.toUpperCase(), t.coupon].filter(Boolean).join(' · ') || '—'}</td>
                      <td>{t.lastUsedAt ? when(t.lastUsedAt) : 'Never'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : templates && <p className="a-muted a-hint">No active templates yet. <Link to="/admin/whatsapp/templates/new" className="a-textbtn">Make one</Link>, or choose AI Generate or Create manually.</p>)}

          {mode === 'ai' && !drafted && <AiPanel onDraft={(d) => { setContent(contentOf(d)); setDrafted(true); }} />}
          {mode === 'ai' && drafted && <p className="a-note"><Icon name="alert" size={16} /><span>AI draft. Read it and change anything before you continue. <button type="button" className="a-textbtn" onClick={() => setDrafted(false)}>Write another</button></span></p>}
          {(mode === 'manual' || (mode === 'ai' && drafted) || (mode === 'saved' && editing)) && (
            <div className="a-wa-split">
              <div className="a-wa-col">
                {mode === 'saved' && <p className="a-note"><Icon name="alert" size={16} /><span>Changes here are for this campaign only; the saved template stays as it is.</span></p>}
                <ContentForm value={content} onChange={setContent} errors={errors} />
              </div>
              <aside className="a-wa-side"><span className="a-eyebrow">Live preview</span><PhonePreview content={content} contactId={contactId} /></aside>
            </div>
          )}
          {error && <p className="a-error" role="alert">{error}</p>}
          <div className="a-flow-foot">
            <button type="button" className="a-btn" onClick={() => go(1)}>Back</button>
            <span className="a-actions">
              {mode === 'saved' && tpl && !editing && <button type="button" className="a-btn a-quiet" onClick={() => setEditing(true)}><Icon name="pencil" size={16} /> Edit for this campaign</button>}
              <button type="button" className="a-btn a-primary" disabled={!messageReady} onClick={() => go(3)}>Next: preview</button>
            </span>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="a-panel">
          <h2>This is what they will see</h2>
          <div className="a-wa-split">
            <div className="a-wa-col">
              <p className="a-muted">Variables are filled in for each person: their first name, prices in their currency (₹ or AED) and the coupon’s discount.</p>
              {audience === 'selected' && selected.size > 1 && (
                <label className="a-inline-field">Preview as
                  <select value={contactId} onChange={(e) => setPreviewAs(e.target.value)}>
                    {[...selected.values()].map((c) => <option key={c.id} value={c.id}>{c.name || c.phone}</option>)}
                  </select>
                </label>
              )}
              <dl className="a-facts">
                <dt>To</dt><dd>{audience === 'selected' ? `${people(selected.size)} chosen` : `${AUDIENCE[audience]} · ${people(recipients)}`}</dd>
                <dt>Message</dt><dd>{usingTemplate ? `Template “${tpl?.name}”` : mode === 'ai' ? 'AI draft (edited)' : mode === 'saved' ? `“${tpl?.name}”, changed for this campaign` : 'Written here'}</dd>
              </dl>
              <p className="a-muted a-hint">Want to change something? <button type="button" className="a-textbtn" onClick={() => { if (mode === 'saved') setEditing(true); go(2); }}>Edit message</button></p>
            </div>
            <aside className="a-wa-side"><PhonePreview content={usingTemplate ? undefined : content} templateId={usingTemplate ? templateId : undefined} contactId={contactId} onResult={setPreview} /></aside>
          </div>
          <div className="a-flow-foot">
            <button type="button" className="a-btn" onClick={() => go(2)}>Back</button>
            <button type="button" className="a-btn a-primary" disabled={!preview?.canSend} onClick={() => go(4)}>Next: send</button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="a-panel">
          <h2>Send now or later?</h2>
          <div className="a-radio-row" role="radiogroup" aria-label="When">
            <label className={whenMode === 'now' ? 'is-on' : ''}><input type="radio" name="when" checked={whenMode === 'now'} onChange={() => setWhenMode('now')} /> Send now</label>
            <label className={whenMode === 'later' ? 'is-on' : ''}><input type="radio" name="when" checked={whenMode === 'later'} onChange={() => setWhenMode('later')} /> Schedule</label>
            {whenMode === 'later' && <input type="datetime-local" value={at} min={localInput(new Date())} onChange={(e) => setAt(e.target.value)} aria-label="Date and time" />}
          </div>
          <dl className="a-facts a-confirm">
            <dt>To</dt><dd><b>{people(recipients)}</b> · {AUDIENCE[audience]}{audience === 'leads' ? ' only' : ''}</dd>
            <dt>Messages</dt><dd>{recipients} (one each)</dd>
            <dt>Message</dt><dd>{preview?.title || tpl?.name || 'Your message'}{preview?.image ? ` · with picture${preview.cta ? ' and button' : ''}` : ''}</dd>
            {preview?.coupon && <><dt>Coupon</dt><dd>{preview.coupon.code} (checked again just before sending)</dd></>}
            {preview?.product && <><dt>Product</dt><dd>{preview.product.name} (checked again just before sending)</dd></>}
            <dt>When</dt><dd>{whenMode === 'now' ? 'Straight away' : when(new Date(at))}</dd>
          </dl>
          {error && <p className="a-error" role="alert">{error}</p>}
          <div className="a-flow-foot">
            <button type="button" className="a-btn" onClick={() => go(3)}>Back</button>
            <button type="button" className="a-btn a-primary" disabled={busy || !status.configured || !recipients} onClick={send}>
              <Icon name="send" size={16} /> {busy ? 'One moment…' : whenMode === 'now' ? `Send to ${people(recipients)}` : `Schedule for ${people(recipients)}`}
            </button>
          </div>
        </section>
      )}

      {step === 5 && sent && (
        <>
          <CampaignResults id={sent.id} embedded />
          <div className="a-flow-foot">
            <Link to="/admin/whatsapp/history" className="a-btn">All campaigns</Link>
            <button type="button" className="a-btn a-primary" onClick={startOver}><Icon name="plus" size={16} /> New campaign</button>
          </div>
        </>
      )}
    </div>
  );

  function stepNote(n) {
    if (n === 1) return audience === 'selected' ? `${selected.size} chosen` : `${AUDIENCE[audience]} · ${recipients}`;
    if (n === 2) return mode === 'saved' && tpl ? tpl.name : mode === 'ai' && drafted ? 'AI draft' : mode === 'manual' && content.message ? 'Written here' : '';
    if (n === 4 && sent) return sent.scheduledAt ? 'Scheduled' : 'Sent';
    return '';
  }
}
