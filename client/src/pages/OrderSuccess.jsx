import { Link, useLocation, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Seo from '../components/Seo';
import { useSolidHeader } from '../hooks/useSolidHeader';
import { useStore } from '../context/StoreContext';
import { money, whatsappLink } from '../lib/format';

export default function OrderSuccess() {
  const { orderNumber } = useParams();
  const { state } = useLocation();
  const { lang, t } = useStore();
  useSolidHeader();
  return (
    <section className="section page-pad success">
      <Seo title="Thank you" />
      <div className="container narrow center">
        <motion.img src="/media/emblem.webp" alt="" width="140" className="emblem-tile" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }} />
        <motion.p className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>{t('Order {n}', { n: orderNumber })}</motion.p>
        <motion.h1 className="display-l" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>{t('Your signature is on its way.')}</motion.h1>
        <p className="section-lede">{t('Thank you. We have received your order and will confirm it shortly by WhatsApp or email.')}</p>
        {state?.trackingId && (
          <div className="tracking-box">
            <p className="eyebrow">{t('Your tracking ID')}</p>
            <p className="tracking-id" dir="ltr">{state.trackingId}</p>
            {state.total != null && <p className="fine">{t('Order total {amount}', { amount: money(state.total, state.currency, lang) })}</p>}
          </div>
        )}
        <div className="btn-row center-row">
          <Link to={`/track${state?.trackingId ? `?id=${state.trackingId}&email=${encodeURIComponent(state.email || '')}` : ''}`} className="btn btn-primary">{t('Track your order')}</Link>
          <a href={whatsappLink(t('Hello Al Barakah, I just placed order {n}.', { n: orderNumber }))} className="btn btn-ghost" target="_blank" rel="noreferrer">{t('Message us on WhatsApp')}</a>
        </div>
      </div>
    </section>
  );
}
