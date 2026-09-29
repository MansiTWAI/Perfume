import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Seo from '../components/Seo';
import SignatureCard, { OCCASIONS } from '../components/SignatureCard';
import { useSolidHeader } from '../hooks/useSolidHeader';
import { useStore } from '../context/StoreContext';
import { api } from '../lib/api';
import { whatsappLink } from '../lib/format';
import { seasonFor } from '../lib/seasons';

const PAY_LABEL = {
  cod: ['Cash on delivery', 'Pay when your order arrives.'],
  'pay-on-confirmation': ['Pay on confirmation', 'We confirm your order by WhatsApp or email and send a secure payment link.'],
};

const PHONE_CODE = { IN: '+91', AE: '+971' };

function OrderSummary({ cart, subtotal, shipping, region }) {
  const { priceOf, fmt, t } = useStore();
  return (
    <aside className="summary">
      <h2>{t('Your order')}</h2>
      <ul>
        {cart.map((i) => (
          <li key={i.slug}>
            <span className="summary-img"><img src={i.image} alt="" /><b>{i.qty}</b></span>
            <span className="summary-name">{i.name}<small dir="ltr">{i.sizeLabel}</small></span>
            <span>{fmt((priceOf(i) || 0) * i.qty)}</span>
          </li>
        ))}
      </ul>
      <div className="row"><span>{t('Subtotal')}</span><span>{fmt(subtotal)}</span></div>
      {region.ships && <div className="row"><span>{t('Delivery')}</span><span>{shipping ? fmt(shipping) : t('Complimentary')}</span></div>}
      <div className="row total"><span>{t('Total')}</span><span>{fmt(subtotal + shipping)}</span></div>
      <p className="fine">
        {region.ships
          ? t('Prices {tax}.', { tax: t(region.taxLabel) })
          : t('Prices are estimates converted from UAE dirhams. We confirm the exact amount on WhatsApp before you pay.')}
      </p>
    </aside>
  );
}

export default function Checkout() {
  const { cart, subtotal, shipping, fmt, region, regions, setRegion, clearCart, user, t } = useStore();
  const navigate = useNavigate();
  useSolidHeader();
  const methods = region.payments || ['pay-on-confirmation'];
  const [f, setF] = useState({ name: '', email: '', phone: '', line1: '', line2: '', city: '', state: '', postalCode: '' });
  // Fill in the signed-in customer's saved details (the account can load after
  // this page does). Only empty fields are filled, never what was typed.
  useEffect(() => {
    if (!user) return;
    const a = !user.address?.region || user.address.region === region.code ? user.address || {} : {};
    const from = { name: user.name, email: user.email, phone: user.phone, line1: a.line1, line2: a.line2, city: a.city, state: a.state, postalCode: a.postalCode };
    setF((x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v || from[k] || ''])));
  }, [user, region.code]);
  const [pay, setPay] = useState(methods[0]);
  // In Ramadan or around Eid the gift card opens on that occasion.
  const [gift, setGift] = useState(() => ({
    enabled: false,
    name: '',
    occasion: seasonFor(region.code)?.card || 'eid',
    message: t('For every room you walk into.'),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!methods.includes(pay)) setPay(methods[0]);
  }, [methods, pay]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const giftFragrance = cart.find((i) => i.slug === 'zafreon') ? 'ZAFREON' : cart[0]?.name;
  const isIndia = region.code === 'IN';

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api('/orders', {
        method: 'POST',
        body: {
          region: region.code,
          paymentMethod: pay,
          items: cart.map((i) => ({ slug: i.slug, qty: i.qty })),
          customer: {
            name: f.name, email: f.email, phone: f.phone,
            address: { line1: f.line1, line2: f.line2, city: f.city, state: f.state, postalCode: f.postalCode },
          },
          giftNote: gift,
        },
      });
      clearCart();
      navigate(`/order/${res.orderNumber}`, { state: { ...res, email: f.email } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!cart.length) {
    return (
      <section className="section page-pad center checkout">
        <Seo title="Checkout" />
        <h1 className="display-l">{t('Your bag is empty')}</h1>
        <p className="section-lede center-block">{t('Choose a fragrance to begin.')}</p>
        <Link to="/fragrances" className="btn btn-primary" style={{ marginTop: 28 }}>{t('Discover the collection')}</Link>
      </section>
    );
  }

  const regionPicker = (
    <fieldset>
      <legend>{t('Deliver to')}</legend>
      <label>
        <span className="sr-only">{t('Country')}</span>
        <select value={region.code} onChange={(e) => setRegion(e.target.value)}>
          {regions.map((r) => <option key={r.code} value={r.code}>{t(r.name)}{r.ships ? '' : ` ${t('(on request)')}`}</option>)}
        </select>
      </label>
    </fieldset>
  );

  // Countries without confirmed delivery order through a conversation.
  if (!region.ships) {
    const lines = cart.map((i) => `${i.name} × ${i.qty}`).join(', ');
    return (
      <section className="section checkout page-pad">
        <Seo title="Checkout" />
        <div className="container checkout-grid">
          <div className="form checkout-form">
            <h1 className="display-l">{t('Checkout')}</h1>
            {regionPicker}
            <div className="enquiry-box">
              <h2>{t('Ordering from {country}', { country: t(region.name) })}</h2>
              <p>{t('We are arranging delivery to {country}. Send us your order on WhatsApp and we will confirm availability, delivery time and any duties before you pay.', { country: t(region.name) })}</p>
              <a
                className="btn btn-primary"
                href={whatsappLink(`${t('Hello Al Barakah, I would like to order {lines} for delivery to {country}.', { lines, country: t(region.name) })} (${fmt(subtotal)})`)}
                target="_blank"
                rel="noreferrer"
              >
                {t('Send my order on WhatsApp')}
              </a>
            </div>
          </div>
          <OrderSummary cart={cart} subtotal={subtotal} shipping={0} region={region} />
        </div>
      </section>
    );
  }

  return (
    <section className="section checkout page-pad">
      <Seo title="Checkout" />
      <div className="container checkout-grid">
        <form onSubmit={submit} className="form checkout-form">
          <h1 className="display-l">{t('Checkout')}</h1>
          {regionPicker}

          <fieldset>
            <legend>{t('Contact')}</legend>
            <div className="form-row">
              <label>{t('Full name')}<input required value={f.name} onChange={set('name')} autoComplete="name" /></label>
              <label>{t('Mobile (WhatsApp)')}<input required type="tel" dir="ltr" value={f.phone} onChange={set('phone')} autoComplete="tel" placeholder={PHONE_CODE[region.code]} /></label>
            </div>
            <label>{t('Email')}<input type="email" dir="ltr" required value={f.email} onChange={set('email')} autoComplete="email" /></label>
          </fieldset>

          <fieldset>
            <legend>{t('Address')}</legend>
            <label>{t('Address line 1')}<input required value={f.line1} onChange={set('line1')} autoComplete="address-line1" /></label>
            <label>{t('Address line 2 (optional)')}<input value={f.line2} onChange={set('line2')} autoComplete="address-line2" /></label>
            <div className="form-row three">
              <label>{t('City')}<input required value={f.city} onChange={set('city')} autoComplete="address-level2" /></label>
              <label>{t(isIndia ? 'State' : 'Emirate')}<input value={f.state} onChange={set('state')} autoComplete="address-level1" /></label>
              <label>{t(isIndia ? 'PIN code' : 'Postal code / P.O. Box')}<input required value={f.postalCode} onChange={set('postalCode')} autoComplete="postal-code" inputMode={isIndia ? 'numeric' : undefined} /></label>
            </div>
          </fieldset>

          <fieldset>
            <legend>{t('Payment')}</legend>
            <div className="radio-cards">
              {methods.map((m) => (
                <label key={m} className={`radio-card ${pay === m ? 'is-on' : ''}`}>
                  <input type="radio" name="pay" value={m} checked={pay === m} onChange={() => setPay(m)} />
                  <span><b>{PAY_LABEL[m] ? t(PAY_LABEL[m][0]) : m}</b><small>{PAY_LABEL[m] && t(PAY_LABEL[m][1])}</small></span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="gift-field">
            <legend>{t('Signature Card')}</legend>
            <label className="toggle">
              <input type="checkbox" checked={gift.enabled} onChange={(e) => setGift({ ...gift, enabled: e.target.checked })} />
              <span>{t('Add a complimentary gift note, printed and placed in the box')}</span>
            </label>
            <AnimatePresence>
              {gift.enabled && (
                <motion.div className="gift-grid" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <div className="gift-controls">
                    <label>{t('Recipient’s name')}<input value={gift.name} maxLength={18} onChange={(e) => setGift({ ...gift, name: e.target.value })} placeholder="Ayesha" /></label>
                    <div>
                      <span className="label" id="occasion-label">{t('Occasion')}</span>
                      <div className="chips" role="group" aria-labelledby="occasion-label">
                        {OCCASIONS.map((o) => (
                          <button type="button" key={o.id} className="chip" aria-pressed={gift.occasion === o.id} onClick={() => setGift({ ...gift, occasion: o.id })}>{t(o.label)}</button>
                        ))}
                      </div>
                    </div>
                    <label>{t('Your message')}<input value={gift.message} maxLength={80} onChange={(e) => setGift({ ...gift, message: e.target.value })} /></label>
                  </div>
                  <SignatureCard name={gift.name || 'Ayesha'} occasion={gift.occasion} message={gift.message} theme={giftFragrance === 'ZAFREON' ? 'onyx' : 'ivory'} fragrance={giftFragrance} />
                </motion.div>
              )}
            </AnimatePresence>
          </fieldset>

          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? t('Placing your order…') : t('Place order · {amount}', { amount: fmt(subtotal + shipping) })}</button>
          <p className="fine">
            {t('By placing your order you agree to our {terms} and {privacy}.', {
              terms: <Link to="/terms">{t('Terms')}</Link>,
              privacy: <Link to="/privacy-policy">{t('Privacy Policy')}</Link>,
            })}
          </p>
        </form>
        <OrderSummary cart={cart} subtotal={subtotal} shipping={shipping} region={region} />
      </div>
    </section>
  );
}
