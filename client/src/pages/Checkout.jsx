import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Seo from '../components/Seo';
import SignatureCard, { OCCASIONS } from '../components/SignatureCard';
import { useSolidHeader } from '../hooks/useSolidHeader';
import { useStore } from '../context/StoreContext';
import { api } from '../lib/api';
import { money, whatsappLink } from '../lib/format';

const PAY_LABEL = {
  cod: ['Cash on delivery', 'Pay when your order arrives.'],
  'pay-on-confirmation': ['Pay on confirmation', 'We confirm your order by WhatsApp or email and send a secure payment link.'],
};

function OrderSummary({ cart, currency, subtotal, shipping, region }) {
  return (
    <aside className="summary">
      <h2>Your order</h2>
      <ul>
        {cart.map((i) => (
          <li key={i.slug}>
            <span className="summary-img"><img src={i.image} alt="" /><b>{i.qty}</b></span>
            <span className="summary-name">{i.name}<small>{i.sizeLabel}</small></span>
            <span>{money((i.price?.[currency] || 0) * i.qty, currency)}</span>
          </li>
        ))}
      </ul>
      <div className="row"><span>Subtotal</span><span>{money(subtotal, currency)}</span></div>
      {region.ships && <div className="row"><span>Delivery</span><span>{shipping ? money(shipping, currency) : 'Complimentary'}</span></div>}
      <div className="row total"><span>Total</span><span>{money(subtotal + shipping, currency)}</span></div>
      {region.ships && <p className="fine">Prices {region.taxLabel}.</p>}
    </aside>
  );
}

export default function Checkout() {
  const { cart, subtotal, shipping, currency, region, regions, setRegion, clearCart, user } = useStore();
  const navigate = useNavigate();
  useSolidHeader();
  const methods = region.payments || ['pay-on-confirmation'];
  const [f, setF] = useState({ name: user?.name || '', email: user?.email || '', phone: '', line1: '', line2: '', city: '', state: '', postalCode: '' });
  const [pay, setPay] = useState(methods[0]);
  const [gift, setGift] = useState({ enabled: false, name: '', occasion: 'eid', message: 'For every room you walk into.' });
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
        <h1 className="display-l">Your bag is empty</h1>
        <p className="section-lede center-block">Choose a fragrance to begin.</p>
        <Link to="/fragrances" className="btn btn-primary" style={{ marginTop: 28 }}>Discover the collection</Link>
      </section>
    );
  }

  const regionPicker = (
    <fieldset>
      <legend>Deliver to</legend>
      <label>
        <span className="sr-only">Country</span>
        <select value={region.code} onChange={(e) => setRegion(e.target.value)}>
          {regions.map((r) => <option key={r.code} value={r.code}>{r.name}{r.ships ? '' : ' (on request)'}</option>)}
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
            <h1 className="display-l">Checkout</h1>
            {regionPicker}
            <div className="enquiry-box">
              <h2>Ordering from {region.name}</h2>
              <p>We are arranging delivery to {region.name}. Send us your order on WhatsApp and we will confirm availability, delivery time and any duties before you pay.</p>
              <a className="btn btn-primary" href={whatsappLink(`Hello Al Barakah, I would like to order ${lines} for delivery to ${region.name}.`)} target="_blank" rel="noreferrer">
                Send my order on WhatsApp
              </a>
            </div>
          </div>
          <OrderSummary cart={cart} currency={currency} subtotal={subtotal} shipping={0} region={region} />
        </div>
      </section>
    );
  }

  return (
    <section className="section checkout page-pad">
      <Seo title="Checkout" />
      <div className="container checkout-grid">
        <form onSubmit={submit} className="form checkout-form">
          <h1 className="display-l">Checkout</h1>
          {regionPicker}

          <fieldset>
            <legend>Contact</legend>
            <div className="form-row">
              <label>Full name<input required value={f.name} onChange={set('name')} autoComplete="name" /></label>
              <label>Mobile (WhatsApp)<input required type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" placeholder={isIndia ? '+91' : '+971'} /></label>
            </div>
            <label>Email<input type="email" required value={f.email} onChange={set('email')} autoComplete="email" /></label>
          </fieldset>

          <fieldset>
            <legend>Address</legend>
            <label>Address line 1<input required value={f.line1} onChange={set('line1')} autoComplete="address-line1" /></label>
            <label>Address line 2 (optional)<input value={f.line2} onChange={set('line2')} autoComplete="address-line2" /></label>
            <div className="form-row three">
              <label>City<input required value={f.city} onChange={set('city')} autoComplete="address-level2" /></label>
              <label>{isIndia ? 'State' : 'Emirate'}<input value={f.state} onChange={set('state')} autoComplete="address-level1" /></label>
              <label>{isIndia ? 'PIN code' : 'Postal code / P.O. Box'}<input required value={f.postalCode} onChange={set('postalCode')} autoComplete="postal-code" inputMode={isIndia ? 'numeric' : undefined} /></label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Payment</legend>
            <div className="radio-cards">
              {methods.map((m) => (
                <label key={m} className={`radio-card ${pay === m ? 'is-on' : ''}`}>
                  <input type="radio" name="pay" value={m} checked={pay === m} onChange={() => setPay(m)} />
                  <span><b>{PAY_LABEL[m]?.[0] || m}</b><small>{PAY_LABEL[m]?.[1]}</small></span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="gift-field">
            <legend>Signature Card</legend>
            <label className="toggle">
              <input type="checkbox" checked={gift.enabled} onChange={(e) => setGift({ ...gift, enabled: e.target.checked })} />
              <span>Add a complimentary gift note, printed and placed in the box</span>
            </label>
            <AnimatePresence>
              {gift.enabled && (
                <motion.div className="gift-grid" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <div className="gift-controls">
                    <label>Recipient’s name<input value={gift.name} maxLength={18} onChange={(e) => setGift({ ...gift, name: e.target.value })} placeholder="Ayesha" /></label>
                    <div>
                      <span className="label" id="occasion-label">Occasion</span>
                      <div className="chips" role="group" aria-labelledby="occasion-label">
                        {OCCASIONS.map((o) => (
                          <button type="button" key={o.id} className="chip" aria-pressed={gift.occasion === o.id} onClick={() => setGift({ ...gift, occasion: o.id })}>{o.label}</button>
                        ))}
                      </div>
                    </div>
                    <label>Your message<input value={gift.message} maxLength={80} onChange={(e) => setGift({ ...gift, message: e.target.value })} /></label>
                  </div>
                  <SignatureCard name={gift.name || 'Ayesha'} occasion={gift.occasion} message={gift.message} theme={giftFragrance === 'ZAFREON' ? 'onyx' : 'ivory'} fragrance={giftFragrance} />
                </motion.div>
              )}
            </AnimatePresence>
          </fieldset>

          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'Placing your order…' : `Place order · ${money(subtotal + shipping, currency)}`}</button>
          <p className="fine">By placing your order you agree to our <Link to="/terms">Terms</Link> and <Link to="/privacy-policy">Privacy Policy</Link>.</p>
        </form>
        <OrderSummary cart={cart} currency={currency} subtotal={subtotal} shipping={shipping} region={region} />
      </div>
    </section>
  );
}
