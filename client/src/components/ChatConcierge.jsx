import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../context/StoreContext';
import { useProducts } from '../hooks/useProducts';
import { api } from '../lib/api';
import { money, whatsappLink, CONTACT } from '../lib/format';
import { Thumb } from './Img';
import Icon from './Icon';
import { ConciergeOptIn } from './WhatsAppUpdates';

// The AI fragrance concierge. Messages go to our server (/api/ai/chat),
// which answers from the live catalogue; this panel only shows the reply and
// the product cards the server sends. Replies are rendered as plain text
// (never as HTML).
const SESSION_KEY = 'ab_chat';
const readSession = () => {
  try {
    return sessionStorage.getItem(SESSION_KEY) || '';
  } catch {
    return '';
  }
};
const saveSession = (id) => {
  try {
    sessionStorage.setItem(SESSION_KEY, id);
  } catch {
    /* private mode: the chat lasts this page view */
  }
};

const PROMPTS = [
  'Help me find my signature scent',
  'A gift under ₹3,000',
  'Compare ZAFREON and ELARISSE',
  'Where is my order?',
];

// **bold**, "- " bullets and site paths (/fragrances/…) as links; nothing else.
function Rich({ text }) {
  const inline = (s, k) =>
    s.split(/(\*\*[^*]+\*\*|\/(?:fragrances|journal|track|contact|faq|shipping-policy|refund-policy|profile\/orders)(?:\/[a-z0-9-]+)?)/g).map((part, i) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) return <b key={`${k}-${i}`}>{part.slice(2, -2)}</b>;
      if (/^\/[a-z]/.test(part)) return <Link key={`${k}-${i}`} to={part} className="cc-link">{part}</Link>;
      return <Fragment key={`${k}-${i}`}>{part}</Fragment>;
    });
  const lines = String(text).split('\n').filter((l) => l.trim());
  const out = [];
  let list = [];
  const flush = () => {
    if (list.length) out.push(<ul key={`ul${out.length}`}>{list}</ul>);
    list = [];
  };
  lines.forEach((l, i) => {
    const m = /^\s*(?:[-•*]|\d+\.)\s+(.*)$/.exec(l);
    if (m) list.push(<li key={i}>{inline(m[1], i)}</li>);
    else {
      flush();
      out.push(<p key={i}>{inline(l, i)}</p>);
    }
  });
  flush();
  return out;
}

const AVAIL = { in_stock: '', only_a_few_left: 'Only a few left', out_of_stock: 'Sold out' };

function ProductCards({ items, onAdd }) {
  const { t, lang } = useStore();
  return (
    <div className="cc-cards" role="list">
      {items.map((p) => (
        <div className="cc-card" role="listitem" key={p.slug}>
          <Thumb src={p.image} width="72" height="90" className="cc-card-img" />
          <div className="cc-card-body">
            <b>{p.name}</b>
            <small>{p.subtitle}</small>
            <span className="cc-price">{typeof p.price === 'number' ? money(p.price, p.currency, lang) : ''}</span>
            {AVAIL[p.availability] && <small className="cc-avail">{t(AVAIL[p.availability])}</small>}
            <div className="cc-card-actions">
              <Link to={`/fragrances/${p.slug}`}>{t('View')}</Link>
              {p.availability !== 'out_of_stock' && <button type="button" onClick={() => onAdd(p)}>{t('Add to bag')}</button>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChatConcierge({ hidden }) {
  const { pathname } = useLocation();
  const { t, region, addToCart, toast, cartOpen } = useStore();
  const { products } = useProducts();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { role: 'user'|'model', text, products?, actions? }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null); // the message to retry
  const sessionRef = useRef(readSession());
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const loaded = useRef(false);

  // Reopening after a page change: bring back this visit's conversation.
  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    if (sessionRef.current) {
      api(`/ai/chat/${encodeURIComponent(sessionRef.current)}`)
        .then((d) => setMessages((m) => (m.length ? m : d.messages)))
        .catch(() => {
          sessionRef.current = '';
        });
    }
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, failed]);

  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    addEventListener('keydown', esc);
    const id = setTimeout(() => inputRef.current?.focus(), 250);
    return () => {
      removeEventListener('keydown', esc);
      clearTimeout(id);
    };
  }, [open]);

  async function send(text) {
    const message = String(text || '').trim();
    if (!message || busy) return;
    setFailed(null);
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: message }]);
    setBusy(true);
    try {
      const d = await api('/ai/chat', { method: 'POST', body: { message, sessionId: sessionRef.current, region: region.code, page: pathname } });
      sessionRef.current = d.sessionId;
      saveSession(d.sessionId);
      setMessages((m) => [...m, { role: 'model', text: d.reply, products: d.products, actions: d.actions }]);
    } catch (e) {
      setMessages((m) => m.slice(0, -1));
      setFailed({ text: message, error: e.status === 429 || e.status === 400 ? e.message : t('The concierge could not answer just now.') });
    } finally {
      setBusy(false);
    }
  }

  const add = (card) => {
    const full = products.find((p) => p.slug === card.slug);
    if (!full) return;
    addToCart(full, 1);
    toast(t('{name} added to your bag', { name: full.name }));
  };

  const handoff = whatsappLink(t('Hello Al Barakah, I was chatting with your concierge and would like some help.'));
  const showLauncher = !hidden && !cartOpen;

  return (
    <>
      <AnimatePresence>
        {showLauncher && !open && (
          <motion.div className="concierge" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.6 } }} exit={{ opacity: 0, y: 20 }}>
            <button type="button" className="concierge-btn cc-launch" onClick={() => setOpen(true)} aria-label={t('Ask our fragrance concierge')} aria-haspopup="dialog">
              <Icon name="chat" size={18} />
              <span className="cc-launch-label">{t('Ask')}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section
            className="cc-panel"
            role="dialog"
            aria-modal="false"
            aria-label={t('Fragrance concierge')}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <header className="cc-head">
              <img src="/media/emblem.webp" alt="" width="38" height="38" />
              <div>
                <h2>{t('The Concierge')}</h2>
                <p>{t('Fragrance advice from the house')}</p>
              </div>
              <button type="button" className="cc-close" onClick={() => setOpen(false)} aria-label={t('Close')}><Icon name="close" /></button>
            </header>

            <div className="cc-list" ref={listRef} aria-live="polite">
              <div className="cc-msg is-model">
                <Rich text={t('Welcome to AL BARAKAH LIFESTYLE. Tell me the moment, the mood or the person, and I will find the fragrance.')} />
              </div>
              {!messages.length && (
                <div className="cc-prompts">
                  {PROMPTS.map((p) => (
                    <button type="button" key={p} onClick={() => send(t(p))}>{t(p)}</button>
                  ))}
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`cc-msg is-${m.role}${m.products?.length ? ' has-cards' : ''}`}>
                  <Rich text={m.text} />
                  {m.products?.length > 0 && <ProductCards items={m.products} onAdd={add} />}
                  {m.actions?.some((a) => a.type === 'whatsapp_optin') && <ConciergeOptIn sessionId={sessionRef.current} />}
                  {m.actions?.some((a) => a.type === 'handoff') && (
                    <div className="cc-handoff">
                      <a href={handoff} target="_blank" rel="noreferrer" className="btn btn-primary">{t('Continue on WhatsApp')}</a>
                      <a href={`mailto:${CONTACT.email}`} className="text-link">{CONTACT.email}</a>
                    </div>
                  )}
                </div>
              ))}
              {busy && (
                <div className="cc-msg is-model cc-typing" aria-label={t('The concierge is writing')}>
                  <span /><span /><span />
                </div>
              )}
              {failed && (
                <div className="cc-error" role="alert">
                  <p>{failed.error}</p>
                  <div>
                    <button type="button" className="text-link" onClick={() => send(failed.text)}>{t('Try again')}</button>
                    <a href={handoff} target="_blank" rel="noreferrer" className="text-link">{t('Message us on WhatsApp')}</a>
                  </div>
                </div>
              )}
            </div>

            <form
              className="cc-form"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <label className="sr-only" htmlFor="cc-input">{t('Your message')}</label>
              <textarea
                id="cc-input"
                ref={inputRef}
                rows={1}
                value={input}
                maxLength={600}
                placeholder={t('Ask about a scent, a gift or an order…')}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <button type="submit" disabled={busy || !input.trim()} aria-label={t('Send')}>
                <Icon name="send" size={18} className="flip-rtl" />
              </button>
            </form>
            <p className="cc-foot">
              {t('AI concierge, it can make mistakes.')} <a href={handoff} target="_blank" rel="noreferrer">{t('Talk to a person')}</a>
            </p>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
