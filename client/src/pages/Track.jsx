import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Seo from '../components/Seo';
import { PageHero } from '../components/Bits';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import { ReviewForm } from '../components/Reviews';
import { useStore } from '../context/StoreContext';

function Lamp({ lit, current, label, date }) {
  return (
    <div className={`lamp ${lit ? 'is-lit' : ''} ${current ? 'is-now' : ''}`}>
      <span className="lamp-flame">
        <svg viewBox="0 0 30 30" aria-hidden="true">
          <path d="M15 3c4 6 6 9 0 16-6-7-4-10 0-16z" />
          <path d="M5 21c4 5 16 5 20 0" fill="none" strokeWidth="1.4" />
        </svg>
      </span>
      <b>{label}</b>
      <small>{date || '—'}</small>
    </div>
  );
}

export default function Track() {
  const [params] = useSearchParams();
  const { t } = useStore();
  const [id, setId] = useState(params.get('id') || '');
  const [email, setEmail] = useState(params.get('email') || '');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviewable, setReviewable] = useState([]);

  async function lookup(e) {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      const o = await api(`/orders/track/${encodeURIComponent(id.trim())}?email=${encodeURIComponent(email.trim())}`);
      setOrder(o);
      // Delivered orders can review each fragrance once.
      setReviewable([]);
      if (o.status === 'Delivered') {
        const r = await api(`/reviews/eligible/${encodeURIComponent(id.trim())}?email=${encodeURIComponent(email.trim())}`).catch(() => null);
        setReviewable((r?.items || []).filter((i) => !i.reviewed));
      }
    } catch (err) {
      setOrder(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (params.get('id') && params.get('email')) lookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const idx = order ? order.stages.indexOf(order.status) : -1;
  const dateFor = (s) => {
    const h = order?.history?.filter((x) => x.status === s).pop();
    return h ? formatDate(h.at) : null;
  };

  return (
    <>
      <Seo title="Track your order" description="Track your AL BARAKAH LIFESTYLE order with your tracking ID and email." />
      <PageHero eyebrow={t('Track your order')} title={t('Follow the lamps home')} layout="split" image="/media/panel-elarisse.webp" alt="ELARISSE beneath ivory arches" lede={t('Enter your tracking ID and the email used at checkout.')} />
      <section className="section">
        <div className="container">
          <form className="form track-form" onSubmit={lookup}>
            <label>{t('Tracking ID')}<input required dir="ltr" value={id} onChange={(e) => setId(e.target.value)} placeholder="ABL…" /></label>
            <label>{t('Email used at checkout')}<input type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <button className="btn btn-primary" disabled={busy}>{t(busy ? 'Finding…' : 'Track')}</button>
          </form>
          {error && <p className="form-error center" role="alert">{error}</p>}
          {order && (
            <motion.div className="track-result" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
              <div className="track-head">
                <div>
                  <p className="eyebrow">{t('Order {n} · to {place}', { n: order.orderNumber, place: `${order.city}, ${t(order.country)}` })}</p>
                  <h2>{t(order.status)}</h2>
                </div>
                <div className="track-meta">
                  {order.eta && <p>{t('Expected:')} <b>{order.eta}</b></p>}
                  {order.carrier && <p>{t('Courier:')} <b>{order.carrier}</b></p>}
                  {order.carrierUrl && <a href={order.carrierUrl} target="_blank" rel="noreferrer" className="text-link">{t('Courier tracking')}</a>}
                </div>
              </div>
              <div className="lamps">
                {order.stages.map((s, i) => (
                  <Lamp key={s} label={t(s)} lit={i <= idx} current={i === idx} date={i <= idx ? dateFor(s) : null} />
                ))}
              </div>
              <ul className="track-items">
                {order.items.map((it) => (
                  <li key={it.name}><img src={it.image} alt="" width="48" height="48" />{it.name} × {it.qty}</li>
                ))}
              </ul>
              {reviewable.length > 0 && (
                <div className="track-reviews">
                  {reviewable.map((it) => (
                    <ReviewForm key={it.slug} trackingId={id.trim()} email={email.trim()} item={it} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </section>
    </>
  );
}
