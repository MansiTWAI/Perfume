import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AccountLayout from '../components/AccountLayout';
import { useStore } from '../context/StoreContext';
import { api, getToken } from '../lib/api';
import { AuthForm } from './Account';

// One save button per section, each with its own message.
function useSection() {
  const [state, setState] = useState({ busy: false, error: '', ok: '' });
  const run = async (fn, okText) => {
    setState({ busy: true, error: '', ok: '' });
    try {
      await fn();
      setState({ busy: false, error: '', ok: okText });
    } catch (e) {
      setState({ busy: false, error: e.message, ok: '' });
    }
  };
  return [state, run];
}

function Status({ state }) {
  if (state.error) return <p className="form-error" role="alert">{state.error}</p>;
  if (state.ok) return <p className="form-ok" role="status">✓ {state.ok}</p>;
  return null;
}

function Details() {
  const { user, login, regions, t } = useStore();
  const a = user.address || {};
  const markets = regions.filter((r) => r.ships);
  const [f, setF] = useState({
    name: user.name || '', phone: user.phone || '',
    line1: a.line1 || '', line2: a.line2 || '', city: a.city || '', state: a.state || '', postalCode: a.postalCode || '', region: a.region || markets[0]?.code || 'IN',
  });
  const [state, run] = useSection();
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const india = f.region === 'IN';
  const dirty = JSON.stringify(f) !== JSON.stringify({ name: user.name || '', phone: user.phone || '', line1: a.line1 || '', line2: a.line2 || '', city: a.city || '', state: a.state || '', postalCode: a.postalCode || '', region: a.region || markets[0]?.code || 'IN' });

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      const d = await api('/auth/me', {
        method: 'PATCH',
        body: { name: f.name, phone: f.phone, address: { line1: f.line1, line2: f.line2, city: f.city, state: f.state, postalCode: f.postalCode, region: f.region } },
      });
      login(getToken(), d.user);
    }, t('Your details are saved.'));
  };

  return (
    <form className="form acct-card" onSubmit={submit}>
      <div className="acct-card-head"><h2>{t('Your details')}</h2></div>
      <div className="form-row">
        <label>{t('Full name')}<input required value={f.name} onChange={set('name')} autoComplete="name" /></label>
        <label>{t('Mobile (WhatsApp)')}<input type="tel" dir="ltr" value={f.phone} onChange={set('phone')} autoComplete="tel" placeholder={india ? '+91' : '+971'} /></label>
      </div>
      <h3 id="address" className="acct-sub">{t('Saved delivery address')}</h3>
      <p className="fine">{t('Checkout fills this in for you. You can still change it on each order.')}</p>
      <label>{t('Country')}
        <select value={f.region} onChange={set('region')}>
          {markets.map((r) => <option key={r.code} value={r.code}>{t(r.name)}</option>)}
        </select>
      </label>
      <label>{t('Address line 1')}<input value={f.line1} onChange={set('line1')} autoComplete="address-line1" /></label>
      <label>{t('Address line 2 (optional)')}<input value={f.line2} onChange={set('line2')} autoComplete="address-line2" /></label>
      <div className="form-row three">
        <label>{t('City')}<input value={f.city} onChange={set('city')} autoComplete="address-level2" /></label>
        <label>{t(india ? 'State' : 'Emirate')}<input value={f.state} onChange={set('state')} autoComplete="address-level1" /></label>
        <label>{t(india ? 'PIN code' : 'Postal code')}<input value={f.postalCode} onChange={set('postalCode')} autoComplete="postal-code" dir="ltr" /></label>
      </div>
      <Status state={state} />
      <div className="acct-form-foot">
        <button className="btn btn-primary" disabled={state.busy || !dirty}>{t(state.busy ? 'Saving…' : 'Save details')}</button>
      </div>
    </form>
  );
}

function Email() {
  const { user, login, t } = useStore();
  const [f, setF] = useState({ email: '', password: '' });
  const [state, run] = useSection();
  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      const d = await api('/auth/me/email', { method: 'POST', body: f });
      login(getToken(), d.user);
      setF({ email: '', password: '' });
    }, t('Your email is updated. Use it to sign in from now on.'));
  };
  return (
    <form className="form acct-card" onSubmit={submit}>
      <div className="acct-card-head"><h2>{t('Sign-in email')}</h2></div>
      <p className="fine">{t('Currently {email}. Your past orders stay in your account.', { email: user.email })}</p>
      <div className="form-row">
        <label>{t('New email')}<input type="email" dir="ltr" required value={f.email} onChange={(e) => setF((x) => ({ ...x, email: e.target.value }))} autoComplete="email" /></label>
        <label>{t('Current password')}<input type="password" required value={f.password} onChange={(e) => setF((x) => ({ ...x, password: e.target.value }))} autoComplete="current-password" /></label>
      </div>
      <Status state={state} />
      <div className="acct-form-foot"><button className="btn btn-ghost" disabled={state.busy}>{t(state.busy ? 'Saving…' : 'Change email')}</button></div>
    </form>
  );
}

function Password() {
  const { login, t } = useStore();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [state, run] = useSection();
  const mismatch = f.confirm && f.next !== f.confirm;
  const submit = (e) => {
    e.preventDefault();
    if (f.next !== f.confirm) return;
    run(async () => {
      const d = await api('/auth/me/password', { method: 'POST', body: { current: f.current, next: f.next } });
      login(d.token, d.user); // this device stays signed in; others are signed out
      setF({ current: '', next: '', confirm: '' });
    }, t('Your password is changed. Other devices have been signed out.'));
  };
  const type = show ? 'text' : 'password';
  return (
    <form className="form acct-card" onSubmit={submit}>
      <div className="acct-card-head">
        <h2>{t('Password')}</h2>
        <button type="button" className="text-link" onClick={() => setShow((s) => !s)} aria-pressed={show}>{t(show ? 'Hide' : 'Show')}</button>
      </div>
      <label>{t('Current password')}<input type={type} required value={f.current} onChange={(e) => setF((x) => ({ ...x, current: e.target.value }))} autoComplete="current-password" /></label>
      <div className="form-row">
        <label>{t('New password')}<input type={type} required minLength={8} value={f.next} onChange={(e) => setF((x) => ({ ...x, next: e.target.value }))} autoComplete="new-password" /><small className="field-hint">{t('At least 8 characters.')}</small></label>
        <label>{t('Repeat new password')}<input type={type} required value={f.confirm} onChange={(e) => setF((x) => ({ ...x, confirm: e.target.value }))} autoComplete="new-password" aria-invalid={mismatch || undefined} />{mismatch && <small className="field-hint is-error">{t('The passwords do not match.')}</small>}</label>
      </div>
      <Status state={state} />
      <div className="acct-form-foot"><button className="btn btn-ghost" disabled={state.busy || mismatch}>{t(state.busy ? 'Saving…' : 'Change password')}</button></div>
    </form>
  );
}

function Devices() {
  const { logout, t } = useStore();
  const navigate = useNavigate();
  const [state, run] = useSection();
  const [sure, setSure] = useState(false);
  const go = () =>
    run(async () => {
      await api('/auth/logout-all', { method: 'POST' });
      logout();
      navigate('/account');
    }, '');
  return (
    <div className="acct-card">
      <div className="acct-card-head"><h2>{t('Signed-in devices')}</h2></div>
      <p className="fine">{t('Signs you out on every phone, tablet and computer, including this one. Use it if you lost a device or signed in somewhere public.')}</p>
      <Status state={state} />
      <div className="acct-form-foot">
        {sure ? (
          <>
            <button className="btn btn-ghost" onClick={() => setSure(false)} disabled={state.busy}>{t('Keep me signed in')}</button>
            <button className="btn btn-danger" onClick={go} disabled={state.busy}>{t(state.busy ? 'One moment…' : 'Sign out everywhere')}</button>
          </>
        ) : (
          <button className="btn btn-ghost" onClick={() => setSure(true)}>{t('Sign out everywhere')}</button>
        )}
      </div>
    </div>
  );
}

export default function EditProfile() {
  const { user, t } = useStore();
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) setTimeout(() => document.querySelector(hash)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 300);
  }, [hash]);
  return (
    <AccountLayout title={t('Edit profile')} seoTitle="Edit profile" lede={t('Your name, contact details, delivery address and sign-in.')} signedOut={<AuthForm />}>
      {user && (
        <div className="acct-stack">
          <Details />
          <Email />
          <Password />
          <Devices />
        </div>
      )}
    </AccountLayout>
  );
}
