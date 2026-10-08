import { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { api } from '../lib/api';
import Icon from './Icon';

// The coupons the house lists on the website ("Show on website"), for this
// market. Fetched once per market per visit; the bag and checkout share it.
const cache = new Map();
function useOffers(region) {
  const [list, setList] = useState(() => cache.get(region) || null);
  useEffect(() => {
    let live = true;
    const hit = cache.get(region);
    if (hit) setList(hit);
    api(`/coupons?region=${region}`)
      .then((d) => {
        cache.set(region, d.items || []);
        if (live) setList(d.items || []);
      })
      .catch(() => live && setList((x) => x || []));
    return () => { live = false; };
  }, [region]);
  return list || [];
}

// What a coupon would take off this bag, worked out the server's way (the
// server has the final word when it is applied).
export function estimate(o, subtotal) {
  if (o.minSubtotal && subtotal < o.minSubtotal) return { short: o.minSubtotal - subtotal, saving: 0 };
  let saving = o.type === 'percent' ? Math.round((subtotal * o.percent) / 100) : o.amount || 0;
  if (o.type === 'percent' && o.maxDiscount) saving = Math.min(saving, o.maxDiscount);
  return { short: 0, saving: Math.max(0, Math.min(saving, subtotal)) };
}

function useLabels() {
  const { fmt, t, lang } = useStore();
  const day = (d) => new Date(d).toLocaleDateString(lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short' });
  return {
    what: (o) => (o.type === 'percent'
      ? (o.maxDiscount ? t('{n}% off, up to {amount}', { n: o.percent, amount: fmt(o.maxDiscount) }) : t('{n}% off', { n: o.percent }))
      : t('{amount} off', { amount: fmt(o.amount) })),
    terms: (o) => [o.minSubtotal ? t('on bags over {amount}', { amount: fmt(o.minSubtotal) }) : null, o.expiresAt ? t('ends {date}', { date: day(o.expiresAt) }) : null].filter(Boolean),
  };
}

// One offer card: what it gives, its terms, the saving on this bag (or how
// much more to add) and Apply.
function OfferCard({ o, subtotal, best, busy, onApply }) {
  const { fmt, t } = useStore();
  const L = useLabels();
  const { short, saving } = estimate(o, subtotal);
  return (
    <li className={`offer${best ? ' is-best' : ''}${short ? ' is-short' : ''}`}>
      {best && <span className="offer-tag">{t('Best for this bag')}</span>}
      <span className="offer-what">{L.what(o)}</span>
      <span className="offer-terms"><b className="offer-code" dir="ltr">{o.code}</b>{L.terms(o).map((x) => ` · ${x}`).join('')}</span>
      {short ? (
        <span className="offer-need">{t('Add {amount} more to use this', { amount: fmt(short) })}</span>
      ) : saving > 0 ? (
        <span className="offer-save">{t('You save {amount}', { amount: fmt(saving) })}</span>
      ) : null}
      {o.description && <span className="offer-desc">{o.description}</span>}
      <button type="button" className="offer-apply" disabled={!!short || busy} aria-label={t('Apply {code}', { code: o.code })} onClick={() => onApply(o.code)}>
        {busy === o.code ? t('Applying…') : t('Apply')}
      </button>
    </li>
  );
}

// The offers block. `compact` (checkout summary) starts as a single line that
// opens the full list; the bag shows the list straight away.
export default function Offers({ compact = false }) {
  const { region, subtotal, coupon, discount, couponNote, applyCoupon, removeCoupon, fmt, t } = useStore();
  const offers = useOffers(region.code);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState(!compact);
  const [typing, setTyping] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const L = useLabels();
  if (!region.ships) return null;

  async function apply(c) {
    const value = String(c || '').trim();
    if (!value) return;
    setBusy(value.toUpperCase());
    setError('');
    try {
      await applyCoupon(value);
      setCode('');
      setTyping(false);
      if (compact) setOpen(false);
    } catch (e) {
      setError(e.status === 429 ? t('Too many tries. Please wait a few minutes.') : e.message);
    } finally {
      setBusy('');
    }
  }

  const others = offers.filter((o) => o.code !== coupon?.code);
  const ranked = others
    .map((o) => ({ o, ...estimate(o, subtotal) }))
    .sort((a, b) => (a.short ? 1 : 0) - (b.short ? 1 : 0) || b.saving - a.saving || a.short - b.short);
  const bestCode = !coupon && ranked[0] && !ranked[0].short && ranked[0].saving > 0 ? ranked[0].o.code : null;
  const shown = all ? ranked : ranked.slice(0, 2);

  const applied = coupon && (
    <div className="coupon-applied" role="status">
      <Icon name="check" size={16} />
      <span><b dir="ltr">{coupon.code}</b> {t('applied')} · {t('you save {amount}', { amount: fmt(discount) })}</span>
      <button type="button" onClick={() => removeCoupon()}>{t('Remove')}</button>
    </div>
  );

  const entry = typing ? (
    <form className="coupon-entry" onSubmit={(e) => { e.preventDefault(); apply(code); }}>
      <label className="sr-only" htmlFor={compact ? 'coupon-code-co' : 'coupon-code'}>{t('Coupon code')}</label>
      <input id={compact ? 'coupon-code-co' : 'coupon-code'} value={code} onChange={(e) => { setCode(e.target.value); setError(''); }} placeholder={t('Enter code')} autoComplete="off" autoCapitalize="characters" spellCheck="false" dir="ltr" maxLength={30} aria-invalid={!!error} aria-describedby={error ? 'coupon-error' : undefined} autoFocus />
      <button type="submit" disabled={!code.trim() || !!busy}>{busy && busy === code.trim().toUpperCase() ? t('Applying…') : t('Apply')}</button>
    </form>
  ) : (
    <button type="button" className="text-btn coupon-have" onClick={() => setTyping(true)}>{t('Have a code?')}</button>
  );

  const list = (
    <>
      {ranked.length > 0 && (
        <ul className="offer-list">
          {shown.map(({ o }) => <OfferCard key={o.code} o={o} subtotal={subtotal} best={o.code === bestCode} busy={busy} onApply={apply} />)}
        </ul>
      )}
      {entry}
      {error && <p className="coupon-error" id="coupon-error" role="alert"><Icon name="error" size={16} />{error}</p>}
    </>
  );

  if (compact) {
    return (
      <div className="offers offers-compact">
        <div className="coupon-line">
          {coupon ? (
            <span className="coupon-line-on"><Icon name="check" size={16} /><span><b dir="ltr">{coupon.code}</b> · {L.what(coupon)}</span></span>
          ) : (
            <span>{offers.length ? t(offers.length === 1 ? '1 offer available' : '{n} offers available', { n: offers.length }) : t('Have a coupon code?')}</span>
          )}
          <button type="button" className="text-btn" aria-expanded={open} onClick={() => { setOpen((x) => !x); if (!offers.length) setTyping(true); }}>
            {open ? t('Close') : coupon ? t('Change') : offers.length ? t('View offers') : t('Enter code')}
          </button>
        </div>
        {couponNote && <p className="coupon-error" role="status"><Icon name="alert" size={16} />{couponNote}</p>}
        {open && (
          <div className="offers-panel">
            {coupon && applied}
            {list}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="offers" aria-label={t('Offers for you')}>
      {couponNote && <p className="coupon-error" role="status"><Icon name="alert" size={16} />{couponNote}</p>}
      {applied}
      {ranked.length > 0 && (
        <div className="offers-head">
          <span className="eyebrow">{t(coupon ? 'Other offers' : 'Offers for you')}</span>
          {ranked.length > 2 && <button type="button" className="text-btn" aria-expanded={all} onClick={() => setAll((x) => !x)}>{all ? t('Show fewer') : t('See all {n}', { n: ranked.length })}</button>}
        </div>
      )}
      {list}
    </section>
  );
}
