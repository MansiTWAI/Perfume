import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import { api } from '../lib/api';
import { stopScroll } from './SmoothScroll';
import Icon from './Icon';

// WhatsApp updates for customers. Every "Get WhatsApp updates" button opens
// the same panel (<WhatsAppSheet>): number + consent → 6-digit code sent on
// WhatsApp → done. The code proves the number is theirs; a signed-in
// customer whose number is already verified skips it.
//
// Where it appears: the account page, the AI concierge (once, after
// interest), one band on the homepage, and a small reminder card shown at
// most once to interested visitors who are not subscribed.

export const PERKS = [
  ['New arrivals', 'Be first to know when a fragrance launches or returns.'],
  ['Exclusive offers', 'Subscriber-only codes for festivals and launches.'],
  ['Personal picks', 'Recommendations based on what you love.'],
  ['Concierge updates', 'Replies to what you asked our AI concierge.'],
];

// ----- shared state (this device) -----
const KEY = 'ab_wa'; // 'on' once subscribed here
const NUDGE = 'ab_wa_nudge'; // { visits, views, dismissedAt, shownAt }
const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };
const markSubscribed = (on) => { write(KEY, on ? 'on' : 'off'); window.dispatchEvent(new Event('wa:changed')); };
export const subscribedHere = () => read(KEY, '') === 'on';

export function openWhatsAppSignup(detail = {}) {
  window.dispatchEvent(new CustomEvent('wa:open', { detail }));
}
// Product pages call this: two fragrances viewed counts as interest.
export function noteProductView() {
  const n = read(NUDGE, {});
  write(NUDGE, { ...n, views: (n.views || 0) + 1 });
}

// ----- the panel -----
export function WhatsAppSheet() {
  const { t, user, toast } = useStore();
  const [open, setOpen] = useState(null); // { source, sessionId } while open
  const [step, setStep] = useState('number'); // number | code | done
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState('');
  const [wait, setWait] = useState(0);
  const first = useRef(null);

  useEffect(() => {
    const onOpen = (e) => {
      setOpen(e.detail || {});
      setStep('number');
      setPhone(user?.phone || '');
      setConsent(false);
      setCode('');
      setError('');
      setDevCode('');
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
  }, [open, step]);
  useEffect(() => {
    if (!wait) return undefined;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const digits = phone.replace(/\D/g, '');
  const phoneOk = digits.length >= 10 && digits.length <= 15;

  async function subscribe(withCode) {
    if (user) await api('/whatsapp/me', { method: 'PUT', body: { subscribed: true, phone, ...(withCode && { code: withCode }) } });
    else await api('/whatsapp/subscribe', { method: 'POST', body: { phone, code: withCode, consent: true, ...(open?.sessionId && { sessionId: open.sessionId }) } });
    markSubscribed(true);
    setStep('done');
  }
  async function sendCode(e) {
    e?.preventDefault();
    if (!phoneOk) return setError(t('Please enter your WhatsApp number with country code, e.g. +91 98765 43210.'));
    if (!consent) return setError(t('Please tick the box to agree to WhatsApp updates.'));
    setBusy(true);
    setError('');
    try {
      const r = await api('/whatsapp/subscribe/code', { method: 'POST', body: { phone } });
      if (r.needsCode === false) await subscribe('');
      else {
        setDevCode(r.devCode || '');
        setCode('');
        setStep('code');
        setWait(30);
      }
    } catch (err) {
      setError(err.status === 429 ? t('Too many codes for this number. Please wait a minute and try again.') : err.message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm(e) {
    e.preventDefault();
    if (code.length !== 6) return setError(t('Enter the 6-digit code from WhatsApp.'));
    setBusy(true);
    setError('');
    try {
      await subscribe(code);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const close = () => {
    if (step === 'done') toast(t('WhatsApp updates are on.'));
    setOpen(null);
  };
  const ORDER = ['number', 'code', 'done'];
  const stepClass = (s) => (s === step ? 'is-on' : ORDER.indexOf(s) < ORDER.indexOf(step) ? 'is-done' : '');

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="wa-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(null)} />
          <motion.div
            className="wa-sheet" role="dialog" aria-modal="true" aria-labelledby="wa-sheet-title" data-lenis-prevent
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.35 } }} exit={{ opacity: 0, y: 24 }}
          >
            <button type="button" className="wa-x" onClick={close} aria-label={t('Close')}><Icon name="close" /></button>
            <ol className="wa-steps" aria-label={t('Steps')}>
              <li className={stepClass('number')}>{t('1 Number')}</li>
              <li className={stepClass('code')}>{t('2 Code')}</li>
              <li className={stepClass('done')}>{t('3 Done')}</li>
            </ol>

            {step === 'number' && (
              <form onSubmit={sendCode} className="wa-form" noValidate>
                <h2 id="wa-sheet-title">{t('Get WhatsApp updates')}</h2>
                <ul className="wa-chips">{PERKS.map(([p]) => <li key={p}>{t(p)}</li>)}</ul>
                <label className="wa-field">{t('Your WhatsApp number')}
                  <input ref={first} type="tel" dir="ltr" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setError(''); }} placeholder="+91 98765 43210" aria-invalid={!!error && !phoneOk} />
                </label>
                <label className="wa-consent">
                  <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setError(''); }} />
                  <span>{t('I agree to receive updates from Al Barakah on WhatsApp. I can reply STOP at any time.')}</span>
                </label>
                {error && <p className="wa-error" role="alert"><Icon name="error" size={16} />{error}</p>}
                <button className="btn btn-primary btn-block" disabled={busy}>{t(busy ? 'Sending…' : 'Send my code')}</button>
                <p className="fine">{t('We will send a 6-digit code on WhatsApp to check it is your number.')}</p>
              </form>
            )}

            {step === 'code' && (
              <form onSubmit={confirm} className="wa-form" noValidate>
                <h2 id="wa-sheet-title">{t('Enter your code')}</h2>
                <p className="fine">{t('Sent on WhatsApp to {phone}', { phone: <b dir="ltr" key="p">{phone}</b> })} · <button type="button" className="wa-link" onClick={() => { setStep('number'); setError(''); }}>{t('change')}</button></p>
                <label className="wa-field">{t('6-digit code')}
                  <input ref={first} className="wa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} dir="ltr" aria-invalid={!!error} />
                </label>
                {devCode && <p className="fine">{t('Test server: your code is {code}', { code: devCode })}</p>}
                {error && <p className="wa-error" role="alert"><Icon name="error" size={16} />{error}</p>}
                <button className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>{t(busy ? 'One moment…' : 'Confirm')}</button>
                <p className="fine">{t("Didn't get it?")} {wait > 0 ? t('Send again in {n}s', { n: wait }) : <button type="button" className="wa-link" onClick={sendCode} disabled={busy}>{t('Send again')}</button>}</p>
              </form>
            )}

            {step === 'done' && (
              <div className="wa-done" role="status">
                <span className="wa-ring"><Icon name="check" /></span>
                <h2 id="wa-sheet-title">{t("You're on the list")}</h2>
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
export default function WhatsAppUpdates() {
  const { t, lang } = useStore();
  const [state] = useSubscribed();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  async function stop() {
    setBusy(true);
    setError('');
    try {
      await api('/whatsapp/me', { method: 'PUT', body: { subscribed: false } });
      markSubscribed(false);
      setAsking(false);
      setNote(t('Updates stopped. You can subscribe again any time.'));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="acct-card wa-card" aria-labelledby="wa-title">
      <h2 id="wa-title" className="acct-sub">{t('WhatsApp updates')}</h2>
      <ul className="wa-chips">{PERKS.map(([p]) => <li key={p}>{t(p)}</li>)}</ul>
      {!state ? <div className="skeleton-lines" aria-busy="true"><span /></div> : state.subscribed ? (
        <div className="wa-state">
          <span><b dir="ltr">{state.phone}</b><span className="wa-on"><Icon name="check" size={16} />{t('Subscribed since {date}', { date: day(state.since, lang) })}</span></span>
          {asking ? (
            <span className="wa-ask"><span>{t('Stop WhatsApp updates?')}</span><button type="button" className="btn btn-primary" disabled={busy} onClick={stop}>{t(busy ? 'One moment…' : 'Yes, stop')}</button><button type="button" className="wa-link" onClick={() => setAsking(false)}>{t('Keep them')}</button></span>
          ) : <button type="button" className="btn btn-ghost" onClick={() => { setAsking(true); setNote(''); }}>{t('Stop updates')}</button>}
        </div>
      ) : (
        <div className="wa-state">
          <span><b>{t('Not subscribed')}</b><span className="muted">{t('New arrivals, offers and personal picks, a few times a month.')}</span></span>
          <button type="button" className="btn btn-primary" onClick={() => openWhatsAppSignup({ source: 'account' })}>{t('Get updates')}</button>
        </div>
      )}
      {note && <p className="wa-note" role="status">{note}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="fine">{t('You can also reply STOP to any of our messages. Order updates are separate and always sent.')}</p>
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
        <button type="button" className="btn btn-primary" onClick={() => openWhatsAppSignup({ source: 'concierge', sessionId })}>{t('Yes, please')}</button>
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
          <p className="wa-band-lede">{t('A few messages a month, never more. Verified to your number, and you can stop any time by replying STOP.')}</p>
          <div className="wa-row">
            <button type="button" className="btn wa-gold" onClick={() => openWhatsAppSignup({ source: 'home' })}><Icon name="chat" size={16} />{t('Get WhatsApp updates')}</button>
            <span className="fine">{t('Free · a few messages a month')}</span>
          </div>
        </div>
        <ul className="wa-perks">{PERKS.map(([p, d]) => <li key={p}><b>{t(p)}</b><span>{t(d)}</span></li>)}</ul>
      </div>
    </section>
  );
}

// ----- the gentle reminder -----
// At most once, to visitors who are not subscribed and seem interested
// (second visit, or two fragrances viewed). Never on checkout, account,
// order or info pages or the homepage (it has the band), never in the first 15 seconds, never while the bag,
// the concierge or the sign-up panel is open. "Not now" hides it 30 days.
const QUIET = /^\/(checkout|profile|account|order|track|reset|forgot|privacy|terms|refund|shipping-policy|admin)/;
let visitCounted = false;
export function WhatsAppNudge() {
  const { t, user, cartOpen } = useStore();
  const { pathname } = useLocation();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (visitCounted) return;
    visitCounted = true;
    const n = read(NUDGE, {});
    write(NUDGE, { ...n, visits: (n.visits || 0) + 1 });
  }, []);
  useEffect(() => {
    setShow(false);
    // The homepage has its own WhatsApp band, so the reminder never doubles it.
    if (pathname === '/' || QUIET.test(pathname)) return undefined;
    const id = setTimeout(async () => {
      const n = read(NUDGE, {});
      const day30 = 30 * 864e5;
      if (n.shownSession === sessionStorage.getItem('ab_session_id')) return;
      if (n.dismissedAt && Date.now() - n.dismissedAt < day30) return;
      if (!((n.visits || 0) >= 2 || (n.views || 0) >= 2)) return;
      if (subscribedHere()) return;
      if (document.querySelector('.cc-panel, .wa-sheet, .drawer, .search-overlay[aria-hidden="false"]')) return;
      if (user) {
        try {
          if ((await api('/whatsapp/me')).subscribed) return write(KEY, 'on');
        } catch { /* show anyway */ }
      }
      let sid = sessionStorage.getItem('ab_session_id');
      if (!sid) { sid = Math.random().toString(36).slice(2); try { sessionStorage.setItem('ab_session_id', sid); } catch { /* blocked */ } }
      write(NUDGE, { ...read(NUDGE, {}), shownSession: sid, shownAt: Date.now() });
      setShow(true);
    }, 15000);
    return () => clearTimeout(id);
  }, [pathname, user]);
  useEffect(() => {
    if (cartOpen) setShow(false);
  }, [cartOpen]);
  useEffect(() => {
    const hide = () => setShow(false);
    window.addEventListener('wa:open', hide);
    return () => window.removeEventListener('wa:open', hide);
  }, []);
  const dismiss = () => {
    write(NUDGE, { ...read(NUDGE, {}), dismissedAt: Date.now() });
    setShow(false);
  };
  return (
    <AnimatePresence>
      {show && (
        <motion.aside className="wa-nudge" role="complementary" aria-label={t('WhatsApp updates')} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
          <button type="button" className="wa-x" onClick={dismiss} aria-label={t('Not now')}><Icon name="close" size={16} /></button>
          <b>{t('First to know about new arrivals')}</b>
          <p>{t('Launches, subscriber offers and personal picks, a few times a month on WhatsApp.')}</p>
          <div className="wa-row">
            <button type="button" className="btn btn-primary" onClick={() => { setShow(false); openWhatsAppSignup({ source: 'nudge' }); }}>{t('Get updates')}</button>
            <button type="button" className="wa-link" onClick={dismiss}>{t('Not now')}</button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
