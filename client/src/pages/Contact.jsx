import { useState } from 'react';
import Seo, { breadcrumbLd, orgLd } from '../components/Seo';
import { PageHero } from '../components/Bits';
import { Reveal } from '../components/Motion';
import { api } from '../lib/api';
import { CONTACT, mapLink, whatsappLink } from '../lib/format';
import { useStore } from '../context/StoreContext';

const CARD_FILE = '/media/al-barakah-lifestyle-business-card.jpg';
const SITE = `https://${CONTACT.web}`;

// The rows on the card, each with its own link and copy button.
const ROWS = [
  { key: 'phone', label: 'Phone & WhatsApp', value: CONTACT.phone, href: `tel:+${CONTACT.phoneRaw}` },
  { key: 'email', label: 'Email', value: CONTACT.email, href: `mailto:${CONTACT.email}` },
  { key: 'web', label: 'Website', value: CONTACT.web, href: SITE },
  { key: 'address', label: 'Studio', value: CONTACT.address, href: mapLink, external: true },
];

const ALL_DETAILS = [
  'AL BARAKAH LIFESTYLE',
  'Fragrances · Beauty · Lifestyle',
  CONTACT.name,
  CONTACT.phone,
  CONTACT.email,
  CONTACT.web,
  CONTACT.address,
].join('\n');

// vCard 3.0, so the card can be saved straight into a phone's contacts.
function vcard() {
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:Nizam;;;Mrs;',
    `FN:${CONTACT.name}`,
    'ORG:AL BARAKAH LIFESTYLE',
    `TEL;TYPE=CELL,VOICE:+${CONTACT.phoneRaw}`,
    `EMAIL;TYPE=INTERNET:${CONTACT.email}`,
    `URL:${SITE}`,
    'ADR;TYPE=WORK:;;Plot Number 61\\, Friends Colony\\, Jalpally;Hyderabad;Telangana;;India',
    'NOTE:Fragrances · Beauty · Lifestyle. leave your signature',
    'END:VCARD',
  ].join('\r\n');
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers and non-secure pages: a hidden textarea.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
);
const TickIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
);

// The house business card, with every detail one tap from the clipboard,
// the card itself to download, and a contact file for phones.
function BusinessCard() {
  const { toast, t } = useStore();
  const [copied, setCopied] = useState(null);

  const copy = async (key, text, what) => {
    if (await copyText(text)) {
      setCopied(key);
      toast(t('{what} copied', { what: t(what) }));
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 1800);
    } else {
      toast(t('Copying is blocked in this browser. Select the text instead.'), 'warn');
    }
  };

  const saveContact = () => {
    const url = URL.createObjectURL(new Blob([vcard()], { type: 'text/vcard;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'AL-BARAKAH-LIFESTYLE-Mrs-Nizam.vcf' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="bcard">
      <p className="eyebrow">{t('Speak with the house')}</p>
      <a className="bcard-image" href={CARD_FILE} target="_blank" rel="noreferrer" aria-label={t('Open the business card at full size')}>
        <img
          src="/media/business-card.webp"
          srcSet="/media/business-card-800.webp 800w, /media/business-card.webp 1280w"
          sizes="(max-width: 860px) 92vw, 40vw"
          alt="AL BARAKAH LIFESTYLE business card for Mrs Nizam: burgundy and gold with the Arabic calligraphy logo, front and back"
          width="1280"
          height="853"
          loading="lazy"
        />
      </a>
      <p className="contact-name">{CONTACT.name}</p>
      <ul className="bcard-rows">
        {ROWS.map((r) => (
          <li key={r.key}>
            <span className="bcard-label">{t(r.label)}</span>
            <a className="bcard-value" dir="ltr" href={r.href} {...(r.external ? { target: '_blank', rel: 'noreferrer' } : {})}>{r.value}</a>
            <button type="button" className={`bcard-copy ${copied === r.key ? 'is-done' : ''}`} onClick={() => copy(r.key, r.value, r.label)} aria-label={t('Copy {what}', { what: t(r.label) })}>
              {copied === r.key ? <TickIcon /> : <CopyIcon />}
              <span>{t(copied === r.key ? 'Copied' : 'Copy')}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="bcard-actions">
        <button type="button" className="btn btn-ghost bcard-save" onClick={saveContact}>{t('Save to contacts')}</button>
        <button type="button" className="btn btn-ghost" onClick={() => copy('all', ALL_DETAILS, 'All details')}>
          {t(copied === 'all' ? 'Copied' : 'Copy all details')}
        </button>
        <a className="btn btn-ghost" href={CARD_FILE} download="AL-BARAKAH-LIFESTYLE-business-card.jpg">{t('Download card')}</a>
      </div>
    </div>
  );
}

// Topic values stay in English for the house's inbox; only the labels translate.
const TOPICS = ['Product question', 'Order & delivery', 'Gifting & corporate orders', 'Middle East delivery', 'Press & collaborations'];

export default function Contact() {
  const { t } = useStore();
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
      <PageHero eyebrow={t('Contact')} title={t('We would love to hear from you')} layout="split" image="/media/emblem.webp" fit="contain" alt="The AL BARAKAH LIFESTYLE emblem on burgundy stationery" lede={t('Orders, gifting, wholesale and press. We reply personally from Hyderabad.')} />
      <section className="section">
        <div className="container contact-grid">
          <Reveal className="contact-info">
            <BusinessCard />
            <dl>
              <div><dt>{t('Delivery')}</dt><dd>{t('Across India and to the United Arab Emirates. Other Gulf countries on request.')}</dd></div>
            </dl>
            <a className="btn btn-primary" href={whatsappLink(t('Hello Al Barakah, I have a question.'))} target="_blank" rel="noreferrer">{t('Message us on WhatsApp')}</a>
          </Reveal>
          <Reveal delay={0.1}>
            <form className="form" onSubmit={submit}>
              <div className="form-row">
                <label>{t('Name')}<input required value={form.name} onChange={set('name')} autoComplete="name" /></label>
                <label>{t('Email')}<input type="email" dir="ltr" required value={form.email} onChange={set('email')} autoComplete="email" /></label>
              </div>
              <div className="form-row">
                <label>{t('Phone (optional)')}<input type="tel" dir="ltr" value={form.phone} onChange={set('phone')} autoComplete="tel" /></label>
                <label>{t('Topic')}
                  <select value={form.topic} onChange={set('topic')}>
                    {TOPICS.map((x) => <option key={x} value={x}>{t(x)}</option>)}
                  </select>
                </label>
              </div>
              <label>{t('Message')}<textarea required rows="6" value={form.message} onChange={set('message')} /></label>
              {state.error && <p className="form-error" role="alert">{state.error}</p>}
              {state.done && <p className="form-ok" role="status">{t('Thank you. Your message has reached the house and we will reply soon.')}</p>}
              <button className="btn btn-primary" disabled={state.busy}>{t(state.busy ? 'Sending…' : 'Send message')}</button>
            </form>
          </Reveal>
        </div>
      </section>
    </>
  );
}
