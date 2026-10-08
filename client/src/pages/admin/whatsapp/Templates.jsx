import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useStore } from '../../../context/StoreContext';
import Icon from '../../../components/Icon';
import { ContentForm, AiPanel, PhonePreview, EMPTY_CONTENT, contentOf, fieldErrors, when } from './shared';

// Saved notifications to reuse. Two ways in: AI Generate (a draft to edit) or
// Create manually. Saving never sends.
export function TemplateList() {
  const { toast } = useStore();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    api('/admin/whatsapp/templates').then((d) => setItems(d.items)).catch(() => setItems([]));
  }, [reload]);

  async function act(t, kind) {
    if (kind === 'delete' && !window.confirm(`Delete the template “${t.name}”? Campaigns already sent keep their message.`)) return;
    try {
      if (kind === 'toggle') await api(`/admin/whatsapp/templates/${t.id}`, { method: 'PATCH', body: { active: !t.active } });
      if (kind === 'duplicate') {
        const c = await api(`/admin/whatsapp/templates/${t.id}/duplicate`, { method: 'POST' });
        toast('Copy made');
        return navigate(`/admin/whatsapp/templates/${c.id}`);
      }
      if (kind === 'delete') await api(`/admin/whatsapp/templates/${t.id}`, { method: 'DELETE' });
      toast(kind === 'toggle' ? `${t.name} ${t.active ? 'switched off' : 'switched on'}` : 'Template deleted');
    } catch (e) {
      toast(e.message, 'warn');
    }
    setReload((n) => n + 1);
  }

  const shown = (items || []).filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="a-section-head">
        <p className="a-muted">Saved messages you can send again and again. Saving a template never sends anything.</p>
        <span className="a-actions">
          <Link to="/admin/whatsapp/templates/new?ai=1" className="a-btn"><Icon name="pencil" size={16} /> AI Generate</Link>
          <Link to="/admin/whatsapp/templates/new" className="a-btn a-primary"><Icon name="plus" size={16} /> Create manually</Link>
        </span>
      </div>
      {items && items.length > 6 && <div className="a-filters"><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates" aria-label="Search templates" /></div>}
      {!items ? <p>Loading…</p> : items.length === 0 ? (
        <section className="a-panel a-empty">
          <h2>No templates yet</h2>
          <p className="a-muted">Make your first one: let the AI write a draft from a sentence, or write it yourself.</p>
          <span className="a-actions"><Link to="/admin/whatsapp/templates/new?ai=1" className="a-btn"><Icon name="pencil" size={16} /> AI Generate</Link><Link to="/admin/whatsapp/templates/new" className="a-btn a-primary">Create manually</Link></span>
        </section>
      ) : (
        <ul className="a-tpl-grid">
          {shown.map((t) => (
            <li key={t.id} className={`a-tpl${t.active ? '' : ' is-off'}`}>
              <div className="a-tpl-head">
                <Link to={`/admin/whatsapp/templates/${t.id}`} className="a-tpl-name">{t.name}</Link>
                <button type="button" role="switch" aria-checked={t.active} aria-label={`${t.name}: ${t.active ? 'on' : 'off'}`} title={t.active ? 'Switch off' : 'Switch on'} className={`a-switch${t.active ? ' is-on' : ''}`} onClick={() => act(t, 'toggle')} />
              </div>
              <span className="a-tpl-tags">
                <span className={`a-pill ${t.source === 'ai' ? 'ai' : ''}`}>{t.source === 'ai' ? 'AI draft, edited' : 'Manual'}</span>
                <span className={`a-pill ${t.active ? 'ok' : 'off'}`}>{t.active ? 'Active' : 'Off'}</span>
              </span>
              {t.title && <b className="a-tpl-title">{t.title}</b>}
              <p className="a-tpl-msg">“{t.message.length > 110 ? `${t.message.slice(0, 110)}…` : t.message}”</p>
              <p className="a-muted a-tpl-meta">{[t.product && t.product.toUpperCase(), t.coupon, t.timesUsed ? `used ${t.timesUsed} time${t.timesUsed === 1 ? '' : 's'}` : 'not used yet', t.lastUsedAt && `last ${when(t.lastUsedAt)}`].filter(Boolean).join(' · ')}</p>
              <div className="a-tpl-acts">
                {t.active && <Link to={`/admin/whatsapp/campaigns?template=${t.id}`} className="a-btn a-quiet"><Icon name="send" size={16} /> Use</Link>}
                <Link to={`/admin/whatsapp/templates/${t.id}`} className="a-btn a-quiet"><Icon name="pencil" size={16} /> Edit</Link>
                <button type="button" className="a-btn a-quiet" onClick={() => act(t, 'duplicate')}><Icon name="copy" size={16} /> Duplicate</button>
                <button type="button" className="a-btn a-quiet" onClick={() => act(t, 'delete')} aria-label={`Delete ${t.name}`}><Icon name="trash" size={16} /> Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TemplateEdit() {
  const { id } = useParams();
  const isNew = id === 'new';
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useStore();
  const [name, setName] = useState('');
  const [content, setContent] = useState(isNew ? EMPTY_CONTENT : null);
  const [source, setSource] = useState('manual');
  const [aiOpen, setAiOpen] = useState(isNew && params.get('ai') === '1');
  const [drafted, setDrafted] = useState(false);
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => {
    if (isNew) return;
    api(`/admin/whatsapp/templates/${id}`).then((t) => { setName(t.name); setContent(contentOf(t)); setSource(t.source); setActive(t.active); }).catch((e) => setError(e.message));
  }, [id, isNew]);
  if (!content) return error ? <p className="a-error">{error}</p> : <p>Loading…</p>;

  function onDraft(d) {
    setContent(contentOf(d));
    if (!name) setName(d.name);
    setSource('ai');
    setDrafted(true);
    setAiOpen(false);
  }
  async function save(andUse) {
    setBusy(andUse ? 'use' : 'save');
    setError('');
    setErrors({});
    try {
      const body = { name, ...content, active, ...(isNew && { source }) };
      const t = await api(isNew ? '/admin/whatsapp/templates' : `/admin/whatsapp/templates/${id}`, { method: isNew ? 'POST' : 'PUT', body });
      toast(isNew ? 'Template saved' : 'Changes saved');
      navigate(andUse ? `/admin/whatsapp/campaigns?template=${t.id}` : '/admin/whatsapp/templates');
    } catch (e) {
      setError(e.message);
      setErrors(fieldErrors(e));
    } finally {
      setBusy('');
    }
  }

  return (
    <div>
      <div className="a-section-head">
        <h2 className="a-h2">{isNew ? 'New template' : name || 'Template'}</h2>
        <Link to="/admin/whatsapp/templates" className="a-link"><Icon name="arrow-left" size={16} /> All templates</Link>
      </div>
      <div className="a-wa-split">
        <div className="a-wa-col">
          {isNew && !aiOpen && !drafted && (
            <button type="button" className="a-btn a-ai-open" onClick={() => setAiOpen(true)}><Icon name="pencil" size={16} /> Let the AI write a draft</button>
          )}
          {aiOpen && <AiPanel onDraft={onDraft} initial={content} />}
          {drafted && <p className="a-note"><Icon name="alert" size={16} /><span>AI draft. Read it and change anything before saving. <button type="button" className="a-textbtn" onClick={() => setAiOpen(true)}>Write another</button></span></p>}
          <section className="a-panel">
            <form className="a-form" onSubmit={(e) => { e.preventDefault(); save(false); }} noValidate>
              <label><span>Template name <small className="a-muted">(only the team sees this)</small></span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Back in stock" aria-invalid={!!errors.name} />{errors.name && <span className="a-field-error">{errors.name}</span>}</label>
              <ContentForm value={content} onChange={setContent} errors={errors} />
              <label className="a-check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active (can be chosen when sending)</label>
              {error && <p className="a-error" role="alert">{error}</p>}
              <div className="a-actions">
                <button className="a-btn a-primary" disabled={!!busy}>{busy === 'save' ? 'Saving…' : 'Save template'}</button>
                <button type="button" className="a-btn" disabled={!!busy || !active} onClick={() => save(true)}><Icon name="send" size={16} /> {busy === 'use' ? 'Saving…' : 'Save and use now'}</button>
                <Link to="/admin/whatsapp/templates" className="a-btn a-quiet">Cancel</Link>
              </div>
            </form>
          </section>
        </div>
        <aside className="a-wa-side">
          <span className="a-eyebrow">Live preview</span>
          <PhonePreview content={content} />
        </aside>
      </div>
    </div>
  );
}
