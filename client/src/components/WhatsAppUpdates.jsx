import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import { api } from '../lib/api';
import { whatsappLink } from '../lib/format';
import { stopScroll } from './SmoothScroll';
import Icon from './Icon';

// WhatsApp updates for customers. One tap: a signed-in customer with a phone
// on their account subscribes straight from the account card; everyone else
// gets one small panel (<WhatsAppSheet>) with their number and a consent tick.
// No code. A number that sent STOP on WhatsApp has to send START there to
// come back (the server answers WHATSAPP_STOPPED).
//
// Where it appears: the account page, the AI concierge (once, after
// interest) and one band on the homepage. Nowhere else, and no pop-ups.

export const PERKS = [
  ['New arrivals', 'Be first to know when a fragrance launches or returns.'],
  ['Exclusive offers', 'Subscriber-only codes for festivals and launches.'],
  ['Personal picks', 'Recommendations based on what you love.'],
  ['Concierge updates', 'Replies to what you asked our AI concierge.'],
];

// ----- shared state (this device) -----
const KEY = 'ab_wa'; // 'on' once subscribed here
const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };
const markSubscribed = (on) => { write(KEY, on ? 'on' : 'off'); window.dispatchEvent(new Event('wa:changed')); };
export const subscribedHere = () => read(KEY, '') === 'on';

export function openWhatsAppSignup(detail = {}) {
  window.dispatchEvent(new CustomEvent('wa:open', { detail }));
}

// The server's "this number sent STOP" answer, with the way back.
function StoppedNote({ t }) {
  return (
    <p className="wa-error" role="alert"><Icon name="error" size={16} />
      <span>{t('This number asked us to stop WhatsApp updates. To start again, send START to us on WhatsApp.')} <a className="wa-link" href={whatsappLink('START')} target="_blank" rel="noreferrer">{t('Open WhatsApp')}</a></span>
    </p>
  );
}

// ----- the panel -----
export function WhatsAppSheet() {
  const { t, user, toast } = useStore();
  const [open, setOpen] = useState(null); // { source, sessionId } while open
  const [done, setDone] = useState(false);
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const first = useRef(null);

  useEffect(() => {
    const onOpen = (e) => {
      setOpen(e.detail || {});
      setDone(false);
      setPhone(user?.phone || '');
      setConsent(false);
      setError('');
    };
    window.addEventListener('wa:open', onOpen);
    return () => window.removeEventListener('wa:open', onOpen);
  }, [user?.phone]);
  useEffect(() => {
    if (!open) return undefined;
    stopScroll(true);
    const onKey = (e) => e.key === 'Escape' && setOpen(null);
    addEventListener('keydown', onKey);
    const id = setTimeout(() => first.current?.focus(), 80);
    return () => { stopScroll(false); removeEventListener('keydown', onKey); clearTimeout(id); };
  }, [open, done]);

  const digits = phone.replace(/\D/g, '');
  const phoneOk = digits.length >= 10 && digits.length <= 15;

  async function submit(e) {
    e.preventDefault();
    if (!phoneOk) return setError(t('Please enter your WhatsApp number with country code, e.g. +91 98765 43210.'));
    if (!consent) return setError(t('Please tick the box to agree to WhatsApp updates.'));
    setBusy(true);
    setError('');
    try {
      if (user) await api('/whatsapp/me', { method: 'PUT', body: { subscribed: true, phone } });
      else await api('/whatsapp/subscribe', { method: 'POST', body: { phone, consent: true, ...(open?.sessionId && { sessionId: open.sessionId }) } });
      markSubscribed(true);
      setDone(true);
    } catch (err) {
      setError(err.code === 'WHATSAPP_STOPPED' ? 'stopped' : err.status === 429 ? t('Too many tries. Please wait a few minutes and try again.') : err.message);
    } finally {
      setBusy(false);
    }
  }
  const close = () => {
    if (done) toast(t('WhatsApp updates are on.'));
    setOpen(null);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="wa-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <motion.div
            className="wa-sheet" role="dialog" aria-modal="true" aria-labelledby="wa-sheet-title" data-lenis-prevent
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.35 } }} exit={{ opacity: 0, y: 24 }}
          >
            <button type="button" className="wa-x" onClick={close} aria-label={t('Close')}><Icon name="close" /></button>
            {!done ? (
              <form onSubmit={submit} className="wa-form" noValidate>
                <h2 id="wa-sheet-title">{t('Subscribe to WhatsApp updates')}</h2>
                <p className="fine">{t('A few messages a month. Reply STOP at any time.')}</p>
                <ul className="wa-chips">{PERKS.map(([p]) => <li key={p}>{t(p)}</li>)}</ul>
                <label className="wa-field">{t('Your WhatsApp number')}
                  <input ref={first} type="tel" dir="ltr" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setError(''); }} placeholder="+91 98765 43210" aria-invalid={!!error && !phoneOk} />
                </label>
                <label className="wa-consent">
                  <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setError(''); }} />
                  <span>{t('I agree to receive updates from Al Barakah on WhatsApp. I can reply STOP at any time.')}</span>
                </label>
                {error === 'stopped' ? <StoppedNote t={t} /> : error && <p className="wa-error" role="alert"><Icon name="error" size={16} />{error}</p>}
                <button className="btn btn-primary btn-block wa-btn" disabled={busy}><Icon name="chat" size={16} />{t(busy ? 'One moment…' : 'Subscribe')}</button>
              </form>
            ) : (
              <div className="wa-done" role="status">
                <span className="wa-ring"><Icon name="check" /></span>
                <h2 id="wa-sheet-title">{t("You're subscribed")}</h2>
                <p className="fine">{t('Updates will come from Al Barakah on WhatsApp to {phone}. Reply STOP to any message, or switch them off in your account, whenever you like.', { phone: <b dir="ltr" key="p">{phone}</b> })}</p>
                <button ref={first} type="button" className="btn btn-primary" onClick={close}>{t('Continue shopping')}</button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Whether this customer is subscribed: the account's answer when signed in,
// else what this device remembers.
function useSubscribed() {
  const { user } = useStore();
  const [state, setState] = useState(null); // null loading · { subscribed, phone, since }
  const load = useCallback(() => {
    if (!user) return setState({ subscribed: subscribedHere() });
    api('/whatsapp/me').then((d) => { setState(d); write(KEY, d.subscribed ? 'on' : 'off'); }).catch(() => setState({ subscribed: subscribedHere() }));
  }, [user]);
  useEffect(() => {
    load();
    window.addEventListener('wa:changed', load);
    return () => window.removeEventListener('wa:changed', load);
  }, [load]);
  return [state, load];
}

const day = (d, lang) => (d ? new Date(d).toLocaleDateString(lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// ----- account page card -----
// With a phone on the account: one tap. Without: the panel asks for it.
export default function WhatsAppUpdates() {
  const { t, lang, user } = useStore();
  const [state] = useSubscribed();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  async function set(on) {
    setBusy(true);
    setError('');
    setNote('');
    try {
      await api('/whatsapp/me', { method: 'PUT', body: { subscribed: on } });
      markSubscribed(on);
      setAsking(false);
      setNote(t(on ? 'Subscribed. Updates will come on WhatsApp.' : 'Updates stopped. You can subscribe again any time.'));
    } catch (e) {
      setError(e.code === 'WHATSAPP_STOPPED' ? 'stopped' : e.message);
    } finally {
      setBusy(false);
    }
  }
  const phone = state?.phone || user?.phone || '';
  return (
    <section className="acct-card wa-card" aria-labelledby="wa-title">
      <h2 id="wa-title" className="acct-sub">{t('WhatsApp updates')}</h2>
      {!state ? <div className="skeleton-lines" aria-busy="true"><span /></div> : state.subscribed ? (
        <div className="wa-state">
          <span><b dir="ltr">{state.phone}</b><span className="wa-on"><Icon name="check" size={16} />{t('Subscribed since {date}', { date: day(state.since, lang) })}</span></span>
          {asking ? (
            <span className="wa-ask"><span>{t('Stop WhatsApp updates?')}</span><button type="button" className="btn btn-primary" disabled={busy} onClick={() => set(false)}>{t(busy ? 'One moment…' : 'Yes, stop')}</button><button type="button" className="wa-link" onClick={() => setAsking(false)}>{t('Keep them')}</button></span>
          ) : <button type="button" className="btn btn-ghost" onClick={() => { setAsking(true); setNote(''); }}>{t('Unsubscribe')}</button>}
        </div>
      ) : (
        <div className="wa-state">
          <span><b>{t('Not subscribed')}</b><span className="muted">{phone ? t('Updates would go to {phone}', { phone: <bdi key="p">{phone}</bdi> }) : t('New arrivals, offers and personal picks, a few times a month.')}</span></span>
          <button type="button" className="btn btn-primary wa-btn" disabled={busy} onClick={() => (phone ? set(true) : openWhatsAppSignup({ source: 'account' }))}><Icon name="chat" size={16} />{t(busy ? 'One moment…' : 'Subscribe to WhatsApp updates')}</button>
        </div>
      )}
      {note && <p className="wa-note" role="status">{note}</p>}
      {error === 'stopped' ? <StoppedNote t={t} /> : error && <p className="form-error" role="alert">{error}</p>}
      <p className="fine">{state?.subscribed ? t('You can also reply STOP to any of our messages. Order updates are separate and always sent.') : t('New arrivals, exclusive offers and personal picks, a few times a month. By subscribing you agree to receive them on WhatsApp; reply STOP any time.')}</p>
    </section>
  );
}

// ----- AI concierge card (shown once, after interest) -----
export function ConciergeOptIn({ sessionId }) {
  const { t } = useStore();
  const [closed, setClosed] = useState(false);
  const [on, setOn] = useState(subscribedHere());
  useEffect(() => {
    const f = () => setOn(subscribedHere());
    window.addEventListener('wa:changed', f);
    return () => window.removeEventListener('wa:changed', f);
  }, []);
  if (closed) return null;
  if (on) return <p className="cc-optin-done" role="status"><Icon name="check" size={16} />{t('Subscribed. Reply STOP to any message to stop.')}</p>;
  return (
    <div className="cc-optin">
      <b>{t('Get new launches and offers on WhatsApp')}</b>
      <p>{t('A few messages a month. You can stop any time.')}</p>
      <div className="wa-row">
        <button type="button" className="btn btn-primary wa-btn" onClick={() => openWhatsAppSignup({ source: 'concierge', sessionId })}><Icon name="chat" size={16} />{t('Subscribe')}</button>
        <button type="button" className="wa-link" onClick={() => setClosed(true)}>{t('No thanks')}</button>
      </div>
    </div>
  );
}

// ----- homepage band -----
export function WhatsAppBand() {
  const { t } = useStore();
  const [state] = useSubscribed();
  if (state?.subscribed) return null;
  return (
    <section className="wa-band" aria-labelledby="wa-band-title">
      <div className="wa-band-in">
        <div>
          <p className="eyebrow">{t('The house on WhatsApp')}</p>
          <h2 id="wa-band-title">{t('Hear it first.')}</h2>
          <p className="wa-band-lede">{t('A few messages a month, never more. Stop any time by replying STOP.')}</p>
          <div className="wa-row">
            <button type="button" className="btn wa-gold" onClick={() => openWhatsAppSignup({ source: 'home' })}><Icon name="chat" size={16} />{t('Subscribe to WhatsApp updates')}</button>
            <span className="fine">{t('Free · a few messages a month')}</span>
          </div>
        </div>
        <ul className="wa-perks">{PERKS.map(([p, d]) => <li key={p}><b>{t(p)}</b><span>{t(d)}</span></li>)}</ul>
      </div>
    </section>
  );
}
