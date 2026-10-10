import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Seo from '../components/Seo';
import { useStore } from '../context/StoreContext';
import { useSolidHeader } from '../hooks/useSolidHeader';
import { api } from '../lib/api';
import Icon from '../components/Icon';

function Frame({ title, lede, children, seo }) {
  const { t } = useStore();
  useSolidHeader();
  return (
    <section className="section page-pad acct acct-out">
      <Seo title={seo} />
      <div className="acct-signin">
        <img src="/media/emblem.webp" alt="" width="88" height="88" className="emblem-tile" />
        <p className="eyebrow">{t('Your account')}</p>
        <h1 className="acct-title">{title}</h1>
        {lede && <p className="acct-lede">{lede}</p>}
        {children}
      </div>
    </section>
  );
}

export function ForgotPassword() {
  const { t } = useStore();
  const [email, setEmail] = useState('');
  const [state, setState] = useState({ busy: false, sent: false, error: '' });
  async function submit(e) {
    e.preventDefault();
    setState({ busy: true, sent: false, error: '' });
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email } });
      setState({ busy: false, sent: true, error: '' });
    } catch (err) {
      setState({ busy: false, sent: false, error: err.message });
    }
  }
  return (
    <Frame seo="Forgot password" title={t('Forgot your password?')} lede={t('Enter the email you signed up with and we will send you a link to choose a new password.')}>
      {state.sent ? (
        <div className="auth-form form">
          <p className="form-ok" role="status"><Icon name="check" size={16} /> {t('If an account uses this email, a link to reset the password is on its way. It works for one hour.')}</p>
          <p className="fine">{t('Check your spam folder if it does not arrive in a few minutes.')}</p>
          <Link to="/account" className="btn btn-ghost btn-block">{t('Back to sign in')}</Link>
        </div>
      ) : (
        <form className="form auth-form" onSubmit={submit}>
          <label>{t('Email')}<input type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus /></label>
          {state.error && <p className="form-error" role="alert">{state.error}</p>}
          <button className="btn btn-primary btn-block" disabled={state.busy}>{t(state.busy ? 'One moment…' : 'Send reset link')}</button>
          <Link to="/account" className="text-link center">{t('Back to sign in')}</Link>
        </form>
      )}
    </Frame>
  );
}

export function ResetPassword() {
  const { login, t } = useStore();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const [f, setF] = useState({ password: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [state, setState] = useState({ busy: false, error: '' });
  const mismatch = f.confirm && f.password !== f.confirm;
  async function submit(e) {
    e.preventDefault();
    if (f.password !== f.confirm) return;
    setState({ busy: true, error: '' });
    try {
      const d = await api('/auth/reset-password', { method: 'POST', body: { token, password: f.password } });
      // With two-step sign-in on, team accounts sign in again with the emailed code.
      if (d.signInRequired) return navigate('/account', { replace: true });
      login(d.token, d.user);
      navigate('/profile', { replace: true });
    } catch (err) {
      setState({ busy: false, error: err.message });
    }
  }
  if (!token) {
    return (
      <Frame seo="Reset password" title={t('Reset your password')} lede={t('This link is incomplete. Please use the button in the email, or ask for a new link.')}>
        <Link to="/forgot-password" className="btn btn-primary">{t('Ask for a new link')}</Link>
      </Frame>
    );
  }
  const type = show ? 'text' : 'password';
  return (
    <Frame seo="Reset password" title={t('Choose a new password')} lede={t('You will be signed in straight away, and signed out on every other device.')}>
      <form className="form auth-form" onSubmit={submit}>
        <label>{t('New password')}
          <span className="pw-field">
            <input type={type} required minLength={8} value={f.password} onChange={(e) => setF((x) => ({ ...x, password: e.target.value }))} autoComplete="new-password" autoFocus />
            <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-pressed={show}>{t(show ? 'Hide' : 'Show')}</button>
          </span>
          <small className="field-hint">{t('At least 8 characters.')}</small>
        </label>
        <label>{t('Repeat new password')}<input type={type} required value={f.confirm} onChange={(e) => setF((x) => ({ ...x, confirm: e.target.value }))} autoComplete="new-password" aria-invalid={mismatch || undefined} />
          {mismatch && <small className="field-hint is-error">{t('The passwords do not match.')}</small>}
        </label>
        {state.error && (
          <p className="form-error" role="alert">{state.error} {/(expired|invalid)/i.test(state.error) && <Link to="/forgot-password" className="text-link">{t('Ask for a new link')}</Link>}</p>
        )}
        <button className="btn btn-primary btn-block" disabled={state.busy || mismatch}>{t(state.busy ? 'One moment…' : 'Save new password')}</button>
      </form>
    </Frame>
  );
}
