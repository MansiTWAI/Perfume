import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useStore } from '../../context/StoreContext';
import { Modal } from './Fields';
import { EmptyState, LoadError } from './ui';
import Icon from '../../components/Icon';

// Admin → Integrations: the health of every outside service the shop uses,
// from real data (services/integrations.js). Four questions per service,
// shown as a ladder: configured → connected → operational → production-ready.
const STATE = {
  ok: { label: 'Working', tone: 'ok', icon: 'check' },
  warn: { label: 'Needs attention', tone: 'warn', icon: 'alert' },
  bad: { label: 'Broken', tone: 'bad', icon: 'error' },
  unknown: { label: 'Not confirmed yet', tone: 'unknown', icon: 'refresh' },
  off: { label: 'Not set up', tone: 'off', icon: 'minus' },
};
const STAGES = [['configured', 'Configured'], ['connected', 'Connected'], ['operational', 'Operational'], ['production', 'Production-ready']];
const KIND = { activity: 'Activity', check: 'Check', test: 'Test', config: 'Settings change' };

const when = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
function ago(d) {
  if (!d) return '';
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return when(d);
}
const fact = (v) => (v && typeof v === 'object' ? [v.text, when(v.at)].filter(Boolean).join(' · ') : v);

// ----- one service -----
function Ladder({ stages }) {
  return (
    <ol className="a-int-ladder" aria-label="Status">
      {STAGES.map(([k, label]) => {
        const s = stages[k];
        const st = STATE[s.state] || STATE.off;
        return (
          <li key={k} className={`is-${st.tone}`}>
            <span className="a-int-step" aria-hidden="true"><Icon name={st.icon} size={13} /></span>
            <span className="a-int-step-text">
              <b>{label}</b>
              <small title={s.detail}>{s.detail}{s.at && <> · {ago(s.at)}</>}</small>
            </span>
            <span className="sr-only">: {st.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function TestForm({ it, onDone }) {
  const { user } = useStore();
  const input = it.canTest.input;
  const [value, setValue] = useState(input?.defaultToMe ? user?.email || '' : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api(`/admin/integrations/${it.id}/test`, { method: 'POST', body: { input: input ? { [input.name]: value } : {} }, timeout: 40000 });
      onDone(r.result, r.item);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="a-int-test" onSubmit={run}>
      {input && (
        <label htmlFor={`t-${it.id}`}>{input.label}
          <input id={`t-${it.id}`} type={input.type || 'text'} value={value} onChange={(e) => setValue(e.target.value)} placeholder={input.placeholder} pattern={input.pattern} required inputMode={input.name === 'pin' ? 'numeric' : undefined} />
        </label>
      )}
      <button className="a-btn a-primary" disabled={busy}>{busy ? 'Running…' : it.canTest.label}</button>
      {error && <span className="a-field-error" role="alert">{error}</span>}
    </form>
  );
}

function Card({ it, onItem, onManage }) {
  const st = STATE[it.overall] || STATE.off;
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const problem = STAGES.map(([k]) => it.stages[k]).find((s) => s.state === 'bad');
  async function check() {
    setBusy(true);
    setResult(null);
    try {
      const r = await api(`/admin/integrations/${it.id}/check`, { method: 'POST', timeout: 30000 });
      setResult(r.result);
      onItem(r.item);
    } catch (e) {
      setResult({ ok: false, message: e.message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={`a-int is-${st.tone}`} aria-labelledby={`int-${it.id}`}>
      <header className="a-int-head">
        <span className="a-int-light" aria-hidden="true"><Icon name={st.icon} size={16} /></span>
        <div className="a-int-title">
          <h2 id={`int-${it.id}`}>{it.name}</h2>
          <small>{it.role}</small>
        </div>
        <span className="a-int-badges">
          {it.mode && <span className={`a-pill ${it.mode === 'live' ? 'ok' : 'warn'}`}>{it.mode === 'live' ? 'Live' : 'Test mode'}</span>}
          <span className={`a-pill ${st.tone === 'unknown' ? '' : st.tone}`}>{st.label}</span>
        </span>
      </header>

      <Ladder stages={it.stages} />

      {problem && !result && <p className="a-note is-bad"><Icon name="error" size={16} /><span>{problem.detail}</span></p>}
      {result && <p className={`a-note ${result.ok ? 'is-ok' : 'is-bad'}`} role="status"><Icon name={result.ok ? 'check' : 'error'} size={16} /><span>{result.message}{result.ms != null && <small className="a-muted"> · {result.ms} ms</small>}</span></p>}

      <div className="a-int-meta">
        <dl className="a-int-facts">
          {it.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{fact(v)}</dd></div>)}
          <div><dt>Last check</dt><dd>{it.lastCheck ? <>{it.lastCheck.ok ? 'Passed' : 'Failed'} · {ago(it.lastCheck.at)}</> : 'Never'}</dd></div>
        </dl>
        {it.checklist.length > 0 && (
          <ul className="a-int-checklist" aria-label="Production checklist">
            {it.checklist.map((c) => <li key={c.label} className={c.ok ? 'ok' : c.optional ? 'opt' : 'no'}><Icon name={c.ok ? 'check' : c.optional ? 'minus' : 'close'} size={12} />{c.label}{c.optional && !c.ok && <small> (optional)</small>}</li>)}
          </ul>
        )}
      </div>

      {testing && it.canTest && <TestForm it={it} onDone={(r, item) => { setResult(r); onItem(item); }} />}

      <footer className="a-int-acts">
        <button type="button" className="a-btn" onClick={check} disabled={busy}><Icon name="refresh" size={16} /> {busy ? 'Checking…' : 'Check connection'}</button>
        {it.canTest && <button type="button" className="a-btn" aria-expanded={testing} onClick={() => setTesting((v) => !v)}>{testing ? 'Close test' : 'Test'}</button>}
        <button type="button" className="a-btn" onClick={() => onManage(it)}><Icon name="pencil" size={16} /> Manage settings</button>
        {it.link && <Link to={it.link} className="a-btn a-quiet">Open {it.name} <Icon name="arrow-right" size={14} /></Link>}
      </footer>
    </article>
  );
}

// ----- settings -----
function SettingsModal({ it, onClose, onSaved }) {
  const { toast } = useStore();
  const [list, setList] = useState(null);
  const [values, setValues] = useState({});
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    api(`/admin/integrations/${it.id}/settings`).then((d) => setList(d.settings)).catch((e) => setError(e.message));
  }, [it.id]);
  const transport = values.MAIL_TRANSPORT ?? list?.find((s) => s.key === 'MAIL_TRANSPORT')?.value;
  const shown = (list || []).filter((s) => !s.when || s.when === (transport === 'sendmail' ? 'sendmail' : 'smtp'));
  const changed = Object.entries(values).some(([k, v]) => {
    const s = list?.find((x) => x.key === k);
    return s && (s.secret ? v.trim() !== '' : v !== (s.value || ''));
  });
  const set = (k, v) => { setValues((x) => ({ ...x, [k]: v })); setErrors((x) => ({ ...x, [k]: undefined })); };
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setErrors({});
    try {
      const r = await api(`/admin/integrations/${it.id}/settings`, { method: 'PUT', body: { values, password }, timeout: 40000 });
      toast(r.changed.length ? `Saved: ${r.changed.join(', ')}` : 'Nothing changed');
      onSaved(r.item, r.check);
    } catch (err) {
      setError(err.message);
      setErrors(Object.fromEntries((err.data?.errors || []).map((x) => [x.field, x.message])));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`${it.name} settings`} onClose={busy ? undefined : onClose}>
      {!list ? (error ? <LoadError message={error} /> : <p className="a-muted">Loading…</p>) : (
        <form className="a-form a-int-settings" onSubmit={save} autoComplete="off">
          <p className="a-muted a-hint">Saved secrets are never shown again: type a new value only to replace one. Changes take effect at once and are checked straight after saving.</p>
          {shown.map((s) => (
            <label key={s.key} htmlFor={`s-${s.key}`}>
              <span className="a-int-label">{s.label}{s.required && <small className="a-muted"> required</small>}{s.secret && <span className={`a-pill ${s.set ? 'ok' : 'off'}`}>{s.set ? `Saved ${s.preview}` : 'Not set'}</span>}</span>
              {s.options ? (
                <select id={`s-${s.key}`} value={values[s.key] ?? s.value ?? ''} onChange={(e) => set(s.key, e.target.value)}>
                  {!s.value && <option value="">Choose…</option>}
                  {s.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input
                  id={`s-${s.key}`}
                  type={s.secret ? 'password' : 'text'}
                  autoComplete={s.secret ? 'new-password' : 'off'}
                  spellCheck="false"
                  value={values[s.key] ?? (s.secret ? '' : s.value || '')}
                  placeholder={s.secret ? (s.set ? 'Type a new value to replace it' : 'Paste the value') : ''}
                  onChange={(e) => set(s.key, e.target.value)}
                  aria-invalid={!!errors[s.key]}
                />
              )}
              {errors[s.key] ? <span className="a-field-error">{errors[s.key]}</span> : s.hint && <span className="a-hint">{s.hint}</span>}
            </label>
          ))}
          <label htmlFor="s-password" className="a-int-confirm">Your admin password <small className="a-muted">(to confirm the change)</small>
            <input id="s-password" type="password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setErrors((x) => ({ ...x, password: undefined })); }} required aria-invalid={!!errors.password} />
            {errors.password && <span className="a-field-error">{errors.password}</span>}
          </label>
          {error && !Object.keys(errors).length && <p className="a-error" role="alert">{error}</p>}
          <footer className="a-modal-foot">
            <button type="button" className="a-btn" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="a-btn a-primary" disabled={busy || !changed || !password}>{busy ? 'Saving…' : 'Save and check'}</button>
          </footer>
        </form>
      )}
    </Modal>
  );
}

// ----- activity log -----
function Activity({ names, tick }) {
  const [filter, setFilter] = useState('');
  const [items, setItems] = useState(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async (before) => {
    try {
      const q = new URLSearchParams({ limit: '30', ...(filter && { integration: filter }), ...(before && { before }) });
      const d = await api(`/admin/integrations/activity?${q}`);
      setItems((x) => (before ? [...(x || []), ...d.items] : d.items));
      setMore(d.items.length === 30);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [filter]);
  useEffect(() => { setItems(null); load(); }, [load, tick]);
  return (
    <section className="a-panel a-int-log" aria-labelledby="int-log">
      <div className="a-section-head">
        <h2 id="int-log">Activity</h2>
        <div className="a-tabs" role="tablist" aria-label="Filter by service">
          {[['', 'All'], ...names].map(([k, l]) => <button key={k || 'all'} role="tab" aria-selected={filter === k} className={filter === k ? 'is-on' : ''} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
      </div>
      {error && <LoadError message={error} onRetry={() => load()} />}
      {!items ? <p className="a-muted">Loading…</p> : items.length === 0 ? (
        <EmptyState icon="inbox" title="No activity yet">Bookings, payments, emails, checks and setting changes appear here as they happen.</EmptyState>
      ) : (
        <>
          <div className="a-table-wrap a-sticky-head">
            <table className="a-table a-int-table">
              <thead><tr><th>When</th><th>Service</th><th>Type</th><th>Result</th><th>Details</th></tr></thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id}>
                    <td title={new Date(e.at).toLocaleString('en-GB')}>{when(e.at)}</td>
                    <td>{e.name}</td>
                    <td><span className="a-pill off">{KIND[e.kind] || e.kind}</span></td>
                    <td><span className={`a-int-result ${e.ok ? 'ok' : 'bad'}`}><Icon name={e.ok ? 'check' : 'error'} size={14} />{e.ok ? 'OK' : 'Failed'}</span></td>
                    <td className="a-int-msg">{e.message}{(e.by || e.ms != null) && <small>{[e.by, e.ms != null && `${e.ms} ms`].filter(Boolean).join(' · ')}</small>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {more && <button type="button" className="a-btn a-int-more" onClick={() => load(items.at(-1).at)}>Show older</button>}
        </>
      )}
      <p className="a-muted a-hint">Kept for 90 days. Routine successes are noted at most every 15 minutes per service; every failure is noted.</p>
    </section>
  );
}

export default function Integrations() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [at, setAt] = useState(null);
  const [manage, setManage] = useState(null);
  const [tick, setTick] = useState(0);
  const load = useCallback(() => {
    setError('');
    api('/admin/integrations').then((d) => { setItems(d.items); setAt(d.at); }).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  const replace = (item) => { setItems((l) => l.map((x) => (x.id === item.id ? item : x))); setTick((n) => n + 1); };
  async function checkAll() {
    setChecking(true);
    try {
      const d = await api('/admin/integrations/check', { method: 'POST', timeout: 60000 });
      setItems(d.items);
      setAt(new Date());
      setTick((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setChecking(false);
    }
  }
  const count = (s) => (items || []).filter((x) => x.overall === s).length;
  return (
    <div>
      <header className="a-head">
        <div>
          <h1>Integrations</h1>
          <p className="a-muted">Shipping, payments, email, WhatsApp and the AI concierge: are they set up, connected and working?</p>
        </div>
        <div className="a-actions">
          {at && <span className="a-muted">Updated {ago(at)}</span>}
          <button type="button" className="a-btn a-primary" onClick={checkAll} disabled={checking}><Icon name="refresh" size={16} /> {checking ? 'Checking all…' : 'Check all connections'}</button>
        </div>
      </header>
      {error && <LoadError message={error} onRetry={load} />}
      {!items && !error && <p className="a-muted">Loading…</p>}
      {items && (
        <>
          <div className="a-int-summary" role="status">
            {[['ok', 'Working'], ['warn', 'Need attention'], ['bad', 'Broken'], ['unknown', 'Not confirmed'], ['off', 'Not set up']].map(([k, l]) => (
              <span key={k} className={`is-${k}`}><b>{count(k)}</b> {l}</span>
            ))}
          </div>
          <div className="a-int-list">
            {items.map((it) => <Card key={it.id} it={it} onItem={replace} onManage={setManage} />)}
          </div>
          <Activity names={items.map((x) => [x.id, x.name])} tick={tick} />
        </>
      )}
      {manage && <SettingsModal it={manage} onClose={() => setManage(null)} onSaved={(item) => { setManage(null); replace(item); }} />}
    </div>
  );
}
