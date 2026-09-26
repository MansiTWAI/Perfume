import { useState } from 'react';
import Seo, { breadcrumbLd, orgLd } from '../components/Seo';
import { PageHero } from '../components/Bits';
import { Reveal } from '../components/Motion';
import { api } from '../lib/api';
import { CONTACT, mapLink, whatsappLink } from '../lib/format';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', topic: 'Product question', message: '' });
  const [state, setState] = useState({ busy: false, done: false, error: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setState({ busy: true, done: false, error: '' });
    try {
      await api('/enquiries', { method: 'POST', body: form });
      setState({ busy: false, done: true, error: '' });
      setForm({ name: '', email: '', phone: '', topic: 'Product question', message: '' });
    } catch (err) {
      setState({ busy: false, done: false, error: err.message });
    }
  }

  return (
    <>
      <Seo title="Contact AL BARAKAH LIFESTYLE | Perfume & Lifestyle Brand India" description="Contact AL BARAKAH LIFESTYLE in Hyderabad for orders, gifting and fragrance questions. WhatsApp +91 91112 79997 or email you@albarakah.me." jsonLd={[orgLd(), breadcrumbLd([['Home', '/'], ['Contact', '/contact']])]} />
      <PageHero eyebrow="Contact" title="We would love to hear from you" layout="split" image="/media/emblem.webp" fit="contain" alt="The AL BARAKAH LIFESTYLE emblem on burgundy stationery" lede="Orders, gifting, wholesale and press. We reply personally from Hyderabad." />
      <section className="section">
        <div className="container contact-grid">
          <Reveal className="contact-info">
            <div>
              <p className="eyebrow">Speak with the house</p>
              <p className="contact-name">{CONTACT.name}</p>
            </div>
            <dl>
              <div><dt>WhatsApp &amp; phone</dt><dd><a href={`tel:+${CONTACT.phoneRaw}`}>{CONTACT.phone}</a></dd></div>
              <div><dt>Email</dt><dd><a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></dd></div>
              <div><dt>Studio</dt><dd><a href={mapLink} target="_blank" rel="noreferrer">{CONTACT.address}</a></dd></div>
              <div><dt>Delivery</dt><dd>Across India and to the United Arab Emirates. Other Gulf countries on request.</dd></div>
            </dl>
            <a className="btn btn-primary" href={whatsappLink('Hello Al Barakah, I have a question.')} target="_blank" rel="noreferrer">Message us on WhatsApp</a>
          </Reveal>
          <Reveal delay={0.1}>
            <form className="form" onSubmit={submit}>
              <div className="form-row">
                <label>Name<input required value={form.name} onChange={set('name')} autoComplete="name" /></label>
                <label>Email<input type="email" required value={form.email} onChange={set('email')} autoComplete="email" /></label>
              </div>
              <div className="form-row">
                <label>Phone (optional)<input value={form.phone} onChange={set('phone')} autoComplete="tel" /></label>
                <label>Topic
                  <select value={form.topic} onChange={set('topic')}>
                    <option>Product question</option>
                    <option>Order &amp; delivery</option>
                    <option>Gifting &amp; corporate orders</option>
                    <option>Middle East delivery</option>
                    <option>Press &amp; collaborations</option>
                  </select>
                </label>
              </div>
              <label>Message<textarea required rows="6" value={form.message} onChange={set('message')} /></label>
              {state.error && <p className="form-error" role="alert">{state.error}</p>}
              {state.done && <p className="form-ok" role="status">Thank you. Your message has reached the house and we will reply soon.</p>}
              <button className="btn btn-primary" disabled={state.busy}>{state.busy ? 'Sending…' : 'Send message'}</button>
            </form>
          </Reveal>
        </div>
      </section>
    </>
  );
}
