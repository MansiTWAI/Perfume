import { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { api } from '../lib/api';
import Icon from './Icon';

// Subscribing to WhatsApp updates always proves the number first: a 6-digit
// code goes to it on WhatsApp (the same sender as sign-in codes) and has to
// come back. A number already verified on the signed-in account skips that.
//
// <VerifyNumber> is the form itself: number → code (+ consent) → done.
// `submit(phone, code)` does the subscribing (account or concierge).
export function VerifyNumber({ initialPhone = '', consentText, submit, onDone, onCancel, compact = false }) {
  const { t } = useStore();
  const [phone, setPhone] = useState(initialPhone);
  const [step, setStep] = useState('phone'); // phone | code
  const [code, setCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState('');
  const [wait, setWait] = useState(0);
  const [noCode, setNoCode] = useState(false);
  useEffect(() => {
    if (!wait) return undefined;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function sendCode(e) {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api('/whatsapp/subscribe/code', { method: 'POST', body: { phone } });
      if (r.needsCode === false) {
        // Already verified on this account: no code needed, only consent.
        setNoCode(true);
        if (!consentText) {
          await submit(phone, '');
          onDone?.();
          return;
        }
        setStep('code');
        return;
      }
      setNoCode(false);
      setDevCode(r.devCode || '');
      setStep('code');
      setWait(30);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e) {
    e.preventDefault();
    if (consentText && !consent) return setError(t('Please tick the box to agree to WhatsApp updates.'));
    setBusy(true);
    setError('');
    try {
      await submit(phone, code.trim());
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return step === 'phone' ? (
    <form className={`wa-verify${compact ? ' is-compact' : ''}`} onSubmit={sendCode}>
      <label>{t('WhatsApp number')}
        <input type="tel" dir="ltr" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => { setPhone(e.target.value); setError(''); }} placeholder="+91 98765 43210" />
      </label>
      <p className="field-hint">{t('We will send a 6-digit code to this number on WhatsApp to confirm it is yours.')}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="wa-verify-actions">
        <button className="btn btn-primary" disabled={busy || !phone.trim()}>{t(busy ? 'Sending…' : 'Send code')}</button>
        {onCancel && <button type="button" className="text-btn" onClick={onCancel}>{t('No thanks')}</button>}
      </div>
    </form>
  ) : (
    <form className={`wa-verify${compact ? ' is-compact' : ''}`} onSubmit={confirm}>
      <p className="wa-verify-sent">
        {noCode ? t('{phone} is already verified on your account.', { phone: <b dir="ltr" key="p">{phone}</b> }) : t('Enter the code we sent on WhatsApp to {phone}.', { phone: <b dir="ltr" key="p">{phone}</b> })}{' '}
        <button type="button" className="text-btn" onClick={() => { setStep('phone'); setCode(''); setError(''); }}>{t('Change number')}</button>
      </p>
      {!noCode && (
        <label>{t('6-digit code')}
          <input className="wa-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} dir="ltr" autoFocus />
        </label>
      )}
      {devCode && <p className="field-hint">{t('Test server: your code is {code}', { code: devCode })}</p>}
      {consentText && (
        <label className="wa-consent">
          <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setError(''); }} />
          <span>{consentText}</span>
        </label>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="wa-verify-actions">
        <button className="btn btn-primary" disabled={busy || (!noCode && code.length !== 6)}>{t(busy ? 'One moment…' : noCode ? 'Subscribe' : 'Confirm and subscribe')}</button>
        {!noCode && <button type="button" className="text-btn" disabled={busy || wait > 0} onClick={sendCode}>{wait > 0 ? t('Send again in {n}s', { n: wait }) : t('Send the code again')}</button>}
      </div>
    </form>
  );
}

const day = (d, lang) => new Date(d).toLocaleDateString(lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// The account page card: one switch, with the code step when needed.
export default function WhatsAppUpdates() {
  const { user, t, lang, toast } = useStore();
  const [state, setState] = useState(null); // { subscribed, phone, since, verified }
  const [verifying, setVerifying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/whatsapp/me').then(setState).catch(() => setState({ subscribed: false, phone: user?.phone || '' }));
  }, [user?.phone]);

  async function save(subscribed, phone = state?.phone, code) {
    const r = await api('/whatsapp/me', { method: 'PUT', body: { subscribed, ...(phone && { phone }), ...(code && { code }) } });
    setState((s) => ({ ...s, ...r }));
    toast(t(subscribed ? 'WhatsApp updates are on.' : 'WhatsApp updates are off.'));
  }
  async function flip() {
    setError('');
    if (state.subscribed) {
      setBusy(true);
      try { await save(false); } catch (e) { setError(e.message); } finally { setBusy(false); }
      return;
    }
    if (state.verified) {
      setBusy(true);
      try { await save(true); } catch (e) { setError(e.message); } finally { setBusy(false); }
      return;
    }
    setVerifying((v) => !v);
  }

  return (
    <section className="acct-card wa-card" aria-labelledby="wa-title">
      <h2 id="wa-title" className="acct-sub">{t('WhatsApp updates')}</h2>
      <p className="muted">{t('New fragrances, restocks and offers, a few times a month. Order updates are separate and always sent.')}</p>
      {!state ? (
        <div className="skeleton-lines" aria-busy="true"><span /></div>
      ) : (
        <>
          <div className="wa-switch-row">
            <span>
              <b id="wa-switch-label">{t('Send me updates on WhatsApp')}</b>
              {state.subscribed ? (
                <small dir="auto"><span dir="ltr">{state.phone}</span> · {t('subscribed {date}', { date: day(state.since, lang) })}</small>
              ) : state.phone ? <small dir="ltr">{state.phone}</small> : null}
            </span>
            <button type="button" role="switch" aria-checked={!!state.subscribed} aria-labelledby="wa-switch-label" className={`switch${state.subscribed ? ' is-on' : ''}`} disabled={busy} onClick={flip} />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {verifying && !state.subscribed && (
            <VerifyNumber
              initialPhone={state.phone || user?.phone || ''}
              submit={(phone, code) => save(true, phone, code)}
              onDone={() => setVerifying(false)}
              onCancel={() => setVerifying(false)}
            />
          )}
          <p className="fine">{t('You can switch this off here at any time, or reply STOP to any of our messages.')}</p>
        </>
      )}
    </section>
  );
}

// The concierge card, shown once after a shopper shows interest.
export function ConciergeOptIn({ sessionId }) {
  const { t, user } = useStore();
  const [state, setState] = useState('ask'); // ask | form | done | closed
  if (state === 'closed') return null;
  if (state === 'done') return <p className="cc-optin-done" role="status"><Icon name="check" size={16} />{t('Subscribed. Reply STOP to any message to stop.')}</p>;
  return (
    <div className="cc-optin">
      <b>{t('Get new launches and offers on WhatsApp')}</b>
      {state === 'ask' ? (
        <div className="wa-verify-actions">
          <button type="button" className="btn btn-primary" onClick={() => setState('form')}>{t('Yes, please')}</button>
          <button type="button" className="text-btn" onClick={() => setState('closed')}>{t('No thanks')}</button>
        </div>
      ) : (
        <VerifyNumber
          compact
          initialPhone={user?.phone || ''}
          consentText={t('I agree to receive updates from Al Barakah on WhatsApp. I can reply STOP at any time.')}
          submit={(phone, code) => api('/whatsapp/subscribe', { method: 'POST', body: { phone, code, consent: true, sessionId } })}
          onDone={() => setState('done')}
          onCancel={() => setState('closed')}
        />
      )}
    </div>
  );
}
