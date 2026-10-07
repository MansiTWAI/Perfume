import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Seo from '../components/Seo';
import { useSolidHeader } from '../hooks/useSolidHeader';
import { useStore } from '../context/StoreContext';
import { money, whatsappLink } from '../lib/format';
import { payOnline, checkPayment } from '../lib/payments';
import Icon from '../components/Icon';

export default function OrderSuccess() {
  const { orderNumber } = useParams();
  const { state } = useLocation();
  const { lang, t } = useStore();
  useSolidHeader();
  // Online payment: 'paid', or { kind, message } (see lib/payments.js).
  // Older history entries may still hold 'pending' or a plain message.
  const initial = state?.payment;
  const [payment, setPayment] = useState(
    initial === 'pending' ? { kind: 'dismissed' } : typeof initial === 'string' && initial !== 'paid' ? { kind: 'failed', message: initial } : initial || null
  );
  const [paying, setPaying] = useState(false);
  const ids = { orderNumber, email: state?.email };
  async function retry() {
    setPaying(true);
    try {
      setPayment(await payOnline(ids));
    } catch (e) {
      setPayment({ kind: e.kind || 'error', message: e.message });
    } finally {
      setPaying(false);
    }
  }
  // Paid but not yet confirmed: keep checking quietly for up to two minutes
  // (the webhook usually settles it within seconds).
  const confirming = payment?.kind === 'confirming';
  useEffect(() => {
    if (!confirming) return undefined;
    let n = 0;
    const id = setInterval(async () => {
      n += 1;
      try {
        if ((await checkPayment(ids)).paid) setPayment('paid');
      } catch {
        /* try again on the next tick */
      }
      if (n >= 24) clearInterval(id);
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirming]);
  const PAY_TEXT = {
    dismissed: 'Your order is saved, but the payment was not completed.',
    failed: 'The payment did not go through. No money was taken, or it will be returned by your bank.',
    error: 'We could not open the payment window.',
  };
  return (
    <section className="section page-pad success">
      <Seo title="Thank you" />
      <div className="container narrow center">
        <motion.img src="/media/emblem.webp" alt="" width="140" className="emblem-tile" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }} />
        <motion.p className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>{t('Order {n}', { n: orderNumber })}</motion.p>
        <motion.h1 className="display-l" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>{t('Your signature is on its way.')}</motion.h1>
        <p className="section-lede">{t('Thank you. We have received your order and will confirm it shortly by WhatsApp or email.')}</p>
        {payment === 'paid' && <p className="pay-note is-ok" role="status"><Icon name="check" size={16} /> {t('Payment received. Thank you.')}</p>}
        {confirming && (
          <div className="pay-note is-wait" role="status" aria-live="polite">
            <p><span className="pay-spin" aria-hidden="true" />{t('Confirming your payment with Razorpay…')}</p>
            <small>{t('Please do not pay again. This page updates by itself; you can also check your order page later.')}</small>
          </div>
        )}
        {payment?.kind === 'review' && (
          <div className="pay-note" role="alert">
            <p>{payment.message}</p>
            <a href={whatsappLink(t('Hello Al Barakah, about the payment for order {n}.', { n: orderNumber }))} className="btn btn-ghost" target="_blank" rel="noreferrer">{t('Message us on WhatsApp')}</a>
          </div>
        )}
        {payment && ['dismissed', 'failed', 'error'].includes(payment.kind) && (
          <div className="pay-note" role="alert">
            <p>{t(PAY_TEXT[payment.kind])}</p>
            {payment.kind !== 'dismissed' && payment.message && <small>{payment.message}</small>}
            <button className="btn btn-primary" onClick={retry} disabled={paying}>{t(paying ? 'Opening…' : 'Try payment again')}</button>
            <small>{t('You can also pay later from your order page.')}</small>
          </div>
        )}
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
