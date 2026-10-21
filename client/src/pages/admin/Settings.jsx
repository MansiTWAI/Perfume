import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useStore } from '../../context/StoreContext';
import { confirm, LoadError, CopyButton } from './ui';
import Icon from '../../components/Icon';

// Admin → Settings: connect Delhivery and WhatsApp (Meta Cloud API) by
// pasting the keys here. They are saved encrypted on the server and never
// shown again: a saved secret only says "set · ends …1234".
const HELP = {
  delhivery: {
    DELHIVERY_API_TOKEN: 'Delhivery One → Settings → API Setup → API token. A test token works only in Test mode, the live token only in Live mode.',
    DELHIVERY_ENV: 'Test sends shipments to Delhivery’s test system (nothing is collected). Live books real pickups.',
    DELHIVERY_PICKUP_LOCATION: 'The warehouse name exactly as registered in Delhivery One → Settings → Pickup locations (capitals and spaces count).',
    DELHIVERY_WEBHOOK_TOKEN: 'Any long random text (16+ characters). Give the same text and the URL below to Delhivery support for live tracking updates.',
  },
  whatsapp: {
    WHATSAPP_ACCESS_TOKEN: 'Meta Business Suite → Settings → Users → System users → Generate token (permanent), with whatsapp_business_messaging and whatsapp_business_management.',
    WHATSAPP_PHONE_NUMBER_ID: 'WhatsApp Manager → API setup (or Phone numbers): the Phone number ID, not the phone number itself.',
    WHATSAPP_NOTIFY_TEMPLATE: 'An approved Marketing template with the body “Hello {{1}}, {{2}}” and the footer “Reply STOP to unsubscribe”.',
    WHATSAPP_NOTIFY_MEDIA_TEMPLATE: 'Optional: the same body with an image header and a URL button. Without it, messages go as text.',
    WHATSAPP_NOTIFY_PARAMS: '“name,message” if the template has {{1}} for the name and {{2}} for the text; “message” if it has only {{1}}.',
    WHATSAPP_TEMPLATE_LANG: 'The template’s language code in WhatsApp Manager, e.g. en or en_US.',
    WHATSAPP_APP_SECRET: 'Meta for Developers → your app → App settings → Basic → App secret. Needed for delivery receipts and STOP replies.',
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'Any text you choose; enter the same in the app’s WhatsApp → Configuration → Webhook, with the URL below.',
  },
};

function Group({ id, g, onSaved }) {
  const { toast } = useStore();
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState('');
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const site = window.location.origin.includes('localhost') ? 'https://albarakah.me' : window.location.origin;
  const hook = id === 'delhivery' ? `${site}/api/shipping/delhivery/webhook` : `${site}/api/whatsapp/webhook`;
  const changed = Object.values(values).some((v) => v !== undefined && v !== '');
  const set = (k, v) => { setValues((x) => ({ ...x, [k]: v })); setErrors((x) => ({ ...x, [k]: undefined })); };

  async function save(extra = {}) {
    const body = { values: { ...values, ...extra } };
    if (id === 'delhivery' && body.values.DELHIVERY_ENV === 'production' && g.mode !== 'production') {
      const ok = await confirm({ title: 'Switch Delhivery to live?', message: 'From now on, new shipments are real bookings and Delhivery will come to collect them. Make sure the token above is your live token.', confirmLabel: 'Switch to live' });
      if (!ok) return;
    }
    setBusy('save');
    setErrors({});
    setResult(null);
    try {
      onSaved(await api(`/admin/settings/integrations/${id}`, { method: 'PUT', body }));
      setValues({});
      toast('Settings saved');
    } catch (e) {
      setErrors(Object.fromEntries((e.data?.errors || []).map((x) => [x.field, x.message])));
      toast(e.message, 'warn');
    } finally {
      setBusy('');
    }
  }
  async function clear(key, label) {
    if (!(await confirm({ title: `Remove the saved ${label.toLowerCase()}?`, message: 'The server file’s value (if any) is used again.', confirmLabel: 'Remove', danger: true }))) return;
    setBusy('save');
    try {
      onSaved(await api(`/admin/settings/integrations/${id}`, { method: 'PUT', body: { clear: [key] } }));
      toast('Removed');
    } catch (e) {
      toast(e.message, 'warn');
    } finally {
      setBusy('');
    }
  }
  async function test() {
    setBusy('test');
    setResult(null);
    try {
      setResult(await api(`/admin/settings/integrations/${id}/test`, { method: 'POST', timeout: 20000 }));
    } catch (e) {
      setResult({ ok: false, message: e.message });
    } finally {
      setBusy('');
    }
  }

  const status = id === 'delhivery'
    ? (g.ready ? (g.mode === 'production' ? ['Live', 'ok'] : ['Test mode', 'warn']) : ['Not connected', 'bad'])
    : (g.ready ? ['Ready to send', 'ok'] : g.keys.find((k) => k.key === 'WHATSAPP_ACCESS_TOKEN')?.set ? ['Template missing', 'warn'] : ['Not connected', 'bad']);

  return (
    <section className="a-panel a-settings" aria-labelledby={`set-${id}`}>
      <div className="a-section-head">
        <h2 id={`set-${id}`}>{g.label}</h2>
        <span className={`a-pill ${status[1]}`}>{status[0]}</span>
      </div>
      <form className="a-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        {g.keys.map((k) => {
          const help = HELP[id]?.[k.key];
          const field = k.options ? (
            id === 'delhivery' && k.key === 'DELHIVERY_ENV' ? (
              <span className="a-seg" role="radiogroup" aria-label={k.label}>
                {[['staging', 'Test'], ['production', 'Live']].map(([v, l]) => {
                  const on = (values[k.key] || k.value || 'staging') === v;
                  return <button key={v} type="button" role="radio" aria-checked={on} className={on ? 'is-on' : ''} onClick={() => set(k.key, v)}>{l}</button>;
                })}
              </span>
            ) : (
              <select value={values[k.key] || k.value || k.options[0]} onChange={(e) => set(k.key, e.target.value)}>
                {k.options.map((o, n) => <option key={o} value={o}>{o}{n === 0 && !k.value ? ' (default)' : ''}</option>)}
              </select>
            )
          ) : (
            <input
              type={k.secret ? 'password' : 'text'}
              autoComplete="off"
              spellCheck="false"
              value={values[k.key] ?? (k.secret ? '' : k.value || '')}
              placeholder={k.secret ? (k.set ? `Saved · ${k.hint}. Type to replace.` : 'Not set') : k.key === 'WHATSAPP_TEMPLATE_LANG' ? 'en (default)' : 'Not set'}
              onChange={(e) => set(k.key, e.target.value)}
              aria-invalid={!!errors[k.key]}
            />
          );
          return (
            <label key={k.key}>
              <span className="a-set-label">{k.label}{k.source && <small className={`a-pill ${k.source === 'panel' ? 'ok' : 'off'}`}>{k.source === 'panel' ? 'saved here' : 'server file'}</small>}{k.source === 'panel' && <button type="button" className="a-textbtn" onClick={() => clear(k.key, k.label)}>Remove</button>}</span>
              {field}
              {errors[k.key] ? <span className="a-field-error">{errors[k.key]}</span> : help && <span className="a-hint">{help}</span>}
            </label>
          );
        })}
        <p className="a-hint a-hook">Webhook URL for {id === 'delhivery' ? 'Delhivery support' : 'Meta'}: <code>{hook}</code> <CopyButton text={hook} /></p>
        {result && <p className={`a-note ${result.ok ? 'is-ok' : 'is-bad'}`} role="status"><Icon name={result.ok ? 'check' : 'error'} size={16} /><span>{result.message}</span></p>}
        <div className="a-actions">
          <button className="a-btn a-primary" disabled={!changed || !!busy}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
          <button type="button" className="a-btn" disabled={!!busy || changed} onClick={test} title={changed ? 'Save first' : 'Checks the saved keys; sends nothing'}>{busy === 'test' ? 'Checking…' : 'Test connection'}</button>
        </div>
      </form>
    </section>
  );
}

export default function Settings() {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setError('');
    api('/admin/settings/integrations').then(setS).catch((e) => setError(e.message));
  }, [tick]);
  return (
    <div>
      <header className="a-head">
        <h1>Settings</h1>
        <span className="a-muted">Connect Delhivery and WhatsApp. Keys are stored encrypted and never shown again.</span>
      </header>
      {error && <LoadError message={error} onRetry={() => setTick((n) => n + 1)} />}
      {!s && !error && <p className="a-muted">Loading…</p>}
      {s && (
        <div className="a-two a-settings-grid">
          <Group id="delhivery" g={s.delhivery} onSaved={setS} />
          <div>
            <Group id="whatsapp" g={s.whatsapp} onSaved={setS} />
            <p className="a-muted a-hint">After connecting WhatsApp, send campaigns from <Link to="/admin/whatsapp" className="a-textbtn">WhatsApp</Link>. Customers still subscribe themselves, with a consent tick.</p>
          </div>
        </div>
      )}
    </div>
  );
}
