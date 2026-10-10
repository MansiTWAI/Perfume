import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useStore } from '../context/StoreContext';

// Second step of a team sign-in: the 6-digit code we emailed. `challenge` is
// the /auth/login answer ({ challengeToken, sentTo, resendInSeconds }).
// `classes` lets the admin studio and the storefront keep their own look.
export default function TwoStepCode({ challenge, onDone, onCancel, classes = {} }) {
  const { login } = useStore();
  const [token] = useState(challenge.challengeToken);
  const [sentTo, setSentTo] = useState(challenge.sentTo);
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(challenge.resendInSeconds || 30);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function verify(e) {
    e.preventDefault();
    if (code.length !== 6) return setError('Enter the 6-digit code from the email.');
    setBusy('verify');
    setError('');
    try {
      const d = await api('/auth/2fa/verify', { method: 'POST', body: { challengeToken: token, code } });
      login(d.token, d.user);
      onDone?.(d.user);
    } catch (err) {
      setError(err.message);
      setCode('');
      // Expired or too many tries: the password step starts again.
      if (err.code === 'OTP_EXPIRED' || err.status === 403) setTimeout(() => onCancel?.(err.message), 1800);
    } finally {
      setBusy('');
    }
  }

  async function resend() {
    setBusy('resend');
    setError('');
    setNote('');
    try {
      const d = await api('/auth/2fa/resend', { method: 'POST', body: { challengeToken: token } });
      setSentTo(d.sentTo);
      setWait(d.resendInSeconds || 30);
      setNote('A new code is on its way. The earlier one no longer works.');
    } catch (err) {
      if (err.data?.retryAfter) setWait(err.data.retryAfter);
      setError(err.message);
      if (err.code === 'OTP_EXPIRED') setTimeout(() => onCancel?.(err.message), 1800);
    } finally {
      setBusy('');
    }
  }

  return (
    <form className={classes.form} onSubmit={verify} noValidate>
      <p className={classes.lede}>We emailed a 6-digit code to <b dir="ltr">{sentTo}</b>. It expires in 10 minutes.</p>
      <label>Sign-in code
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          dir="ltr"
          className={classes.code}
          aria-invalid={!!error}
          aria-describedby={error ? 'two-step-error' : undefined}
          autoFocus
          required
        />
      </label>
      {error && <p className={classes.error} id="two-step-error" role="alert">{error}</p>}
      {note && !error && <p className={classes.note} role="status">{note}</p>}
      <button className={classes.primary} disabled={!!busy || code.length !== 6}>{busy === 'verify' ? 'Checking…' : 'Verify and sign in'}</button>
      <div className={classes.row}>
        <button type="button" className={classes.link} onClick={resend} disabled={!!busy || wait > 0}>
          {busy === 'resend' ? 'Sending…' : wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
        </button>
        <button type="button" className={classes.link} onClick={() => onCancel?.()} disabled={!!busy}>Use another account</button>
      </div>
    </form>
  );
}
