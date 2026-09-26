import { Link, useLocation, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Seo from '../components/Seo';
import { useSolidHeader } from '../hooks/useSolidHeader';
import { money, whatsappLink } from '../lib/format';

export default function OrderSuccess() {
  const { orderNumber } = useParams();
  const { state } = useLocation();
  useSolidHeader();
  return (
    <section className="section page-pad success">
      <Seo title="Thank you" />
      <div className="container narrow center">
        <motion.img src="/media/emblem.webp" alt="" width="140" className="emblem-tile" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }} />
        <motion.p className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>Order {orderNumber}</motion.p>
        <motion.h1 className="display-l" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>Your signature is on its way.</motion.h1>
        <p className="section-lede">Thank you. We have received your order and will confirm it shortly by WhatsApp or email.</p>
        {state?.trackingId && (
          <div className="tracking-box">
            <p className="eyebrow">Your tracking ID</p>
            <p className="tracking-id">{state.trackingId}</p>
            {state.total != null && <p className="fine">Order total {money(state.total, state.currency)}</p>}
          </div>
        )}
        <div className="btn-row center-row">
          <Link to={`/track${state?.trackingId ? `?id=${state.trackingId}&email=${encodeURIComponent(state.email || '')}` : ''}`} className="btn btn-primary">Track your order</Link>
          <a href={whatsappLink(`Hello Al Barakah, I just placed order ${orderNumber}.`)} className="btn btn-ghost" target="_blank" rel="noreferrer">Message us on WhatsApp</a>
        </div>
      </div>
    </section>
  );
}
