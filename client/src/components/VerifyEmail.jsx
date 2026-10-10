import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useStore } from '../context/StoreContext';

// The one time a customer enters a code: confirming the email of a new
// account. `email` is the address the code went to; onBack returns to the form.
export default function VerifyEmail({ email, onBack }) {
  const { login, t } = useStore();
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(30);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (wait <= 0) return undefined;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function submit(e) {
    e.preventDefault();
    if (code.length !== 6) return setError(t('Enter the 6-digit code from the email.'));
    setBusy('verify');
    setError('');
    try {
      const d = await api('/auth/verify-email', { method: 'POST', body: { email, code } });
      login(d.token, d.user);
    } catch (err) {
      setError(err.message);
      setCode('');
    } finally {
      setBusy('');
    }
  }

  async function resend() {
    setBusy('resend');
    setError('');
    setNote('');
    try {
      await api('/auth/verify-email/resend', { method: 'POST', body: { email } });
      setWait(30);
      setNote(t('A new code is on its way.'));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <form className="form auth-form verify-email" onSubmit={submit} noValidate>
      <h2 className="verify-title">{t('Confirm your email')}</h2>
      <p className="field-hint">{t('We emailed a 6-digit code to {email}. Enter it to finish creating your account.', { email })}</p>
      <label>{t('Verification code')}
        <input
          className="code-input"
          value={code}
          onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          dir="ltr"
          aria-invalid={!!error}
          aria-describedby={error ? 'verify-error' : undefined}
          autoFocus
          required
        />
      </label>
      {error && <p className="form-error" id="verify-error" role="alert">{error}</p>}
      {note && !error && <p className="field-hint" role="status">{note}</p>}
      <button className="btn btn-primary btn-block" disabled={!!busy || code.length !== 6}>{t(busy === 'verify' ? 'Checking…' : 'Confirm and continue')}</button>
      <div className="auth-code-row">
        <button type="button" className="text-link" onClick={resend} disabled={!!busy || wait > 0}>
          {busy === 'resend' ? t('Sending…') : wait > 0 ? t('Resend code in {n}s', { n: wait }) : t('Resend code')}
        </button>
        <button type="button" className="text-link" onClick={onBack} disabled={!!busy}>{t('Use another email')}</button>
      </div>
    </form>
  );
}
