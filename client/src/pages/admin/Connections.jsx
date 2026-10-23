import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { LoadError } from './ui';
import Icon from '../../components/Icon';

// Admin → Connections: is each outside service working? Read-only. Keys are
// kept in the server settings file (server/.env) and never shown here.
const ORDER = ['delhivery', 'email', 'payments', 'whatsapp', 'ai'];
const STATE = {
  ok: ['Working', 'ok', 'check'],
  warn: ['Needs attention', 'warn', 'alert'],
  bad: ['Broken', 'bad', 'error'],
  off: ['Not set up', 'off', 'minus'],
};
const when = (d) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fact = (v) => (v && typeof v === 'object' ? [v.text, when(v.at)].filter(Boolean).join(' · ') : v);

function Row({ id, c }) {
  const [label, tone, icon] = STATE[c.state] || STATE.off;
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [keys, setKeys] = useState(false);
  async function test() {
    setBusy(true);
    setResult(null);
    try {
      setResult(await api(`/admin/connections/${id}/test`, { method: 'POST', timeout: 25000 }));
    } catch (e) {
      setResult({ ok: false, message: e.message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={`a-conn is-${tone}`} aria-labelledby={`conn-${id}`}>
      <span className="a-conn-light" aria-hidden="true"><Icon name={icon} size={16} /></span>
      <div className="a-conn-main">
        <header>
          <h2 id={`conn-${id}`}>{c.name}</h2>
          <span className={`a-pill ${tone}`}>{label}</span>
          <small className="a-muted">{c.role}</small>
        </header>
        <p>{c.summary}</p>
        <dl className="a-conn-facts">
          {c.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{fact(v)}</dd></div>)}
        </dl>
        {result && <p className={`a-note ${result.ok ? 'is-ok' : 'is-bad'}`} role="status"><Icon name={result.ok ? 'check' : 'error'} size={16} /><span>{result.message}</span></p>}
        {keys && (
          <p className="a-hint a-conn-keys">Set in the server settings file <code>server/.env</code>: {c.keys.map((k) => <code key={k}>{k}</code>)}. After a change, the app is restarted.</p>
        )}
      </div>
      <div className="a-conn-acts">
        <button type="button" className="a-btn" onClick={test} disabled={busy}>{busy ? 'Checking…' : id === 'email' ? 'Send test email' : 'Test'}</button>
        {c.link && <Link to={c.link} className="a-btn a-quiet">Open</Link>}
        <button type="button" className="a-textbtn" aria-expanded={keys} onClick={() => setKeys((v) => !v)}>Where is this set?</button>
      </div>
    </article>
  );
}

export default function Connections() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setError('');
    api('/admin/connections').then(setD).catch((e) => setError(e.message));
  }, [tick]);
  return (
    <div>
      <header className="a-head">
        <h1>Connections</h1>
        <div className="a-actions">
          {d && <span className="a-muted">Checked {when(d.checkedAt)}</span>}
          <button type="button" className="a-btn" onClick={() => setTick((n) => n + 1)}><Icon name="refresh" size={16} /> Check again</button>
        </div>
      </header>
      {error && <LoadError message={error} onRetry={() => setTick((n) => n + 1)} />}
      {!d && !error && <p className="a-muted">Checking…</p>}
      {d && (
        <>
          <p className={`a-note ${d.attention ? 'is-bad' : 'is-ok'}`}>
            <Icon name={d.attention ? 'error' : 'check'} size={16} />
            <span>{d.attention ? `${d.attention} service${d.attention === 1 ? ' the shop needs is' : 's the shop needs are'} not working. Details below.` : 'Shipping, email and payments are all set up.'}</span>
          </p>
          <section className="a-conn-list">
            {ORDER.filter((k) => d.items[k]).map((k) => <Row key={k} id={k} c={d.items[k]} />)}
          </section>
          <p className="a-muted a-hint">Keys and passwords are kept only in the server settings file and are never shown in the studio. To change one, edit <code>server/.env</code> on the server and restart the app.</p>
        </>
      )}
    </div>
  );
}
